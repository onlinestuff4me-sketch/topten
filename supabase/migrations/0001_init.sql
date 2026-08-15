-- Top Ten — initial schema.
--
-- The object model this encodes (specs/prd.md): topics are the social object,
-- and a Ten is one person's take on a topic. Discovery, comparison, consensus
-- and remix chains fall out of that shape rather than being features bolted
-- onto it.
--
-- Two rules run through the whole file:
--
--   1. A Ten is ten. The database refuses to publish a list that is not
--      exactly ten distinct items in positions 1..10 — enforced by a trigger,
--      not by hope, because "unfinished Ten is a draft" is a product promise
--      (AGENTS.md, locked) and the app is not the only thing that can write.
--
--   2. A list's name is its criteria. Nothing here stores a user-typed title
--      or description, because there is no such field in the product (PRD Req
--      12 amendment, 2026-08-15) and a nullable column is an invitation.

create extension if not exists "pgcrypto";

-- ── Profiles ────────────────────────────────────────────────────────────────
-- One row per account. Handles are generated, not chosen, until the identity
-- question in the PRD is settled — so the column is here and the choosing is
-- not.
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  handle      text unique not null,
  display_name text,
  created_at  timestamptz not null default now(),
  constraint handle_shape check (handle ~ '^[a-z0-9_]{3,24}$')
);

-- ── Topics ──────────────────────────────────────────────────────────────────
-- A topic IS its criteria. `criteria_id` is the same string TopTenKit's
-- `Criteria.id` produces ("movie:genre:Crime:decade:1990"), so the app, the
-- web page and the database all agree on what counts as the same topic
-- without anybody parsing a title.
--
-- Titles and prompts are stored **derived**, not authored: they are written by
-- the client from the criteria and kept so a web page can render without
-- reimplementing the namer in TypeScript. If the namer changes, they are
-- regenerated — they are a cache, and the comment says so because the next
-- person will otherwise treat them as input.
create table public.topics (
  id          uuid primary key default gen_random_uuid(),
  criteria_id text unique not null,
  slug        text unique not null,
  domain      text not null check (domain in ('movie','tv','book','game','restaurant','place')),
  -- The clauses, so the database can answer "what is this topic" without
  -- parsing criteria_id.
  genre       text,
  creator     text,
  performer   text,
  decade      int check (decade is null or (decade >= 1880 and decade % 10 = 0)),
  title       text not null,   -- derived cache: "Top 10 Crime Movies of the 90s"
  prompt      text not null,   -- derived cache
  created_at  timestamptz not null default now(),
  constraint slug_shape check (slug ~ '^[a-z0-9-]{3,80}$')
);

create index topics_domain_idx on public.topics (domain);

-- ── Tens ────────────────────────────────────────────────────────────────────
-- One row per take. The id is stable and public-facing: future social features
-- attach to it (the Stack lesson, specs/tech-stack.md), so it must survive
-- re-ranking, re-badging and un-publishing.
create table public.tens (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid not null references public.profiles (id) on delete cascade,
  topic_id     uuid not null references public.topics (id) on delete restrict,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- One take per person per topic. A second take is an edit of the first, not
  -- a new row — otherwise consensus counts one person twice and "you and Sam
  -- share 6" has to ask which Sam.
  unique (author_id, topic_id)
);

create index tens_topic_published_idx on public.tens (topic_id, published_at desc)
  where published_at is not null;
create index tens_author_idx on public.tens (author_id);

-- ── Ten items ───────────────────────────────────────────────────────────────
-- Catalog ids rather than a catalog table: the shelf is TMDB's and ours is a
-- cache, so the join key is the id the app already holds. `title_at_publish`
-- is a snapshot, because a shared page must still read correctly when a
-- catalog row is renamed or withdrawn.
create table public.ten_items (
  ten_id           uuid not null references public.tens (id) on delete cascade,
  position         int  not null check (position between 1 and 10),
  item_id          bigint not null,
  title_at_publish text not null,
  artwork_path     text,
  primary key (ten_id, position),
  -- The same film cannot hold two positions in one Ten.
  unique (ten_id, item_id)
);

