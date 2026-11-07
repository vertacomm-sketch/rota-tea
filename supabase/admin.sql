-- Rota TEA: administração da plataforma
alter table public.profiles add column if not exists email text;
update public.profiles p set email = u.email from auth.users u where u.id = p.id and p.email is null;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, data, accepted_terms_at)
  values (new.id, new.email,
          jsonb_build_object('responsavel_nome', coalesce(new.raw_user_meta_data->>'nome',''), 'responsavel_contato', new.email),
          now())
  on conflict (id) do nothing;
  return new;
end $$;

create table if not exists public.admins (
  email text primary key,
  added_at timestamptz not null default now(),
  added_by text
);
alter table public.admins enable row level security;
insert into public.admins (email, added_by) values ('vertacomm@gmail.com', 'instalacao') on conflict do nothing;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins a where a.email = lower(coalesce(auth.jwt()->>'email','')));
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "admins_read" on public.admins;
create policy "admins_read" on public.admins for select to authenticated using ((select public.is_admin()));
grant select on public.admins to authenticated;

drop policy if exists "profiles_admin_select" on public.profiles;
create policy "profiles_admin_select" on public.profiles for select to authenticated using ((select public.is_admin()));
drop policy if exists "documents_admin_select" on public.documents;
create policy "documents_admin_select" on public.documents for select to authenticated using ((select public.is_admin()));

-- registro de acessos e ações da administração
create table if not exists public.admin_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  admin_email text not null default lower(coalesce(auth.jwt()->>'email','')),
  action text not null,
  target_user uuid,
  target_email text,
  target_doc uuid,
  detail text
);
alter table public.admin_log enable row level security;
drop policy if exists "admin_log_read" on public.admin_log;
drop policy if exists "admin_log_insert" on public.admin_log;
create policy "admin_log_read" on public.admin_log for select to authenticated using ((select public.is_admin()));
create policy "admin_log_insert" on public.admin_log for insert to authenticated
  with check ((select public.is_admin()) and admin_email = lower(coalesce(auth.jwt()->>'email','')));
grant select, insert on public.admin_log to authenticated;

create or replace function public.admin_list_users()
returns table (id uuid, email text, nome text, created_at timestamptz, last_sign_in_at timestamptz,
               email_confirmed_at timestamptz, blocked boolean, docs bigint, is_admin boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'acesso negado'; end if;
  return query
    select u.id, u.email::text,
           coalesce(p.data->>'responsavel_nome', u.raw_user_meta_data->>'nome', '')::text,
           u.created_at, u.last_sign_in_at, u.email_confirmed_at,
           (u.banned_until is not null and u.banned_until > now()),
           (select count(*) from public.documents d where d.user_id = u.id),
           exists (select 1 from public.admins a where a.email = lower(u.email))
    from auth.users u left join public.profiles p on p.id = u.id
    order by u.created_at desc;
end $$;

create or replace function public.admin_set_blocked(target uuid, blocked boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare em text;
begin
  if not public.is_admin() then raise exception 'acesso negado'; end if;
  if target = auth.uid() then raise exception 'voce nao pode bloquear a propria conta'; end if;
  update auth.users set banned_until = case when blocked then 'infinity'::timestamptz else null end
    where id = target returning email into em;
  if blocked then delete from auth.sessions where user_id = target; end if;
  insert into public.admin_log (admin_email, action, target_user, target_email)
    values (lower(auth.jwt()->>'email'), case when blocked then 'bloqueou usuario' else 'desbloqueou usuario' end, target, em);
end $$;

create or replace function public.admin_delete_user(target uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare em text;
begin
  if not public.is_admin() then raise exception 'acesso negado'; end if;
  if target = auth.uid() then raise exception 'voce nao pode excluir a propria conta por aqui'; end if;
  select email into em from auth.users where id = target;
  delete from public.admins where email = lower(em);
  delete from auth.users where id = target;
  insert into public.admin_log (admin_email, action, target_user, target_email)
    values (lower(auth.jwt()->>'email'), 'excluiu usuario', target, em);
end $$;

create or replace function public.admin_set_admin(target_email text, make_admin boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'acesso negado'; end if;
  if make_admin then
    insert into public.admins (email, added_by) values (lower(trim(target_email)), lower(auth.jwt()->>'email')) on conflict do nothing;
  else
    if lower(trim(target_email)) = lower(auth.jwt()->>'email') then raise exception 'voce nao pode remover o proprio acesso'; end if;
    delete from public.admins where email = lower(trim(target_email));
  end if;
  insert into public.admin_log (admin_email, action, target_email)
    values (lower(auth.jwt()->>'email'), case when make_admin then 'deu acesso de administrador' else 'removeu acesso de administrador' end, lower(trim(target_email)));
end $$;

revoke all on function public.admin_list_users() from public, anon;
revoke all on function public.admin_set_blocked(uuid, boolean) from public, anon;
revoke all on function public.admin_delete_user(uuid) from public, anon;
revoke all on function public.admin_set_admin(text, boolean) from public, anon;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_set_blocked(uuid, boolean) to authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;
grant execute on function public.admin_set_admin(text, boolean) to authenticated;
