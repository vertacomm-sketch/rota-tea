-- Rota TEA: estatísticas anônimas de acesso (sem IP, sem dados pessoais)
create table if not exists public.page_views (
  id bigserial primary key,
  at timestamptz not null default now(),
  sid text not null check (char_length(sid) between 6 and 40),
  page text not null check (char_length(page) between 2 and 30),
  source text not null default 'direto' check (char_length(source) <= 30),
  device text not null default 'computador' check (device in ('celular','tablet','computador')),
  logged boolean not null default false,
  city text not null default '' check (char_length(city) <= 80),
  region text not null default '' check (char_length(region) <= 10),
  country text not null default '' check (char_length(country) <= 4)
);
create index if not exists page_views_at on public.page_views (at desc);
alter table public.page_views enable row level security;
revoke all on public.page_views from anon, authenticated;
drop policy if exists "pv_admin_select" on public.page_views;
create policy "pv_admin_select" on public.page_views for select to authenticated using ((select public.is_admin()));
grant select on public.page_views to authenticated;
revoke all on sequence public.page_views_id_seq from anon, authenticated;

create or replace function public.log_hit(p_sid text, p_page text, p_source text, p_device text, p_logged boolean, p_city text, p_region text, p_country text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_page not in ('inicio','guia','mapa','base','fontes','contato','entrar','painel','documentos','modelos','checklist','cadastro','editor') then return; end if;
  if p_sid is null or char_length(p_sid) not between 6 and 40 then return; end if;
  insert into public.page_views (sid, page, source, device, logged, city, region, country)
  values (p_sid, p_page, left(coalesce(nullif(p_source,''),'direto'),30),
          case when p_device in ('celular','tablet','computador') then p_device else 'computador' end,
          coalesce(p_logged,false), left(coalesce(p_city,''),80), left(coalesce(p_region,''),10), left(coalesce(p_country,''),4));
end $$;
revoke all on function public.log_hit(text,text,text,text,boolean,text,text,text) from public;
grant execute on function public.log_hit(text,text,text,text,boolean,text,text,text) to anon, authenticated;

create or replace function public.admin_stats(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare since timestamptz; r jsonb;
begin
  if not public.is_admin() then raise exception 'acesso negado'; end if;
  p_days := greatest(1, least(coalesce(p_days,30), 366));
  since := date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo' - make_interval(days => p_days - 1);
  with v as (select * from public.page_views where at >= since)
  select jsonb_build_object(
    'days', p_days,
    'views', (select count(*) from v),
    'visits', (select count(distinct sid) from v),
    'logged_visits', (select count(distinct sid) from v where logged),
    'signups', (select count(*) from public.profiles where created_at >= since),
    'by_day', coalesce((select jsonb_agg(jsonb_build_object('d', d, 'views', n, 'visits', s) order by d) from (
        select (at at time zone 'America/Sao_Paulo')::date d, count(*) n, count(distinct sid) s from v group by 1) x), '[]'),
    'pages', coalesce((select jsonb_agg(jsonb_build_object('k', page, 'n', n) order by n desc) from (
        select page, count(*) n from v group by 1 order by 2 desc limit 15) x), '[]'),
    'cities', coalesce((select jsonb_agg(jsonb_build_object('k', city, 'r', region, 'c', country, 'n', n) order by n desc) from (
        select city, region, country, count(distinct sid) n from v where city <> '' group by 1,2,3 order by 4 desc limit 20) x), '[]'),
    'states', coalesce((select jsonb_agg(jsonb_build_object('k', region, 'n', n) order by n desc) from (
        select region, count(distinct sid) n from v where country = 'BR' and region <> '' group by 1 order by 2 desc limit 27) x), '[]'),
    'countries', coalesce((select jsonb_agg(jsonb_build_object('k', country, 'n', n) order by n desc) from (
        select country, count(distinct sid) n from v where country <> '' group by 1 order by 2 desc limit 10) x), '[]'),
    'sources', coalesce((select jsonb_agg(jsonb_build_object('k', source, 'n', n) order by n desc) from (
        select source, count(*) n from (select distinct on (sid) sid, source from v order by sid, at) f group by 1 order by 2 desc limit 10) x), '[]'),
    'devices', coalesce((select jsonb_agg(jsonb_build_object('k', device, 'n', n) order by n desc) from (
        select device, count(distinct sid) n from v group by 1 order by 2 desc) x), '[]')
  ) into r;
  return r;
end $$;
revoke all on function public.admin_stats(int) from public, anon;
grant execute on function public.admin_stats(int) to authenticated;
