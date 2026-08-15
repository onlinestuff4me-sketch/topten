# Supabase

The database half of M5: schema, row-level security, and the consensus
function. Migrations are numbered and run **deliberately** — the Stack
discipline, inherited via `specs/tech-stack.md`.

```
migrations/0001_init.sql             the schema, its triggers, and every RLS policy
migrations/0002_aggregate_stats.sql  aggregate-only analytics, as views
migrations/0003_grants.sql           table privileges for the anon/authenticated roles
verify.sql                           paste into Supabase after migrating: did it land, whole?
tests/run.sh                         applies all three to a throwaway Postgres and runs the suite
tests/00_supabase_stub.sql           the parts of Supabase the migrations assume
tests/01_grants.sql                  the little the local stub needs on top of 0003
tests/rls_test.sql                   30 checks, executed as three different callers
```

## Running the tests

```sh
supabase/tests/run.sh
```

Needs PostgreSQL 16 binaries on `PATH` (or `PGBIN=` pointing at them). It
starts its own server on a unix socket in `/var/tmp`, so it touches nothing
already running, and it is what CI's **Schema and RLS** job executes.

## Why the tests exist in this form

**RLS cannot be reviewed by reading.** A policy that is too permissive looks
exactly like one that is correct — `using (true)` and
`using (published_at is not null or author_id = auth.uid())` are the same
shape on the page and opposite in effect. So the suite *executes* each policy
as three callers:

- **anon** — a visitor with no account, arriving from a shared link
- **the author** — signed in, looking at their own draft
- **someone else** — signed in, looking at a draft that is not theirs

Both roles are `NOBYPASSRLS`. That matters more than it looks: a superuser
ignores every policy in the file, and a suite run as one passes no matter what
the policies say.

The suite has been **falsified twice**, which is the only reason to trust it.
Weakening `tens_read_published_or_own` to `using (true)` turns two checks red;
dropping `security_invoker` from the aggregate views turns another red.

The second falsification is the more useful story. The first version of that
check asserted "a draft must not raise the published count", and it passed with
`security_invoker` removed — because each view's own `WHERE` clause already
excludes drafts, so RLS never entered into it. The test proved nothing and the
comment above it claimed the setting was load-bearing. Both were corrected: the
setting is defence in depth for the *next* view, and the check is now
structural — every view in `public` must carry it.

## What the schema commits to

- **A published Ten is world-readable; a draft is yours alone.** The web page
  is the product's front door (PRD Req 11), so no account is required to read
  one.
- **The list is never gated — only the badge is** (PRD Req 12). Badge rows are
  therefore readable, and the lock is drawn by the client. Hiding the row
  would turn "you have not earned this" into a 404 and make an unlock cost a
  round trip.
- **A Ten is ten.** A trigger refuses to publish anything that is not exactly
  ten items in positions 1 through 10. This is a product promise (AGENTS.md,
  locked) and the app is not the only thing that can write to the database.
- **Publishing is an UPDATE, always.** You create a draft, add items, then set
  `published_at`. A row cannot be born published, because at that instant it
  has no items. The first draft used a deferred constraint trigger so an
  INSERT could carry its items along — but an error raised at COMMIT is
  outside any plpgsql handler, so that version could not be tested. An
  untestable guarantee is not one.
- **One take per person per topic.** A second take is an edit of the first.
  Otherwise consensus counts one person twice and "you and Sam share 6" has to
  ask which Sam.
- **Handles are generated, not chosen** (2026-08-15). `TopTenKit/Handle.swift`
  mints them and its validity rule is character-for-character the database's
  `handle_shape` constraint — a client that can mint a handle the database
  refuses is a client that fails at publish time, on the one action that
  matters.
- **Analytics are aggregate only** (2026-08-15), and implemented as views over
  rows that already exist rather than counters fed by triggers. A counter
  column is a second copy of a number, and second copies are wrong eventually.
- **Nothing stores a user-typed title or description**, because the product
  has no such field (PRD Req 12 amendment) and a nullable column is an
  invitation. `topics.title` and `topics.prompt` are a *derived cache* written
  from the criteria, and regenerated if the namer changes.

## Setting up the project — the steps, in order

Mischa creates the project; Claude writes the client (decided 2026-08-15).
Roughly ten minutes.

### 1. Make a new project

app.supabase.com → **New project**.

- **Not Stack's project.** The `EXPO_PUBLIC_SUPABASE_*` variables in cloud
  sessions belong to Stack; putting Top Ten's tables in that database mixes two
  products in one place forever.
- Name: `topten`. Region: closest to you. Save the database password somewhere
  — it is not needed for any of this, but it is not shown again.
- Wait for provisioning (~2 minutes).

### 2. Run the migrations

Left sidebar → **SQL Editor** → **New query**. Paste each file's whole contents
and run it, **in this order**, checking each says Success before the next:

| Order | File | What it does |
|---|---|---|
| 1 | `supabase/migrations/0001_init.sql` | Tables, triggers, consensus functions, every RLS policy |
| 2 | `supabase/migrations/0002_aggregate_stats.sql` | The aggregate-only analytics views |
| 3 | `supabase/migrations/0003_grants.sql` | Table privileges for the `anon` and `authenticated` roles |

They are ordered because each depends on the last. If one errors, stop and send
me the message rather than running the next.

*(If you have the Supabase CLI linked instead, `supabase db push` does all
three and is equivalent.)*

### 3. Check it landed

New query → paste **`supabase/verify.sql`** → run. It changes nothing and
prints ten lines. Every one should start `ok`:

```
  ok    tables                                  7 of 7
  ok    row level security enabled              7 of 7
  ok    policies                                15 of 15
  ok    aggregate views                         4 of 4
  ok    views run as caller (security_invoker)  4 of 4
  ok    functions                               5 of 5
  ok    the "a Ten is ten" trigger              1 of 1
  ok    anon can read the tables                7 of 7
  ok    authenticated can write                 7 of 7
  ok    tables are empty (a fresh project)      0 tens
```

A `FAIL` line names what is missing — a missing policy is printed by name, not
as a count. Send me the whole output if any line fails.

### 4. Turn on email sign-in

**Authentication → Providers → Email.** Enable it, and leave "Confirm email"
on. Sign-in is only ever required to *publish*; anonymous local use stays
first-class (PRD Req 10), so nothing else here needs changing.

### 5. Send me two values

**Project Settings → API**:

- **Project URL** — `https://<something>.supabase.co`
- **anon / public** key — the long one labelled `anon`

**Do not send the `service_role` key.** It bypasses every policy in this
directory and nothing in this product needs it. The anon key is designed to be
public — it ships inside a web page — which is exactly why the policies are
tested the way they are.

Then I wire the prototype's publish and read paths to the real database and
verify against it. That is the first moment "a Ten published from the app is
live on a real URL" can actually be checked, rather than asserted.

## Until then

**The schema is tested but unapplied**, and that is stated plainly rather than
rounded up: 30 checks pass against a local Postgres in CI, and no row has ever
been written to a real project.

## Applying it for real

Not done from a cloud session: Supabase's dashboard and management API are
blocked at this environment's proxy (`specs/tech-stack.md`). The migration is
written and tested here; pointing it at a real project is a Mac-side step.

**Top Ten needs its own Supabase project.** The `EXPO_PUBLIC_SUPABASE_*`
variables in cloud sessions belong to Stack — do not point this at that
database.
