# Resuming Top Ten

*Session-handoff file, rewritten at the end of each session (Stack
convention). Read this first, then `AGENTS.md`, then `specs/`.*

**Last written:** 2026-08-15 · cloud session (Linux, no Xcode) · **M0, M1 and
M5's web half done; M1.5 prototype through eight rounds, three domains live**

---

## Where the project is

- **M0 — repo bootstrap: done.** `TopTenKit` builds and tests on CI, the CI
  gate is proven able to fail, `docs/resuming.md` exists.
- **M1.5 — flow prototype: round 1 of feedback applied.** Live at
  **https://topten-three.vercel.app**. Building a Ten is now ONE screen —
  search with live results, refinements (services, genre, director, actor),
  branching suggestions backed by a persistent graph with a map view, and the
  ten slots pinned in the dock, reorderable in place. Then the cut (only on overflow), the badge
  reveal, and the post-completion rabbit hole. 620-film catalog baked from
  TMDB with per-film streaming availability, cast, and recommendation edges.
  **Round 6 is pending Mischa's next pass.**
- **M1 — the brain: done.** `TopTenKit` holds the models, the criteria namer,
  guided placement, Borda consensus, palette derivation, the badge pre-pass
  and its inscription post-check, the suggestion engine and the catalog
  boundary. 85 tests, green on Linux CI. See the M1 section below.

## Sequencing change (2026-08-14, Mischa's call, executed by Claude)

KICKOFF orders M1 (the brain) before M1.5 (the prototype). We swapped them.
Reasoning: the prototype is what puts something in Mischa's hands, and the
placement algorithm M1 would harden is exactly what the prototype tests. It
immediately paid for itself — the prototype proved the PRD's "≤15
comparisons" acceptance criterion impossible (see prd.md Req 3 amendment)
before a line of Swift was written against it.

## What is verified, and where

- **CI (Linux, `kit-linux`):** `swift build` + `swift test` on TopTenKit —
  4 tests, green. Falsified once on a throwaway branch to prove the gate can
  go red.
- **Browser (Chromium, iPhone 15 Pro viewport, `docs/prototype/drive.js`):**
  the prototype driven end to end — 312 assertions in `drive.js`, plus 45 in
  `drive_share.js` for the public pages, zero page errors. Both now run in CI.
  Playwright is installed globally here, so the suite needs
  `NODE_PATH=/opt/node22/lib/node_modules` and a static server on 8788
  (`python3 -m http.server 8788` from `docs/prototype`). These now
  include layout invariants Mischa reported by eye: every block shares one
  left edge, rails align to it, all ten slots fit without scrolling, and
  nothing is trapped behind the dock. Screenshots from the same run judge the
  rest.
- **Deploy:** verified by fetching the live page and finding the build tag,
  not by assuming the push shipped.
- **Nothing is verified on a Mac or a device.** No app target exists.

## Round 1 feedback (2026-08-14) and what it changed

Mischa's notes, and where each landed:

| Note | Outcome |
|---|---|
| Build the list in one place: recs, search, refine, reorder, confirm | One screen; PRD Req 2/3 amended |
| Filter by subscriptions (top priority), genre, director, actor | Chip row, services first; catalog carries availability |
| Adding is abrupt — show where the item went | Poster flies to its slot; the card stays and draws a ring |
| "Because you picked X" is valuable but hard to see, and should branch | Section headings, plus a deeper control and a walkable trail |
| Text alignment and spacing are all over the place | One left edge and one spacing scale, both now asserted in tests |
| Language sounds unnatural ("Widely called great") | Reasons only when earned; captions removed |

## Round 2 feedback (2026-08-14) and what it changed

| Note | Outcome |
|---|---|
| Build the mind-map view | Built — a tidy tree of every followed and picked film (titled `Map of your selections` since round 4) |
| Going back destroys the branch ahead of it | Exploration is a persistent graph; navigating never removes a node |
| Didn't know how to add vs what the chevron did | Two named buttons per card: `+ Add` and `Similar ›` |
| Can't tell what a filter did | The **Now showing** bar states every clause of the query plus the match count |
| "Also adventure" isn't actionable | Reasons are tappable and narrow to that director/actor/genre |
| "Back" vs "Go deeper" unclear | Per-section verbs removed; navigation lives in Now showing and the map |