-- ── Badges ──────────────────────────────────────────────────────────────────
-- Composition, not an image (specs/badges.md). Stored so a web page and an OG
-- card can render the same badge the phone rendered, and so a badge survives a
-- change to the generator.
create table public.badges (
  ten_id      uuid primary key references public.tens (id) on delete cascade,
  composition jsonb not null,
  inscription text not null,
  seed        numeric(20,0) not null,
  provenance  text not null check (provenance in ('deterministic','guided')),
  created_at  timestamptz not null default now(),
  constraint inscription_length check (
    array_length(regexp_split_to_array(btrim(inscription), '\s+'), 1) between 1 and 6
  )
);

-- ── Remix edges ─────────────────────────────────────────────────────────────
-- "Ten B was made after seeing Ten A." Traversable both ways (PRD object
-- model), which is why it is a table and not a column on tens.
create table public.remix_edges (
  from_ten_id uuid not null references public.tens (id) on delete cascade,
  to_ten_id   uuid not null references public.tens (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (from_ten_id, to_ten_id),
  constraint no_self_remix check (from_ten_id <> to_ten_id)
);

create index remix_edges_to_idx on public.remix_edges (to_ten_id);

-- ── Unlocks ─────────────────────────────────────────────────────────────────
-- Which topics a person has earned the badges of. Denormalised on purpose:
-- the reveal gate is read on every badge render, and "does this person have a
-- published Ten on this topic" is a question worth answering with an index
-- rather than a join through tens on every card.
create table public.unlocks (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  topic_id   uuid not null references public.topics (id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (profile_id, topic_id)
);

-- ── A Ten is ten ────────────────────────────────────────────────────────────
-- Publishing is the moment the promise has to hold, and it fires immediately
-- rather than at commit.
--
-- That makes **publishing an UPDATE, always**: you create a draft, add items
-- to it, and then set published_at. Creating an already-published row in one
-- INSERT is refused, because at that instant the list has no items — which is
-- the correct answer, not a limitation. The first draft of this used a
-- deferred constraint trigger so an INSERT could carry its items along; that
-- version could not be tested, because an error raised at COMMIT is outside
-- any plpgsql handler. An untestable guarantee is not one.
create or replace function public.assert_ten_is_complete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  n int;
  target uuid := coalesce(new.id, old.id);
begin
  if new.published_at is null then
    return new;
  end if;
  select count(*) into n from public.ten_items where ten_id = target;
  if n <> 10 then
    raise exception 'a published Ten must hold exactly 10 items, found %', n
      using errcode = 'check_violation';
  end if;
  -- Positions 1..10 exactly once each. The primary key already forbids a
  -- repeated position; this catches a gap (1..9 plus 11 would otherwise pass
  -- the count).
  if exists (
    select 1 from generate_series(1, 10) g
    where not exists (
      select 1 from public.ten_items ti where ti.ten_id = target and ti.position = g
    )
  ) then
    raise exception 'a published Ten must fill positions 1 through 10'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger tens_complete_on_publish
  after insert or update on public.tens
  for each row execute function public.assert_ten_is_complete();

-- Publishing also earns the unlock, and re-publishing must not fail on the
-- second attempt.
create or replace function public.grant_unlock_on_publish()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.published_at is not null then
    insert into public.unlocks (profile_id, topic_id)
    values (new.author_id, new.topic_id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger tens_unlock_on_publish
  after insert or update of published_at on public.tens
  for each row execute function public.grant_unlock_on_publish();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

create trigger tens_touch before update on public.tens
  for each row execute function public.touch_updated_at();

-- ── Consensus ───────────────────────────────────────────────────────────────
-- Borda: position 1 scores 10, position 10 scores 1, so every complete Ten
-- contributes exactly 55 points whatever its picks are. No Ten can buy
-- influence by being unusual — the property the whole scheme rests on.
--
-- Ties break on appearances and then on item id. Not for fairness but for
-- **determinism**: this list is rendered on a cached web page and
-- screenshotted, and two replicas disagreeing about identical data is a bug
-- that only shows up in production.
create or replace function public.consensus_ten(p_topic_id uuid, p_limit int default 10)
returns table (item_id bigint, points bigint, appearances bigint, title text)
language sql
stable
as $$
  select ti.item_id,
         sum(11 - ti.position)::bigint as points,
         count(*)::bigint              as appearances,
         (array_agg(ti.title_at_publish order by t.published_at desc))[1] as title
  from public.ten_items ti
  join public.tens t on t.id = ti.ten_id
  where t.topic_id = p_topic_id and t.published_at is not null
  group by ti.item_id
  order by points desc, appearances desc, ti.item_id asc
  limit p_limit;
$$;

-- How many picks a given Ten shares with its topic's consensus. The number
-- behind "You share 4 of 10".
create or replace function public.shared_with_consensus(p_ten_id uuid)
returns int
language sql
stable
as $$
  select count(*)::int
  from public.ten_items mine
  where mine.ten_id = p_ten_id
    and mine.item_id in (
      select c.item_id
      from public.consensus_ten((select topic_id from public.tens where id = p_ten_id)) c
    );
$$;

-- ── Row level security ──────────────────────────────────────────────────────
-- The shape of the product, stated as policy:
--
--   * A published Ten is world-readable, with no account. That is the whole
--     point of the web page (PRD Req 11) — a browser arrives from a link.
--   * A draft is yours alone. Nobody, signed in or not, may read someone
--     else's unpublished list.
--   * The LIST is never gated; only the badge is (PRD Req 12). So badges are
--     readable too, and the gate is drawn in the client. Hiding the badge row
--     would make an unlock require a round trip and would leak "you have not
--     earned this" into a 404.
--   * Nobody writes anybody else's anything.
alter table public.profiles    enable row level security;
alter table public.topics      enable row level security;
alter table public.tens        enable row level security;
alter table public.ten_items   enable row level security;
alter table public.badges      enable row level security;
alter table public.remix_edges enable row level security;
alter table public.unlocks     enable row level security;

-- Profiles: public, because a published Ten shows a byline.
create policy profiles_read_all on public.profiles
  for select using (true);
create policy profiles_write_own on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

-- Topics: public to read. Created by any signed-in user, because a topic is
-- materialised the first time somebody takes it on; never updated or deleted
-- by a user, because topics are shared ground.
create policy topics_read_all on public.topics
  for select using (true);
create policy topics_insert_signed_in on public.topics
  for insert with check (auth.uid() is not null);

-- Tens: published ones are world-readable; drafts are the author's alone.
create policy tens_read_published_or_own on public.tens
  for select using (published_at is not null or author_id = auth.uid());
create policy tens_insert_own on public.tens
  for insert with check (author_id = auth.uid());
create policy tens_update_own on public.tens
  for update using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy tens_delete_own on public.tens
  for delete using (author_id = auth.uid());

-- Items and badges inherit their Ten's visibility. Written as an EXISTS
-- against tens rather than duplicating the rule, so there is one definition of
-- "visible" and it cannot drift.
create policy ten_items_read_visible on public.ten_items
  for select using (exists (
    select 1 from public.tens t
    where t.id = ten_items.ten_id
      and (t.published_at is not null or t.author_id = auth.uid())
  ));
create policy ten_items_write_own on public.ten_items
  for all using (exists (
    select 1 from public.tens t where t.id = ten_items.ten_id and t.author_id = auth.uid()
  )) with check (exists (
    select 1 from public.tens t where t.id = ten_items.ten_id and t.author_id = auth.uid()
  ));

create policy badges_read_visible on public.badges
  for select using (exists (
    select 1 from public.tens t
    where t.id = badges.ten_id
      and (t.published_at is not null or t.author_id = auth.uid())
  ));
create policy badges_write_own on public.badges
  for all using (exists (
    select 1 from public.tens t where t.id = badges.ten_id and t.author_id = auth.uid()
  )) with check (exists (
    select 1 from public.tens t where t.id = badges.ten_id and t.author_id = auth.uid()
  ));

-- Remix edges: readable when both ends are visible, writable by the author of
-- the *new* Ten — you record that you remixed someone, not that they remixed
-- you.
create policy remix_read_visible on public.remix_edges
  for select using (
    exists (select 1 from public.tens t where t.id = remix_edges.from_ten_id
              and (t.published_at is not null or t.author_id = auth.uid()))
    and
    exists (select 1 from public.tens t where t.id = remix_edges.to_ten_id
              and (t.published_at is not null or t.author_id = auth.uid()))
  );
create policy remix_insert_own on public.remix_edges
  for insert with check (exists (
    select 1 from public.tens t where t.id = remix_edges.to_ten_id and t.author_id = auth.uid()
  ));

-- Unlocks are private. What you have earned is nobody else's business, and
-- the badge gate is drawn from your own row.
create policy unlocks_read_own on public.unlocks
  for select using (profile_id = auth.uid());
