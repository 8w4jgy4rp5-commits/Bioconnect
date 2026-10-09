-- New, empty bioconnect-sandbox project ONLY. Not a production schema migration.
-- owner_id is the authenticated Supabase user; money never lives in this table.
create table public.user_app_data (
  owner_id uuid not null references auth.users(id) on delete cascade,
  app_slug text not null,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (owner_id, app_slug, key)
);
alter table public.user_app_data enable row level security;
revoke all on public.user_app_data from public, anon, authenticated;
grant select, insert, update on public.user_app_data to authenticated;
create policy bioconnect_records_read on public.user_app_data for select to authenticated
  using (owner_id = (select auth.uid()) and app_slug = 'ecosystem-puzzle' and key in ('score','met'));
create policy bioconnect_records_insert on public.user_app_data for insert to authenticated
  with check (owner_id = (select auth.uid()) and app_slug = 'ecosystem-puzzle' and key in ('score','met'));
create policy bioconnect_records_update on public.user_app_data for update to authenticated
  using (owner_id = (select auth.uid()) and app_slug = 'ecosystem-puzzle' and key in ('score','met'))
  with check (owner_id = (select auth.uid()) and app_slug = 'ecosystem-puzzle' and key in ('score','met'));
