-- Grants for the LOCAL test roles only.
--
-- The real grants ship as `migrations/0003_grants.sql` and run against the real
-- project. This file exists because the local stub creates `anon` and
-- `authenticated` after the fact and has an `auth` schema of its own to open
-- up; everything else it needs, 0003 has already done.
grant usage on schema auth to anon, authenticated;
