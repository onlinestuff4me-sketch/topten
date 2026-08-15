# Top Ten — Tech Stack

**Status:** Draft v1
**Last updated:** 2026-08-14
**Owner:** Mischa

Coding agents should build against this without re-litigating these choices;
if a choice needs to change, update this file and note why.

## Locked stack

### iOS app (the product)

- **Swift 6 / SwiftUI**, **iOS 26 minimum**. The floor is deliberate: Liquid
  Glass materials and the FoundationModels framework are the product's
  differentiators, and the ADA goal rewards current-platform adoption. No
  UIKit screens; UIKit interop only where SwiftUI has no equivalent
  (document it here when it happens).
- **FoundationModels framework** (on-device Apple Intelligence) for the
  rabbit-hole suggestion engine and badge direction/inscription, using
  `@Generable` guided generation so outputs are structurally constrained.
  Every call site must handle `SystemLanguageModel.availability` — the
  fallback ladders in prd.md Req 5 and badges.md are requirements, not
  nice-to-haves (device support, Apple Intelligence toggled off, model
  updating are all normal states).
- **SwiftData** for local persistence (drafts, completed Tens, badge
  compositions, suggestion history). Device is source of truth for
  unpublished work.
- **No third-party UI or convenience dependencies by default.** Every
  dependency is a decision recorded here. Expected initial dependency count:
  ~0–2 (e.g., `supabase-swift`).

### Shared logic — `TopTenKit` (the load-bearing structural decision)

A platform-independent Swift Package containing: domain models (Topic, Ten,
Item, BadgeComposition, remix edges), ranking/placement logic, consensus
scoring, palette derivation, badge deterministic pre-pass, topic
normalization, suggestion candidate assembly, Laurel token definitions
(exported to CSS for web), and all TMDB/Supabase DTOs.

**Why it exists:** cloud agent sessions run on Linux with no Xcode. Swift
builds and tests fine on Linux as long as it avoids SwiftUI/UIKit/CoreGraphics.
Keeping every testable rule in `TopTenKit` means cloud sessions can do real
verified work (`swift test`) on the app's brain, and the Mac/CI is only
needed for the body. Anything expressible without a framework import goes in
the Kit; if a PR adds logic to the app target that could live in the Kit,
move it.

### Backend

- **Supabase** (Postgres + Auth + RLS) — the pattern proven in Stack.
  Tables (initial): `profiles`, `topics`, `tens` (one row per published Ten,
  **stable id** — future social features attach to it, the Stack lesson),
  `ten_items`, `badges` (composition JSON), `remix_edges`, `unlocks`.
  Consensus computed by a Postgres function per topic on publish (≤1 min
  lag acceptable per PRD Req 9).
- **Auth:** passwordless magic link + 6-digit code (proven flow). Sign-in
  required only to publish. Anonymous local use is first-class.
- Migrations numbered `0001…` with a `supabase/README.md`, run deliberately —
  same discipline as Stack.

### Catalog

- **TMDB** for movies/TV: search, metadata, artwork, person/genre filters
  for topic scopes. Attribution required. **Licence is non-commercial** —
  this is why the app is unmonetised (PRD Non-Goals); re-audit before any
  paid feature. Inherited data lessons from Stack: TMDB `release_date` is
  earliest-anywhere and parses as UTC midnight (own a calendar-day layer if
  dates ever surface); provider/person IDs can drift — assert seed IDs in CI.
- P1 domains get catalog adapters behind a `Catalog` protocol in TopTenKit
  (Apple Music for music is the expected next one — native, artwork-rich).

### Web share pages

- **Next.js on Vercel** (topten.app working domain): `/t/[token]` Ten pages,
  `/topic/[slug]` topic pages. Server-rendered, fast, no client JS required
  for reading. OG images rendered from the same Share Card design via the
  web badge/card renderer fed by TopTenKit-exported tokens.
- Playwright e2e for the web surface, runnable entirely in cloud sessions —
  this inherits Stack's whole e2e discipline (parallel runner, mock
  fixtures, "a test that cannot go red proves nothing": falsify new
  regression tests against the pre-fix commit).

## ⚠️ Inherited trap — Vercel silently skips non-owner commits

