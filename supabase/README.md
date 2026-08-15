# Supabase

The database half of M5: schema, row-level security, and the consensus
function. Migrations are numbered and run **deliberately** — the Stack
discipline, inherited via `specs/tech-stack.md`.

```
migrations/0001_init.sql               the schema, its triggers, and every RLS policy
migrations/0002_aggregate_stats.sql    aggregate-only analytics, as views
migrations/0003_grants.sql             table privileges for the anon/authenticated roles
migrations/0004_profile_on_signup.sql  every account gets a profile the instant it exists
verify.sql                             paste into Supabase after migrating: did it land, whole?
tests/run.sh                           applies all four, runs verify.sql, then the suite
tests/00_supabase_stub.sql             the parts of Supabase the migrations assume
tests/01_grants.sql                    the little the local stub needs on top of 0003
tests/rls_test.sql                     37 checks, executed as three different callers
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

The suite has been **falsified three times**, which is the only reason to
trust it. Weakening `tens_read_published_or_own` to `using (true)` turns two
checks red; dropping `security_invoker` from the aggregate views turns another
red; removing `0004`'s trigger turns five red and fails `verify.sql` on a
separate line.

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
- **Handles are generated, not chosen** (2026-08-15), and once an account
  exists the *database* is what mints one — `0004`, inside the same
  transaction as the signup. A client-supplied handle would make it
  chosen-at-signup for anyone calling the API directly, so the trigger ignores
  `raw_user_meta_data` and a check in the suite says so.
  `TopTenKit/Handle.swift` keeps the same wordlists for the half of the
  product that has no account yet, and its validity rule is
  character-for-character the `handle_shape` constraint.
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
| 4 | `supabase/migrations/0004_profile_on_signup.sql` | Gives every account a profile the moment it exists |

`0004` is the one magic link makes non-optional. Signing in creates a row in
`auth.users` and nothing else; `tens.author_id` points at `public.profiles`.
Without the trigger in `0004`, the first publish after the first sign-in fails
on a foreign key — at the exact moment the product is for. If it does not
apply, stop: nothing downstream is worth testing.

They are ordered because each depends on the last. If one errors, stop and send
me the message rather than running the next.

*(If you have the Supabase CLI linked instead, `supabase db push` does all
four and is equivalent.)*

### 3. Check it landed

New query → paste **`supabase/verify.sql`** → run. It changes nothing and
prints eleven lines. Every one should start `ok`:

```
  ok    tables                                          7 of 7
  ok    row level security enabled                      7 of 7
  ok    policies                                        15 of 15
  ok    aggregate views                                 4 of 4
  ok    views run as caller (security_invoker)          4 of 4
  ok    functions                                       8 of 8
  ok    the "a Ten is ten" trigger                      1 of 1
  ok    the "signing in gives you a profile" trigger    1 of 1
  ok    anon can read the tables                        7 of 7
  ok    authenticated can write                         7 of 7
  ok    tables are empty (a fresh project)              0 tens
```

A `FAIL` line names what is missing — a missing policy is printed by name, not
as a count. Send me the whole output if any line fails.

### 4. Turn on magic-link sign-in

Sign-in is only ever required to *publish*; anonymous local use stays
first-class (PRD Req 10). Magic link, like Stack — no passwords anywhere in
this product.

There is **no "Magic Link" provider** to switch on. A magic link *is* the
email provider: the client calls `signInWithOtp({ email })` and Supabase sends
the link. So what follows is mostly about the three settings that make the
link work, each of which fails in a way that looks like something else.

**a. Authentication → Providers → Email** — make sure it is enabled. Leave the
rest alone.

**b. Authentication → URL Configuration** — this is the one that bites.

| Field | Set it to |
|---|---|
| Site URL | `https://topten-three.vercel.app` |
| Redirect URLs | `https://topten-three.vercel.app/**`, and `http://localhost:*/**` if you ever open the prototype from a file server |

The default Site URL on a new project is `http://localhost:3000`. Leave it and
every magic link you send lands on a page that does not exist — on your phone,
where there is no localhost at all. The symptom reads like a broken email, and
the cause is one field.

**c. Authentication → Rate Limits** — read the "emails per hour" figure and
tell me what it says.

Supabase's built-in email sender is a shared, throttled one meant for testing,
and the allowance is small — single digits per hour. That is fine for you
signing in once. It is not fine for a TestFlight round, and when it runs out
the failure is a silent non-delivery rather than an error. Before we put this
in front of anyone else we add custom SMTP (**Project Settings → Auth → SMTP
Settings**; Resend's free tier is enough). Not needed today.

*(I could not check the current default from this session — supabase.com is
blocked at the environment's egress proxy, so the number above is "small"
rather than a figure I would have you rely on. The dashboard is authoritative.)*

**What you should NOT do:**

- Don't turn off "Confirm email". It does not gate magic links, and off it
  weakens the signup path we might add later.
- Don't add a password provider "just in case". A second way in is a second
  thing to secure and a second thing to explain.

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
rounded up: 37 checks pass against a local Postgres in CI, and no row has ever
been written to a real project.

## Applying it for real

Not done from a cloud session: Supabase's dashboard and management API are
blocked at this environment's proxy (`specs/tech-stack.md`). The migration is
written and tested here; pointing it at a real project is a Mac-side step.

**Top Ten needs its own Supabase project.** The `EXPO_PUBLIC_SUPABASE_*`
variables in cloud sessions belong to Stack — do not point this at that
database.
