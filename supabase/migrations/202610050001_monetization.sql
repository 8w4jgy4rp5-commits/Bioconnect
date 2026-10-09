-- Money and entitlements never use user_app_data. Apply in a TEST project first.
create schema if not exists bioconnect_private;
revoke all on schema bioconnect_private from public, anon, authenticated;

create table bioconnect_private.accounts (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  crystals integer not null default 0 check (crystals >= 0),
  welcome_claimed boolean not null default false,
  no_ads boolean not null default false,
  free_day date
);
create table bioconnect_private.revivals (
  owner_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid not null,
  source text not null check (source in ('crystal','daily')),
  created_at timestamptz not null default now(),
  primary key (owner_id, run_id)
);
create table bioconnect_private.orders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  sku text not null check (sku in ('crystals5','crystals11','crystals30','crystals65','no_ads')),
  stripe_session text unique,
  paid boolean not null default false,
  created_at timestamptz not null default now(),
  unique (owner_id, request_id)
);
create table bioconnect_private.payment_events (
  event_id text primary key,
  order_id uuid not null references bioconnect_private.orders(id),
  created_at timestamptz not null default now()
);
-- Defense in depth: no browser role has table privileges or policies.
alter table bioconnect_private.accounts enable row level security;
alter table bioconnect_private.revivals enable row level security;
alter table bioconnect_private.orders enable row level security;
alter table bioconnect_private.payment_events enable row level security;
revoke all on all tables in schema bioconnect_private from public, anon, authenticated;

-- Subtract four hours AFTER converting to wall time: correct on DST days.
create function bioconnect_private.revival_day(t timestamptz) returns date
language sql stable set search_path = '' as $$
  select ((t at time zone 'America/New_York') - interval '4 hours')::date
