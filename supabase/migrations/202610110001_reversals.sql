-- Refunds and chargebacks take back what the order granted. Apply after 202610050001.
-- Policy (2026-10-11): Crystals are subtracted but never below 0; No Ads is revoked;
-- the account stays usable and may buy again.
alter table bioconnect_private.orders add column reversed boolean not null default false;
alter table bioconnect_private.orders add column reversal_reason text
  check (reversal_reason in ('refund','dispute'));

-- Called only after signature validation AND Stripe API retrieval of the refund/dispute.
create function public.bioconnect_reverse(p_order uuid, p_owner uuid, p_session text,
  p_event text, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare o bioconnect_private.orders; units integer;
begin
  if p_reason is null or p_reason not in ('refund','dispute') or p_session is null or p_event is null
    then raise exception 'Invalid reversal'; end if;
  select * into o from bioconnect_private.orders where id=p_order for update;
  if o.id is null or o.owner_id is distinct from p_owner then raise exception 'Order mismatch'; end if;
  if o.stripe_session is not null and o.stripe_session <> p_session then raise exception 'Session mismatch'; end if;
  -- A refund and a dispute on the same payment, or repeated notices, take back once.
  if o.reversed then return; end if;
  insert into bioconnect_private.payment_events(event_id,order_id) values(p_event,p_order)
    on conflict (event_id) do nothing;
  if o.paid then
    insert into bioconnect_private.accounts(owner_id) values(o.owner_id) on conflict do nothing;
    perform 1 from bioconnect_private.accounts where owner_id=o.owner_id for update;
    units := case o.sku when 'crystals5' then 5 when 'crystals11' then 11
      when 'crystals30' then 30 when 'crystals65' then 65 else 0 end;
    update bioconnect_private.accounts set crystals=greatest(crystals-units,0) where owner_id=o.owner_id;
    if o.sku='no_ads' then
      -- Keep No Ads only if another paid, unreversed No Ads order exists.
      update bioconnect_private.accounts set no_ads=exists(select 1 from bioconnect_private.orders
        where owner_id=o.owner_id and sku='no_ads' and paid and not reversed and id<>o.id)
        where owner_id=o.owner_id;
    end if;
  end if;
  -- An out-of-order notice before fulfillment marks the order so it never grants later.
  update bioconnect_private.orders set reversed=true,reversal_reason=p_reason,
    stripe_session=p_session where id=p_order;
end $$;

-- Same as 202610050001, plus: a reversed order never grants.
create or replace function public.bioconnect_fulfill(p_order uuid, p_owner uuid, p_session text,
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
  if o.paid or o.reversed then return; end if;
  -- Even different event IDs for the same Checkout session grant once.
  insert into bioconnect_private.payment_events(event_id,order_id) values(p_event,p_order);
  units := case o.sku when 'crystals5' then 5 when 'crystals11' then 11
    when 'crystals30' then 30 when 'crystals65' then 65 else 0 end;
  update bioconnect_private.accounts set crystals=crystals+units,
    no_ads=no_ads or o.sku='no_ads' where owner_id=o.owner_id;
  update bioconnect_private.orders set paid=true,stripe_session=p_session where id=p_order;
end $$;

-- Same as 202610050001, plus: a reversed checkout is never shared with another device.
create or replace function public.bioconnect_order(p_owner uuid, p_request uuid, p_sku text) returns jsonb
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
      and not paid and not reversed and created_at > now() - interval '23 hours' order by created_at desc limit 1;
  end if;
  if o.id is null then
    insert into bioconnect_private.orders(owner_id,request_id,sku) values(p_owner,p_request,p_sku) returning * into o;
  end if;
  return to_jsonb(o);
end $$;

revoke all on function public.bioconnect_reverse(uuid,uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.bioconnect_reverse(uuid,uuid,text,text,text) to service_role;
