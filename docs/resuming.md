# Resuming Top Ten

*Session-handoff file, rewritten at the end of each session (Stack
convention). Read this first, then `AGENTS.md`, then `specs/`.*

**Last written:** 2026-08-14 · cloud session (Linux, no Xcode) · **M0 done,
M1.5 prototype built and deployed, awaiting Mischa's first rounds**

---

## Where the project is

- **M0 — repo bootstrap: done.** `TopTenKit` builds and tests on CI, the CI
  gate is proven able to fail, `docs/resuming.md` exists.
- **M1.5 — flow prototype: round 1 of feedback applied.** Live at
  **https://topten-three.vercel.app**. Building a Ten is now ONE screen —
  search with live results, refinements (services, genre, director, actor),
  branching suggestions backed by a persistent graph with a map view, and the
  ten slots pinned in the dock, reorderable in place. Then the cut (only on overflow), the badge
  reveal, and the post-completion rabbit hole. 220-film catalog baked from
  TMDB with per-film streaming availability, cast, and recommendation edges.
  **Round 3 is pending Mischa's next pass.**
- **M1 — the brain: not started.** Deliberately resequenced after the
  prototype (see below).

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
  the prototype driven end to end — 48 assertions, zero page errors. These now
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
| Build the mind-map view | Built — `Where you have been`, a tidy tree of every followed and picked film |
| Going back destroys the branch ahead of it | Exploration is a persistent graph; navigating never removes a node |
| Didn't know how to add vs what the chevron did | Two named buttons per card: `+ Add` and `Similar ›` |
| Can't tell what a filter did | The **Now showing** bar states every clause of the query plus the match count |
| "Also adventure" isn't actionable | Reasons are tappable and narrow to that director/actor/genre |
| "Back" vs "Go deeper" unclear | Per-section verbs removed; navigation lives in Now showing and the map |

Storage key moved to `topten.proto.v4` and `load()` now normalises against a
fresh state — a v3 draft had no graph in it and would have thrown on first
read, which would have meant a dead page for the one person using it.

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
