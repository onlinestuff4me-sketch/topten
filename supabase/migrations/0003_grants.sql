-- Table privileges for the two roles PostgREST connects as.
--
-- Supabase configures default privileges that would grant most of this
-- automatically for tables created in `public`. This file does not rely on
-- that. Default privileges are project configuration rather than schema, they
-- differ between a project created today and one created two years ago, and
-- the failure mode when they are absent is the worst kind: every query returns
-- zero rows and every policy looks like the culprit.
--
-- Grants and RLS answer different questions and both have to be right:
--
--   GRANT   may this role touch this table at all?
--   POLICY  which rows, of the ones it may touch?
--
-- So these are wide on purpose. `anon` may SELECT from everything and
-- `authenticated` may write to everything, and then the policies in 0001 decide
-- what that actually means — which is one row of somebody's own draft, or every
-- published Ten, depending. A narrow grant here would be a second, invisible
-- access-control system layered under the tested one.

grant usage on schema public to anon, authenticated;

-- Covers the aggregate views in 0002 as well as the tables. They stay bounded
-- by RLS because each is declared `security_invoker = true`.
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;
grant execute on all functions in schema public to anon, authenticated;

-- And for whatever a later migration adds, so this file does not have to be
-- remembered and re-run.
alter default privileges in schema public
  grant select on tables to anon, authenticated;
alter default privileges in schema public
  grant insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage on sequences to authenticated;
alter default privileges in schema public
  grant execute on functions to anon, authenticated;
