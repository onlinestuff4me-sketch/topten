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

## ⚠️ Trap — a shared script's `const` is not scoped to that script

**Found 2026-11-17 (Claude).** `docs/prototype/badge.js` is a classic
`<script>` loaded beside `index.html`, `ten.html`, `topic.html` and
`card.html`. A top-level `const` in a classic script does **not** become a
property of `window` and is **not** private to the file — it goes into the
one global *lexical* environment shared by every classic script on the page.
So `const MOTIFS` in `badge.js` beside `const MOTIFS` in `index.html` is not
shadowing. It is a `SyntaxError`, it stops the entire page parsing, and the
page is blank.

Two things make it expensive:

- **The symptom is four layers from the cause.** The app never boots, so the
  first assertion to fail was `a new user lands on the intro, not on a form`
  — which points at routing, at state, at anything but a name collision in
  a different file.
- **The obvious test does not work.** Asserting `window.MOTIFS` passes no
  matter what either file does, because a top-level `const` is never on
  `window`. The test has to read the **bare identifier** (`typeof MOTIFS`),
  evaluated inside the page.

The rule: **a shared script states its surface and closes over the rest.**
`badge.js` is wrapped in an IIFE and assigns its four exports to `window`
explicitly at the bottom. `drive.js` asserts both halves — that the exports
are present and that the kit (`PLATES`, `ENAMELS`, `MATERIALS`, …) is not —
and both halves were falsified by re-leaking a name and watching the suite
go red.

## WARNING - Trap: CSS transform beats an SVG transform attribute

**Found 2026-11-17 (Claude).** The reveal ceremony animates badge layers by
class, and the landed state is `.layer.on { transform: none }`. The badge's
motif carried its placement as a `transform` **attribute** on that same
element. CSS always wins over a presentation attribute, so the moment the
layer landed, `transform: none` wiped the placement and the motif snapped
back to its authored box - where the ribbon cut it in half.

The rule: **an element that CSS animates must not also carry a layout
transform attribute.** Put the placement on an inner group. The same applies
to `fill`, `stroke` and every other presentation attribute wherever a
stylesheet touches the element.

It is quiet because both halves look right in isolation: the SVG is correct
when opened on its own, and the CSS is correct on an element with no
transform attribute. Only the landed state of the animation is wrong, which
is the one frame a 1.4s-into-the-ceremony screenshot does not show. The walk
harness now waits for the ceremony to finish before shooting.

## WARNING - Trap: nothing inside a template literal means what it looks like

Three bugs in one day, all the same shape. A browser check written as a
template literal and handed to `page.evaluate` is a STRING first: JavaScript
processes its escapes before the browser ever sees the text.

**A backtick ends it.** A comment quoting a CSS selector in backticks closed
the literal in `badge.js`, and because that is a classic script shared by
four pages the symptom was the whole app failing to boot. It happened again
an hour later in `drive.js`, quoting a variable name. Comments inside these
strings get no backticks - name the thing in plain words.

**A backslash is eaten.** `\\(` becomes `(` and `\\s` becomes the letter
`s`. This silently destroyed the contrast check:

    written   /rgba?\\\\(([^)]+)\\\\)/
    evaluated /rgba?(([^)]+))/

so parsing `rgb(201, 162, 39)` captured `(201, 162, 39`, `Number()` of that
is `NaN`, every contrast ratio was `NaN`, and `NaN < need` is false. **The
check examined every text element on every screen in both colour schemes and
could not have reported a failure if one existed.** It passed a deliberately
planted 2.1:1 element. Double every backslash in these strings.

**So: prove an absence assertion before trusting it.** "Nothing fails" reads
identically whether the page is clean or the check is dead, and both of this
session's vacuous tests were that shape (the other measured the browse-screen
budget at 852px, where it passed no matter what the header did). Each of the
three sweeps in `drive.js` now plants an element that MUST fail - a 20x20
button, a clipped line, a 2.1:1 paragraph - confirms it is caught, removes
it, and only then runs for real. The canary is four lines and it is the only
reason the contrast bug was found rather than shipped.

## WARNING - Trap: a layout assertion in one font measures one machine

**Found 2026-11-17 (Claude), the hard way: main went red.** A new check said
the browse screen's count line must not be ellipsised. It passed here and
failed on the GitHub runner, which has none of this machine's fonts and falls
back to something wider - so "All 2,500+ movies in our collection" fitted
locally and was clipped there.

