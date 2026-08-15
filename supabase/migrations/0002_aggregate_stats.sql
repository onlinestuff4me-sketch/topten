-- Aggregate analytics, and only aggregate (decided 2026-08-15, Mischa).
--
-- Counts of publishes, remixes and completions; no per-person event stream,
-- no third-party SDK, no identifiers leaving the device. The splash screen
-- promises "Free. No ads. No subscription. Ever." and while that sentence does
-- not literally mention tracking, a product that says it and then ships an
-- analytics SDK is trading on a distinction its readers did not make.
--
-- **Views, not tables fed by triggers.** Every figure below is derived from
-- rows that already exist, so there is nothing to keep in step and nothing
-- that can drift from the truth it summarises. A counter column maintained by
-- a trigger is a second copy of a number, and second copies are wrong
-- eventually.
--
-- `security_invoker = true` on every view is **defence in depth, not a fix for
-- a live leak** — and the distinction is worth stating because the first draft
-- of this file claimed otherwise and a falsification test proved it wrong.
--
-- A Postgres view runs with its OWNER's rights by default, which reads straight
-- past RLS. Today that changes nothing here, because every view's own WHERE
-- clause already restricts it to published rows — exactly what the policies in
-- 0001 permit a stranger to read. The two agree, so removing the setting
-- changes no result, which is precisely what the test discovered.
--
-- It matters for the NEXT view. The moment somebody adds one that touches
-- drafts, unlocks or profiles, owner rights turn it into a leak with a `sum()`
-- in front of it. So rather than a test that pretends to catch a leak that
-- does not exist, there is a structural one: every view in `public` must carry
-- the setting, and a new view without it fails the suite.

-- ── Per topic ───────────────────────────────────────────────────────────────
-- What a topic page needs: how many people have taken this on, and when it
-- last moved. Authors are counted, never listed.
create view public.topic_stats
with (security_invoker = true) as
  select t.topic_id,
         count(*)::bigint                       as published_tens,
         count(distinct t.author_id)::bigint    as authors,
         min(t.published_at)                    as first_published_at,
         max(t.published_at)                    as last_published_at
  from public.tens t
  where t.published_at is not null
  group by t.topic_id;

-- ── Per day ─────────────────────────────────────────────────────────────────
-- A publish curve, bucketed by day. A day is the finest grain that is still
-- aggregate: an hour-by-hour series over a small user base is a per-person
-- event stream wearing a timestamp.
create view public.daily_publishes
with (security_invoker = true) as
  select date_trunc('day', t.published_at)::date as day,
         count(*)::bigint                        as publishes,
         count(distinct t.author_id)::bigint     as authors
  from public.tens t
  where t.published_at is not null
  group by 1;

create view public.daily_remixes
with (security_invoker = true) as
  select date_trunc('day', r.created_at)::date as day,
         count(*)::bigint                      as remixes
  from public.remix_edges r
  group by 1;

-- ── The whole product, in one row ───────────────────────────────────────────
-- The numbers the PRD's metrics section is about. One row, no dimensions to
-- slice by, because a dimension is where re-identification starts.
create view public.product_stats
with (security_invoker = true) as
  select
    (select count(*) from public.tens where published_at is not null)::bigint as published_tens,
    (select count(distinct author_id) from public.tens where published_at is not null)::bigint as publishing_authors,
    (select count(*) from public.topics)::bigint as topics,
    (select count(*) from public.remix_edges)::bigint as remixes,
    (select count(*) from public.badges)::bigint as badges;

comment on view public.topic_stats is
  'Aggregate only. Authors are counted, never listed (analytics decision, 2026-08-15).';
comment on view public.daily_publishes is
  'Aggregate only, bucketed by day. Finer than a day stops being aggregate on a small user base.';
comment on view public.product_stats is
  'One row, no dimensions. A dimension is where re-identification starts.';

grant select on public.topic_stats, public.daily_publishes,
                public.daily_remixes, public.product_stats to anon, authenticated;
