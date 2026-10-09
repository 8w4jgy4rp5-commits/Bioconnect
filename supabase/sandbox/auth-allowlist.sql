-- Sandbox ONLY. Populate permitted addresses through the TEST SQL Editor.
-- Do not commit a person's address or put the allowlist in a browser config.
create table bioconnect_private.sandbox_login_allowlist (
  email text primary key check (email = lower(email) and length(email) > 0),
  active boolean not null default true
);
alter table bioconnect_private.sandbox_login_allowlist enable row level security;
revoke all on bioconnect_private.sandbox_login_allowlist from public, anon, authenticated;
grant usage on schema bioconnect_private to supabase_auth_admin;
grant select on bioconnect_private.sandbox_login_allowlist to supabase_auth_admin;
create policy sandbox_auth_read_allowlist on bioconnect_private.sandbox_login_allowlist
  for select to supabase_auth_admin using (true);
create function public.bioconnect_sandbox_before_user_created(event jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare email_address text := lower(event->'user'->>'email');
begin
  if email_address is null or coalesce((event->'user'->>'is_anonymous')::boolean, false)
    or not exists (select 1 from bioconnect_private.sandbox_login_allowlist
      where email=email_address and active) then
    return jsonb_build_object('error',jsonb_build_object('http_code',403,
      'message','This sandbox is restricted to its owner.'));
  end if;
  return '{}'::jsonb;
end $$;
revoke all on function public.bioconnect_sandbox_before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.bioconnect_sandbox_before_user_created(jsonb) to supabase_auth_admin;
