-- The part of Supabase that must exist BEFORE our migration runs.
--
-- RLS is the part of this schema that is easy to get subtly wrong and almost
-- impossible to review by reading: a policy that is too permissive looks
-- exactly like one that is correct. So the policies are *executed* here, as
-- three different callers, against a real Postgres.
--
-- What Supabase provides and this file stands in for:
--
--   auth.users        the table profiles references
--   auth.uid()        the signed-in user, read out of the request's JWT claims
--   anon/authenticated  the two roles PostgREST connects as
--
-- The real auth.uid() reads `request.jwt.claims`, a per-transaction setting
-- PostgREST writes from the caller's token. Setting that GUC is exactly how a
-- test chooses who is calling, so the emulation is faithful where it matters
-- and absent everywhere else.

create extension if not exists "pgcrypto";
create schema if not exists auth;
create schema if not exists test;

-- `raw_user_meta_data` is here because the real table has it: a client can
-- attach arbitrary JSON to a signup. 0004 deliberately ignores it, and a stub
-- without the column would make that decision untestable — the trigger would
-- pass by virtue of the column not existing.
create table if not exists auth.users (
  id                  uuid primary key default gen_random_uuid(),
  email               text unique,
  raw_user_meta_data  jsonb
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $fn$
  select nullif(
    coalesce(
      current_setting('request.jwt.claim.sub', true),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    ),
    ''
  )::uuid
$fn$;

-- The two roles PostgREST uses. Both are NOBYPASSRLS, which is the entire
-- point: a superuser ignores every policy in the migration and would make
-- these tests pass no matter what the policies said.
do $do$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit nobypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit nobypassrls;
  end if;
end
$do$;

-- Become a visitor with no account.
create or replace procedure test.as_anon()
language plpgsql as $p$
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
end;
$p$;

-- Become a signed-in user.
create or replace procedure test.as_user(p_id uuid)
language plpgsql as $p$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_id)::text, true);
  execute 'set local role authenticated';
end;
$p$;

-- Back to the migration owner, who bypasses RLS — used only to build fixtures.
create or replace procedure test.as_owner()
language plpgsql as $p$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end;
$p$;

create table if not exists test.results (
  n      serial primary key,
  ok     boolean not null,
  what   text not null,
  detail text
);

create or replace procedure test.check(p_ok boolean, p_what text, p_detail text default null)
language plpgsql as $p$
begin
  insert into test.results (ok, what, detail) values (coalesce(p_ok, false), p_what, p_detail);
end;
$p$;

-- The harness itself has to be reachable from inside a role switch: a block
-- that becomes `anon` still has to call `test.check` to record the result and
-- `test.as_owner` to switch back. Granted to PUBLIC because this file only
-- ever runs against a throwaway database.
grant usage on schema test to public;
grant execute on all routines in schema test to public;
grant select, insert on test.results to public;
grant usage, select on all sequences in schema test to public;