Nothing about the test was wrong except its sample size. Any assertion about
WIDTH - does it fit, does it wrap, does it ellipsise, does it stay on one
line - is a statement about the font that rendered it, and CI's font is not
yours. The fix is not to loosen the assertion; it is to check more fonts.
`drive.js` now re-measures that row in `system-ui`, Georgia, DejaVu Serif and
Liberation Sans, and the DejaVu pass reproduces the CI failure locally in
under a second.

The same applies to the `fitline` page-title checks, which have always had
this exposure and have been lucky.

**Written down once and then not applied.** The Dynamic Type sweep added
hours later measured in one font and went red on CI for exactly this reason:
"Make your first list" fitted the splash's button here at a 28px root and
overflowed it by 7px there. A lesson recorded in a spec is not a lesson
applied to the next test. That sweep now runs in three fonts, and the DejaVu
Serif pass reproduces the CI failure locally in a second - 8px and 32px
against CI's 7px and 31px.

The underlying bug was the same shape as the splash headline's: a label that
grows with the reader's text size, inside a control with `white-space:
nowrap`. Button labels wrap now. A two-line button at an accessibility text
size is correct; a label with its end sliced off is not.

**And the process lesson, which cost more than the bug.** The commit was
pushed to `main` on the strength of three green local suites while CI was
still running. "All green" meant "green here". Watch the run before calling
a push good - the whole point of the macOS/Linux split in this repo is that
one environment does not speak for another.

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

## A crash is not a pass, and a filtered pipe hides both (2026-11-18, Claude)

`drive.js` ended `})().catch(e => { console.error('\n' + e.message); ... })`.
A run that threw two checks from the end therefore printed **no line matching
`FAILED`** and **no line matching `ALL CHECKS PASSED`** — just a bare sentence.
Run as `node drive.js 2>&1 | grep -E "^FAILED|ALL CHECKS"`, that produced empty
output, and because a pipeline's exit status is the **last** command's, the
harness reported **exit code 0**. A suite that died looked exactly like a suite
that had not run a failing check.

It cost a round trip, and it is the same shape as the two vacuous gates in the
November sweep: the thing that was supposed to tell me something could not.

Two fixes, both kept:

1. **Every suite's top-level catch prints `FAILED:` and a stack.** A crash is a
   failure and must use the word every filter looks for. The stack names the
   line, which the bare message did not — the actual error was
   `Cannot read properties of undefined (reading 'length')`, which could have
   been anywhere in 2,400 lines.
2. **Do not filter a suite through `grep` in a pipe.** Redirect to a file and
   read the tail: `node drive.js > run.log 2>&1; echo $?`. The exit status is
   then the suite's own, and nothing that was not anticipated by the pattern
   is thrown away. If a filter is wanted, `set -o pipefail` first.

## Two ways a custom pointer drag dies (2026-11-18, Claude)

Both cost a debugging round on the dock's hold-and-drag, and neither is
visible in the code that breaks.

**1. An `<img>` is natively draggable, and the browser's own drag CANCELS the
pointer stream.** The hold was recognised, `drag` was set, and the first
`pointermove` arrived with `drag` already back to `null` — because Chromium had
started its own image drag and fired `pointercancel`, which the drag's own
cleanup handled. The instrumentation that found it logged `pointerdown` and
`pointermove` and no `pointerup`, which looks impossible until you notice
`pointercancel` was never being logged.

Fix it at the source — `draggable="false"` on the image plus
`-webkit-user-drag: none; user-select: none` — and **not** with
`preventDefault()` on `pointerdown`, which in the same breath suppresses the
click, and the click is the other half of this control (tap opens the list).

**2. A one-shot listener armed on an event that may never arrive stays armed.**
A drag must not also read as a tap, so the first version added
`addEventListener('click', suppress, {once: true})` when a drag ended. A drag
that ends on a *different* element than it began on fires **no click at all** —
so the suppressor was never consumed, sat there, and swallowed the next
genuine tap instead. The symptom appeared one interaction later than the cause,
in a test that looked unrelated.

A timestamp cannot be left armed:

```js
dockEl.addEventListener('click', e => {
  if (performance.now() - dragEndedAt < 400) { e.stopPropagation(); e.preventDefault(); }
}, true);
```

It expires whether the event comes or not. Prefer it to `{once: true}` for
anything conditioned on a gesture that may not produce the event you are
waiting for.

## `node --check` before a long suite run (2026-11-18, Claude)

A duplicate `const` at module scope is a **parse**-time `SyntaxError`, so the
top-level `catch` that now prints `FAILED:` never gets installed — the crash
reporting added earlier the same day does not cover it. The run printed a bare
V8 stack, `grep -c '^FAILED'` returned 0, and five minutes went by before the
log was read.

`node --check drive.js` is instant and catches the whole class. Run it first
whenever a block has been inserted into a suite, especially one that declares
its own locals: a 2,500-line file has no shortage of names like `before`,
`after` and `box` already taken.

## A column flex box overflows upward, where `scrollHeight` cannot see it (2026-11-18, Claude)

The splash's name plate is `display: flex; flex-direction: column;
justify-content: flex-end`. Its overflow gate was the usual one:

```js
clipped: plate.scrollHeight > plate.clientHeight + 1
```

It is vacuous. Content that does not fit a flex column justified to the end
overflows out of the **block-start** edge, and scrollable overflow is not
recorded in that direction — there is nothing to scroll *up* to. Measured: a
plate squeezed to a third of its width put its first child at `top: −43px`
while `scrollHeight` and `clientHeight` both read **153**. The gate said ok.

It was found by trying to break it, not by it firing. Shrinking the plate on
purpose to confirm the gate worked is what exposed that it did not.

**Measure the children against the parent's content box instead**, in all four
directions:

```js
const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
const pad = s => parseFloat(cs['padding' + s]) + parseFloat(cs['border' + s + 'Width']);
const box = { t: r.top + pad('Top'), b: r.bottom - pad('Bottom'),
              l: r.left + pad('Left'), r: r.right - pad('Right') };
