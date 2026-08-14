# Resuming Top Ten

*Session-handoff file, rewritten at the end of each session (Stack
convention). Read this first, then `AGENTS.md`, then `specs/`.*

**Last written:** 2026-08-14 · cloud session (Linux, no Xcode) · end of **M0**

---

## Where the project is

M0 (repo bootstrap) is the only milestone with code in it. The founding
documents — `AGENTS.md`, `KICKOFF.md`, `specs/*.md` — were already committed
before this session; M0 added the `TopTenKit` package, CI, and this file.

Next milestone is **M1 — the brain** (`KICKOFF.md`): domain models, the
placement/ranking algorithm, consensus scoring, palette derivation, badge
pre-pass, topic normalization, TMDB DTOs behind a `Catalog` protocol. All of
it is cloud-verifiable through CI, and it is where correctness lives.

## Repo layout vs. `specs/tech-stack.md`

| Path | Status |
|---|---|
| `AGENTS.md` | present (founding commit) |
| `KICKOFF.md` | present (founding commit) |
| `specs/` | present — `prd.md`, `design.md`, `badges.md`, `tech-stack.md` |
| `docs/` | present — this file; investigations land here |
| `TopTenKit/` | present — SPM package, builds and tests on Linux |
| `.github/workflows/` | present — `ci.yml` |
| `App/` | **not yet** — M2 scaffolds the Xcode project |
| `web/` | **not yet** — M1.5 (prototype lives in `docs/`), real pages at M5 |
| `supabase/` | **not yet** — M5 |

Nothing in the layout has changed; the three missing directories are
milestones that haven't run, not drift.

## What is verified, and where

- **CI (GitHub Actions, `kit-linux` job):** `swift build` + `swift test` on
  `TopTenKit` in a pinned `swift:6.2` container. This is the only green light
  M0 claims.
- **Nothing is verified on a Mac or a device.** No app target exists yet.
- The `app-macos` job is written but **skipped** — a Linux probe job looks for
  `App/*.xcodeproj` and gates it, so it burns nothing until M2. M2 owns
  filling in `SCHEME` and `DESTINATION` in `.github/workflows/ci.yml`.

## Constraints you will hit in a cloud session

- **No local Swift.** `download.swift.org` is denied by the session's egress
  policy and there is no Docker daemon, so there is no local `swift test`
  loop here. Write Kit code, push, and read the CI run. Batch your changes —
  the round trip is a CI run, not a terminal. (Recorded in
  `specs/tech-stack.md` → Verification workflow.)
- **You cannot compile SwiftUI.** Never report app-level verification from a
  cloud session; say "CI/Mac-verified" or "unverified" and mean it.

## Standing traps (the ones that have already cost sessions)

- **Vercel skips non-owner commits.** The repo's git config is set to commit
  as `Mischa <onlinestuff4me@gmail.com>`; leave it that way. Anything web-
  facing that lands on `main` with a different *committer* is silently not
  built. Pushed is not shipped — verify a deploy ran.
- **Specs update in the implementing commit**, dated, with the reasoning —
  not in a cleanup pass.
- **Never print secret values.** Presence and length only.
- The repo is **public**, so treat everything committed as world-readable.
  Real keys go in a gitignored `Secrets.xcconfig` (M2 adds the committed
  `Secrets.example.xcconfig` template).

## Open questions waiting on Mischa

Tracked in `specs/prd.md` → Open Questions. None of them block M1.