Storage key moved to `topten.proto.v4` and `load()` now normalises against a
fresh state — a v3 draft had no graph in it and would have thrown on first
read, which would have meant a dead page for the one person using it.

## Round 3 feedback (2026-08-15) and what it changed

| Note | Outcome |
|---|---|
| "More like Interstellar" led with non-Nolan films | Similarity reweighted: director 10 > TMDB edge 5 > cast 3 > genre 1.5 |
| "What about The Prestige?" | It was not on the shelf. Catalog 220 → 620, with full filmographies for repeat directors |
| Count said 2, one card shown | One `matching()` behind both the count and the rail |
| "Now showing — Everything" is strange | States the shelf's real size instead |
| Dead ends should suggest related paths | Escapes computed per clause: "Without Horror · 7 films" |
| YouTube (thought to need Premium) | It is free with ads; availability now covers free listings, grouped apart from subscriptions |
| Map has no breadcrumbs or way to drill in | Ghost nodes for unexplored steps, followable inside the map; states filters; opens centred on focus |

## Round 4 feedback (2026-08-15) and what it changed

| Note | Outcome |
|---|---|
| Lower the director weight | 10 → 5 (×1.2 when prolific), plus a cap of 4 films per director per rail |
| Authorship matters sometimes, franchise/studio other times | Links score on axes: series 14, lead actor 6, director 5, brand studio 5, TMDB edge 5, genre 1.5 |
| "More like Toy Story" should be the sequels, then Pixar | Series and brand-studio data added (`col`, `br`); Toy Story 2/3/4 lead, then Pixar |
| Top Gun should show Tom Cruise | Shared *lead* actor scores above director; Cruise films follow Top Gun |
| Could Foundation Models help? | Yes — recorded as the plan in prd.md Req 5: the model picks the **axis**, never the films |

The strongest axis also **labels** the card — *More Toy Story*, *Also Pixar*,
*With Tom Cruise* — because those are different promises and the user should
be told which one is being made.

Three data bugs found on the way: three of sixteen studio ids were wrong
(6735 is Participant, not Disney Animation; 2452 is the UK Film Council, not
Laika; 4 is Paramount Pictures, which put "Paramount Animation" under
Collateral), and the detail fetch set fields without clearing them, so a
corrected run left its own rejects in place. The build verifies brand ids
against TMDB now and fails loudly if they drift — the inherited rule from
tech-stack.md, finally applied to this data too.

## Known trap: a rebuilt shelf breaks old drafts

The catalog is regenerated from TMDB, so film ids come and go between builds.
A draft saved by an earlier build could name films that no longer exist, and
one unguarded `byId.get(id).t` blanked the whole map. State is now **pruned on
load**: unknown ids leave the tray and the graph, and a removed node's children
are re-parented to its parent so a path keeps its shape. Defend once at the
door, not at every read site — and the regression test carries exactly the
state that broke it.

**Anything that rebuilds `catalog.js` must assume someone is holding a draft
against the old one.**

## M5 — the web half (2026-08-15)

The pieces of M5 that can be verified from a cloud session, which is most of
them. Live at **https://topten-three.vercel.app** alongside the app prototype.

**Supabase schema, RLS and consensus** — `supabase/`. Tables for the object
model, `consensus_ten()` and `shared_with_consensus()` as Postgres functions,
and a trigger that refuses to publish anything that is not exactly ten items
in positions 1–10.

**RLS is executed, not reviewed.** `supabase/tests/run.sh` applies the
migration to a throwaway Postgres and runs every policy as three callers: an
anonymous visitor, the author, and a different signed-in user. Both roles are
`NOBYPASSRLS` — a suite run as superuser passes whatever the policies say. 24
checks, and **falsified**: weakening `tens_read_published_or_own` to
`using (true)` turns two red.

The schema is *not* applied to a real Supabase project. The dashboard and
management API are blocked at this environment's proxy, so that is a Mac-side
step — and Top Ten needs its **own** project, not Stack's.

**Three public web surfaces** — `docs/prototype/ten.html`, `topic.html`,
`card.html`, all built from `share.js`. 45 browser assertions in
`drive_share.js`.

**Data travels in the link** rather than from a database, so the pages are real
and shareable with no backend standing up. `Share.fromLocation` is the only
thing that knows about URLs; swapping the source for Supabase is a change to
one function, and the field names already match the schema's.