[...el.children].every(c => { const k = c.getBoundingClientRect();
  return k.top >= box.t - 1 && k.bottom <= box.b + 1
      && k.left >= box.l - 1 && k.right <= box.r + 1; });
```

Two related traps in the same family, both hit the same day:

- **`scrollHeight > clientHeight` on an auto-height block is line-box
  rounding, not overflow.** A headline that fits perfectly reads `sh: 136,
  ch: 134`. For a block that can grow, overflow is only ever horizontal —
  measure a `Range` over its text nodes against its box.
- **`offsetLeft` and `scrollWidth` are integers.** A 5/4 plate on a 155px row
  is 193.75px wide, so an exact layout measured with integers can read half a
  pixel out. Anything compared against an animation's `%` has to be measured
  with `getBoundingClientRect`, which is not rounded.

## A `mask-image` or `filter` on an ancestor empties `backdrop-filter` (2026-11-18, Claude)

Written down because the symptom is *nothing visibly wrong*. A glass panel
with `backdrop-filter: blur()` under an ancestor that creates a backdrop root
— a `mask-image`, a `filter`, `opacity < 1` — has an empty backdrop to filter,
so it renders as its own flat background colour and looks exactly like a panel
somebody styled that way on purpose.

In this case the panel was not over anything anyway: it is a flex **sibling**
of the posters, not a layer over them, so the blur had never had a job. The
contrast probe is what said so — it sampled the plate's backdrop as flat
`--vault-bg` at every viewport, which is what a blur of nothing looks like.
The rule it leaves behind: **if a `backdrop-filter` is not visibly doing
something, it is not doing anything** — check what is actually painted behind
the element before paying for the blur.

## Three ways a new component collides with an old one (2026-11-18, Claude)

All three hit the splash wall inside a day, all three were silent, and all
three are the same mistake: a new part of the page assuming it is alone.

**1. A class name the app already uses.** `.wallrail` is called that because
`.rail` was taken — it is the horizontal scroller the browse rows use, and it
carries `margin: 0 calc(var(--margin) * -1)` and 8px of bottom padding. Both
rules applied, so the wall's rail came out **40px too wide and its posters 8px
too short**, with nothing reported. `.wallveil` is named around the same trap:
`.scrim` is the sheet backdrop, `position: fixed; z-index: 40; opacity: 0`,
which would have made the splash's veil invisible and fixed to the viewport.

*The rule this leaves:* a component that owns a screen gets a prefix, and a
new class name is grepped for before it is used. `grep -n '\.foo' index.html`
costs a second.

**2. A z-index with no stacking context to live in.** The pinned name plates
need `z-index: 2` to sit above their own row's posters. `.wallrows` had no
`z-index`, so that 2 was measured against `.wallcopy`'s 1 in the *same*
context — and a plate painted over the headline, another over the CTA. The fix
is one line on the parent (`z-index: 0; isolation: isolate`), and the rule is
that any container whose children carry z-indexes should establish a context,
so its insides cannot outrank its siblings.

**3. A probe that samples occluded pixels.** The contrast gate read the bottom
plate at 2.1:1 and was right about the pixels: that plate sits *under* the
copy block, so what it sampled was the CTA's gold. Occluded text is not
low-contrast text, it is not text — the gate now skips any plate text whose
box is below the copy's top edge, the same line the "is a name readable"
gate uses.

## A sweep limited to the viewport is a sweep of the top of the page (2026-11-18, Claude)

The contrast gate skipped anything below the fold:

```js
if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > innerHeight) continue;
```

It looks like a sensible optimisation — why measure what nobody can see — and
it quietly reduced a whole-screen check to a first-screenful check. The
prototype's own build stamp sat at **2.41:1 in light mode for three months**
inside a footer that is below the fold on every screen in the app *except* the
two shortest. The gate had run on screens carrying that footer dozens of
times and never looked at it.

It was found by **adding a short screen to the sweep's list**, not by the
gate getting better: the badge case fits its footer above the fold, so the
same check on the same markup suddenly had an opinion.

Two things follow:

1. **Drop the viewport filter.** The cost is one `evaluate` over a few more
   elements; the benefit is that the check means what its name says.
2. **A new screen goes into every sweep list.** AGENTS.md's gates say
   "VoiceOver pass on every new screen" and a Dynamic Type pass XS to
   accessibility sizes — a screen that is not in `DT_SCREENS` and
   `TAP_SCREENS` has had neither, and nothing anywhere reports that.

The general shape is the same one that has now caught this project four
times: **a gate whose scope is narrower than its name.** The others were a
`scrollHeight` check that could not see upward overflow, an `offsetLeft`
measurement rounding a correct layout wrong, and a comparison test whose
expected value was whatever the code produced.

## `git add -A` is a sweep too, and it committed 3.8MB to `undefined/` (2026-11-18, Claude)

The glass-alpha sweep that settled the name card's 82% was a throwaway
script. It wrote its four comparison screenshots to
`` `${process.env.SHOTS}/shots/glass-82.png` `` — and it was run from
`docs/prototype` with `SHOTS` unset, so the template interpolated the string
**"undefined"** and Node happily created `docs/prototype/undefined/shots/`.
The commit that followed used `git add -A`, and **3.8MB of PNGs of our own
prototype landed in a public repository** under a directory named after a
JavaScript value.

Nothing failed. `mkdir -p` succeeds for any name, the screenshots were
written and read back correctly, the measurement they produced was right,
and the commit was clean. The only symptom was a directory listing nobody
had reason to run.

Three rules out of it, in order of how much they would have helped:

1. **A throwaway harness script writes to the scratchpad, never into the
   working tree.** An absolute path under the session scratchpad cannot be
   swept up by a commit no matter what a variable interpolates to.
2. **`drive.js` is right and the one-off was wrong**: `const SHOTS =
   process.env.SHOTS || './shots'` has a default, so it cannot produce this.
   A one-off that skips the default inherits none of that care.
3. **`.gitignore` now carries `docs/prototype/undefined/`** — not because
   that path is meaningful, but because it is the one spelling this specific
   mistake produces, and a named ignore is cheaper than remembering.

The blobs remain in `1aba29d`'s tree; they are screenshots of our own
prototype, so they are an embarrassment rather than a leak, and rewriting
published history to remove 3.8MB of PNG is the more expensive mistake.
`HEAD` is clean from `569ba09`'s successor onward.

**The class, again:** a *default* that one caller skips. It is the same shape
as `--text-disabled` being used for text — a thing that is safe everywhere it
was designed for, and silently wrong in the one place that reached past the
design.

## A suite that never turns JavaScript off cannot test "works without JavaScript" (2026-11-18, Claude)

`drive_share.js` had 45 checks over the public pages and every one of them
ran in a browser with JavaScript on, so the page that PRD Req 8 requires to
"render well with no JS" had never once been loaded the way the requirement
describes. It rendered **zero characters**.

The fix in the harness is one line of Playwright —
`browser.newContext({ javaScriptEnabled: false })` — and it is worth noting
how *cheap* the missing coverage was, because that is the pattern:

| gate | what it was missing | cost to add |
|---|---|---|
| contrast sweep | everything below the fold | delete one filter clause |
| no-JS render | the whole requirement | one context option |
| plate overflow | upward overflow | measure children, not `scrollHeight` |

None of these needed a new tool, a new fixture or a new screen. Each was a
default — the viewport, a browser with JS, `scrollHeight` — that nobody had
asked to be different.

**And the falsification found something better than the check.** Moving the
fallback out of `<noscript>` so it would leak into a JavaScript-enabled page
did not merely fail the new check: it crashed the suite at its *first*
assertion, `locator('h1')` hitting a strict-mode violation with two `h1`
elements. Playwright's strict locators are a structural gate nobody wrote,
and they are the reason the fallback lives inside `#page` — the element the
script overwrites — rather than beside it. Two independent reasons it cannot
leak, which is the right number for something a reader never sees.