Vercel's free plan only builds commits whose **COMMITTER** is the repo owner
(`onlinestuff4me@gmail.com`). A commit committed as anyone else — Claude, a
bot, CI — lands on `main` and is **silently skipped**: no build, no error,
and the live site keeps serving the old bundle. This cost two full sessions
on Stack. Before committing anything meant to ship to the web:

```bash
git config user.name "Mischa"
git config user.email "onlinestuff4me@gmail.com"
```

**Pushed is not shipped.** Verify a deploy ran (deployment list or a literal
from the change grepped out of the served bundle) before reporting live.

## Verification workflow

Three environments; every report names which one it verified in.

1. **Cloud (Linux):** `swift test` on TopTenKit; full web build + Playwright;
   Supabase migrations against a branch database. Cannot compile the app
   target — never claim app verification here.
2. **Mac (Mischa's machine, Claude Code local):** `xcodebuild build test`
   (unit + snapshot tests), simulator boots + XCUITest for flows
   (gather→rank→reveal is the canonical smoke), screenshot capture for
   design review. Batch verification (Stack lesson): verify at batch
   boundaries, not per item — one build per batch, targeted tests while
   iterating, full suite before "done."
3. **CI (GitHub Actions):** macOS runner builds app + runs tests on every
   PR (so cloud-authored Swift gets compiler truth without a Mac session);
   Linux job runs TopTenKit tests + web e2e. **Nothing runs on Mischa's Mac
   on a schedule** — automation lives in Actions (Stack rule).

Testing stances inherited wholesale from Stack: snapshot/screenshots judge
layout and copy, tests judge behaviour; never round partial results up;
green e2e proves the app works, not that data is live; keep a
viewport-overflow test equivalent (Dynamic Type XL sweep asserting no
truncation) once screens exist.

### Amendment 2026-08-14 (M0, Claude) — cloud sessions have no local Swift

Point 1 above says a cloud session runs `swift test`. In the actual cloud
environment it can't run it *locally*: `download.swift.org` is denied by the
session's egress policy (403 on CONNECT) and there is no Docker daemon to
pull a `swift` image, so no toolchain can be installed. Swift on Linux is
therefore verified **through CI**, not in the session's terminal.

Consequence for how work is done here, which is why this is written down
rather than worked around: a cloud session's red/green loop is a push and a
CI run, not a command. Batch Kit changes before pushing, and read the run
rather than guessing. Everything else in point 1 (web build, Playwright,
Supabase migrations) is unaffected — those toolchains are present. If a
future session finds swift.org reachable, install the toolchain and delete
this amendment.

### CI shape (decided 2026-08-14, M0, Claude)

`.github/workflows/ci.yml`, one job per environment:

- **`kit-linux`** — `swift build` + `swift test` on `TopTenKit` inside a
  pinned `swift:6.2` container. Pinned image rather than a third-party setup
  action: reproducible, and it keeps the dependency stance above honest about
  CI as well as app code. Bump the tag deliberately.
- **`probe-app` → `app-macos`** — a one-step Linux job looks for
  `App/*.xcodeproj`; the macOS job only runs if it finds one. macOS runner
  minutes bill at 10x, and a job whose whole output is "nothing to build yet"
  is noise in every run. M2 owns the `SCHEME`/`DESTINATION` env values in
  that job.
- Triggers are **every branch push** plus PRs into `main`, because
  cloud-authored Swift needs compiler truth before there's a PR to open —
  waiting for review to discover a syntax error wastes a session.
- The web/Playwright job joins at M1.5, when `web/` exists.

### Prototype verification (added 2026-08-14, M1.5)

The flow prototype in `docs/prototype/` is driven end to end by Playwright
against a real Chromium at iPhone viewport: gather → cut → rank → reveal →
rabbit hole, asserting behaviour at each step (the cut is required past ten,
an eleventh keep is refused, the reveal only becomes skippable after 0.8s,
the inscription obeys its word cap, every provocation is true of the actual
picks, the draft survives a reload). Screenshots come from the same run.
Tests judge behaviour, screenshots judge layout — never swapped.

Two environment facts worth keeping:

- **Chromium here cannot reach `image.tmdb.org`.** The container only reaches
  it through the agent proxy, whose certificate the bundled browser does not
  trust. Rather than weaken TLS, the harness mirrors posters locally with
  `curl` and fulfils image requests from disk. Real phones fetch them
  directly, so this is a harness detail, not a product one.
- **The prototype ships no API key.** Its catalog is generated at build time
  (`docs/prototype/build_catalog.py`) and committed as `catalog.js`, so the page
  needs no secrets and works offline. Poster dominant colours are computed at
  build time too, which is why badge palettes genuinely derive from artwork.

### Prototype catalog: how big, and how it is chosen (2026-08-15, Claude)

Mischa, on reading "All 940 films on the shelf": *"shouldn't there be
thousands?"* He is right, and it is the same complaint as round 3, where
following Interstellar could not reach The Prestige because The Prestige was
not in the shelf. **620 films + 320 shows → 2,000 films + 700 shows.**

The pipeline, in order — each step reads and rewrites `catalog.js`, so the
order is not optional:

```
python3 build_catalog.py               # films: select, poster colour, director
python3 enrich_catalog.py              # cast, in-catalog recs, raw providers
python3 enrich_catalog.py --details    # series (col) + brand studio (br)
python3 enrich_catalog.py --providers  # canonical sv, incl. free-with-ads
python3 build_tv.py                    # shows, appended in the same shape
```

Selection is unchanged **in kind** — canon-weighted, `standing = rating ×
log10(votes)`, so the shelf reads as a canon rather than a new-releases rail.
Four things changed to make it work at scale, each because the old shape
broke when stretched:

- **The candidate pool is now the whole eligible universe, not a sample.**
  TMDB holds 9,306 films with 400+ votes and 3,114 shows with 150+; both
  sweep completely (466 and 156 discover pages, ~20s each). Approximating
  "the canon" by walking genre pages made sense when the shelf was 220; with
  the full field in hand the trim ranks the real population.
- **Named canon is PINNED past the trim.** The by-name lists exist because
  standing buries these titles — so letting them compete against standing
  defeated the list. Measured: 17 of the 49 named films were being trimmed
  out of the 620 build, including The Master, Drive My Car and Past Lives.
  Named titles now skip the trim — in the build that shipped, 66 of 239 films
  and 74 of 179 shows were below the standing cutoff and survive only because
  they are named. The lists themselves were widened toward the eras and
  languages vote counts bury hardest: pre-1980 films went 52 → 209, and the
  film shelf now opens on A Trip to the Moon (1902) rather than the 1920s.
  This is the only hand on the scale, and
  unresolved names are printed loudly rather than swallowed, because a name
  that stops resolving is the list rotting. Two are currently unresolved and
  deliberately so: *This Country* (58 votes) and *Stath Lets Flats* (49) sit
  under the 60-vote canon floor, which is the floor working — a show with
  fifty votes has no cast, no creator and no recommendation edges to give.
- **Title matching is exact, accent-folded, highest-vote-wins.** A fuzzy top
  hit is how you pin the 2019 remake. `8½` needed a separate search term
  (`QUERY_FOR`) because TMDB's own search cannot find that title from
  itself — it returns Code 8 and 8 Mile.
- **Authorship expansion is bounded and id-based.** Directors/creators are
  resolved on a shortlist (pinned canon + top 2×target by standing) rather
  than on all ~10,000 candidates, because a credits call per candidate is six
  minutes of wall clock spent learning who directed films the trim will drop.
  The TMDB person id now comes out of the credits row itself, so the
  filmography expansion no longer needs a `/search/person` per name — which
  also removes the chance of expanding the wrong Michael Bay. TV has no crew
  filter on `/discover/tv`, so its equivalent walks
  `/person/{id}/tv_credits` and keeps the `Creator` credits.

Two defects the rebuild exposed and fixed:

- **TV had no streaming availability at all.** `build_tv.py` wrote raw TMDB
  provider names to `svraw`, a field nothing in `index.html` reads, so every
  show in the app was unwatchable everywhere while the field looked present.
  TV now canonicalises through the *same* tables the film side uses —
  imported from `enrich_catalog.py`, not copied, so the two domains cannot
  drift — and writes `sv`. `svraw` is gone. Any service only TV carries is
  merged into `window.SERVICES` so it has a chip in the filter sheet.
- **A quarter of shows had no creator.** `created_by` is empty for most
  British and nearly all Japanese shows, and `d` is what the creator facet and
  the "Also <author>" branch label are built from. The `aggregate_credits`
  call already being made for the cast also carries a `Creator` job, so it is
  used as the fallback; coverage went 77% (245/320) → 82% (572/700). The
  remainder are genuinely authorless in TMDB — miniseries like Band of
  Brothers, and most anime.

**Id verification is unchanged and non-negotiable** (`verify_brands`,
`verify_networks`): every brand studio and TV network id is checked against
TMDB by name before use and the build dies if one has drifted. The seven
networks added for the bigger shelf (FX, USA Network, Syfy, STARZ, Disney
Channel, Disney XD, Nickelodeon) were taken from a census of the networks
actually carrying the top 600 shows, not guessed — a guessed id is exactly
what that check exists to catch.

**Page weight is the constraint that caps this.** `catalog.js` is loaded on
every visit, so the shelf size is bounded by bytes, not by taste. Measured at
2,700 items: **969,882 bytes (0.92 MB), 359 bytes an item**, against a ~1.5 MB
ceiling — so nothing was dropped and the field shape is unchanged. When that
ceiling is reached, the lever is per-item payload, not the number of titles,
because the number of titles is the whole point of this change. Measured on
this file: dropping `pop` saves 3.0%, `vc` 2.8% (5.8% together), and `tmdb`
another 0.9%. All three are build-time-only — `index.html` reads none of them;
`pop` sets the written order, `vc` feeds `standing`, both before the file is
written, and `tmdb` is derivable as `id - 10_000_000`. That budget puts the
ceiling near 4,500 items, which is where the next conversation starts.

**A harness lesson from this rebuild.** `drive.js` drilled into *the first
card* of a branch rail and then asserted that walking back moved the focus up
the path. On the 2,000-film shelf the first card became a film the test had
already added, and following an existing node re-enters it where it already
sits (documented behaviour — "tapping a followed node re-enters the path
there") rather than hanging a new child off the current focus, so the trail
was one node long and there was nowhere to walk back to. The assertion was
right and the setup was wrong: it now drills into the first card that is *not*
already on the map, and asserts that it added exactly one node. **Which title
sits first in a rail is a fact about the shelf, not about the app** — a
harness step that depends on it will break every time the catalog is rebuilt.

## Distribution

- **TestFlight** via GitHub Actions (fastlane or Xcode Cloud — decide and
  record at M6; Stack's lesson: local CLI release tools abort silently in
  agent shells, so the canonical release path is a workflow file from day
  one). `ascAppId` and signing config recorded here once created.
- Web auto-deploys from `main` (with the committer trap above).

## Secrets & env

- iOS: TMDB key and Supabase anon key in a gitignored `Secrets.xcconfig`
  (+ `Secrets.example.xcconfig` committed). Client keys are
  publishable-class, but **never print secret values — presence and length
  only** (standing rule).
- Web: Vercel env vars; same rule.
- No mock-catalog silent fallback (Stack's bit hard): if keys are absent the
  app fails **loudly** at launch in DEBUG, and search surfaces a designed
  error state in RELEASE. Fixtures for tests are explicit, opt-in test
  doubles in TopTenKit, never an ambient fallback.

## Repo layout

```
topten/
  AGENTS.md              ← process contract (auto-loaded by agents)
  KICKOFF.md             ← bootstrap prompt + milestone plan
  specs/                 ← prd.md, design.md, badges.md, tech-stack.md
  docs/                  ← investigations, options considered, resuming.md
  TopTenKit/             ← SPM package: all platform-independent logic + tests
  App/                   ← Xcode project (SwiftUI app target, snapshot + UI tests)
  web/                   ← Next.js share pages + Playwright e2e
  supabase/              ← migrations + README
  .github/workflows/     ← ci.yml (mac + linux jobs), deploy checks
```

## Deferred, tracked

- Analytics decision (PRD open question) — no telemetry code until decided.
- Push notifications — P1 social layer; needs APNs setup, not before.
- Apple Music catalog adapter — P1.
- Image-gen badge tier — P1, blocked on licensing re-audit.
- iPad/visionOS layouts — P2.