**One badge renderer.** `badge.js` and `tokens.css` were extracted from
`index.html` so the app screen, the share page and the OG card draw from the
same file. A test asserts the app and the share page produce byte-identical
SVG from one composition. Two extractions, both verified by the existing suite
staying green.

Three defects the work turned up, all now guarded:

1. `badgeSVG` referenced an `esc` that lived in `index.html`, so it worked on
   the app page and threw on the share page. It has its own now.
2. A top-level `function` attaches to `window` in a classic script and a
   top-level `const` does not — so `badgeSVG` was reachable from the share
   page and `lockedBadge` was not, and only the *locked* half of the gate
   broke. Both are exported explicitly now.
3. A composition with missing fields rendered as a black rectangle. `badgeSVG`
   fills defaults at the door.

**CI grew two jobs**: the Postgres policy suite, and a Chromium job running
both browser suites against the directory Vercel publishes.

## M1 — the brain (2026-08-15)

`TopTenKit` now holds every rule that can be expressed without a UI, and
everything the prototype proved is encoded here as the source of truth rather
than as JavaScript nobody can run twice.

| File | What it settles |
|---|---|
| `Domain.swift` | Domains and their vocabulary; `Item` as the shape the rules read |
| `Topic.swift` | Criteria, the namer, the surname rule, and the ≥10 supply gate |
| `Placement.swift` | Guided placement as a state machine; carries the 22 floor and its own 25 worst case as code |
| `Consensus.swift` | Borda, fed one Ten at a time, deterministic tie-breaks |
| `Palette.swift` | sRGB ↔ CIE L\*C\*h, the Laurel-safe clamp, and a reproducible RNG |
| `Badge.swift` | The pre-pass and its candidate sets — what the on-device model chooses among |
| `Inscription.swift` | The post-check as enforcing code, policing templates too |
| `BadgeEligibility.swift` | Re-rank: offer, never force |
| `Suggestions.swift` | The fraction is the reason and never the name |
| `Catalog.swift` | A three-question protocol, browse rows, TMDB DTOs |

**Verified on CI, which is the only instrument this session has.** No Swift
toolchain here (`download.swift.org` denied, no Docker), so M1 was written
blind and driven to green by reading the Linux job. Three rounds:

1. **The type checker gave up** on two `map`/`sorted` chains over tuple
   literals with mixed `Double` arithmetic. Rewritten as loops with annotated
   types. Worth knowing before writing more Swift blind: a chain that reads
   fine can simply exceed the inference budget.
2. **Argument order** — Swift wants memberwise-init arguments in declaration
   order, and three call sites had `creator:` before `genre:`.
3. **Two tests were wrong, not the code.** The comparison floor is a
   *worst-case* bound, not a per-run minimum — a lucky permutation finished in
   19, and the assertion said `min >= floor`. And the books fixture made every
   book a Romance, so the "Popular romance books" row was an exact copy of
   "Popular" and the new duplicate-row guard correctly dropped it.

**Mischa's calls, 2026-08-15** (recorded in prd.md's new Answered section):
"Top 10" in digits is the user-facing voice everywhere; re-ranking offers a
new badge and never forces one; fixture people stay as obvious fixtures; and
M2 waits — the next work is more prototype rounds, not SwiftUI nobody here can
compile.

## Round 8 (2026-08-15) — two card anatomies, and the one-line rule properly kept

| Ask | Outcome |
|---|---|
| Browse cards poster-only | A browse card is the poster and the title, 221pt instead of 320. The poster was always the add control |
| "See similar" after you add | Grown in place by `markCard` on the card you picked — no re-render, so the rail does not move and the ring keeps drawing |
| Splash breaks the one-line rule twice | The headline and sub-line were wrapping. Both `nowrap` now, both sized under measured ceilings |
| Bullets still not big enough | **13.5px → 15.75px ceiling** — see below. Shipping 15.4 / 16.2 / 17.9 against 13px before round 7 |
| Posters bigger, framed to match the CTA | 40px above the posters and 40px under the CTA on every screen; posters sized to their row exactly |
| Bold the last bullet | Done |
| Tooltip like Stack's | Modal: dims, freezes, spotlights the chip, one OK |
| The page title wraps | `fitOneLine` shrinks 30 → 20px; "Start over" moved off the title's line |

