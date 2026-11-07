-- Rota TEA: cadastro, checklist e documentos das famílias
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  checklist jsonb not null default '{}'::jsonb,
  accepted_terms_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text not null check (type in ('pedido','revisao','ouvidoria','ans','ficha')),
  title text not null default '',
  status text not null default 'rascunho' check (status in ('rascunho','pronto','enviado','respondido')),
  fields jsonb not null default '{}'::jsonb,
  rows jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint documents_size check (pg_column_size(fields) + pg_column_size(rows) < 500000)
);
create index if not exists documents_user_updated on public.documents (user_id, updated_at desc);

alter table public.profiles enable row level security;
alter table public.documents enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists "documents_select_own" on public.documents;
drop policy if exists "documents_insert_own" on public.documents;
drop policy if exists "documents_update_own" on public.documents;
drop policy if exists "documents_delete_own" on public.documents;
create policy "documents_select_own" on public.documents for select to authenticated using (user_id = (select auth.uid()));
create policy "documents_insert_own" on public.documents for insert to authenticated with check (user_id = (select auth.uid()));
create policy "documents_update_own" on public.documents for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "documents_delete_own" on public.documents for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.profiles, public.documents from anon;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.documents to authenticated;

-- cria o perfil automaticamente no cadastro
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, data, accepted_terms_at)
  values (new.id,
          jsonb_build_object('responsavel_nome', coalesce(new.raw_user_meta_data->>'nome',''), 'responsavel_contato', new.email),
          now())
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- permite que a própria pessoa exclua a conta e todos os dados (LGPD)
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
