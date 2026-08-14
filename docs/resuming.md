# Resuming Top Ten

*Session-handoff file, rewritten at the end of each session (Stack
convention). Read this first, then `AGENTS.md`, then `specs/`.*

**Last written:** 2026-08-14 · cloud session (Linux, no Xcode) · **M0 done,
M1.5 prototype built and deployed, awaiting Mischa's first rounds**

---

## Where the project is

- **M0 — repo bootstrap: done.** `TopTenKit` builds and tests on CI, the CI
  gate is proven able to fail, `docs/resuming.md` exists.
- **M1.5 — flow prototype: built, not yet reacted to.** Live at
  **https://topten-three.vercel.app**. Covers gather → the cut → rank →
  badge reveal → rabbit-hole suggestions, over a 220-film catalog baked from
  TMDB. Mischa has not yet used it on his phone; **M1.5 is not done until he
  has been through at least two feedback rounds and design.md records what
  changed.**
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
  the prototype driven end to end — 20 behavioural assertions, zero page
  errors. Screenshots from the same run judged layout.
- **Deploy:** verified by fetching the live page and finding the build tag,
  not by assuming the push shipped.
- **Nothing is verified on a Mac or a device.** No app target exists.

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
