-- How rare an elephant really is, for the share card ("Only 3% of meadows
-- raise one"). Anonymous on purpose: no owner, no device, no score. A
-- finished run reports only whether it raised an elephant, under the rules
-- version it was played on, so a rules change starts a fresh count.
create schema if not exists bioconnect_private;
revoke all on schema bioconnect_private from public, anon, authenticated;

create table bioconnect_private.run_outcomes (
  run_id uuid primary key,
  rules integer not null check (rules between 1 and 10000),
  elephant boolean not null default false,
  ticks integer not null default 0 check (ticks >= 0),
  at timestamptz not null default now()
);
alter table bioconnect_private.run_outcomes enable row level security;

-- A revived run ends twice under one id; an elephant from either ending counts.
create or replace function public.bioconnect_record_run(p_run uuid, p_rules integer, p_elephant boolean, p_ticks integer)
returns void language sql security definer set search_path = '' as $$
  insert into bioconnect_private.run_outcomes as o (run_id, rules, elephant, ticks)
  select p_run, p_rules, coalesce(p_elephant, false), least(greatest(coalesce(p_ticks, 0), 0), 1000000)
  where p_run is not null and p_rules between 1 and 10000
  on conflict (run_id) do update set
    elephant = o.elephant or excluded.elephant,
    ticks = greatest(o.ticks, excluded.ticks);
$$;

-- Only the two totals ever leave the table. Runs that ended almost at once
-- (a tap-through, a reload) are not a meadow anyone played.
create or replace function public.bioconnect_elephant_rate(p_rules integer)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('runs', count(*), 'elephants', count(*) filter (where elephant))
  from bioconnect_private.run_outcomes where rules = p_rules and ticks >= 10;
$$;

revoke all on function public.bioconnect_record_run(uuid,integer,boolean,integer),
  public.bioconnect_elephant_rate(integer) from public, anon, authenticated;
grant execute on function public.bioconnect_record_run(uuid,integer,boolean,integer),
  public.bioconnect_elephant_rate(integer) to anon, authenticated;
