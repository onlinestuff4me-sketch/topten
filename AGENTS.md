# What Top Ten is

An app for creating, sharing, and remixing ranked Top 10 lists of anything —
starting with movies and TV. The job it does is identity, not utility: *define
yourself through your favorites, and be seen doing it.* You build a **Ten**
(exactly ten items, ranked), the app's on-device LLM notices patterns in your
picks and suggests ever-more-specific **Topics** to rabbit-hole into, and
finishing a Ten reveals a generated **Badge** — a crafted emblem with an
inside-joke inscription drawn from your own list. Other people's badges stay
hidden until you make your own take on their topic, which is the engine that
turns browsing into creating.

Top Ten is a sibling project to **Stack** (the TV/movie tracker at
`github.com/onlinestuff4me-sketch/stack`). It inherits Stack's process
discipline and its hard-won platform lessons, but it is a different product:
Stack is exhaustive, private-by-default tracking; Top Ten is scarce, expressive
curation. Do not import tracker mechanics (statuses, episodes, watch progress)
here.

# The overarching goal

**Win an Apple Design Award.** This is the stated bar for every design and
engineering decision. It is why the app is native SwiftUI on iOS 26 with Liquid
Glass and on-device Foundation Models, and why "good enough" is not the
standard for motion, haptics, typography, or accessibility. When two options
tie on function, pick the one an ADA jury would respect.

# Locked decisions (2026-08-14, Mischa — via clarifying questions, do not re-litigate silently)

- **Platform:** Native SwiftUI iOS app (iOS 26 minimum) + lightweight public
  web pages for shared lists. No Android. No react-native. The web surface
  exists for virality (a shared Ten must be beautiful in a browser for people
  without the app), not for feature parity.
- **List size:** Ten, always. Every list is exactly 10 ranked items. No
  5-item mode, no partial publishing. An unfinished Ten is a draft.
- **Name:** **Top Ten** (working name; repo `topten`). A user's list is
  called a **Ten** in product copy ("What's your Ten?").
- **Badges:** Procedurally composed from a hand-crafted design system, with
  Apple's on-device Foundation Models choosing the composition and writing the
  inscription. No server-side image generation in v1 (may become a premium
  tier later — see `specs/badges.md`).
- **Backend:** Supabase (Postgres/Auth/RLS) for accounts, published Tens,
  topics, and the remix graph — the pattern proven in Stack. Local-first on
  device (SwiftData); publishing requires sign-in (magic link + code).

# Project specs (source of truth)

Read these before making any product, design, or architecture decision. They
capture everything decided so far and the reasoning behind it, and they are
updated whenever a decision is made — not just read once.

- `specs/prd.md` — problem, goals, non-goals, object model, numbered P0/P1/P2
  requirements with acceptance criteria, success metrics, phasing. **The live
  answer to "what are we building right now."**
- `specs/design.md` — the **Laurel** design system: direction, tokens,
  typography, Liquid Glass usage rules, components, motion, haptics,
  accessibility.
- `specs/badges.md` — the badge system: composition layers, the Foundation
  Models pipeline, inscription rules, the reveal ritual, gating, fallbacks.
- `specs/tech-stack.md` — locked stack, repo structure, verification loops,
  platform constraints, and every trap inherited from Stack.
- `docs/` — investigations and options considered.

# Write the decision down, with the reason, in the same change

Every product, design, or architecture decision lands in the specs **in the
commit that implements it** — not in a later cleanup pass. (Rule inherited
from Stack, where an audit found the code ahead of the docs.)

- **Product / behaviour** → `specs/prd.md` (numbered requirement, or a dated
  amendment to one).
- **Anything reusable — a token, a component, a rule about states** →
  `specs/design.md`.
- **Badge composition, inscription, or reveal rules** → `specs/badges.md`.
- **Stack, constraints, platform gotchas** → `specs/tech-stack.md`.
- **Investigations and options considered** → `docs/`.

Record the REASONING, not just the outcome, and keep the measurements that
justified a choice. Superseding an earlier decision means EDITING it in place
and saying what changed and why, so the file never quietly contradicts the
code. Date and attribute every decision.

# Working relationship

- Mischa is directing this as a **non-technical PM**. Handle all technical
  setup (installs, config, project structure, signing) autonomously — surface
  a decision only when it has a real product or cost trade-off.
- Build in **small, verifiable milestones**. After each one, report in plain
  language what now works, not a diff.
- **Self-verify before calling anything done.** Actually run the thing and
  check the result rather than declaring success from reading the code.
- **Never round a partial result up to "working."** If three of four things
  pass, say which one didn't and name the exact variable, build step, or
  domain that would fix it.
- **A screenshot is not verification.** It proves one state of one screen
  with one fixture. Screenshots judge layout and copy; tests judge behaviour.
- **Never print secret values** — presence and length only, in every report
  and every command's output.
- **Pushing to `main` (decided 2026-08-14, Mischa).** Claude may push straight
  to `main` without a PR, on two standing conditions: **say what is going to
  `main` before pushing it, and confirm what actually landed after.** Reasoning:
  the web surface deploys from `main`, so routing every prototype iteration
  through review would stall exactly the feedback loop M1.5 exists to create;
  the announce/confirm protocol keeps Mischa's visibility without the round
  trip. Work is still developed on a branch and merged in — `main` is never the
  working surface.
- Update `specs/` as scope evolves — it's a living record, not a one-time doc.
- When Mischa gives a vague visual direction ("bigger", "warmer"), pick a
  value, apply it, and report the value chosen — don't iterate to discover
  his number.

# Verification: two environments, know which one you're in

The repo is structured so that logic and UI verify in different places — see
`specs/tech-stack.md` for the full workflow.

- **Cloud sessions (Linux, no Xcode):** can build and test `TopTenKit` (the
  platform-independent Swift package holding models, ranking, topic, and
  badge-composition logic) with `swift test`, and can build/test/deploy the
  web share pages end-to-end with Playwright. Cloud sessions **cannot**
  compile SwiftUI or run the app — do not claim app-level verification from
  a cloud session.
- **Mac sessions (Mischa's machine):** full loop — `xcodebuild`, simulator,
  XCUITest, snapshot tests, TestFlight via EAS-equivalent (Xcode Cloud or
  fastlane; see tech-stack.md). UI work is verified here.
- **CI (GitHub Actions macOS runners):** builds the app and runs the full
  test suite on every PR, so cloud-written Swift gets compiler + test feedback
  without waiting for a Mac session.

**Pushed is not shipped.** For the web pages, confirm a Vercel deploy actually
ran before telling anyone a change is live — and remember the committer-email
trap in `specs/tech-stack.md`, which has already cost two full sessions on
Stack.

# Quality gates for the ADA bar

Before any milestone is called done:

- Dynamic Type from XS to accessibility sizes without truncation or overlap.
- VoiceOver pass on every new screen; ranked positions announced meaningfully.
- Reduce Motion honored — every ceremony lands on the same end state.
- 44×44pt minimum targets; contrast at WCAG AA in both light and dark.
- Haptics and motion match the specs in `specs/design.md` — no ad-hoc
  durations or generator types typed inline.
