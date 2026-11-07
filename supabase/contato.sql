-- Rota TEA: mensagens do formulário Fale conosco
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null,
  nome text not null check (char_length(nome) between 2 and 120),
  email text not null check (char_length(email) between 5 and 200),
  whatsapp text not null default '' check (char_length(whatsapp) <= 30),
  assunto text not null check (char_length(assunto) between 2 and 120),
  mensagem text not null check (char_length(mensagem) between 5 and 4000),
  status text not null default 'nova' check (status in ('nova','respondida','arquivada')),
  notas text not null default '' check (char_length(notas) <= 4000),
  updated_at timestamptz not null default now()
);
create index if not exists contact_messages_created on public.contact_messages (created_at desc);
alter table public.contact_messages enable row level security;

drop policy if exists "contact_insert_public" on public.contact_messages;
drop policy if exists "contact_admin_select" on public.contact_messages;
drop policy if exists "contact_admin_update" on public.contact_messages;
drop policy if exists "contact_admin_delete" on public.contact_messages;
create policy "contact_insert_public" on public.contact_messages for insert to anon, authenticated
  with check (status = 'nova' and notas = '' and (user_id is null or user_id = (select auth.uid())));
create policy "contact_admin_select" on public.contact_messages for select to authenticated using ((select public.is_admin()));
create policy "contact_admin_update" on public.contact_messages for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "contact_admin_delete" on public.contact_messages for delete to authenticated using ((select public.is_admin()));

revoke all on public.contact_messages from anon, authenticated;
grant insert on public.contact_messages to anon, authenticated;
grant select, update, delete on public.contact_messages to authenticated;
