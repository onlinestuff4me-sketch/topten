-- Every account gets a profile, at the instant the account exists.
--
-- This closes a gap that magic-link sign-in makes unavoidable. The chain is:
--
--   auth.users  ←  public.profiles  ←  public.tens.author_id
--
-- Signing in creates the `auth.users` row and nothing else. Without the
-- trigger below, the first thing anybody does after signing in — publish —
-- fails on a foreign key, and it fails at the single moment the whole product
-- is for. Worse, it fails *silently correctly*: the schema is right, the
-- policies are right, and the row just is not there yet.
--
-- The alternative is for each client to insert its own profile after sign-in.
-- That is two clients (iOS and web) both having to get a retry loop right,
-- racing their own publish call, and a person whose account exists but whose
-- profile does not if the app is closed in between. A trigger has one
-- implementation, runs inside the same transaction as the signup, and cannot
-- be skipped by a client that forgets.
--
-- **Handles are generated here, not accepted from the client.** Supabase lets
-- a client attach arbitrary JSON to a signup (`raw_user_meta_data`), and it
-- would be easy to read a handle out of it. This deliberately does not:
--
--   - "Generated, changeable later" was the decision (2026-08-15). Reading a
--     client-supplied handle at signup makes it chosen-at-signup for anyone
--     who calls the API directly, which is the thing the decision avoided.
--   - `raw_user_meta_data` is user-controlled input arriving inside a
--     SECURITY DEFINER function. The less of it that is load-bearing, the
--     smaller the surface.
--
-- `TopTenKit/Handle.swift` keeps its generator for local, pre-account use
-- (PRD Req 10 — anonymous use is first-class, and a local Ten still needs a
-- byline). Once an account exists, the database's handle is the real one.

-- ── The generator ───────────────────────────────────────────────────────────

-- Deterministic index into a wordlist. `hashtextextended` is core Postgres,
-- so this needs no extension, and the double `mod` is because Postgres `mod`
-- keeps the sign of its left argument — a negative hash would index off the
-- front of the array.
create or replace function public.handle_pick(key text, n int)
returns int
language sql
immutable
as $fn$
  select (mod(mod(hashtextextended(key, 0), n) + n, n))::int
$fn$;

comment on function public.handle_pick(text, int) is
  'Internal to generate_handle. Deterministic 0..n-1 from a string.';

-- The same two curated wordlists as TopTenKit/Handle.swift, and for the same
-- reason: nothing here is a body part, a nationality, a slur in any spelling
-- we could find, or a word that becomes one beside any word in the other
-- list. Deliberately boring — a handle is an address, not a joke.
--
-- The lists are duplicated in Swift and SQL rather than shared, which is a
-- real cost, and it buys the property that matters more: the database can
-- always mint a handle by itself, with no client involved and nothing to call
-- out to, at the moment a row appears in auth.users.
create or replace function public.generate_handle(seed uuid, attempt int default 0)
returns text
language plpgsql
immutable
as $fn$
declare
  adjectives constant text[] := array[
    'amber', 'brisk', 'calm', 'civic', 'clear', 'coastal', 'copper', 'crisp',
    'distant', 'early', 'even', 'gentle', 'golden', 'grand', 'humble', 'inland',
    'keen', 'level', 'lucid', 'mellow', 'modest', 'narrow', 'northern', 'open',
    'patient', 'plain', 'polite', 'quiet', 'rapid', 'rested', 'rural', 'settled',
    'silver', 'smooth', 'solid', 'southern', 'steady', 'still', 'sunlit', 'swift',
    'tidal', 'upland', 'urban', 'velvet', 'wandering', 'warm', 'western', 'willing'
  ];
  nouns constant text[] := array[
    'anchor', 'arbour', 'atlas', 'beacon', 'bridge', 'canyon', 'cedar', 'compass',
    'cottage', 'current', 'delta', 'ember', 'fathom', 'ferry', 'garden', 'harbour',
    'hollow', 'island', 'jetty', 'junction', 'kestrel', 'lantern', 'ledger', 'marsh',
    'meadow', 'orchard', 'parlour', 'pennant', 'quarry', 'quill', 'ridge', 'river',
    'sable', 'signal', 'station', 'summit', 'thicket', 'tide', 'trellis', 'valley',
    'vessel', 'willow', 'window', 'harvest', 'lattice', 'prairie', 'sextant', 'cove'
  ];
  key constant text := seed::text || ':' || attempt::text;
begin
  -- Two digits, always. A fixed width keeps handles the same shape, and the
  -- number is what makes collisions rare rather than what resolves them — the
  -- unique index still has the last word.
  return adjectives[1 + public.handle_pick(key || ':adjective', array_length(adjectives, 1))]
      || '_' || nouns[1 + public.handle_pick(key || ':noun', array_length(nouns, 1))]
      || '_' || lpad(public.handle_pick(key || ':number', 100)::text, 2, '0');
end
$fn$;

comment on function public.generate_handle(uuid, int) is
  'Mirrors TopTenKit/Handle.swift: 48 x 48 x 100 handles, all matching handle_shape. Bump `attempt` on collision.';

-- ── The trigger ─────────────────────────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
-- An empty search_path and fully-qualified names throughout: a SECURITY
-- DEFINER function that resolves names through the caller's search_path is
-- the classic way to hand somebody else's schema the owner's rights.
set search_path = ''
as $fn$
declare
  candidate text;
begin
  -- Supabase can re-run signup paths, and a profile may already exist if a
  -- future migration backfills. Either way this is not an error.
  if exists (select 1 from public.profiles where id = new.id) then
    return new;
  end if;

  -- Retries are different handles rather than a counter glued onto the last
  -- one, because `quiet_lantern_04_2` beside `quiet_lantern_04` reads as a
  -- copy of somebody. Twenty attempts against 230,400 handles is far past the
  -- point where the loop is what fails.
  for i in 0..19 loop
    candidate := public.generate_handle(new.id, i);
    insert into public.profiles (id, handle) values (new.id, candidate)
      on conflict do nothing;
    if found then
      return new;
    end if;
  end loop;

  -- Last resort, and it cannot collide: the account's own id. Ugly on
  -- purpose — a handle that looks like this is a bug report, and it is still
  -- immeasurably better than an account with no profile, which cannot
  -- publish at all.
  insert into public.profiles (id, handle)
    values (new.id, 'user_' || substr(replace(new.id::text, '-', ''), 1, 12))
    on conflict do nothing;
  return new;
end
$fn$;

comment on function public.handle_new_user() is
  'Gives every account a profile the instant it exists. Without it the first publish after sign-in fails on a foreign key.';

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Backfill ────────────────────────────────────────────────────────────────
-- For any account that already exists when this migration runs. On a fresh
-- project this does nothing, which is the point of writing it as a statement
-- rather than an instruction in a README.
-- It retries the same way the trigger does rather than taking the first
-- candidate and shrugging at a collision, because `on conflict do nothing` on
-- its own would leave exactly the profile-less account this file exists to
-- prevent, and leave it quietly.
do $backfill$
declare
  u record;
  candidate text;
begin
  for u in select id from auth.users loop
    if exists (select 1 from public.profiles where id = u.id) then
      continue;
    end if;
    for i in 0..19 loop
      candidate := public.generate_handle(u.id, i);
      insert into public.profiles (id, handle) values (u.id, candidate)
        on conflict do nothing;
      exit when found;
    end loop;
    if not exists (select 1 from public.profiles where id = u.id) then
      insert into public.profiles (id, handle)
        values (u.id, 'user_' || substr(replace(u.id::text, '-', ''), 1, 12));
    end if;
  end loop;
end
$backfill$;
