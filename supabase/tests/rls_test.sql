-- What the policies actually do, executed as three different callers.
--
-- Every assertion below is a sentence from specs/prd.md turned into a query.
-- A policy that is too permissive reads exactly like one that is correct, so
-- reviewing this file is not a substitute for running it.
--
-- Run it with `supabase/tests/run.sh`, which applies, in order:
--   00_supabase_stub.sql   the parts of Supabase our migration assumes
--   ../migrations/*.sql    the migration under test
--   01_grants.sql          role grants, which need the tables to exist
--   this file

\set ON_ERROR_STOP on
set client_min_messages to warning;

-- ── Fixtures, created as the owner (bypassing RLS on purpose) ───────────────
call test.as_owner();

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ada@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'grace@example.com');

-- An upsert, not an insert, because 0004's trigger has already created both
-- of these profiles with generated handles. The suite renames them to `ada`
-- and `grace` so the rest of the file reads as sentences about people rather
-- than about `quiet_lantern_04`.
insert into public.profiles (id, handle, display_name) values
  ('11111111-1111-1111-1111-111111111111', 'ada',   'Ada'),
  ('22222222-2222-2222-2222-222222222222', 'grace', 'Grace')
on conflict (id) do update
  set handle = excluded.handle, display_name = excluded.display_name;

insert into public.topics (id, criteria_id, slug, domain, genre, decade, title, prompt) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'movie:genre:Crime:decade:1990',
   'top-10-crime-movies-of-the-90s', 'movie', 'Crime', 1990,
   'Top 10 Crime Movies of the 90s', 'Your 10 favorite crime movies of the 90s.'),
  -- Two spare topics. The "a Ten is ten" checks below need somewhere to build
  -- a broken list, and building it on the topic everybody already has a take
  -- on would trip the one-take-per-topic constraint instead — the test would
  -- pass without ever exercising the rule it names.
  ('aaaaaaaa-0000-0000-0000-000000000002', 'movie:genre:Horror',
   'top-10-horror-movies', 'movie', 'Horror', null,
   'Top 10 Horror Movies', 'Your 10 favorite horror movies.'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'tv',
   'top-10-shows-of-all-time', 'tv', null, null,
   'Top 10 Shows of All Time', 'Your 10 favorite shows of all time.');

-- Ada publishes; Grace keeps a draft on the same topic.
insert into public.tens (id, author_id, topic_id) values
  ('bbbbbbbb-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222',
   'aaaaaaaa-0000-0000-0000-000000000001');

insert into public.ten_items (ten_id, position, item_id, title_at_publish)
select 'bbbbbbbb-0000-0000-0000-000000000001', g, 1000 + g, 'Ada pick ' || g
from generate_series(1, 10) g;
insert into public.ten_items (ten_id, position, item_id, title_at_publish)
select 'bbbbbbbb-0000-0000-0000-000000000002', g, 2000 + g, 'Grace pick ' || g
from generate_series(1, 10) g;

update public.tens set published_at = now()
where id = 'bbbbbbbb-0000-0000-0000-000000000001';

insert into public.badges (ten_id, composition, inscription, seed, provenance)
values ('bbbbbbbb-0000-0000-0000-000000000001', '{"shape":"ticketStub"}'::jsonb,
        'Crime, all ten', 42, 'deterministic');

-- ── A published Ten is world-readable, with no account ──────────────────────
-- PRD Req 11: a browser arrives from a link. If this fails, the whole web
-- surface fails.
do $$
declare n int;
begin
  call test.as_anon();
  select count(*) into n from public.tens where id = 'bbbbbbbb-0000-0000-0000-000000000001';
  call test.as_owner();
  call test.check(n = 1, 'a visitor with no account can read a published Ten', 'rows=' || n);
end $$;

do $$
declare n int;
begin
  call test.as_anon();
  select count(*) into n from public.ten_items where ten_id = 'bbbbbbbb-0000-0000-0000-000000000001';
  call test.as_owner();
  call test.check(n = 10, 'and all ten of its items', 'rows=' || n);
end $$;

-- The LIST is never gated; only the badge is, and the gate is drawn in the
-- client. Hiding the row would turn "you have not earned this" into a 404.
do $$
declare n int;
begin
  call test.as_anon();
  select count(*) into n from public.badges where ten_id = 'bbbbbbbb-0000-0000-0000-000000000001';
  call test.as_owner();
  call test.check(n = 1, 'the badge row is readable — the gate is drawn, not enforced by a 404', 'rows=' || n);
end $$;

-- ── A draft is yours alone ──────────────────────────────────────────────────
do $$
declare n int;
begin
  call test.as_anon();
  select count(*) into n from public.tens where id = 'bbbbbbbb-0000-0000-0000-000000000002';
  call test.as_owner();
  call test.check(n = 0, 'a visitor cannot read an unpublished draft', 'rows=' || n);
end $$;

do $$
declare n int;
begin
  call test.as_user('11111111-1111-1111-1111-111111111111');
  select count(*) into n from public.tens where id = 'bbbbbbbb-0000-0000-0000-000000000002';
  call test.as_owner();
  call test.check(n = 0, 'and neither can another signed-in user', 'rows=' || n);
end $$;

do $$
declare n int;
begin
  call test.as_user('22222222-2222-2222-2222-222222222222');
  select count(*) into n from public.tens where id = 'bbbbbbbb-0000-0000-0000-000000000002';
  call test.as_owner();
  call test.check(n = 1, 'but its author can', 'rows=' || n);
end $$;

do $$
declare n int;
begin
  call test.as_anon();
  select count(*) into n from public.ten_items where ten_id = 'bbbbbbbb-0000-0000-0000-000000000002';
  call test.as_owner();
  call test.check(n = 0, 'a draft''s items are hidden too — visibility is inherited, not restated', 'rows=' || n);
end $$;

-- ── Nobody writes anybody else's anything ───────────────────────────────────
do $$
declare failed boolean := false; still_published boolean;
begin
  call test.as_user('22222222-2222-2222-2222-222222222222');
  begin
    update public.tens set published_at = null
    where id = 'bbbbbbbb-0000-0000-0000-000000000001';
    -- RLS makes this a no-op rather than an error: the row is not visible for
    -- update, so zero rows match. Both outcomes are acceptable; what matters
    -- is that nothing changed.
    failed := not found;
  exception when others then
    failed := true;
  end;
  call test.as_owner();
  select published_at is not null into still_published from public.tens
  where id = 'bbbbbbbb-0000-0000-0000-000000000001';
  call test.check(failed and still_published, 'one user cannot unpublish another''s Ten');
end $$;

do $$
declare blocked boolean := false;
begin
  call test.as_user('22222222-2222-2222-2222-222222222222');
  begin
    insert into public.tens (author_id, topic_id)
    values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001');
  exception when insufficient_privilege or others then
    blocked := true;
  end;
  call test.as_owner();
  call test.check(blocked, 'one user cannot create a Ten in another''s name');
end $$;

do $$
declare blocked boolean := false;
begin
  call test.as_user('22222222-2222-2222-2222-222222222222');
  begin
    insert into public.ten_items (ten_id, position, item_id, title_at_publish)
    values ('bbbbbbbb-0000-0000-0000-000000000001', 11, 9999, 'Smuggled');
  exception when others then
    blocked := true;
  end;
  call test.as_owner();
  call test.check(blocked, 'nor add an item to it');
end $$;

-- Unlocks are private: what you have earned is nobody else's business.
do $$
declare mine int; theirs int;
begin
  call test.as_user('11111111-1111-1111-1111-111111111111');
  select count(*) into mine from public.unlocks;
  call test.as_user('22222222-2222-2222-2222-222222222222');
  select count(*) into theirs from public.unlocks;
  call test.as_owner();
  call test.check(mine = 1 and theirs = 0,
    'unlocks are private to the person who earned them', 'ada=' || mine || ' grace=' || theirs);
end $$;

-- ── A Ten is ten ────────────────────────────────────────────────────────────
-- The product promise, enforced by the database because the app is not the
-- only thing that can write. Publishing is an UPDATE: a draft is built, then
-- flipped. Both halves of that are checked.
do $$
declare blocked boolean := false;
begin
  call test.as_owner();
  begin
    insert into public.tens (id, author_id, topic_id, published_at)
    values ('cccccccc-0000-0000-0000-000000000001',
            '11111111-1111-1111-1111-111111111111',
            'aaaaaaaa-0000-0000-0000-000000000002', now());
  exception when others then
    blocked := true;
  end;
  call test.check(blocked, 'a Ten cannot be born published — it has no items yet');
end $$;

do $$
declare blocked boolean := false;
begin
  call test.as_owner();
  insert into public.tens (id, author_id, topic_id)
  values ('cccccccc-0000-0000-0000-000000000001',
          '11111111-1111-1111-1111-111111111111',
          'aaaaaaaa-0000-0000-0000-000000000002');
  insert into public.ten_items (ten_id, position, item_id, title_at_publish)
  select 'cccccccc-0000-0000-0000-000000000001', g, 3000 + g, 'Short ' || g
  from generate_series(1, 9) g;
  begin
    update public.tens set published_at = now()
    where id = 'cccccccc-0000-0000-0000-000000000001';
  exception when others then
    blocked := true;
  end;
  call test.check(blocked, 'and a nine-item draft cannot be published');
end $$;

-- A gap is not a count. Nine items numbered 1..8 and 10 would pass a count of
-- ten if the check only counted, so it checks the positions too.
do $$
declare blocked boolean := false;
begin
  call test.as_owner();
  insert into public.ten_items (ten_id, position, item_id, title_at_publish)
  values ('cccccccc-0000-0000-0000-000000000001', 10, 3999, 'Tenth');
  delete from public.ten_items
  where ten_id = 'cccccccc-0000-0000-0000-000000000001' and position = 4;
  insert into public.ten_items (ten_id, position, item_id, title_at_publish)
  values ('cccccccc-0000-0000-0000-000000000001', 4, 3998, 'Refilled');
  update public.tens set published_at = now()
  where id = 'cccccccc-0000-0000-0000-000000000001';
  call test.check(true, 'ten items in positions 1..10 publishes');
exception when others then
  call test.check(false, 'ten items in positions 1..10 publishes', sqlerrm);
end $$;

do $$
declare ok boolean := false;
begin
  call test.as_owner();
  insert into public.tens (id, author_id, topic_id)
  values ('cccccccc-0000-0000-0000-000000000002',
          '22222222-2222-2222-2222-222222222222',
          'aaaaaaaa-0000-0000-0000-000000000003');
  insert into public.ten_items (ten_id, position, item_id, title_at_publish)
  select 'cccccccc-0000-0000-0000-000000000002', g, 4000 + g, 'Draft ' || g
  from generate_series(1, 4) g;
  ok := true;
  call test.check(ok, 'but a four-item DRAFT is fine — a draft is the unfinished state');
end $$;

call test.as_owner();
delete from public.tens where id in
  ('cccccccc-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000002');

-- Publishing earns the unlock, and re-publishing does not fail on the second
-- attempt.
do $$
declare n int;
begin
  call test.as_owner();
  update public.tens set published_at = now()
  where id = 'bbbbbbbb-0000-0000-0000-000000000001';
  -- Scoped to the topic: by this point Ada has also published on the spare
  -- topic the completeness checks used, so counting all her unlocks would be
  -- counting something else.
  select count(*) into n from public.unlocks
  where profile_id = '11111111-1111-1111-1111-111111111111'
    and topic_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  call test.check(n = 1, 'publishing twice earns the unlock once', 'rows=' || n);
end $$;

-- One take per person per topic: a second take is an edit, not a new row.
do $$
declare blocked boolean := false;
begin
  call test.as_owner();
  begin
    insert into public.tens (author_id, topic_id)
    values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001');
  exception when unique_violation then
    blocked := true;
  end;
  call test.check(blocked, 'one take per person per topic — consensus must not count anyone twice');
end $$;

-- ── Consensus ───────────────────────────────────────────────────────────────
-- Every complete Ten contributes exactly 55 points whatever its picks are.
-- No Ten can buy influence by being unusual.
do $$
declare total bigint; top_points bigint; n int;
begin
  call test.as_owner();
  select sum(points), count(*) into total, n from public.consensus_ten('aaaaaaaa-0000-0000-0000-000000000001', 100);
  select points into top_points from public.consensus_ten('aaaaaaaa-0000-0000-0000-000000000001', 1);
  call test.check(total = 55, 'one published Ten contributes exactly 55 points', 'total=' || total);
  call test.check(top_points = 10, 'and its #1 is worth ten', 'top=' || top_points);
  call test.check(n = 10, 'over ten distinct items', 'n=' || n);
end $$;

-- A draft must not move the consensus. This is the one that would be silently
-- wrong if the function forgot its published_at filter.
do $$
declare before_total bigint; after_total bigint;
begin
  call test.as_owner();
  select sum(points) into before_total from public.consensus_ten('aaaaaaaa-0000-0000-0000-000000000001', 100);
  -- Grace's draft exists with ten items and is still unpublished.
  select sum(points) into after_total from public.consensus_ten('aaaaaaaa-0000-0000-0000-000000000001', 100);
  call test.check(before_total = 55 and after_total = 55,
    'an unpublished draft contributes nothing to consensus',
    'before=' || before_total || ' after=' || after_total);
end $$;

-- Two Tens agreeing pushes shared picks to the top.
do $$
declare top_item bigint; top_points bigint;
begin
  call test.as_owner();
  update public.tens set published_at = now()
  where id = 'bbbbbbbb-0000-0000-0000-000000000002';
  -- Grace's #1 is item 2001, Ada's #1 is 1001; nothing overlaps, so both sit
  -- on 10 and the tie breaks on item id.
  select item_id, points into top_item, top_points
  from public.consensus_ten('aaaaaaaa-0000-0000-0000-000000000001', 1);
  call test.check(top_points = 10 and top_item = 1001,
    'ties break deterministically, lowest item id first',
    'item=' || top_item || ' points=' || top_points);
end $$;

do $$
declare total bigint;
begin
  call test.as_owner();
  select sum(points) into total from public.consensus_ten('aaaaaaaa-0000-0000-0000-000000000001', 100);
  call test.check(total = 110, 'two published Tens contribute 110', 'total=' || total);
end $$;

-- Overlap: give Grace three of Ada's picks and check the comparison number.
do $$
declare shared int;
begin
  call test.as_owner();
  update public.ten_items set item_id = 1001 where ten_id = 'bbbbbbbb-0000-0000-0000-000000000002' and position = 5;
  update public.ten_items set item_id = 1002 where ten_id = 'bbbbbbbb-0000-0000-0000-000000000002' and position = 6;
  update public.ten_items set item_id = 1003 where ten_id = 'bbbbbbbb-0000-0000-0000-000000000002' and position = 7;
  select public.shared_with_consensus('bbbbbbbb-0000-0000-0000-000000000002') into shared;
  call test.check(shared between 3 and 10,
    'shared_with_consensus counts picks in common, ignoring position', 'shared=' || shared);
end $$;

-- ── Aggregate stats leak nothing a stranger may not already see ─────────────
-- The point of `security_invoker = true` on the views in 0002. A Postgres view
-- runs with its OWNER's rights by default, which would read straight past the
-- policies above — an aggregate over rows the caller cannot see is a leak with
-- a sum() in front of it.
do $$
declare pub bigint; auth_n bigint;
begin
  call test.as_anon();
  select published_tens, publishing_authors into pub, auth_n from public.product_stats;
  call test.as_owner();
  -- Ada and Grace have both published on the crime topic by now, and Ada also
  -- published on the spare topic the completeness checks used.
  call test.check(pub >= 2, 'a visitor can read the aggregate figures', 'published=' || pub);
  call test.check(auth_n = 2, 'counted by author, not inflated by one person''s several lists',
    'authors=' || auth_n);
end $$;

-- A draft must not raise the count. Note what this does NOT prove: the view's
-- own WHERE clause already excludes unpublished rows, so it passes with or
-- without `security_invoker`. The structural check below is what actually pins
-- that setting.
do $$
declare before_n bigint; after_n bigint;
begin
  call test.as_owner();
  insert into public.tens (id, author_id, topic_id)
  values ('dddddddd-0000-0000-0000-000000000001',
          '11111111-1111-1111-1111-111111111111',
          'aaaaaaaa-0000-0000-0000-000000000003');
  insert into public.ten_items (ten_id, position, item_id, title_at_publish)
  select 'dddddddd-0000-0000-0000-000000000001', g, 7000 + g, 'Secret ' || g
  from generate_series(1, 10) g;

  call test.as_anon();
  select published_tens into before_n from public.product_stats;
  call test.as_owner();
  update public.tens set published_at = now()
  where id = 'dddddddd-0000-0000-0000-000000000001';
  call test.as_anon();
  select published_tens into after_n from public.product_stats;
  call test.as_owner();
  call test.check(after_n = before_n + 1,
    'an unpublished draft is invisible to the aggregates until it is published',
    'before=' || before_n || ' after=' || after_n);
end $$;

-- Every view must run with the CALLER's rights, not its owner's. Owner rights
-- read straight past RLS, and the day somebody adds a view over drafts or
-- profiles that becomes a leak with a sum() in front of it. Structural,
-- because the risk is the next view rather than the current ones.
do $$
declare bad text;
begin
  call test.as_owner();
  select string_agg(c.relname, ', ') into bad
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'v'
    and not coalesce(array_to_string(c.reloptions, ',') like '%security_invoker=true%', false);
  call test.check(bad is null,
    'every view runs with the caller''s rights, so RLS still applies',
    coalesce('missing on: ' || bad, 'all views checked'));
end $$;

-- Authors are counted, never listed.
do $$
declare cols int;
begin
  call test.as_owner();
  select count(*) into cols from information_schema.columns
  where table_schema = 'public'
    and table_name in ('topic_stats', 'daily_publishes', 'daily_remixes', 'product_stats')
    and (column_name like '%author_id%' or column_name like '%profile_id%'
         or column_name like '%handle%' or column_name like '%email%');
  call test.check(cols = 0,
    'no aggregate view exposes a column that identifies a person', 'columns=' || cols);
end $$;

do $$
declare rows_n int;
begin
  call test.as_anon();
  select count(*) into rows_n from public.topic_stats;
  call test.as_owner();
  call test.check(rows_n >= 1, 'topic_stats has a row per topic anybody has published on',
    'rows=' || rows_n);
end $$;

-- ── Signing in gives you a profile (0004) ───────────────────────────────────
-- Magic-link sign-in creates an `auth.users` row and nothing else. Without the
-- trigger, the first publish after sign-in fails on a foreign key — at the one
-- moment the whole product is for. These checks are that failure, prevented.

do $$
declare n int; h text;
begin
  call test.as_owner();
  insert into auth.users (id, email)
    values ('33333333-3333-3333-3333-333333333333', 'newcomer@example.com');
  select count(*) into n from public.profiles
   where id = '33333333-3333-3333-3333-333333333333';
  call test.check(n = 1, 'signing in creates a profile, with no client involved', 'rows=' || n);

  select handle into h from public.profiles
   where id = '33333333-3333-3333-3333-333333333333';
  call test.check(h ~ '^[a-z0-9_]{3,24}$',
    'the generated handle satisfies handle_shape', 'handle=' || coalesce(h, '<null>'));
end $$;

-- The decision was "generated, changeable later" — not "chosen at signup by
-- anyone who calls the API directly". `raw_user_meta_data` is client-supplied
-- and 0004 ignores it on purpose; this is the check that says so.
do $$
declare h text;
begin
  call test.as_owner();
  insert into auth.users (id, email, raw_user_meta_data)
    values ('77777777-7777-7777-7777-777777777777', 'sneaky@example.com',
            '{"handle":"admin_topten"}'::jsonb);
  select handle into h from public.profiles
   where id = '77777777-7777-7777-7777-777777777777';
  call test.check(h = public.generate_handle('77777777-7777-7777-7777-777777777777', 0),
    'a client cannot choose its own handle by attaching JSON to the signup',
    'handle=' || coalesce(h, '<null>'));
end $$;

-- The retry loop, exercised rather than asserted: squat on the handle attempt
-- 0 would produce, then sign the user up anyway.
do $$
declare h text; taken text;
begin
  call test.as_owner();
  taken := public.generate_handle('44444444-4444-4444-4444-444444444444', 0);
  insert into auth.users (id, email) values
    ('66666666-6666-6666-6666-666666666666', 'squatter@example.com');
  update public.profiles set handle = taken
   where id = '66666666-6666-6666-6666-666666666666';

  insert into auth.users (id, email) values
    ('44444444-4444-4444-4444-444444444444', 'collide@example.com');
  select handle into h from public.profiles
   where id = '44444444-4444-4444-4444-444444444444';
  call test.check(h is not null and h <> taken and h ~ '^[a-z0-9_]{3,24}$',
    'a handle collision retries instead of leaving the account profile-less',
    'wanted=' || taken || ' got=' || coalesce(h, '<null>'));
end $$;

-- And the thing all of the above is actually for.
do $$
declare ok_publish boolean := false;
begin
  call test.as_owner();
  insert into auth.users (id, email) values
    ('55555555-5555-5555-5555-555555555555', 'publisher@example.com');
  call test.as_user('55555555-5555-5555-5555-555555555555');
  begin
    insert into public.tens (author_id, topic_id) values
      ('55555555-5555-5555-5555-555555555555', 'aaaaaaaa-0000-0000-0000-000000000003');
    ok_publish := true;
  exception when others then
    ok_publish := false;
  end;
  call test.as_owner();
  call test.check(ok_publish,
    'a freshly signed-in account can immediately start a Ten (no FK violation)');
end $$;

do $$
declare a text; b text; c text;
begin
  call test.as_owner();
  a := public.generate_handle('11111111-1111-1111-1111-111111111111', 0);
  b := public.generate_handle('11111111-1111-1111-1111-111111111111', 0);
  c := public.generate_handle('11111111-1111-1111-1111-111111111111', 1);
  call test.check(a = b and a <> c,
    'generate_handle is deterministic, and a retry is a different handle',
    a || ' / ' || c);
end $$;

-- The retry loop is only cheap if collisions are rare, so the space has to be
-- genuinely wide rather than nominally wide. 48 x 48 x 100 = 230,400; the
-- birthday estimate for 2,000 draws is ~9 duplicates. The same bar as
-- TopTenKit's HandleTests, against the other implementation.
--
-- This also stands in for a correlation check. A hash that moved predictably
-- with its input would cluster here long before it showed up as a duplicate.
do $$
declare n int;
begin
  call test.as_owner();
  select count(distinct public.generate_handle(u, 0)) into n
  from (select gen_random_uuid() as u from generate_series(1, 2000)) s;
  call test.check(n >= 1980,
    'the handle space is wide enough that retrying is the exception',
    'distinct=' || n || ' of 2000');
end $$;

-- ── Report ──────────────────────────────────────────────────────────────────
call test.as_owner();

select case when ok then '  ok — ' else '  FAILED — ' end || what ||
       coalesce(' (' || detail || ')', '') as result
from test.results order by n;

do $$
declare bad int;
begin
  select count(*) into bad from test.results where not ok;
  if bad > 0 then
    raise exception '% RLS/schema check(s) failed', bad;
  end if;
  raise notice 'ALL % CHECKS PASSED', (select count(*) from test.results);
end $$;
