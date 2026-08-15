# Top Ten — Design System: **Laurel**

**Status:** Draft v1
**Last updated:** 2026-08-14
**Owner:** Mischa

The design system is named **Laurel** — the wreath you earn. (Stack's system
was "Marquee"; same convention, new identity. If any doc says Marquee here,
it's stale — fix it.)

## Core insight

**The list is the artifact and the rank is the drama.** Everything on screen
serves either the beauty of the finished Ten or the tension of ordering it.
Chrome recedes; artwork and numerals carry the show. Where Stack was "a dim
cinema after the lights go down," Laurel is **a gallery wall on opening
night** — bright, spare, and hung with things someone chose.

## Principles

1. **Ten slots, always visible.** The count is the product; the interface
   never hides how many remain. Empty slots are designed objects, not blank
   space.
2. **Numerals are typography's job.** Rank numerals are the largest, most
   crafted glyphs in the app. Position 1 is treated as a title, not an index.
3. **Earned, not given.** Anything celebratory (badge, confetti-class motion,
   gold) appears only at genuine completion moments. Inherited law from
   Stack: *celebration for completion, never for repetition.*
4. **Glass frames, never glass content.** Liquid Glass is for chrome — bars,
   trays, the rank dock — floating above content. Artwork and text never sit
   *on* an unreadable material. (See Materials.)
5. **One ceremony at a time.** Gather, cut, rank, reveal are distinct scenes
   with distinct moods. No screen tries to be two of them.

## Color

Light-first (the gallery), with a complete dark theme (the vault) — both
first-class; system-following by default. Semantic dot-namespaced tokens;
**token keys are stable even if product vocabulary changes** (Stack lesson).

### Light — "Gallery"

| Token | Value | Usage |
|---|---|---|
| `bg.base` | `#FAF8F4` | App background — warm paper, not pure white |
| `bg.surface` | `#FFFFFF` | Cards, sheets |
| `bg.recessed` | `#F1EDE6` | Empty slots, wells, input fields |
| `border.subtle` | `#E4DED3` | Hairlines, slot outlines |
| `text.primary` | `#1C1A17` | Near-black, warm |
| `text.secondary` | `#6E675D` | Metadata, provocations |
| `text.disabled` | `#A8A196` | |
| `accent.laurel` | `#8A6D1F` | Interactive accent — deep olive-gold, AA on `bg.base` |
| `accent.laurelBright` | `#C9A227` | Large glyphs/fills only (≥24pt or non-text) — the podium gold |
| `accent.laurelMuted` | `#EFE6CC` | Selected/active tints |
| `status.locked` | `#8B8578` | Locked badges, gated affordances |
| `status.error` | `#B3402E` | |

### Dark — "Vault"

| Token | Value | Usage |
|---|---|---|
| `bg.base` | `#121110` | |
| `bg.surface` | `#1C1A18` | |
| `bg.recessed` | `#0C0B0A` | |
| `border.subtle` | `#2E2B27` | |
| `text.primary` | `#F4F1EA` | |
| `text.secondary` | `#A79F92` | |
| `accent.laurel` | `#D9B23A` | Gold reads brighter in the vault |
| `accent.laurelMuted` | `#3A311A` | |
| `status.locked` | `#6E675D` | Added 2026-08-15: the light value disappears against `bg.surface` in the vault |

Rules: **color follows meaning, never emphasis** (Stack law). Gold is
reserved for rank-1, completion, and interactive accent — never decorative
backgrounds. Badge palettes are generated per-badge (see badges.md) and are
exempt from app tokens but constrained to harmonize (LCH ranges specified
there).

## Typography

Two faces, both platform-native (zero font-loading tax, full Dynamic Type):

- **New York (serif)** — display: topic titles, rank numerals, badge
  inscriptions, the words "Your Ten." Identity moments only.
- **SF Pro** — everything else: UI, metadata, buttons, body.

| Token | Face | Size/Leading | Usage |
|---|---|---|---|
| `numeral.hero` | New York Heavy | 64/64 | The #1 numeral; reveal moments |
| `numeral.rank` | New York Bold | 28/32 | Rank numerals 2–10 in list rows |
| `display.lg` | New York Semibold | 32/38 | Topic titles on topic/Ten pages |
| `display.md` | New York Semibold | 22/28 | Card titles, sheet headers |
| `heading.md` | SF Pro Semibold | 17/22 | Item titles in rows |
| `body.md` | SF Pro Regular | 15/20 | Metadata, descriptions |
| `label.provocation` | SF Pro Medium Italic | 14/19 | Rabbit-hole one-liners |
| `label.sm` | SF Pro Semibold | 12/16, +2% tracking, uppercase | Section labels, domains |

All sizes are Dynamic Type anchors (scaled via `relativeTo`), not fixed
points. Inputs never render below 16pt-equivalent (inherited Stack rule).

## Spacing, Shape, Artwork

- 4pt base scale: `4, 8, 12, 16, 24, 32, 48, 64`. Screen margins 20.
- Radii: 10 cards, 16 sheets/trays, 6 artwork thumbnails, badge shapes per
  badges.md.
- **Fixed artwork sizes only** (Stack lesson — no fluid poster math):
  2:3 poster at `row 56 × 84`, `tray 72 × 108`, `feature 120 × 180`;
  1:1 fallback monogram tile for artless items at the same widths.
- The Ten list row: `[numeral] [artwork] [title / meta] [—]`. No trailing
  controls on published Tens — rows are content, not consoles (anti-lesson
  from Stack's four-grammar drift: Top Ten rows do nothing but link).

## Materials — Liquid Glass usage rules

- Glass surfaces: tab bar, top bars, the **Gather tray** (docked, floating
  over the suggestion field), the **Rank dock** (where the in-hand item
  hovers during placement), share sheet chrome.
- Content surfaces (list rows, cards, badge case, web parity styles): opaque
  `bg.surface`. **Text on glass is limited to bar/dock labels using system
  vibrancy styles; never body text.**
- One glass layer per screen region — glass over glass is a design bug.
- Every glass surface must have a defined Reduce Transparency fallback
  (`bg.surface` at 96% opacity).

## Components

- **Slot Row** — the empty state of a Ten position: recessed well, ghost
  numeral, subtle invitation ("Slot 7"). The ten slots ARE the canvas of
  Gather.
- **Gather Tray** — glass dock holding current candidates as artwork chips
  with count ("7 of 10 — or keep going and make the cut"). Overflow beyond
  10 shifts the count style to the cut state.
- **Suggestion Card** — artwork + title + one-line reason ("Because you
  picked Heat"). Tap adds to tray with a flick-to-tray motion.
- **The Cut** — when tray >10: a full-screen scene; candidates on the wall,
  tap to keep (gold ring) until exactly 10 remain. Copy is direct: "Cut 3."
- **Rank Duel / Placement Scene** — in-hand item on the Rank dock vs. the
  placed spine; binary choices ("Above Goodfellas? Below?") until slotted.
  Progress shown as slots filling, not a percent bar.
- **Numeral One Moment** — placing the final order runs the last beat: the
  #1 slot fills last with `numeral.hero` treatment and a single deep haptic.
- **Badge** (rendered per badges.md) and **Locked Badge** — locked state is
  the badge's plate in `status.locked` under frosted glass, wearing a
  keyhole-free lock glyph, with the state ("Badge locked") and the condition
  that lifts it ("Unlocks when you make your own Crime films Ten") beside it.
  The condition is phrased as a **condition**, never as an imperative: it sits
  next to a real CTA and must not read as a competing one.
- **List Card** — the discovery unit: topic label, generated list name at
  `display.md`, creator byline, ranked poster strip, badge state, and exactly
  one 48pt CTA. Nothing on it is user-entered text (PRD Req 12 amendment).
- **Badge Case** — profile hero: a wall grid of badges, drafts as ghost
  outlines (own profile only).
- **Consensus Bar** — on topic pages: ten tiny artwork tiles composing "the
  people's Ten," with your agreement ticked when you have a take.
- **Comparison Overlay** — shared picks ringed, rank deltas as small
  `↑3/↓5` marks, headline stat in `display.md`.
- **Remix Ribbon** — lineage strip on a Ten page: "Remixed from Sam's Ten ·
  4 takes on this topic."
- **Share Card** — the exportable image: topic title, ranked artwork
  column, author, badge (if revealed to viewer), Top Ten wordmark. This is
  the app's ad; it gets design-review scrutiny every time it changes.
- **Undo Toast** — inherited law: destructive/rapid actions (removing from
  tray, re-ranks) apply instantly with a brief Undo bar. No confirmation
  dialogs anywhere in the make-flow.

## Motion & Haptics

Timings are tokens in code (`Motion.gatherFlick`, `Motion.slotSettle`,
`Motion.revealSequence`…) — never inline durations (Stack law).

- `gatherFlick` — suggestion → tray: 320ms spring, artwork scales 1.0→0.6
  along an arc; `UIImpactFeedbackGenerator(.light)`.
- `slotSettle` — item lands in rank position: 260ms settle with 1.02
  overshoot; `.medium` impact. Numeral counts up in 80ms.
- `theCutKeep` — keep-ring draws on in 180ms; `.light`.
- `revealSequence` — the one long ceremony (~2.8s): dim to vault → badge
  materializes back-to-front (backplate, motif, metals, inscription last,
  letter-by-letter) → single `.heavy` impact at inscription completion →
  settle to shareable state. **Skippable by tap after 0.8s.**
- `unlockMoment` — frosted glass over a locked badge shatters-to-clear,
  400ms; `.rigid` impact.
- **Reduce Motion:** every sequence above has a crossfade variant landing on
  the identical end state — non-optional, tested per milestone.

## Accessibility

- Ranking must be fully operable without drag: the placement flow IS the
  accessible path (binary buttons), and drag-reorder has VoiceOver rotor
  actions ("Move up," "Move to position 3").
- Rank announced semantically: "Number one: Pulp Fiction" — numerals are
  never unlabeled decoration.
- Locked badges announce the gate and the action: "Badge, locked. Make your
  own Ten on Tarantino films to reveal."
- 44×44pt targets; AA contrast both themes (`accent.laurelBright` is
  restricted to large/non-text use for exactly this reason).
- The reveal ceremony is narrated for VoiceOver as a composed announcement,
  not a silent animation.

## How Laurel evolves — the iteration loop

Laurel is a starting hypothesis, not a finished system. The process that
made Stack's design work is the process here, made explicit:

- **Structure iterates in prototype.** Flow, anatomy, copy, and layout
  questions are settled in the M1.5 HTML prototype (and later, quick
  prototype branches) — cheap rounds, Mischa on his phone, before native
  code hardens anything.
- **Feel iterates on device, and only on device.** Liquid Glass rendering,
  haptic weight, motion timing, and the reveal's drama cannot be judged in
  a simulator or a screenshot. Milestones touching a ceremony carry a
  device feel gate: Mischa uses a TestFlight build, reacts, and the change
  lands with reasoning. Budget for multiple rounds — the first version of
  every ceremony is wrong in ways only a thumb discovers.
- **Every design reaction becomes a dated amendment** in this file (or
  badges.md), including the ones that *confirm* a choice — "reveal timing
  felt right at 2.8s on device, 2026-XX-XX" prevents relitigation as
  surely as a correction does.
- **Screenshots judge layout and copy; device time judges feel; tests
  judge behaviour.** Three different instruments — never substitute one
  for another (inherited Stack law).
- When Mischa gives a directional note without a number ("more weight,"
  "slower"), pick a value, ship it to the next build, and report the value
  chosen — convergence by build rounds, not by guessing his number in chat.

## Building a Ten is one screen (2026-08-14, Mischa — round 1 on the prototype)

*"They need to be able to easily add items (from recs and from search, going
back and forth between these…), as well as re-order their list and rankings
all in one place."*

Gather and rank were two scenes. They are now **one**, and the scene has four
things in it and nothing else:

1. **Search**, with live results as you type (no submit step), and an in-field
   clear that returns the screen to its suggestions rather than to an empty
   state. Adding from a result leaves the results on screen, because the next
   thing you want is usually one row down.
2. **Refinements** as a chip row, services first — see below.
3. **Suggestions**, in titled sections. A section's heading carries the reason
   it exists; a card carries a reason line only when the heading doesn't
   already give it.
4. **The Ten**, as a strip of ten slots pinned in the dock — always on screen,
   filled slots showing artwork and empty ones showing their numeral. Tapping
   it opens the list to reorder and remove.

**The ten slots are sized to fit, not to scroll.** `--mini-w` is a clamp
against viewport width so all ten and their gaps fit across; principle 1 says
the interface never hides how many remain, and a tenth slot you have to scroll
a strip to see is hidden.

**Direct reordering is now the primary way to rank, and the guided duel is an
aid.** Arranging ten things by hand is exactly the cold-sort the PRD said never
to demand, so the duel survives as *"Rank them for me"* and as the fully
operable non-drag path (Req 13). What changed is which one you meet first: you
meet your list, and you ask for help if you want it. (PRD Req 3 amended.)

### Refinement: subscriptions first (2026-08-14, Mischa)

*"their subscription services (top priority filter/refinement and value prop)"*

Services, genre, director and actor — in that order, services first because it
is the only one that changes what you could actually watch tonight. Two rules
inherited from Stack, both learned the expensive way:

- **A canonical service registry, matched on id, displayed by name.** TMDB
  returns storefronts as though they were subscriptions — *"Paramount+ Amazon
  Channel"* comes back under Prime's provider id. Stack measured **43% false
  positives for Prime** because of it. Holding Prime does not get you
  Paramount+, so storefront rows are dropped at catalog-build time rather than
  filtered in the UI.
- **Never surface a service the user hasn't claimed.** A row for something they
  don't pay for is the opposite of the feature.

### Branching suggestions — the rabbit hole during gather, not only after it

*"I want to then drill-in further and see more suggestions based on that
recommendation… and go down that rabbit hole further after I pick the next
film."*

Every suggestion card carries a **deeper** control. Tapping it opens a *More
like X* section, and the path you took is a **walkable trail** above it:
`Following · Inception › Interstellar`, each step a button back to that point.
Going deeper again extends the trail rather than replacing it, so the branch is
a path rather than a destination that erases where you came from.

Ranking edges come from the catalog itself — TMDB's own recommendations where
they exist, then shared director, shared cast, shared genre, proximity in
years — so *why* a film is being offered can always be said in three words
(*"Also Nolan"*, *"With Cillian Murphy"*).

### Round 2 (2026-08-14, Mischa) — the path is a graph, and the map is how you see it

*"Moving backward in the branch is destructive to the rest of the branch ahead
of that node… without a way to get back to them."*

The trail was a stack, so stepping back popped everything above it. Exploration
is now a **persistent graph**: nodes are films you followed or picked, edges are
*this led to that*, and **navigation never removes a node**. Stepping out of a
branch moves focus to the parent; the branch you left is still on the map, and
tapping it there re-enters it. This is the difference between a path you are
walking and a path you are consuming.

**The map** (`Where you have been`) draws the whole graph — origin at the top,
each followed film below whatever led to it, picks marked gold. It is the
answer to *how do I get forward again*, and it doubles as the record of the
session: you can see that three of your ten came out of one Nolan detour.

Layout is a tidy tree: leaves take the next slot, parents centre over their
children, and labels are clamped to what a node's width can hold — two
overlapping titles make the map unreadable, so a test asserts no two labels
intersect.

**Picks are on the map too**, not just detours. A map that showed only the
wandering and not what it produced would be missing the point of wandering.

### Round 2 — every control says what it does

*"I didn't know how to add something to the 10 list vs what the chevron would
do… Some rows say 'Back', some say 'Go deeper' and it's hard to tell what these
will do."*

- A card now carries **two named buttons**, stacked: `+ Add` (filled, becomes
  `✓ Added`) and `Similar ›` (outlined). Stacked rather than side by side
  because two labelled pills do not fit across a 120pt card, and a row that
  only just fits at the default text size breaks at the accessibility sizes
  this app must pass.
- **Per-section navigation verbs are gone.** *Back* and *Go deeper* sat beside
  each other meaning different categories of thing. Navigation lives in exactly
  two places now: the Now showing bar, and the map.
- **A reason is also a control.** *"Also Nolan"* narrows to Nolan on tap —
  the answer to *what else of his?* without a trip through a filter sheet.

### Round 2 — "Now showing", the line that answers what am I looking at

*"Can't tell what selecting a Genre filter does… am I looking at movies like
Spider-Man that are also in the Drama genre and on one of my 3 services?"*

One bar states the whole current query as chips — every branch step, every
filter, the search text — each droppable on its own, followed by the **count of
films that match**. The count is what proves a refinement did something; a
filter with no visible consequence is indistinguishable from a broken one.
The same bar carries the entry to the map, so *where am I* and *how did I get
here* are one glance apart.

### The add hand-off (2026-08-14, Mischa: *"very abrupt and unclear what's happening"*)

Two halves, both taken from Stack's status-change motion and its rule that
**acting on a row must not make the row leave**:

- **The card stays exactly where it is** and shows its new state in place: a
  check appears, and a gold ring **draws itself** around the poster (an SVG
  rect stroked with a dash as long as its own perimeter, offset tweened to
  zero). Fading a border reads as a flash; the travel is what makes it an act
  rather than a repaint. Removal runs it backwards in `--m-retreat` on an
  ease-out, because undoing should not look reluctant.
- **A copy of the poster flies to the slot it just filled**, and the slot
  lands with a short overshoot. This is the half that answers *where did it
  go*, and it is why the Ten lives in the dock: the destination is always on
  screen, so the travel never leaves the viewport.

The rails **do not reshuffle** when a pick changes what would be suggested.
Stack's rule names the two moments the held order lifts — leaving the screen,
and changing the filter — and both are honoured; closing a filter sheet
rebuilds the screen behind it.

Reduced motion: no travel, no draw, same end state, same ring.

### Round 3 (2026-08-15, Mischa) — what a suggestion is worth, and saying so honestly

**A shared author beats crowd behaviour.** *"More like Interstellar starts with
2 films that are not Nolan films?"* TMDB's recommendation edge was scored above
a shared director, so *people also watched* outranked *the same person made
it*. Weights are now director 10, TMDB edge 5, shared cast 3, shared genre 1.5,
same era 1 — a shared name is a reason a person would give out loud, and genre
alone is the weakest claim available. "More like Interstellar" now opens with
The Prestige and the rest of Nolan's work.

**One number, not two.** The Now showing count measured everything matching
while a rail rendered a truncated ten, so a count of 2 could sit above a single
card. There is one function behind both now.

**"Everything" was a lie.** The shelf is finite and the bar said otherwise. It
states the shelf's real size when nothing is applied.

**A dead end hands you the door.** At zero results the app works out what each
clause is individually costing and offers the escapes, sorted by how much they
open up: *Without Horror · 7 films*. A wall that only reports itself is a wall.

**Free is a way to watch.** TMDB keeps ad-supported and free listings in
buckets the first pass never read, so Inception being free on YouTube in the US
was invisible and unrepresentable. Availability now covers subscriptions *and*
free-with-ads, grouped separately in the picker — a thing you can watch for
nothing is at least as good an answer to "tonight" as a thing you pay for, and
conflating them would be dishonest.

**The map is somewhere you can go.** It drew only history, so with one node it
looked broken. It now draws unexplored next steps as faint nodes off whatever
is focused; following one stays inside the map, so a path can be built there
rather than only reviewed. It states the active filters, and it opens centred
on where you are — a map that opens at its top-left corner drops you in blank
space as soon as the graph outgrows the screen.

**The shelf itself was the bug behind the sharpest question.** *"What about The
Prestige?"* — it was not in the catalog, and neither were Dunkirk, Oppenheimer
or Tenet. A rabbit hole into a director is worthless if their work is missing,
so the build now pulls the fuller filmography of every director who appears
more than once. 220 films became 620.

### Round 5 (2026-08-15, Mischa) — the discovery card is a list, not a person

*"Other Tens" → **"Other Top 10 Lists"**, and the blurb under it is gone.* A
paragraph explaining a screen made of self-explaining cards costs the first
card its place on screen and tells the reader nothing the cards do not.

**The list name is the card's only display type.** It was `Sam · Crime films`
in one 17pt line, so the two facts on the card competed at the same weight and
the person won by being first. The anatomy is now a hierarchy, top to bottom:

| Part | Token | Why |
|---|---|---|
| Topic | `label.sm` (11pt, uppercase, `text.disabled`) | Scope, read at a glance |
| **List name** | `display.md` (22pt New York Semibold) | The artifact — the reason to tap |
| Creator | 12pt `text.secondary`, *"A Ten by Sam"* | Attribution, subordinate |
| Six-poster strip | 40 × 60 minis, ranked | What the list actually contains |
| Badge state | 44pt badge or lock + `label.sm` + one line | The gate, stated |
| **One CTA** | 48pt full-width pill, accent outline | The single action |

The name comes from the list's contents — nothing on the card is typed by a
person (PRD Req 12 amendment). **Names for a design pass to look at:** *"The
90s did it better"*, *"Nothing stands alone"*, *"Miyazaki keeps showing up"*,
*"Everything Hitchcock touched"*, *"Whatever Al Pacino is in"*, *"Comedy, and
nothing but"*, *"Nothing here is new"*. They run 3–5 words; the 22pt line is
sized to hold two lines of that without the card changing shape.

**A card has one action, and the gate is not it.** The call to action was a
line of secondary text sitting in the middle of the card with air on both
sides of it — a label where a button belonged. Two rules now:

- **One control per card**, full width, 48pt (over the 44pt floor), labelled
  with the verb and its object: *"Read Sam's Top 10"*. The card itself is no
  longer a tap target, because a card that is a button containing a button has
  two actions and the user must guess which one they hit.
- **The gate is a status line, never a second verb.** `BADGE LOCKED` plus
  *"Unlocks when you make your own Crime films Ten"*. It reads as a condition,
  so it cannot compete with the CTA; the gate-crossing action lives on the
  list's own page, where it is that page's single action.

**Two defects found while rebuilding it:**

- `status.locked` **had no value in the prototype's tokens**, so
  `background: var(--locked)` resolved to nothing and every locked badge
  rendered as an empty box. The gate's own object — the thing the whole
  mechanic is about — had been invisible since it was built. Screenshots judge
  layout, and this is exactly the class of bug they catch and tests do not.
- The locked silhouette was a circle above a bar, which at 44pt reads as an
  **avatar** — the single glyph it must not resemble on a screen full of other
  people. It is now the badge's plate in `status.locked` wearing a lock glyph,
  per the Locked Badge component above.

## Amendments from the M1.5 prototype (2026-08-14, Claude)

Built and driven end to end in a browser at iPhone size. These are structure
conclusions only — glass, haptics, and motion feel remain native-only
questions for the M2/M3 device gates. Mischa has not yet used it; anything
below marked *proposed* is awaiting his rounds.

- **Gather anatomy (proposed).** One scrolling scene, in this order: the
  source (search field, then the suggestion rail), then the ten slots as the
  canvas, then a separate "Beyond ten" section when the tray overflows, with
  the dock pinned at the bottom carrying the count and the single action.
  Reasoning: the slots and the tray were two representations of the same
  thing on a phone-sized screen, so the tray's job collapsed into the dock —
  it now carries only the count and the verb, not a second row of artwork.
- **Overflow is shown, not hidden.** Items 11+ appear in their own section
  rather than being refused or silently queued, so "gather 14 then cut" is
  visible as a supported path rather than an error state.
- **Row artwork confirmed at 56 × 84**, with the row's minimum height set
  from the artwork (104pt; 118pt for the #1 row) rather than the reverse.
- **The reveal makes the rest of the app inert.** The ceremony sets
  `inert` + `aria-hidden` on everything behind it. Found because the
  prototype left the ranking buttons reachable behind the vault — invisible
  to a sighted user, fully available to VoiceOver and to a swipe. The badge
  is never previewable during creation, and neither is the flow that made it.
- **Inscription timing is budgeted, not per-character.** Writing the
  inscription letter by letter at a fixed 45ms/char ran a long line to ~3.9s
  and blew the ~2.8s ceremony budget. The letter cadence is now derived from
  the line length against a fixed ~700ms budget: length changes the rhythm,
  never the duration. `Motion.revealSequence` stays the timing authority.

## Web parity (share pages)

The web page is Laurel translated, not approximated: same tokens exported to
CSS custom properties from `TopTenKit` (single source), New York substituted
by `Georgia`-stack with matched metrics (or licensed alternative later), no
glass (static header), same Share Card renderer for OG images. The page's
job: look worthy of the list, convert to "Make your Ten."