$$;
create function bioconnect_private.wallet(u uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('crystals', crystals, 'welcome_claimed', welcome_claimed,
    'no_ads', no_ads, 'daily_available', no_ads and free_day is distinct from bioconnect_private.revival_day(now()),
    'revival_day', bioconnect_private.revival_day(now()))
  from bioconnect_private.accounts where owner_id = u
$$;
create function public.bioconnect_wallet() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'Sign in required'; end if;
  insert into bioconnect_private.accounts(owner_id) values(u) on conflict do nothing;
  return bioconnect_private.wallet(u);
end $$;
create function public.bioconnect_claim_welcome() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'Sign in required'; end if;
  insert into bioconnect_private.accounts(owner_id) values(u) on conflict do nothing;
  update bioconnect_private.accounts set crystals = crystals + 3, welcome_claimed = true
    where owner_id = u and not welcome_claimed;
  return bioconnect_private.wallet(u);
end $$;
create function public.bioconnect_order_status(p_order uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); o bioconnect_private.orders;
begin
  if u is null then raise exception 'Sign in required'; end if;
  select * into o from bioconnect_private.orders where owner_id=u and id=p_order;
  if o.id is null then raise exception 'Order unavailable'; end if;
  return jsonb_build_object('paid',o.paid);
end $$;
create function public.bioconnect_revive(p_run_id uuid, p_source text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); a bioconnect_private.accounts; used text; d date;
begin
  if u is null then raise exception 'Sign in required'; end if;
  if p_run_id is null or p_source not in ('crystal','daily') or p_source is null then
    raise exception 'Invalid revival'; end if;
  insert into bioconnect_private.accounts(owner_id) values(u) on conflict do nothing;
  select * into a from bioconnect_private.accounts where owner_id = u for update;
  select source into used from bioconnect_private.revivals where owner_id = u and run_id = p_run_id;
  if used is not null then
    return jsonb_build_object('source', used, 'wallet', bioconnect_private.wallet(u));
  end if;
  d := bioconnect_private.revival_day(now());
  if p_source = 'daily' then
    if not a.no_ads or a.free_day = d then raise exception 'Daily revival unavailable'; end if;
    update bioconnect_private.accounts set free_day = d where owner_id = u;
  else
    if a.crystals < 1 then raise exception 'Not enough crystals'; end if;
    update bioconnect_private.accounts set crystals = crystals - 1 where owner_id = u;
  end if;
  insert into bioconnect_private.revivals(owner_id,run_id,source) values(u,p_run_id,p_source);
  return jsonb_build_object('source', p_source, 'wallet', bioconnect_private.wallet(u));
end $$;

-- Server-only order creation. The owner is from a verified JWT, never request JSON.
create function public.bioconnect_order(p_owner uuid, p_request uuid, p_sku text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare o bioconnect_private.orders; a bioconnect_private.accounts;
begin
  if p_owner is null or p_request is null or p_sku is null or p_sku not in
    ('crystals5','crystals11','crystals30','crystals65','no_ads') then raise exception 'Invalid order'; end if;
  insert into bioconnect_private.accounts(owner_id) values(p_owner) on conflict do nothing;
  select * into a from bioconnect_private.accounts where owner_id=p_owner for update;
  if p_sku='no_ads' and a.no_ads then raise exception 'Already owned'; end if;
  select * into o from bioconnect_private.orders where owner_id=p_owner and request_id=p_request;
  if o.id is not null and o.sku <> p_sku then raise exception 'Request already used'; end if;
  if o.id is null and p_sku='no_ads' then
    -- Different tabs/devices must share the active one-time checkout as well.
    select * into o from bioconnect_private.orders where owner_id=p_owner and sku='no_ads'
      and not paid and created_at > now() - interval '23 hours' order by created_at desc limit 1;
  end if;
  if o.id is null then
    insert into bioconnect_private.orders(owner_id,request_id,sku) values(p_owner,p_request,p_sku) returning * into o;
  end if;
  return to_jsonb(o);
end $$;

-- Called only after signature validation AND Stripe API retrieval of a PAID session.
create function public.bioconnect_fulfill(p_order uuid, p_owner uuid, p_session text,
  p_event text, p_sku text, p_amount integer, p_currency text) returns void
language plpgsql security definer set search_path = '' as $$
declare o bioconnect_private.orders; units integer; amount integer;
begin
  select * into o from bioconnect_private.orders where id=p_order for update;
  if o.id is null or o.owner_id is distinct from p_owner or o.sku is distinct from p_sku then raise exception 'Order mismatch'; end if;
  amount := case o.sku when 'crystals5' then 100 when 'crystals11' then 200
    when 'crystals30' then 500 when 'crystals65' then 1000 when 'no_ads' then 300 end;
  if p_amount is distinct from amount or p_currency is distinct from 'usd' or
    p_session is null or p_event is null then raise exception 'Payment mismatch'; end if;
  if o.stripe_session is not null and o.stripe_session <> p_session then raise exception 'Session mismatch'; end if;
  if o.paid then return; end if;
  -- Even different event IDs for the same Checkout session grant once.
  insert into bioconnect_private.payment_events(event_id,order_id) values(p_event,p_order);
  units := case o.sku when 'crystals5' then 5 when 'crystals11' then 11
    when 'crystals30' then 30 when 'crystals65' then 65 else 0 end;
  update bioconnect_private.accounts set crystals=crystals+units,
    no_ads=no_ads or o.sku='no_ads' where owner_id=o.owner_id;
  update bioconnect_private.orders set paid=true,stripe_session=p_session where id=p_order;
end $$;

revoke all on all functions in schema bioconnect_private from public, anon, authenticated;
revoke all on function public.bioconnect_wallet(), public.bioconnect_claim_welcome(), public.bioconnect_order_status(uuid),
  public.bioconnect_revive(uuid,text), public.bioconnect_order(uuid,uuid,text),
  public.bioconnect_fulfill(uuid,uuid,text,text,text,integer,text) from public, anon, authenticated;
grant execute on function public.bioconnect_wallet(), public.bioconnect_claim_welcome(), public.bioconnect_order_status(uuid),
  public.bioconnect_revive(uuid,text) to authenticated;
grant execute on function public.bioconnect_order(uuid,uuid,text),
  public.bioconnect_fulfill(uuid,uuid,text,text,text,integer,text) to service_role;