**The vacuous-check trap, again.** The first spelling of "renders its
fallback as markup rather than printing it" was `!/<[a-z]/.test(text)`, which
is *true of an empty string* — so on the blank page it was meant to catch, it
passed. It now asserts a non-empty body as part of the same check. That is
three vacuous gates caught in this project by the habit of breaking a check
before trusting it.

## A broken image is not suppressed by an empty `alt`, and 204 is a broken image (2026-11-18, Claude)

Two beliefs, both wrong, kept a missing poster drawing Chromium's torn-photo
glyph for three months behind a green suite.

**1. "An empty `alt` means the browser draws nothing."** It does not. An
`<img alt="">` whose source fails still gets the glyph, painted *over* the
element's own box — so the designed plate was behind it the entire time,
doing nothing. There is no CSS that covers it, because it is not part of the
element's background. The only fix is to remove the element.

**2. "The harness would have caught it."** The harness is what hid it. Both
suites stub TMDB:

```js
// drive_share.js
await page.route('**image.tmdb.org/**', r => r.abort());

// drive.js — serve from the local mirror, and for anything not mirrored:
return route.fulfill({ status: 204, body: '' });
```

`abort()` is a broken image. **204 is a broken image wearing a success code**
— the request succeeds, the body is empty, `naturalWidth` is 0, the glyph
appears. So every screenshot either suite has ever taken was of broken
images, and no check ever looked at one. The gap was not that the condition
was rare; it was that the condition was *universal in the harness* and
unexamined.