**Round 7's bullet limit was measured in the wrong box.** It reported a 13.5px
ceiling as hard arithmetic. The arithmetic was right and the box was wrong: the
splash was still paying `.wrap`'s 20px page gutters *and* its own 16px inset.
`.wrap.bare` drops the page gutters for that screen and the ceiling moved to
15.75px — more headroom than the numeral column and the side inset combined.

**A measured limit is only as good as the box you measured inside.** Worth
carrying: the first number was genuinely measured and the conclusion drawn from
it was still wrong, because there was a second constraint inside the box that
nobody had looked at.

Two collisions worth remembering. The reveal class for `See similar` was called
`.in`, which the card already used for its absolutely-positioned added-badge —
so the control rendered on top of the poster. And `--tile-h: 20svh` overshot its
row by 26px, which `.marquee`'s `overflow: hidden` swallowed silently; the test
now measures poster height *against its row* rather than on its own.

## Round 7 (2026-08-15) — the splash in thirds, and a screen you can browse

| Ask | Outcome |
|---|---|
| Poster scroll bigger — top 40% | Splash is three bands, `flex: 40/40/20` with **basis 0**; posters size off their band (123pt on an SE, 171pt on a Pro Max) |
| Bullets and sub-line bigger — next 40% | Headline `clamp(2rem, 9.5vw, 2.75rem)`, sub-line `clamp(1rem, 4.4vw, 1.1875rem)`. Bullets are capped — see below |
| CTA last 20%, "Make your first list" | Done |
| "All 2000+ movies in our collection" | A floor, not a count — the round step is chosen by what it costs |
| Far more browsing on the first screen | 11 rows, ~220 titles: Recent releases, Popular, then a row per genre in the collection's own order |
| Search and filters sticky | Sticky query bar (123pt); the Now showing readout deliberately stays out of it |
| Tooltip on Services | Coach mark with an arrow at the chip; retires on first pick, dismissal is permanent |
| Services sheet jitters on tap | It was re-rendering the whole sheet on every tap. Chips toggle in place now |

**The one thing that could not be done as asked.** Round 5 fixed *one line per
bullet* and a test enforces it; round 7 asked for bigger bullets. They meet at
a ceiling set by the longest sentence — *"Ten and only ten. The limit is the
point."*, 41 characters beside a numeral on a 375pt screen. Measured ceilings
are 13.5px at 375, 14.25px at 393, 16px at 430, and the ramp sits ~2% under
each. So bullets went from a flat 13px to 13.2–15.4px, and the real growth
went into the headline and sub-line, which are allowed to wrap. **Flagged to
Mischa** — if bigger bullets matter more than one line, the copy has to get
shorter, and that is his call.

## Round 6 (2026-08-15) — books, copy, and the naming correction

Five agents in parallel (copy, map, discover, books, catalog), integrated on
one branch. What each landed:

| Ask | Outcome |
|---|---|
| Intro: one line per bullet, "What's your Top 10?" | Rewritten; every claim now fits one line |
| US voice — "movies" not "films", US spelling | `specs/design.md` standing rule; asserted on four screens |
| "Other Top 10 Lists", lead with the name, no descriptions | Topic row dropped, creator demoted, blurbs gone |
| "All 940 films in our collection" — and shouldn't it be thousands? | Both halves fixed: **2,000 movies + 700 shows + 232 books**, and the count is now scoped to the shelf you are on |
| The map showed a selection nobody made; needs an empty state and a legend | Fixed, with a visual legend replacing the description line |
| Build the books domain | 232 books with their own covers, Author/Subject axes, no streaming chip |
| **List names must be criteria, satisfied 10/10** | The whole namer replaced — see below |

### The naming correction (Mischa, 2026-08-15)

The previous namer read a finished ten and made a claim about it: *"Everything
Hitchcock touched"*, *"The 90s did it better"*. Every name it produced was
true and every one was the wrong kind of thing. A list is named by **the
criteria all ten of its entries satisfy** — *Top 10 Crime Movies of the 90s* —
and the name is true of 10 of 10 not because anything re-checks it, but
because the criteria are what filtered the shelf the list was built from.
**Naming and scoping are the same act.**

The census the old namer used is still exactly right for deciding *which list
to offer next*. It was pointed at the wrong output. It now produces the
**reason** on a completion-screen card:

> **Top 10 Crime Movies of the 90s**
> 5 of your 10 were crime movies from the 90s.

