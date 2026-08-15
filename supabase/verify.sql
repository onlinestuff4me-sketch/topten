-- Paste this into the Supabase SQL editor AFTER running the migrations.
--
-- Read-only: it creates nothing and changes nothing. It answers one question —
-- did the migrations actually land, whole — and prints a line per check with a
-- FAIL you can read at a glance rather than a wall of green.
--
-- It is not the policy suite. That runs in CI against a real Postgres and
-- executes every policy as three different callers (supabase/tests/). This is
-- the arrival check: right tables, RLS on, policies present, functions there.

with expected_tables(name) as (
  values ('profiles'), ('topics'), ('tens'), ('ten_items'),
         ('badges'), ('remix_edges'), ('unlocks')
),
expected_views(name) as (
  values ('topic_stats'), ('daily_publishes'), ('daily_remixes'), ('product_stats')
),
expected_policies(name) as (
  values ('profiles_read_all'), ('profiles_write_own'),
         ('topics_read_all'), ('topics_insert_signed_in'),
         ('tens_read_published_or_own'), ('tens_insert_own'),
         ('tens_update_own'), ('tens_delete_own'),
         ('ten_items_read_visible'), ('ten_items_write_own'),
         ('badges_read_visible'), ('badges_write_own'),
         ('remix_read_visible'), ('remix_insert_own'),
         ('unlocks_read_own')
),
expected_functions(name) as (
  values ('consensus_ten'), ('shared_with_consensus'),
         ('assert_ten_is_complete'), ('grant_unlock_on_publish'), ('touch_updated_at')
),
checks as (

  -- Every table exists.
  select 1 as ord, 'tables' as what,
         count(*) || ' of 7' as detail,
         count(*) = 7 as ok
  from expected_tables e
  join pg_tables t on t.tablename = e.name and t.schemaname = 'public'

  -- RLS is ON for every one of them. A table with policies and RLS disabled is
  -- a table with no access control at all, and it looks fine in the dashboard.
  union all
  select 2, 'row level security enabled',
         count(*) filter (where c.relrowsecurity) || ' of 7',
         count(*) filter (where c.relrowsecurity) = 7
  from expected_tables e
  join pg_class c on c.relname = e.name
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'

  -- The policies themselves, by name. A count would say "15 of 16" and leave
  -- you to work out which; this says which. The first draft of this file
  -- guessed the number and guessed it wrong, which is a reasonable argument
  -- for never checking a count when you can check the thing.
  union all
  select 3, 'policies',
         coalesce('missing: ' || (
           select string_agg(e.name, ', ')
           from expected_policies e
           where not exists (select 1 from pg_policies p
                             where p.schemaname = 'public' and p.policyname = e.name)
         ), (select count(*)::text from expected_policies) || ' of ' ||
            (select count(*)::text from expected_policies)),
         not exists (
           select 1 from expected_policies e
           where not exists (select 1 from pg_policies p
                             where p.schemaname = 'public' and p.policyname = e.name)
         )

  -- The aggregate views, and that each runs with the caller's rights so RLS
  -- still applies to it.
  union all
  select 4, 'aggregate views', count(*) || ' of 4', count(*) = 4
  from expected_views e
  join pg_views v on v.viewname = e.name and v.schemaname = 'public'

  union all
  select 5, 'views run as caller (security_invoker)',
         count(*) filter (where array_to_string(c.reloptions, ',') like '%security_invoker=true%') || ' of 4',
         count(*) filter (where array_to_string(c.reloptions, ',') like '%security_invoker=true%') = 4
  from expected_views e
  join pg_class c on c.relname = e.name
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'

  union all
  select 6, 'functions', count(*) || ' of 5', count(*) = 5
  from expected_functions e
  join pg_proc p on p.proname = e.name
  join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'

  -- The trigger that refuses to publish a list that is not ten.
  union all
  select 7, 'the "a Ten is ten" trigger', count(*) || ' of 1', count(*) = 1
  from pg_trigger where tgname = 'tens_complete_on_publish' and not tgisinternal

  -- Grants. Without these every query returns zero rows and every policy looks
  -- like the culprit.
  union all
  select 8, 'anon can read the tables',
         count(*) || ' of 7', count(*) = 7
  from expected_tables e
  where has_table_privilege('anon', 'public.' || quote_ident(e.name), 'SELECT')

  union all
  select 9, 'authenticated can write',
         count(*) || ' of 7', count(*) = 7
  from expected_tables e
  where has_table_privilege('authenticated', 'public.' || quote_ident(e.name), 'INSERT')

  -- Nothing should be in here yet, and if something is, that is worth knowing
  -- before the client starts writing.
  union all
  select 10, 'tables are empty (a fresh project)',
         (select count(*) from public.tens)::text || ' tens',
         (select count(*) from public.tens) = 0
)
select case when ok then '  ok    ' else '  FAIL  ' end || rpad(what, 40) || detail as result
from checks order by ord;
