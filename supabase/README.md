# Supabase

The database half of M5: schema, row-level security, and the consensus
function. Migrations are numbered and run **deliberately** — the Stack
discipline, inherited via `specs/tech-stack.md`.

```
migrations/0001_init.sql    the schema, its triggers, and every RLS policy
tests/run.sh                applies it to a throwaway Postgres and runs the suite
tests/00_supabase_stub.sql  the parts of Supabase the migration assumes
tests/01_grants.sql         role grants (need the tables to exist first)
tests/rls_test.sql          24 checks, executed as three different callers
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

The suite has been **falsified**: weakening `tens_read_published_or_own` to
`using (true)` turns two checks red. A gate that has never been seen to fail
is not known to be a gate.

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
- **Nothing stores a user-typed title or description**, because the product
  has no such field (PRD Req 12 amendment) and a nullable column is an
  invitation. `topics.title` and `topics.prompt` are a *derived cache* written
  from the criteria, and regenerated if the namer changes.

## Applying it for real

Not done from a cloud session: Supabase's dashboard and management API are
blocked at this environment's proxy (`specs/tech-stack.md`). The migration is
written and tested here; pointing it at a real project is a Mac-side step.

**Top Ten needs its own Supabase project.** The `EXPO_PUBLIC_SUPABASE_*`
variables in cloud sessions belong to Stack — do not point this at that
database.
