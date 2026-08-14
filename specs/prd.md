# Top Ten — Product Requirements Document

**Status:** Draft v1
**Last updated:** 2026-08-14
**Owner:** Mischa

## Naming & Positioning

The app is **Top Ten** (working name; repo `topten`). A user's list is a
**Ten** — product copy uses it as a noun: "Make your Ten," "Sam's Ten,"
"What's your Ten?" The subject of a Ten is a **Topic** ("Tarantino films,"
"A24 horror," "movie heists"). Finishing a Ten reveals its **Badge**.
Making your own take on someone else's topic is a **Remix**.

Positioning: *the place your taste lives.* Not a tracker (that's Stack), not a
review site, not a database. One constraint — exactly ten, ranked — turns "my
favorite things" from an infinite chore into a finished, shareable artifact.

## Problem Statement

People love declaring their favorites — it's how taste becomes identity — but
there's no home for it. Social feeds bury lists in minutes; notes apps have no
audience; ranking sites are ugly, exhaustive databases built for completists.
And the moment you finish naming your ten favorite films, an obvious next
question appears ("okay, but your ten favorite *heist* films?") that no product
has ever caught and fed back to you. The creative energy dissipates because
nothing catches it.

## Goals

1. Make creating a ranked Ten so pleasurable that people make one unprompted —
   the gather-and-rank flow is the product, not a form.
2. Catch the rabbit-hole: after every finished Ten, surface topic suggestions
   (specific → general) good enough that a session naturally produces 2–3 Tens.
3. Make the Badge reveal a moment people screenshot and share.
4. Turn browsing into creating via the reveal gate (see Requirement 12).
5. Win an Apple Design Award — craft, motion, and platform-native excellence
   are goals, not polish.

## Non-Goals (v1)

- **No tracking.** No watch statuses, episodes, progress, or "seen it" state.
  Stack exists; Top Ten is curation only.
- **No ratings or reviews.** Rank position is the only opinion a Ten encodes.
- **No 5-item lists, no partial lists.** Ten or it's a draft.
- **No Android, no iPad-optimized layout** (iPhone-first; iPad runs the
  iPhone layout acceptably).
- **No follower feeds, comments, DMs, or notifications** in P0 (see P1).
- **No freeform/off-catalog topics** in P0 (see Requirement 6 and P1).
- **No monetisation.** Recorded as a *licensing* decision, inherited from
  Stack: TMDB's free tier is non-commercial. If monetisation is ever
  revisited, every API licence must be re-audited first.

## Object Model (the load-bearing reframe)

**Topics are the social object; Tens are takes on a Topic.**

- **Topic** — a canonical subject with a stable identity ("Quentin Tarantino
  films"). Topics have a domain (movies, TV in v1), a scope definition
  (optionally a catalog filter: director=Tarantino), and a slug. Topics are
  created by the system (seed set + LLM suggestions) and lazily materialized
  the first time someone makes a Ten on them. LLM-suggested topics are
  normalized against existing topics before creating near-duplicates.
- **Ten** — one user's ranked take on a Topic: exactly 10 items, positions
  1–10, position 1 sacred. Draft until complete; publishable once complete.
- **Item** — a catalog entity (TMDB movie/TV title in v1) with artwork.
- **Badge** — the generated emblem for a completed Ten (see `specs/badges.md`).
- **Remix edge** — Ten B was created from Ten A's topic via A's page. Remix
  chains are traversable both ways.
- **Consensus Ten** — the per-topic aggregate ranking computed from all
  published Tens on that topic (Borda-style points: position 1 = 10 points …
  position 10 = 1 point; ties broken by number of appearances, then recency).

This model is what makes discovery, comparison ("you and Sam share 6"),
consensus, and remix chains fall out of the data rather than being features.

## Personas

- **The Curator (primary).** Has strong taste, argues about rankings for fun,
  already makes lists in Notes/letterboxd/threads. Wants an artifact worthy
  of the effort.
- **The Browser.** Arrives from a shared link. Reads, compares, disagrees.
  The reveal gate exists to convert this person.
- **The Instigator.** Makes a Ten specifically to provoke friends into making
  theirs ("no way Casino Royale is your #1"). The remix loop exists for them.

## User Stories

- As a new user, I want to make my first Ten in minutes, with smart
  suggestions doing the remembering for me, so the blank page never appears.
- As a curator, I want ranking to feel like a deliberate ceremony, so my #1
  means something.
- As a finisher, I want a reveal that surprises me with something made *from
  my picks*, so completion feels rewarded, not just recorded.
- As a browser, I want to see a friend's Ten on the web without an account,
  and feel a pull to answer it with mine.
- As a remixer, I want my take linked to the original, and to see exactly
  where we agree and diverge.
- As a rabbit-holer, I want the app to notice that three of my ten picks are
  heist films and dare me to make "Top 10 heists."

## Requirements — Must-Have (P0)

**1. Onboarding to first Ten.** First launch flows directly into making a
first Ten (default topic: "Movies" — your ten favorite movies of all time).
No account required. The flow asks (skippably) which streaming services the
user subscribes to, purely to seed relevant suggestions in the Gather tray.
- Acceptance: a new user can reach a completed first Ten in under 3 minutes
  without typing a search query (suggestion taps alone suffice); services
  question is skippable; no sign-in wall before the first badge reveal.

**2. Gather.** Building a Ten is two phases; phase one is *gathering* — an
unordered tray of up to 10 candidates. Sources: search (catalog-backed with
artwork) and a suggestion rail (popular/classic/acclaimed for the topic,
filtered toward the user's services when known, plus "because you picked X"
entries once 3+ items are in the tray). Candidates can exceed intent —
gathering 14 then cutting to 10 is a supported, labeled moment ("the cut").
- Acceptance: tray persists as a draft across launches; search returns
  catalog results with artwork in <1s on broadband; the cut is required
  before ranking when the tray holds >10.

**3. Rank — the ceremony.** Phase two orders the ten. Primary mechanic:
guided placement (each item slotted against those already placed — a
pairwise-style flow that never asks the user to cold-sort ten things), with
drag-to-reorder always available for adjustments. Placing #1 is a
distinguished moment with its own weight (see design.md). Re-ranking a
published Ten is allowed and versions the Ten (badge may regenerate —
see badges.md).
- Acceptance: a full rank from an unordered tray takes ≤ ~25 comparisons
  (amended 2026-08-14, see below); drag reorder works with VoiceOver
  alternatives; #1 placement has a distinct design treatment; edits to a
  published Ten update `updatedAt` and re-run badge eligibility rules.

**Amendment 2026-08-14 (M1.5 prototype, Claude) — the ≤15 target was
impossible.** The original acceptance criterion asked for a full ranking of
ten items in ≤ ~15 binary comparisons. No algorithm can do that: ordering ten
items requires distinguishing 10! arrangements, and each yes/no answer yields
one bit, so the floor is ⌈log₂(10!)⌉ = **22 comparisons**. The built
prototype uses binary insertion and measured **21–23 questions** per run
across repeated end-to-end runs — at the floor, not wasteful.

The criterion is therefore relaxed to ≤ ~25, and the real problem is restated
honestly: 22 taps is a lot of taps. If ranking feels long on device, the fix
is not a cleverer algorithm — it is **changing what one interaction carries**.
Tapping a position on a visible spine ("where does this go?") conveys several
bits per gesture instead of one, which is the only way under ~22. That is a
design question for the device feel gate at M2, and it is deliberately left
open here rather than pre-decided. The pairwise flow stays the accessible
path either way (PRD Req 13).

**4. Completion & badge reveal.** Completing rank on a Ten triggers badge
generation and the reveal ritual: the badge is never previewable during
creation, generation happens on-device (Foundation Models composition +
inscription per `specs/badges.md`), and the reveal animation presents it as
an earned object.
- Acceptance: reveal works offline; total generation time ≤ 3s on a
  Foundation-Models-capable device or the fallback path engages invisibly;
  the badge references at least one actual item from the Ten.

**5. The rabbit-hole engine.** After every completed Ten (and on the Today
surface), the on-device LLM analyzes the user's Tens and proposes new topics
across a specificity range — from highly specific ("Top 10 needle-drops in
Tarantino films") to general ("Top 10 directors") — each with a one-line
provocation for *why them* ("Three of your ten are heists. Prove it.").
Suggestions are generated with guided/structured output, normalized against
existing topics, and constrained to v1 domains.
- Acceptance: ≥5 suggestions after each completion, spanning at least three
  specificity levels; suggestions never duplicate a topic the user has already
  completed; tapping one lands directly in Gather with the topic set; works
  offline; on non-FM devices a curated static suggestion tree engages instead.

**6. Catalogs (v1 domains: movies + TV).** Items come from TMDB (search,
metadata, artwork), reusing Stack's integration knowledge. TMDB attribution
shown per licence. Topic scopes may bind to catalog filters (person, genre,
collection) so suggestion rails can be auto-populated.
- Acceptance: search + artwork for movies and TV; attribution present;
  missing-artwork items render a designed fallback, never a broken image.

**7. Local-first, account-optional.** All drafting, completing, and badge
reveals work with no account, stored on-device (SwiftData). Publishing to the
web / discovery requires sign-in (magic link + 6-digit code, the flow proven
in Stack). On sign-in, local Tens sync up; the device remains source of truth
for unpublished drafts.
- Acceptance: airplane-mode user can gather, rank, complete, and reveal;
  publish prompts sign-in exactly at the moment of publishing, not before.

**8. Publish & the shared page.** Publishing a Ten creates a public web page
(`topten.app/t/…` working URL scheme) rendering the ranked list beautifully —
artwork, rank numerals, topic, author handle, badge (locked or revealed per
the gate), remix lineage, and an app-store-smart-banner CTA "Make your Ten."
Share from the app produces a link plus a generated share image (the Ten as
a designed card) for stories/messages.
- Acceptance: page renders well with no JS; OG image is the designed card;
  page loads <1.5s p75; the CTA deep-links topic context into the app.

**9. Discovery.** A browse surface of topics and published Tens: trending
topics, new takes on topics you've done, and the **Consensus Ten** per topic
(computed per the object model) presented as its own artifact ("The people's
Tarantino Ten"). Entering any topic shows the consensus, notable takes, and
the ever-present "Make yours" action.
- Acceptance: every discovery card leads to either a Ten page or a topic
  page; consensus recomputes on publish (eventual, ≤1 min lag acceptable);
  empty topics (n=1) suppress consensus and show the lone take.

**10. Comparison.** Viewing someone else's Ten on a topic you've completed
overlays agreement: shared picks marked, rank deltas shown ("their #1 is
your #7"), a headline stat ("You share 6 of 10"). This is the payoff for
remixing and the hook in every share.
- Acceptance: comparison renders in-app and on the web page (when the viewer
  arrived from a link with their own published take); zero-overlap states get
  a designed treatment ("Not one film in common. Incredible.").

**11. Profile — the Badge Case.** A user's profile is their shelf of
completed Tens shown as badges (the Badge Case), plus their takes. Own
profile shows drafts. Public profile shows published Tens only.
- Acceptance: badge case is the profile's hero; tapping a badge opens the
  Ten; drafts never visible to others.

**12. The reveal gate.** On someone else's published Ten, their badge appears
**locked** (present, desirable, obscured). It unlocks — for you — when you
complete your own take on that topic. Unlocking notifies nothing in P0 but
records the remix edge; your take then appears in that topic's takes and in
the original's remix lineage.
- Acceptance: locked badges are visually consistent everywhere (app + web);
  completing a remix unlocks the original's badge immediately and
  retroactively (all previously-locked badges on that topic unlock at once);
  the gate never blocks viewing the *list itself* — only the badge.

**13. Accessibility & platform quality.** Dynamic Type through accessibility
sizes, VoiceOver-complete (including a non-drag ranking path and meaningful
rank announcements), Reduce Motion honored end-to-end, 44pt targets, AA
contrast both appearances.
- Acceptance: audit checklist in AGENTS.md passes per milestone; ranking is
  fully operable with VoiceOver and with Switch Control.

**14. Performance envelope.** Cold launch to interactive <1.5s on a
mid-range supported device; 60fps (120 where available) through gather, rank,
and reveal; badge generation off the main thread.
- Acceptance: Instruments traces recorded at each milestone; no dropped-frame
  regressions accepted into main.

## Nice-to-Have (P1)

- **Social layer:** follows, a takes-feed from followed users, unlock
  notifications ("Mischa remixed your Tarantino Ten"), reactions. (Deferred
  deliberately — the Stack lesson: shape the schema for it now, build later.
  The remix edge and stable Ten ids are that shaping.)
- **More domains:** music (Apple Music API — native, artwork-rich), books,
  games; each is a catalog adapter + topic seeds.
- **Freeform topics** ("Top 10 sandwiches"): freeform items with LLM
  normalization and image search/moderation. Big; explicitly not v1.
- **Widgets & App Intents:** a home-screen widget of a rotating badge/Ten;
  "Start a Ten" intent; Control Center control.
- **The Ten of Tens:** an annual, year-capped meta-list.
- **Badge premium tier:** server-side image generation as an upsell —
  only after the procedural system proves the ritual (and licensing is
  re-audited per Non-Goals).

## Future Considerations (P2)

1. Group Tens (a friend group converges on a shared Ten — borrows Stack's
   ideation on pair mechanics).
2. Topic tournaments (seasonal official topics with featured consensus).
3. iPad/Mac layouts; visionOS badge case.
4. Import taste signals (from Stack's shelf, from Letterboxd) to seed Gather.

## Success Metrics

- **Activation:** % of new users completing a first Ten in session one.
  Target: 60%.
- **The rabbit-hole coefficient:** average completed Tens per creating user
  per week. Target: ≥2 — the suggestion engine's whole job.
- **Reveal-gate conversion:** % of locked-badge encounters that lead to a
  completed remix within 7 days. Target: 8% — the assumption named riskiest
  in ideation; instrument it first.
- **Share loop:** % of completed Tens shared out; page-visitor → app-install
  rate on shared pages.
- **Week-4 retention** among users with ≥3 completed Tens. Target: 40%.

(Analytics stance inherits Stack's caution: decide the telemetry approach —
none / on-device / privacy-preserving aggregate — before instrumenting.
Open question below.)

## Open Questions

- **[Product]** Can you view the *full list* of someone's Ten before making
  yours, or tease only the top 3 + badge? Current call: full list visible,
  only the badge gated (Req 12) — revisit if remix conversion underwhelms.
- **[Product]** Re-ranking a published Ten: does the badge regenerate (new
  joke) or persist (provenance)? Leaning: persists unless items change ≥3
  slots or membership changes — rule lives in badges.md, needs Mischa's call.
- **[Data]** Analytics: none vs. on-device counters vs. aggregate. Blocks
  the metrics section from being measurable.
- **[Legal]** TMDB non-commercial licence is load-bearing for "no
  monetisation." P1 badge premium tier conflicts with it — resolve before
  any paid feature.
- **[Design]** Handle/identity model for anonymous-until-publish users on
  web pages (generated handles vs. required choice at publish).

## Phasing

See `KICKOFF.md` for the milestone plan (M0–M6). P0 requirements 1–8 are the
launchable core ("make, reveal, share"); 9–12 complete the social loop;
13–14 are continuous gates, not phases.
