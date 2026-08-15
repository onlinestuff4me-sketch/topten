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

insert into public.profiles (id, handle, display_name) values
  ('11111111-1111-1111-1111-111111111111', 'ada',   'Ada'),
  ('22222222-2222-2222-2222-222222222222', 'grace', 'Grace');

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