### The listener, and why it is capture-phase

```js
addEventListener('error', (e) => { … }, true);   // ← the `true` is load-bearing
```

`error` on an element **does not bubble**. A handler on `document` or `body`
never fires for a failed image; only capture reaches it. One such listener
covers every image on the page, including every one rendered after it was
installed — which, in a prototype that rebuilds screens with `innerHTML`, is
nearly all of them.

### The check that proves it, and the control beside it

The gate asserts four things; three fail when the listener is deleted and the
fourth — *"and the list itself is untouched — ten rows, every one of them
readable"* — stays green either way **on purpose**. It is the control: it
says the fix removed the glyph and not the content. A suite of assertions
that all fail together cannot tell you which of them was measuring.

## A token that follows the colour scheme, on a surface that does not (2026-11-18, Claude)

Twice in two days, and the second one was introduced by a fix for an
unrelated bug:

| date | token | surface | what a light browser drew |
|---|---|---|---|
| 11-17 | `--accent-bright` | the splash wall's kicker and rank badges | the darker Gallery gold on a dark card — **4.55:1**, over the bar by a rounding error |
| 11-18 | `--bg-recessed` | the splash wall's artless poster plates | `#F1EDE6` on a near-black wall — **luminance 0.850**, fifty white rectangles |

The shape is identical: a token whose whole job is to respond to
`prefers-color-scheme`, used on a surface that is dark in both schemes. The
token is right everywhere it was designed for; it is wrong in the one place
that reached past the design — the same sentence this file already wrote
about `--text-disabled` and about an unset `SHOTS`.

**The rule, now written where it can be found:** anything drawn on the splash
takes a `--vault-*` token. `--vault-rgb`, `--vault-bg`, `--vault-text`,
`--vault-text-dim`, `--vault-surface`, `--vault-line`, `--vault-accent`,
`--vault-plate` exist precisely so there is a complete set to reach for, and
a `--bg-*` / `--text-*` / `--accent-*` token inside a `.wallrow` or `.intro`
rule should be read as a bug until proven otherwise.

**Neither was caught by a gate.** The first was caught by the contrast sweep
only because the sweep happened to cover the splash; the second by *looking
at a screenshot* of the wall with every poster 404ing. Both now have
measurements behind them — but the thing that found them was rendering the
screen in the state nobody renders it in, and then looking.
