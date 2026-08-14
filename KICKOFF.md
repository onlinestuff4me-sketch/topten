# Top Ten — Kickoff prompt for a fresh Claude Code agent

*Hand this file (with the whole bundle) to a Claude Code agent to start the
project. It is also the milestone plan of record until superseded by
`specs/prd.md` amendments.*

---

## The prompt

You are starting a brand-new project called **Top Ten** for Mischa, a
non-technical PM. This folder contains the complete founding documents:

1. Read `AGENTS.md` first — it is the working contract and it governs
   everything you do in this repo, including how decisions get recorded.
2. Read `specs/prd.md`, `specs/design.md`, `specs/badges.md`, and
   `specs/tech-stack.md` in that order. They are the source of truth. Do not
   re-litigate locked decisions; when you make a new decision, write it into
   the right spec **in the same commit**, with the reasoning.

Then execute Milestone 0 below. Work in small, verifiable milestones; after
each, report in plain language what now works. Never round a partial result
up to "working."

Environment note: if you are running in a cloud (Linux) session, you can
fully build and test `TopTenKit`, the web app, and Supabase migrations — but
you cannot compile the SwiftUI app. Write app code freely, but say plainly
that it is CI/Mac-verified, not cloud-verified. If you are on Mischa's Mac,
you have the full Xcode loop.

## Milestones

### M0 — Repo bootstrap (cloud-friendly)
Create the GitHub repo `topten` (owner: Mischa's account,
`onlinestuff4me@gmail.com` as committer — see the Vercel trap in
tech-stack.md before anything web-facing ships). Commit this bundle at the
layout in tech-stack.md "Repo layout." Scaffold `TopTenKit` as an SPM
package with CI (`.github/workflows/ci.yml`: Linux job runs `swift test`;
macOS job builds the app target once it exists). Add `docs/resuming.md`
(session-handoff file, rewritten each session — see Stack's convention).
**Done when:** CI is green on a trivial TopTenKit test.

### M1 — The brain (cloud-verifiable)
TopTenKit: domain models (Topic, Ten, Item, BadgeComposition, remix edge),
the placement/ranking algorithm (guided placement ≤ ~15 comparisons for 10
items, PRD Req 3), consensus scoring (Borda per PRD object model), palette
derivation, badge deterministic pre-pass + template inscriptions, topic
normalization, TMDB DTOs + a `Catalog` protocol with an explicit test-double
catalog. Exhaustive unit tests — this package is where correctness lives.
**Done when:** `swift test` green on Linux with meaningful coverage of
ranking, consensus, and badge pre-pass (including the floor test from
badges.md rendered as composition data).

### M2 — Gather & Rank (Mac-verified)
SwiftUI app shell: Laurel tokens, tab structure (Today / Make / You),
Gather (slot rows, tray, suggestion rail with static seed suggestions,
TMDB search), the Cut, the Rank ceremony, drafts in SwiftData. No badges,
no accounts, no network publish.
**Done when:** on-simulator XCUITest completes gather→cut→rank end-to-end;
Dynamic Type + VoiceOver pass per AGENTS.md quality gates; Mischa can make
a Ten on his phone via TestFlight internal build or simulator demo.

### M3 — The badge (Mac-verified, FM-gated paths tested both ways)
Badge renderer (SwiftUI/Core Graphics from BadgeComposition), the
FoundationModels pass with `@Generable` BadgeDirection + availability
fallbacks, the reveal ceremony with haptics + Reduce Motion variant, the
Badge Case on the You tab.
**Done when:** reveal runs offline on simulator; fallback ladder forced in
tests produces screenshot-worthy badges (lineup test rendered); inscriptions
pass the post-check in badges.md.

### M4 — Rabbit-hole engine (Mac-verified)
FoundationModels suggestion generation (specific→general spread, provocation
lines, topic normalization against existing topics), the static fallback
tree, post-completion suggestion moment + Today surface.
**Done when:** completing a Ten yields ≥5 valid suggestions spanning 3
specificity levels on-device, and the same flow works with FM unavailable.

### M5 — Publish, share, web (cloud + Mac)
Supabase schema + RLS + migrations, magic-link auth, publish flow, the
Next.js Ten/topic pages + OG share cards, share sheet + share image export,
the reveal gate (locked badges, unlock on remix, retroactive unlocks),
comparison overlay, discovery v1 (trending topics, consensus Ten).
**Done when:** a Ten published from the app is live on a real URL (deploy
verified per the Vercel rule), the page passes Playwright e2e in cloud, and
a second account remixing it unlocks the badge end-to-end.

### M6 — ADA polish pass + TestFlight
Motion/haptic audit against design.md tokens, performance envelope (PRD Req
14) with Instruments traces, full accessibility audit, app icon + Share
Card final art, TestFlight external via GitHub Actions workflow (decide
fastlane vs Xcode Cloud and record it in tech-stack.md).
**Done when:** Mischa has the app installed via TestFlight and the quality
gates in AGENTS.md pass in a recorded audit in `docs/`.

## Sequencing rationale

M1 before any UI so the cloud can do real work and the app is thin over a
tested core. Badges (M3) before the rabbit-hole (M4) because the reveal is
the retention ritual and it de-risks FoundationModels integration on the
smaller, more constrained task first. Publish/web last among features (M5)
because everything before it is verifiable without a backend — and because
the reveal gate only matters once there are two users' Tens to gate.

## Standing rules (from AGENTS.md, repeated because they get skipped)

- Spec updates land in the implementing commit, with reasoning, dated.
- Batch verification; name the environment every claim was verified in.
- `git config user.email "onlinestuff4me@gmail.com"` before web-shipping
  commits. Pushed is not shipped.
- Never print secret values. Presence and length only.
