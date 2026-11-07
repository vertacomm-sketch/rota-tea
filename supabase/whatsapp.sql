-- Rota TEA: WhatsApp no cadastro
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, data, accepted_terms_at)
  values (new.id, new.email,
          jsonb_build_object(
            'responsavel_nome', coalesce(new.raw_user_meta_data->>'nome',''),
            'responsavel_contato', new.email,
            'whatsapp', coalesce(new.raw_user_meta_data->>'whatsapp','')),
          now())
  on conflict (id) do nothing;
  return new;
end $$;

drop function if exists public.admin_list_users();
create function public.admin_list_users()
returns table (id uuid, email text, nome text, whatsapp text, created_at timestamptz, last_sign_in_at timestamptz,
               email_confirmed_at timestamptz, blocked boolean, docs bigint, is_admin boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'acesso negado'; end if;
  return query
    select u.id, u.email::text,
           coalesce(nullif(p.data->>'responsavel_nome',''), u.raw_user_meta_data->>'nome', '')::text,
           coalesce(nullif(p.data->>'whatsapp',''), u.raw_user_meta_data->>'whatsapp', '')::text,
           u.created_at, u.last_sign_in_at, u.email_confirmed_at,
           (u.banned_until is not null and u.banned_until > now()),
           (select count(*) from public.documents d where d.user_id = u.id),
           exists (select 1 from public.admins a where a.email = lower(u.email))
    from auth.users u left join public.profiles p on p.id = u.id
    order by u.created_at desc;
end $$;
revoke all on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;
