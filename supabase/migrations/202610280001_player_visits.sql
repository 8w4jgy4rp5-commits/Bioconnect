-- Where real players come from. A visit is counted only once the visitor
-- places a first tile, so crawlers and people who only opened the page are
-- left out. Anonymous on purpose: no owner, no device, no IP. Each row is
-- one page load: where it came from, whether this browser had played
-- before, and the browser's language tag (en-IN, en-US, ...).
create schema if not exists bioconnect_private;
revoke all on schema bioconnect_private from public, anon, authenticated;

create table bioconnect_private.player_visits (
  visit_id uuid primary key,
  source text not null check (source ~ '^[a-z0-9.-]{1,40}$'),
  repeat_player boolean not null default false,
  lang text check (lang ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})?$'),
  at timestamptz not null default now()
);
alter table bioconnect_private.player_visits enable row level security;

-- Anything that does not look like a source or a language tag is stored as
-- 'other' / null instead of being rejected, so a bad value never loses the visit.
create or replace function public.bioconnect_record_visit(p_visit uuid, p_source text, p_returning boolean, p_lang text)
returns void language sql security definer set search_path = '' as $$
  insert into bioconnect_private.player_visits (visit_id, source, repeat_player, lang)
  select p_visit,
    case when lower(p_source) ~ '^[a-z0-9.-]{1,40}$' then lower(p_source) else 'other' end,
    coalesce(p_returning, false),
    case when p_lang ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})?$' then p_lang end
  where p_visit is not null
  on conflict (visit_id) do nothing;
$$;

revoke all on function public.bioconnect_record_visit(uuid,text,boolean,text) from public, anon, authenticated;
grant execute on function public.bioconnect_record_visit(uuid,text,boolean,text) to anon, authenticated;

-- For reading in the SQL Editor only (visitors cannot see it):
--   select * from bioconnect_private.player_visits_daily limit 60;
create or replace view bioconnect_private.player_visits_daily as
  select (at at time zone 'Asia/Tokyo')::date as day, source,
    count(*) as players,
    count(*) filter (where not repeat_player) as first_time,
    string_agg(distinct lang, ' ') as langs
  from bioconnect_private.player_visits
  group by 1, 2
  order by 1 desc, 3 desc;