A name is a rule; a fraction is a reason. Keeping them apart is the whole
correction, and a test asserts a reason never contains the name it justifies.

**A criteria name is a promise the next screen keeps, so a list the collection
cannot fill is never offered** — every topic is gated on ≥10 matching
candidates. The gate refuses *Top 10 Hitchcock Thrillers* (8 on the shelf) and
*Top 10 Eddie Murphy Comedies* (6), and it earned its keep immediately: it
exposed that `facts()` returned the top decade as the **string** `"1990"`,
which `inTopic` compares with `!==`, so every decade-scoped list had silently
been empty. Both the type and the effect are now regression-tested.

Two smaller judgements inside the namer: surnames shorten only when unique on
the shelf (*Hitchcock* yes; *Hayao Miyazaki* stays whole because Goro is there
too, *Eddie Murphy* because Cillian and Ryan are), and particles stay attached
(*Robert De Niro* → *De Niro*, which it briefly got wrong as *Niro*).

## Round 5 (2026-08-15) — onboarding, domains, discovery

| Ask | Outcome |
|---|---|
| Splash screen like Stack's first screen | `renderIntro` — curated artwork, three value props, cost answered, one CTA, no Skip, zero API calls (asserted) |
| Straight into the first Ten | Intro → Movies build screen, no questions first |
| Then related lists AND other list types | Finished screen offers both, side by side |
| TV shows next, then books/games/restaurants/travel | TV is real (320 shows, creators + networks + cast + recs); the rest are named as "Coming next" rather than hidden |
| Discovery after the 2nd list | Gated on `S.done.length >= 2`; six fixture people, each with their own topic |
| — | Reveal gate is real: lists readable, badges locked per topic, unlocking retroactively |

TV ids are offset by 10,000,000 — TMDB numbers films and shows separately and
1399 is both Game of Thrones and a film. One id space in the app, arranged in
one place (`build_tv.py`).

## What the prototype changed in the specs

All landed in the same commit as the code, per AGENTS.md:

- `prd.md` Req 3 — the ≤15 comparison target was mathematically impossible
  (floor is ⌈log₂(10!)⌉ = 22); relaxed to ≤ ~25, with the real design
  question named rather than papered over.
- `design.md` — gather anatomy, overflow shown not hidden, row artwork
  56 × 84, the reveal makes the app behind it inert, inscription timing
  budgeted rather than per-character.
- `badges.md` — the inscription post-check must be enforcing code, and must
  police templates too, not just model output.
- `tech-stack.md` — prototype verification harness, and why posters are
  mirrored locally for screenshot runs.

## Constraints you will hit in a cloud session

- **No local Swift.** `download.swift.org` is denied by egress policy and
  there is no Docker daemon. Kit changes verify through CI: batch, push, read
  the run.
- **You cannot compile SwiftUI.** Never claim app verification here.
- **Chromium cannot reach `image.tmdb.org`.** Mirror posters with `curl` and
  fulfil via `page.route` (already wired in `drive.js`). Never weaken TLS.
- **Vercel and Supabase dashboards/APIs are blocked** (403 at the proxy).
  Deployed `*.vercel.app` pages *are* reachable, which is how deploys get
  verified. Anything needing the Vercel or Supabase dashboard is Mischa's
  hands, not ours.

## Standing traps

- **Vercel skips non-owner commits.** Repo git config commits as
  `Mischa <onlinestuff4me@gmail.com>`; leave it. Pushed is not shipped.
- **Pushing to `main` is allowed** (Mischa, 2026-08-14) on the standing
  condition: say what is going before, confirm what landed after.
- **Specs update in the implementing commit**, dated, with reasoning.
- **Never print secret values.** Presence and length only.
- Repo is **public** — treat everything committed as world-readable. The
  prototype ships no API key by design; its catalog is baked at build time.

## Loose ends

- `claude/ci-gate-check` still exists on the remote (the deliberate red
  branch). This session's git access cannot delete branches — Mischa can, or
  it can simply be ignored.
- The env vars in cloud sessions (`EXPO_PUBLIC_SUPABASE_*`,
  `EXPO_PUBLIC_TMDB_API_KEY`) are **Stack's**, not Top Ten's. The TMDB key is
  fine to reuse for build-time catalog work. Top Ten needs its **own**
  Supabase project at M5 — do not point it at Stack's database.
- Open questions in `prd.md` are unchanged and none block M1.
