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
  that lifts it ("Unlocks when you make your own Top 10 Crime Movies of the
  90s") beside it.
  The condition is phrased as a **condition**, never as an imperative: it sits
  next to a real CTA and must not read as a competing one.
- **List Card** — the discovery unit: the list's name at `display.md`, creator
  byline, ranked poster strip, badge state, and exactly one 48pt CTA. The name
  states the criteria every one of the ten entries satisfies ("Top 10 Crime
  Movies of the 90s"); nothing on the card is user-entered text (PRD Req 12
  amendment).
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

**The map** (titled `Map of your selections` — renamed from `Where you have
been` in round 4, 2026-08-15) draws the whole graph — origin at the top, each
followed film below whatever led to it, picks marked gold. It is the answer to
*how do I get forward again*, and it doubles as the record of the session: you
can see that three of your ten came out of one Nolan detour.

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

**"Everything" was a lie.** The catalog is finite and the bar said otherwise.
It states the catalog's real size when nothing is applied. *(Wording updated
2026-08-15: the line now reads "All 940 movies in our collection" — see "Voice
and spelling". The decision is unchanged; only the nouns are.)*

**A dead end hands you the door.** At zero results the app works out what each
clause is individually costing and offers the escapes, sorted by how much they
open up: *Without Horror · 7 movies*. A wall that only reports itself is a wall.

**Free is a way to watch.** TMDB keeps ad-supported and free listings in
buckets the first pass never read, so Inception being free on YouTube in the US
was invisible and unrepresentable. Availability now covers subscriptions *and*
free-with-ads, grouped separately in the picker — a thing you can watch for
nothing is at least as good an answer to "tonight" as a thing you pay for, and
conflating them would be dishonest.

**The map is somewhere you can go.** It drew only history, so with one node it
looked broken. It now draws unexplored next steps as distinct nodes off
whatever is focused; following one stays inside the map, so a path can be built
there rather than only reviewed. It states the active filters, and it opens
centred on where you are — a map that opens at its top-left corner drops you in
blank space as soon as the graph outgrows the screen.

*(Amended in round 4, 2026-08-15: "off whatever is focused" now means off a
film you actually followed, never off the origin, and the faint treatment those
nodes wore is replaced. See below — as first built this is what put films on
the map that the user had not chosen.)*

**The shelf itself was the bug behind the sharpest question.** *"What about The
Prestige?"* — it was not in the catalog, and neither were Dunkirk, Oppenheimer
or Tenet. A rabbit hole into a director is worthless if their work is missing,
so the build now pulls the fuller filmography of every director who appears
more than once. 220 films became 620.

## The words for the things (2026-11-18, Mischa — "We should be really clear on our terms")

Measured before writing this, by rendering six screens and counting what a
person actually reads. The **You** screen alone used three different words for
one object, and two of them were words the app uses nowhere else:

| word | times it reaches a reader, across six screens |
|---|---|
| Top 10 | **269** |
| list / lists | 16 |
| Ten | 8 — **all on one screen** |
| take / takes | 3 |
| topic | 2 |
| crowd | 2 |
| shelf | 2 |

A word that appears twice in a whole app is not vocabulary, it is a leak.

### One word per thing

| the thing | the word | never |
|---|---|---|
| ten ranked items, made by one person | **a Top 10**, or plainly **a list** | a Ten, a take, a version, an entry |
| what a list is about — *Crime Movies of the 90s* | **a topic** | criteria, a shelf, a kind |
| movies / shows / books | **a category** | a domain |
| everyone's lists on one topic, merged | **what everyone picked** | the crowd, the consensus, Borda |
| somebody else's list on the same topic | **another list on this topic** | a take, a remix |

**"Top 10" and "list" are both allowed, and that is deliberate.** "Top 10" is
the object's name; "list" is the ordinary English noun for it. *Make your
first list* and *Your Top 10s* are both correct, the way *book* and *novel*
are. What is not allowed is a third word.

**"Ten" is ours, not the product's.** Already settled in `AGENTS.md`: product
copy uses digits, our own writing uses the word. The achievement set shipped
on 2026-11-18 broke that in three names and a note before anybody read it,
which is how a rule with no test dies.

**"take" and "the crowd" are retired from copy.** Both were precise in our
heads and opaque on screen. *"Have ten people take on a topic you made
first"* asks a reader to know two private words in one sentence.

### Why this was worth a decision rather than a tidy-up

Mischa could not understand four of the ten achievements. Every one of the
four leaned on *take*, *topic* or *the crowd* — the three rarest words in the
product. The badges were not badly chosen; they were written in a language
only the repository speaks.

## Voice and spelling (2026-08-15, Mischa — standing rule, applies to all future copy)

**US English, everywhere a user can read it.** *Favorite, color, canceled,
toward* — never *favourite, colour, cancelled, towards*. And US **vocabulary**,
not only US orthography: the app says **movies**, never *films*.

Reasoning: the first market is the US, and a British spelling in an American
product does not read as neutral — it reads as *written somewhere else*. This
is an identity app whose whole proposition is that the list sounds like the
person who made it; copy that sounds imported undercuts that before the user
has picked anything. One dialect, chosen once, is cheaper than arguing it per
string. *Movies* over *films* for the same reason plus one more: *films* is the
word a critic uses and *movies* is the word a person uses, and this product is
built for the second one.

**Scope: user-facing strings only.** CSS class names, JS identifiers, code
comments, TMDB genre values, and catalog data fields are unaffected — `addFilm`,
`F.films`, `.map-node`, and the "Science Fiction" genre stay exactly as they
are. Renaming code to chase a copy decision buys nothing and breaks the diff.
Two kinds of on-screen text are also **not ours to spell**: catalog titles,
which keep their makers' spelling (*The Favourite*, 2018), and whatever the
user typed into search, which the Now showing bar quotes back at them.

**"Shelf" is an internal word.** It survives in code and in these specs as the
name for the catalog behind a domain, but the user never sees it. On screen the
noun is **collection**: *All 940 movies in our collection*.

**One noun per domain, and never hard-coded.** `DOMAINS` carries `noun` and
`one` (plural and singular) for each domain, and every count, placeholder,
heading, badge inscription, and generated topic title is built from them.
Before this pass a TV Ten said *"All 940 films on the shelf"* and *"Not one
Horror film made your ten"* — a movie word on a TV screen, which is the same
class of dishonesty round 3 fixed when *"Everything"* was a lie. Books and
games inherit correct copy the day their catalogs land, with no new strings to
write.

**Enforced, not remembered.** `docs/prototype/drive.js` asserts, on the intro,
the build screen, the finished screen, a TV Ten, and Discover, that nothing a
user reads matches `favourite|colour|centre|organis|apologise` — visible text
*and* `aria-label`/`placeholder`/`title`/`alt`, because a British word in an
accessibility string is still shipped copy. A standing rule with no test is a
rule that lasts one session.

*Known gap, flagged not fixed:* the empty-state count is `CAT.length` (940 —
the whole catalog, movies and shows together), while every filtered count is
domain-scoped (620 movies / 320 shows). The wording is now right; the number is
a behavior question, not a copy one, and changing it would have changed the
line Mischa specified.

### The intro screen — three claims, one line each (2026-08-15, Mischa)

*"Too much text. Each bullet must be ONE line at iPhone width."*

| | |
|---|---|
| Headline | What's your Top 10? |
| Sub-line | The list you would defend to the death |
| 10 | Ten and only ten. The limit is the point. |
| ★ | Finish it and earn a secret badge. |
| 0 | Free. No ads. No subscription. Ever. |

What changed and why:

- **The bold lead-in is gone from each bullet.** The old bullets were a bold
  claim followed by a sentence explaining it, which is two lines minimum at
  13px in a 339px text column. A claim that needs a second line to land is a
  claim that has not been written yet.
- **One line is a measurement, not a taste.** A test compares each bullet's
  rendered height against its own computed line-height *and* counts its line
  boxes — two instruments, because a height ratio can be fooled by a short wrap
  and a line-box count depends on the text being one node. Measured at both
  ends of the supported range: 17px against a 16.9px line-height, one line box
  each, at 393pt (iPhone 15 Pro) **and** at 375pt (SE 3rd gen / 13 mini, the
  narrowest iPhone iOS 26 runs on).

  **The headroom, because the next edit needs it.** Spare width per bullet:

  | Bullet | 393pt | 375pt |
  |---|---|---|
  | Ten and only ten. The limit is the point. | 25px | **7px** |
  | Finish it and earn a secret badge. | 62px | 44px |
  | Free. No ads. No subscription. Ever. | 49px | 31px |

  Bullet 1 clears the SE by seven pixels — roughly one character. That is why
  the test runs at 375pt too: a future word added to bullet 1 breaks there long
  before it breaks on the Pro, and a suite that only drives the Pro would call
  it fine. Below 375pt (a width no supported iPhone has) all three wrap; if a
  narrower target ever appears, the fix is the marker column and gutter, not
  smaller type — 13px is already the floor this screen should use.
- **The cost line under the CTA is deleted.** It said *"Free. No account needed
  to make one."* Bullet 3 now carries it and says more (no ads, no
  subscription, ever), so keeping both would have been the same promise twice —
  and the CTA gets its area back.
- **The third marker is `0`, not `→`.** The glyphs are 10 / ★ / 0: the count,
  the reward, the price. The old `→` meant *one list leads to the next*, which
  is the bullet that was cut; an arrow above a sentence about money means
  nothing. `0` is chosen so the marker column keeps saying something.
- **"What's your Top 10?" in the headline; a list is still a Ten everywhere
  else.** The headline is the one place the product name and the number do the
  work of explaining what this is to someone who has never seen it. Past the
  door — *Make your first Ten*, *Your Ten*, *their Ten* — the noun is unchanged
  (AGENTS.md, 2026-08-14).

Unchanged and re-verified: the two drifting artwork rows, exactly one CTA, no
Skip, and zero API calls on the first screen.
### The map claimed a selection nobody made (2026-08-15, Mischa)

*"I opened the map having selected nothing, and it showed Interstellar hanging
under Movies as though I had selected it."*

**The diagnosis.** Three separate decisions compounded into one lie.

1. `ghostsFor(null)` — the speculative "next steps" — had a fallback for the
   case where nothing is focused: with no seed film to be similar to, it
   returned *the top four films of the shelf*. Those are not next steps from
   anywhere; they are simply what the build screen was already showing.
2. `layoutMap` had a matching fallback: with no real roots it walked the ghosts
   **as though they were roots**, which placed them at depth 1 — the row
   directly under the origin, exactly where a film you had followed goes.
   `renderMap` then gave each of them a parent of `S.graph.focus` (null, the
   origin) and drew a real edge from the topic plate down to each one.
3. The "faint" treatment was a 1px dashed plate behind a **full-colour poster
   at 42% opacity**. On a warm background that is a brightness difference, not
   a categorical one — and a poster is precisely what a node on this map
   *means*. So four films the user had never touched sat under "Movies", on
   edges, wearing their artwork, beneath a title that said this screen records
   where you have been.

The empty state written for this exact case (`Nothing followed yet…`) was
unreachable dead code, because its guard was `placed.length > 1` and the
origin-plus-four-ghosts arrangement always cleared it. Two of the same
fallbacks also had the mirror-image failure: with a graph but focus at the
origin, ghosts were computed and then never placed, so the work was silently
discarded and the map offered nothing.

**The fix, and the rule behind it.** *Artwork on this map means "this film is
on your path."* Nothing that is not on your path may wear it.

- **A next step hangs off a film you actually followed, never off the origin.**
  "What could come next" needs a "now"; at the origin the whole build screen
  already is that answer. Both root fallbacks are deleted.
- **A next step carries no artwork at all** — a dashed empty well with a `+`
  where the poster would be. Fading a poster says *less of this film*; an empty
  well says *not a film yet*. That is the difference between a state and a
  volume knob.
- **Nothing explored draws no graph.** The map renders a designed empty state
  instead: *"Your map is empty — this is the record of where you have actually
  been. It draws your own path and nothing else, so it stays blank until you go
  somewhere,"* then what fills it (`+ Add` puts a film here the moment it joins
  your Ten; `Similar` follows a film and keeps whatever led you to it), and the
  promise the bug broke: *"Nothing on this map is ever a film you did not
  choose."*
- **The way in is always there.** The Map entry in the Now showing bar used to
  appear only once the graph had a node. An empty state nobody can reach is not
  a fix, and the same reasoning already governs the domain picker — a named
  thing that is not ready yet is a promise, an absent one is nothing.
- **Title: `Map of your selections`** (was `Where you have been`).

**The legend is a visual key, not a sentence.** It was one run-on line —
*"Solid: followed or picked. Faint: where you could go next… Gold: in your
Ten"* — which asked the reader to hold three colour words in their head while
looking at a tree. It is now four keys, each a drawn swatch beside a
three-word name: **You are here**, **Path you took**, **In your Top 10**,
**Not explored yet**. It lists only the states actually on screen, because a
key is a reading aid for what is drawn and a marker listed but absent sends the
reader hunting for it.

**Amended 2026-11-17 (Claude).** The key read *"In your Ten"* until now. The
2026-08-15 naming amendment says product copy says **Top 10** in digits
wherever a person reads it, and six user-facing strings had been missed — the
arrange sheet's heading, the button at the end of the reveal, this key, the
coach line, and two VoiceOver labels. They now all say **Top 10**. The word
*Ten* survives only in this file, the other specs, and the code.

The three-word ceiling on a key label stands, but **"Top 10" counts as one
word** in it: it is the product's name for the object and reads as a single
noun. Without that, the rule would push exactly this key back into the word the
rest of the app has just stopped saying. The gate still bites — a
sentence-shaped label fails — and the test was re-run against a sentence to
prove it.

**The map says when it continues past the edge (added 2026-11-18, Claude —
raised by Mischa reviewing the overnight build).** The graph is wider than an
iPhone for all but the shallowest path — the fan of unexplored steps alone
overruns a 393pt screen by about 170pt, and a path with two branches by about
250pt — and the view opens **centred on where you are**, which is right, but it
means a whole branch can sit off the left edge with nothing to say so. A
**44pt fade** now sits on each side that has something beyond it: `--bg-base`
held for the first 18% and ramping to transparent, `opacity` cross-faded over
160ms, and off entirely when the graph fits.

It is a fade and **not an arrow**. This is a canvas panned with a thumb; an
arrow glyph reads as a button, and a button at the edge either does nothing or
eats the tap area over the nodes nearest the edge — the ones it is pointing at.
A fade costs no tap target, makes no promise, and is the convention iOS already
uses on every scrolling row. `pointer-events` stay off and both fades are
`aria-hidden`: a screen reader reaches the nodes through the graph, not by
scrolling, so a spoken "there is more to the left" would be noise.

The state is recomputed on scroll and from a `ResizeObserver` on the scroller
rather than a window listener, so it dies with the view. The rule is exact — a
side is faded **if and only if** there is scroll remaining that way, with 2px
of slack for sub-pixel positions — and `drive.js` asserts it at the centred
opening, at both ends, and on a screen wide enough to hold the whole graph.
Falsified both ways before it was kept: pinned on, the left-end check names it;
pinned off, the centred check names it.

**Vertical is deliberately left alone.** The graph can also run past the bottom,
but downward scrolling is the one thing every phone user does by reflex, and
the header stays put above it. The axis that hides content is the unfamiliar
one.

**Every state carries a shape, not only a colour** — the accessibility gate,
and not a theoretical one. In the vault theme `accent.laurel` and
`accent.laurelBright` are **the same gold** (`#D9B23A`), so "where you are" and
"in your Ten" were the same ring in dark mode and told apart by nothing. The
markers now are: a **caret above the plate** for where you are, a **tick disc**
for a pick, a **dashed empty plate with a `+`** for an unexplored step, and
**plain artwork** for a step you took. All four survive greyscale, and a test
asserts it by comparing swatch geometry with the colour thrown away.

Two contrast fixes came with it: the unexplored-node label moved from
`text.disabled` to `text.secondary` (`text.disabled` on `bg.base` is 3.3:1 in
the vault, below AA for text), and the key's artwork block sits at 75% of
`text.secondary` so it measures 3.1:1 on gallery paper and 4.6:1 in the vault —
it is the whole difference between "path you took" and "not explored yet", so
WCAG 1.4.11's 3:1 for meaningful graphics applies to it.

**The filter line says something true in every state.** It read *"Next steps
below are filtered by X"*, which is false on a map with no next steps. It now
reads *"Filtered by X — filters change what is offered next, never the path the
map records"*, which also answers the question a filtered map raises: no, your
history has not been filtered away.

Everything the map already got right is asserted and unchanged: navigating
never destroys a node, tapping a real node re-enters the path there, following
an unexplored step stays inside the map, the active filters are stated, it
opens centred on where you are, and no two labels overlap.

### M5 (2026-08-15) — the pages a stranger lands on

Three surfaces, all built from one module (`share.js`) because they render the
same few things and the point of M5 is that a stranger sees what the phone saw.

**The public Ten page.** The front door: somebody shares a link and this page
has to make the list worth reading and the badge worth earning, with no account
and no app (PRD Req 11). One column on a phone, two above 800px — a share page
is read on a laptop as often as a phone, and a 400px column centred in a 1400px
window looks like a mistake.

**The list is never gated; only the badge is** (Req 12), and the tests assert
exactly that: with the badge locked, all ten titles are still readable. The
lock names its key — *"Make your own Top 10 Crime Movies of the 90s and this
badge opens"* — because a lock with no key on it is just a wall.

**The comparison overlay is the list, annotated.** Shared picks are marked
*your #2* in place and the row is tinted; the count is stated once above the
fold. Making it a separate screen would mean reading the list twice to find the
disagreement, which is the interesting part. Zero in common gets the better
sentence rather than an empty state: *"Not one pick in common. Someone is
wrong."*

**The topic page** is where the argument lives, because a topic is the social
object and a Ten is a take on it. It leads with the consensus, then lists every
take under it.

**The share card** is a page at `/card`, laid out at 1200 × 630 and
screenshotted — not a drawing. That is what makes it verifiable: the same
browser run that checks the Ten page checks that the card's badge is the page's
badge. It shows five picks rather than ten and gives the badge a third of the
frame, because at thumbnail size the badge is the only legible thing and it is
what is being sold.

**One badge renderer, not three.** `badge.js` was extracted from the app
prototype so the app screen, the share page and the card all draw from it. A
badge is *data rendered live* (badges.md), and that decision is worth nothing
the moment a second renderer exists — the two would agree only for as long as
somebody kept them in step. A test asserts the app and the share page produce
byte-identical SVG from one composition.

`tokens.css` came out for the same reason, and the surface where a drifted
token would show is the one a stranger sees first.

**A composition arriving from outside is not trusted.** `badgeSVG` fills
missing fields at the door rather than at six interpolations: a missing colour
renders as a black void, which is the worst kind of failure because it looks
deliberate. Found by hand-writing a test composition with the wrong field
names and getting a black rectangle.

### Round 8 (2026-08-15, Mischa) — two card anatomies, and one line means five lines

**A browse card is a poster and a title. Nothing else.** Round 2 put both verbs
in words on every card, and it was right for a rail that is *arguing a case*
("Because you picked Inception"). It is wrong for a shelf you are *scanning*:
two 44pt buttons under every poster turned eleven browse rows into eleven rows
of buttons. The poster was always the add control, so a browse card keeps it
and drops the rest — 221pt tall instead of 320.

**`See similar` arrives after the pick, on the card that was picked.** It is
also the first moment the question is worth asking. It is built by `markCard`,
in place, rather than by re-rendering the rail — round 1's law is that acting
on a card must not make the card leave, and a re-render would also throw away
the ring that is drawing itself at that moment.

> **Class names on a shared element are a namespace.** The reveal class was
> called `.in`, which the card already used for its added-checkmark badge —
> absolutely positioned, top-left. `See similar` landed on top of the poster.
> Renamed `.revealed`, and the test now asserts the control sits *below the
> artwork*, not merely inside the card.

### Round 8 — the one-line rule covers all five lines

*"The splash breaks our one-line rule twice."* The rule was written for the
three bullets; the headline and the sub-line were wrapping. Both now carry
`white-space: nowrap`, which makes the promise enforceable rather than hoped
for, and both are sized under measured ceilings:

| | 375px | 393px | 430px |
|---|---|---|---|
| Headline ceiling | 40.5 | 42.5 | 47 |
| Sub-line ceiling | 17.75 | 18.5 | 20.5 |
| Bullet ceiling | 15.75 | 16.5 | 18.25 |

**Where the bullet headroom came from.** Round 7 reported a 13.5px ceiling and
called it arithmetic. It was arithmetic against the wrong width: the splash was
still inside `.wrap`'s 20px page gutters *and* its own 16px inset, paying twice.
`.wrap.bare` drops the page gutters for this screen — worth 40px, more than the
numeral column and the side inset put together — and the ceiling moved from
13.5px to 15.75px. Bullets ship at 15.4 / 16.2 / 17.9, against 13px before
round 7.

The lesson is not about this screen: **a measured limit is only as good as the
box you measured inside.** The first number was real and the conclusion drawn
from it was wrong, because the box had a second constraint in it that nobody
had looked at.

**The frame.** One inset, top and bottom — the space above the first row of
posters is the space under the CTA, 40px, equal on every screen. `max()` and
not `+` for the safe areas: a notch and a home indicator are never the same
number, so *adding* them guarantees the one thing the rule exists to prevent.
The CTA band is bottom-aligned so the button's underside sits on the frame.

**Posters are sized to their row, exactly.** `.marquee` clips what overflows,
so `20svh` looked right and was silently cropping 26px off every poster. The
row is `0.4 × (100svh − 112px)` split in two, so `--tile-h: calc(20svh − 26px)`.
A number that is nearly right, plus a clip that hides the remainder, is worse
than either alone — and the test now measures poster height *against its row*
rather than on its own.

> *2026-11-18: `.marquee` is gone. The wall that replaced it does not pick a
> poster height at all — four `flex: 1 1 0` rows make the height the leftover
> divided by four, which cannot be nearly right. The finding is why.*

**The last bullet is bold**, and the callout copy is Stack's: *"Select your
streaming services to see what is already included in your subscriptions."*

### Round 8 — the coach mark is modal

Stack's pattern, replacing round 7's inline callout: the screen dims, the
Services chip is **lifted out of the dim** so the target stays lit, the callout
floats above everything with its arrow on the chip, and the screen is `inert`
until OK. A coach mark you can scroll past is a coach mark nobody reads. The
cost is real — it is an interruption on the first screen — which is why it is
spent once, on the single control whose name does not explain itself.

### Round 8 — a page title never wraps

A list name is a criteria sentence now, and they vary from 25 characters to 35.
At one fixed size the long ones broke across two lines, and a wrapped page
title reads as two headings.

**Shrink to fit, do not bucket by character count.** A bucket has to be guessed
against a font, a locale and an accessibility size at once, and is wrong the
moment any of the three moves. `fitOneLine` measures the real element and steps
down from 30px, stopping at 20px and letting it wrap below that — a title too
small to read is worse than a title on two lines. *Top 10 Animated Movies of
the 2000s* lands at 21px on a 375pt screen.

**"Start over" moved to the line below the title**, beside the prompt. A 44pt
control on the title's line was taking a quarter of the column to say something
secondary — and it was itself wrapping to "Start / over".

### Round 7 (2026-08-15, Mischa) — the splash in thirds, and a screen you can browse

**The splash is three bands: artwork 40%, pitch 40%, CTA 20%.** Stated as
shares of the viewport rather than pixels, because the point is that the
composition holds on every iPhone. In CSS that is `flex: 40 1 0` / `40 1 0` /
`20 1 0` on the three children — **basis `0`, not `auto`**, which is the whole
mechanic: with `auto` each band first takes what its content wants and the
ratio only describes the leftovers, so the copy block silently claims more on a
tall phone and less on a short one. Measured 38/38/19 at 393×852 and 375×667
and 430×932, the missing points being the real gaps between bands.

Posters size off the band that holds them (`--tile-h: clamp(96px, 18.4svh,
190px)`, width `h ÷ 1.5`), so two rows plus one gap fill the artwork 40%:
123pt tall on an SE, 171pt on a Pro Max. A fixed poster size would have left
a third of that band empty on the big phone.

**What the bullets can weigh is arithmetic, not taste.** Round 5 promised one
line per bullet and a test enforces it; round 7 asked for bigger text. Those
two meet at a ceiling, and the ceiling is set by the longest sentence — *"Ten
and only ten. The limit is the point."*, 41 characters, beside a numeral, on a
375pt screen. Measured ceilings: **13.5px at 375, 14.25px at 393, 16px at
430**. The ramp `clamp(0.8125rem, calc(4vw - 1.8px), 1rem)` sits about 2% under
each. The growth this screen actually needed went where nothing caps it — the
headline to `clamp(2rem, 9.5vw, 2.75rem)` and the sub-line to `clamp(1rem,
4.4vw, 1.1875rem)`, both of which may wrap.

The numeral column (`1.6em`) and its gap (`--s2`) are part of that arithmetic:
every pixel they give back is a pixel of sentence.

**The CTA reads "Make your first list."**

### Round 7 — a collection you can browse, and controls that stay put

*"The first screen doesn't have nearly enough browsing."* The shelf holds two
thousand movies and the screen offered sixteen of them under one heading.

**Rows, in the collection's own order.** *Recent releases* first, then
*Popular*, then one row per genre — and the genre order is `facetValues`, which
already counts how much of the shelf each genre holds. So the rows come from
the collection rather than from a list somebody typed, and the TV and books
shelves get their own rows without a second implementation. 11 rows, 20 cards
each, ~220 titles reachable without typing anything.

**Rows overlap on purpose.** A popular drama belongs in *Popular* and in
*Popular dramas* both. Suppressing the second because the first got there
first is how a browse screen ends up with rows that are technically distinct
and practically empty. Only the user's own picks are held back — those have a
home already. What may never repeat is a whole row that duplicates another,
and that is what the test checks.

**Genre headings use the list-name vocabulary.** *Popular comedies*, *Popular
sci-fi movies* — built from `nameParts`, the same decomposition that names a
list, so a genre cannot go by two different words in two parts of one app.

**The query bar is sticky; the readout is not.** Search and the four
refinement chips pin to the top (`position: sticky; top: 0`, 123pt tall) — with
a dozen rows below, a search field that scrolls away is one you have to scroll
back up to find. The **Now showing** bar deliberately stays out of it: it is a
readout of what those controls did, and freezing a readout above a scrolling
page makes it compete with the thing it describes.

### Round 7 — the Services coach mark

*"Services"* names a control. It does not say what the control gets you, and
what it gets you is the app's actual value promise — the reason the catalog
carries per-title availability at all. A callout sits under the chip row with
an arrow pointing up at the Services chip:

> Tell us your streaming services and we will show what is already included in
> your subscriptions.

Three rules keep a coach mark from becoming nagware, and all three are tested:
it appears **only while no service has been chosen**, **only on a domain that
has services** (a book is not on Netflix, so the books shelf never shows it),
and dismissing it is **permanent** — `tipDone` survives starting a new list,
because it is something the person has read, not something this list has done.

### Round 7 — a shelf size is a floor, not a limit

*"All 2,000+ movies in our collection."* An exact count reads as the end of the
shelf; a floor reads as a collection still growing. Which round figure is the
whole question — choosing the step by size alone put 232 books at "200+", giving
away a seventh of the shelf to look tidy. The step is chosen by what it
**costs**: the roundest one that still keeps nine tenths of what is really
there. 2,000 stays 2,000+, 700 stays 700+, 232 lands on 230+. The test asserts
the figure is never larger than the shelf and never rounds away more than a
tenth of it.

### Round 7 — a sheet does not move when you tap something inside it

Tapping a service re-rendered the whole sheet, so the new element entered from
its off state and the sheet appeared to fall away and come back on every tap
(Mischa: *"a weird jitter"*). **Nothing about choosing a service asks the sheet
to move**, so the chip now toggles in place — class, `aria-pressed`, and a live
announcement, and no re-render.

The general rule, worth stating once: **re-render the smallest thing that
changed.** A container that owns an enter transition must not be rebuilt to
express a change to one of its children — the transition is state, and
rebuilding resets it. The regression test samples the sheet's identity and
position across eight frames after the tap, which is the window a replayed
transition would have animated through.

### Round 5 (2026-08-15, Mischa) — the discovery card is a list, not a person

*"Other Tens" → **"Other Top 10 Lists"**, and the blurb under it is gone.* A
paragraph explaining a screen made of self-explaining cards costs the first
card its place on screen and tells the reader nothing the cards do not.

**The list name is the card's only display type.** It was `Sam · Crime films`
in one 17pt line, so the two facts on the card competed at the same weight and
the person won by being first. The anatomy is now a hierarchy, top to bottom:

| Part | Token | Why |
|---|---|---|
| **List name** | `display.md` (22pt New York Semibold) | The artifact — the reason to tap |
| Claim | 14pt `text.secondary`, generated | The argument you can answer (2026-11-17) |
| Byline | 12pt, source bold + `·` + role | Who or what made it (2026-11-18) |
| Six-poster strip | 40 × 60 minis, ranked | What the list actually contains |
| Badge state | 44pt badge or lock + `label.sm` + one line | The gate, stated |
| **One CTA** | 48pt full-width pill, accent outline | The single action |

**The topic row above the name is gone (2026-08-15, Mischa).** It was there
when a name was a claim about the list and the topic was its scope — two
different strings worth two different rows. Since the naming correction the
name *is* the criteria, so the topic row printed the name a second time in
11pt. One row, one name.

**The byline, and why it sits under the claim (2026-11-18, Claude — Mischa
raised it).** The *Creator* row above said *"A Top 10 by Sam"*. Two things
were wrong with it by November: Sam was invented, and the row was doing the
"who" job in a product that had since decided the card leads with the
**argument** and keeps the name as attribution. The byline is now two parts on
one line — the source in `text.primary` bold, then a middle dot, then its role
in `text.secondary` — and it sits **below** the claim, not above it. Above the
claim it would put the name back in front, which is the thing the 2026-11-17
pass removed.

The role is what makes a byline work: *"Mischa · made this app"* answers "who
is this" in three words, and *"Best known · the ones most people have rated"*
says a list is derived rather than dressing a ranking rule as a person. See
the PRD Req 12 amendment of the same date for which sources exist and why.

It **wraps rather than truncates**: at accessibility sizes a role runs wider
than a phone, and a clipped role answers nothing, so the line is a
`flex-wrap` row and not an ellipsis. The dot is a CSS `::before` on the role,
so it never reaches `textContent` and a screen reader hears "Mischa, made this
app" rather than "Mischa middle dot".

Nothing on the card is typed by a person, and the name states the rule all ten
entries satisfy (PRD Req 12 amendment). **That rule is now asserted rather
than proxied.** The harness used to count `p` elements on a card, which was a
stand-in for "nobody types anything here" and failed twice: once when the
generated claim arrived as a `p`, and again when the byline did. It now
accepts a byline only when both halves match a source the app ships,
character for character — so a byline with a word added to it still counts as
free text. Falsified both ways before it was kept. **Names for a design pass to look
at:** *"Top 10 Crime Movies of the 90s"*, *"Top 10 Hitchcock Movies"*, *"Top 10
Animated Movies of the 2000s"*, *"Top 10 Sci-Fi Movies"*, *"Top 10 Pacino
Movies"*, *"Top 10 Drama Shows"*, *"Top 10 Books of All Time"*. They run 4–7
words — longer than the old claim-names, and the 22pt line must hold **two**
lines of that without the card changing shape.

**Two cards may carry the same name.** Two people who both made a *Top 10 Crime
Movies of the 90s* have lists with the same name, and the creator byline is
what tells them apart — which is the correct hierarchy for this app, where the
list is the artifact and the person is the attribution. Design for it rather
than around it: adjacent identical names on the discovery screen are a
signal that a topic is popular, not a bug.

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

## A domain brings its own words and its own pictures (2026-08-15, Claude — books)

Adding books to the prototype made two assumptions visible that had been free
while every shelf came from TMDB. Both are now rules, and both are the kind of
thing the fourth domain (games) should cost nothing to add.

**Extended 2026-11-17 (Claude).** A domain also brings its own word for its
artwork. The dock read *"Tap a poster to start"* in front of a wall of book
covers — the same class of mistake as calling a TV network a studio, which
this section already fixed one rule down. `DOMAINS` carries an `art` word
(`poster` for movies and TV, `cover` for books, the fallback), and
`artNounFor()` answers it the way `nounFor()` answers "movies / shows /
books". `drive.js` asserts a books shelf is tapped by its covers.

**And again, an hour later.** A sweep of every visible string and accessible
name on the books flow, looking for words only a film shelf should say, found
the title page saying **"DIRECTOR" over Jane Austen** and offering **"Where to
watch"** for a book. Both words were typed into that screen while the app
already knew better: books declare `director: 'Author'` and `services: null`
in their own axes, and the filter chips had been reading those all along. The
screen asks now, and a domain with no services axis loses the row rather than
printing "Not on your services" under a novel.

The same sweep caught a third: TV was labelled **Director** when the field
holds the **creator** — Vince Gilligan for Breaking Bad, David Benioff for
Game of Thrones, which `build_tv.py`'s own docstring says it stores. A show
has a creator.

| | movies | TV | books |
|---|---|---|---|
| authorship | Director | **Creator** | **Author** |
| the studio axis | Studio | Network | Publisher |
| the genre axis | Genre | Genre | Subject |
| artwork | poster | poster | **cover** |
| where to watch | yes | yes | **no row at all** |

The pattern to keep: **anything a domain says out loud belongs in `DOMAINS`,
not in a string at the call site.** Five have been caught this way now — the
noun, the studio axis, the artwork word, the credit line and the services row
— and every one was invisible until a second domain existed. `drive.js` now
sweeps the books flow for film words, with a book's own title and author
allowed through, so the next one costs a test run rather than a reading.

- **Artwork is asked for, never assembled at the call site.** Every screen
  used to build `image.tmdb.org/t/p/w185` + the item's path, in a dozen
  places. Books are not on TMDB and never will be, so an item may now carry an
  absolute `img` of its own, and one helper — `art(item, size)` — answers with
  `item.img` when there is one and the TMDB pattern when there is not. The
  rule: **a screen asks an item for its picture; it does not know where
  pictures live.** A domain whose artwork sits somewhere else then costs one
  field, not a dozen edits.
- **Each domain names its own axes, and a missing axis draws nothing.** The
  refinement chips were Services / Genre / Director / Actor for everything. On
  a books shelf, "Director" is wrong, "Genre" is really Subject, and Services
  and Actor do not exist at all — a book has no cast and is not on Netflix. A
  domain now declares its axis labels, and **a null axis is not drawn**: an
  absent chip is honest, while a chip that opens onto an empty sheet is a
  dead control the user paid a tap to discover. (Films and TV keep exactly the
  chips they had.)
- **The domain also owns the noun.** "All 613 films on the shelf", "12 films",
  "Search films", "Not one horror film made your ten" — every one of those is
  now the current domain's word, singular or plural by the same rule, from one
  helper. Two bugs fell out of writing it down: the shelf count was counting
  TV shows as films, and a badge inscribed *"5 Austen films, no apologies"*
  over a shelf of books.
- **Similarity keeps its axes and changes its verbs.** The link scoring
  (series 14, brand 5, author 5, cast 6/2, crowd 5, genre 1.5, era 1) needed
  no new axis for books — a series is a series, an author is the authorship
  axis, a shared subject is the floor. Only the words differ: the crowd edge
  is *"Often read together"*, and a second name on a book is *"Also by"*
  rather than *"With"*.

**Cover artwork is reproduced, not approximated.** The mirrored book covers are
the Standard Ebooks cover *design*, not just its painting: the build replays
each book's own `cover.svg` — its title box, its coordinates, its League
Spartan setting — over the artwork. The first pass skipped that step and the
shelf became a wall of untitled nineteenth-century paintings; a reader
scanning a shelf of paintings cannot find a book. Covers are mirrored at 240px
(twice the 120pt card) and average 14KB, against 680KB for the source artwork:
the prototype ships the whole shelf for the weight of two source covers.

## Web parity (share pages)

The web page is Laurel translated, not approximated: same tokens exported to
CSS custom properties from `TopTenKit` (single source), New York substituted
by `Georgia`-stack with matched metrics (or licensed alternative later), no
glass (static header), same Share Card renderer for OG images. The page's
job: look worthy of the list, convert to "Make your Ten."

## The title page leads with its action (2026-11-17)

Order on a title page: **title, artwork + year + director, the button, then
the ways onward.** Cast, genre and services sit full-width BELOW the button,
not in the column beside the poster.

This started as a bug of my own making. Giving the cast and genre links real
44px targets put each on its own line in the 203px column, the facts block
grew to 428px, and "+ Add to my Top 10" landed at y=528 with the dock at 541
— the primary action on the page, behind the dock. An accessibility fix that
buries the button is not a fix.

It is also the better page. Those links are not facts to read, they are
**navigation**: every one narrows the collection. What somebody came to this
screen to do is add the film, so the artwork and the button come first and
the ways onward follow. Full width lets them wrap properly too — four cast
names take two lines at 353px where they took three at 203 — and the label
("STARRING") sits inline with them instead of spending a line of its own.

`drive.js` asserts the button is fully above the dock at rest, with no
scrolling. Falsified by sinking it 260px and watching the check name the
overlap.

## The map's root names the list (2026-11-17)

A map node is 56px wide and holds about twelve characters of 9px type before
it collides with its neighbour. The ROOT node is the topic, and **every
topic's name begins "Top 10 "** - seven of those twelve - so the root read
*"Top 10 Movi…"* and named nothing at all. It is the same fault the splash
strip's captions had, fixed the same way: strip the prefix every card shares.

The root is also the one node that can afford to be wider. It sits alone on
its row with the full width either side, so it is 132px and holds **24**
characters - measured, not derived: 26 overflowed on "Animated Movies of the
2000s" (127px of text in 124px of room), and 24 clears every shape the namer
can produce (genre, genre + decade, director, actor). It reads "Crime Movies
of the 90s" now.

## The splash fits on every phone, swept not guessed (2026-11-17)

"A splash whose button is below the fold has failed at the only job it has"
was already a comment in the code, written when a breakpoint at 741px tipped
a Pro Max (which gives 745) over its own viewport. That was fixed by
measuring six viewports **by hand, once**. A hand-measurement protects
nothing: sweeping every height from 500 to 900 across five widths found the
splash overflowing in a band nobody had looked at.

**Three faults, each invisible outside its own narrow window:**

1. **The strip was a fixed 173px** whatever the screen, so between about 600
   and 680px of height the three bands wanted more room than existed - an
   iPhone 13 mini (375x629) scrolled by 11px. Its width is now
   `clamp(54px, 9.5svh, 84px)`, so it gives way continuously instead of at a
   breakpoint. Shrinking the strip is the right thing to give up: the hero is
   the thesis and the CTA is the point.
2. **The hero grid's height derives from its WIDTH** - five columns of 2:3
   cells, so about 0.6x - which means a wide, short viewport made it taller
   exactly where there was least room. A 430x610 browser overflowed by 56px.
   Capped at `min(100%, 54svh)`: the loosest value that survives the sweep.
3. **The strip's breakpoint was 620, not 600.** Below ~620 the three bands do
   not fit however small the strip gets. The old value was wrong only in a
   20px window.

**And one self-inflicted:** writing `margin-inline: auto` on the hero to
centre it. It is a `<figure>`, whose default `margin-block` is `1em` - naming
only the inline axis handed 16px back top and bottom, which was most of the
overflow the cap had just been added to remove. `margin: 0 auto`.

`drive.js` now sweeps eight viewports, including the three that actually
broke, and asserts the headline, the button and the promise are all on screen
with the page not scrollable by more than 2px (a pixel or two is sub-pixel
rounding on a `100svh` box, not a layout that overflows).

**A note on the sweeps' own cost.** `drive.js` runs 77s, inside CI's 25-minute
budget with room to spare. The Dynamic Type sweep runs its fallback fonts
only at the 28px and 32px roots: every width failure found that way appeared
at those sizes, because that is where a label outgrows its control, and at
ordinary sizes the fonts agree. Checked by restoring the bug and confirming
the trimmed sweep still names both failures.

## VoiceOver: every control named, every rank spoken (2026-11-17)

The fourth stated gate, swept on five screens by `drive.js`. A screen reader
cannot be run here, but what it would read can be checked: every interactive
control resolves to an accessible name (aria-labelledby, then aria-label,
then content, then title - the spec's own order), and no rank numeral is left
as a bare digit.

**Two findings, both the same shape.** The discover cards' preview strips
read as *"1 2 3 4 5 6"* with nothing attached to the numbers, and the splash's
hero grid read as *"1 2 3 4 5 6 7 8 9 10"* - on the first screen of the app.

design.md's rule is that a rank is "announced semantically ... numerals are
never unlabeled decoration", and the obvious reading of that is to label each
cell. **That is wrong here.** Six or ten separate announcements ahead of a
card's own call to action buries the thing the card is for. Both are a single
labelled image instead, announcing the list once and in order:

> *"Sam's first six: 1, The Shawshank Redemption; 2, Pulp Fiction; 3, The
> Silence of the Lambs; ..."*

The rule holds - a rank is never a bare numeral - but the unit it applies to
is the artifact, not the cell. Per-item announcement is right where the rank
is the interaction (your own Ten, where you move things up and down), and
wrong where the ranking is a picture of somebody else's finished list.

**The sweep has a canary**, like the other three: it plants an unlabelled
button and a bare numeral, confirms both are caught, removes them, then runs
for real. That canary earned itself immediately - the numeral half of the
check was dead on its first run, because its regex was over-escaped inside
the template literal (`\\\\d` where it needed `\\d`), the mirror image of
the bug that had killed the contrast check an hour earlier.

## Contrast at WCAG AA, and Reduce Motion (2026-11-17)

Both are stated gates in AGENTS.md and design.md; both are now swept by
`drive.js`.

**Contrast.** Measured against the background a pixel is actually painted on
- walking up the ancestors, compositing any translucent fill, until
something opaque is found - rather than the one the stylesheet nominally
sets. Two exemptions: WCAG 1.4.3 excludes inactive controls, so a disabled
button is skipped (the "Arrange" button at 0 of 10 measures 2.2:1 and is
meant to recede, while its enabled state is 5.2:1), and text over artwork is
skipped because the backdrop is a photograph.

Two real failures, both in light mode:

| | was | now |
|---|---|---|
| service pills, and a pressed filter chip | `--accent` on `--accent-muted`, **3.93:1** | `--accent-ink`, 5.3:1 |
| the rank numeral on a finished Ten | `--accent-bright`, **2.28:1** at 28px, under the 3.0 large text needs | `--accent`, 4.7:1 |

**New token: `--accent-ink`.** Accent text ON the muted fill. Darkening the
ink was the only move available - lightening the fill enough to carry
`--accent` would need it at 91% luminance, which is not a fill any more. In
dark mode `--accent` already clears 6.4:1 on `--accent-muted`, so the token
resolves to the same value there.

**`--text-disabled` is not a text colour either (2026-11-18).** It measures
**2.41:1 in Gallery and 3.3:1 in Vault** — it fails AA for text in *both*
schemes. That is correct for what it is named after: WCAG 1.4.3 exempts
inactive controls, and a greyed-out button should read as switched off. It is
wrong for anything a reader is meant to read. Two uses had drifted into it —
the level labels on suggestion cards (*"Very specific"*, *"Broad"*, *"Coming
next"*) and the prototype's build stamp — and both are `--text-secondary` now.
The rule: **if it is a word somebody reads, it is `--text-primary` or
`--text-secondary`.**

**`--accent-bright` is a FILL colour**, not a text colour: badge metal, a
slot ring, a focus edge. It fails as text on the light background even at
28px. `--accent` is the text weight of the same gold, and in dark mode the
two tokens are already identical.

**Text over artwork is no longer exempt (2026-11-18).** The exemption above
was honest while artwork appeared behind captions; the splash wall puts the
headline, the tagline and the promise over forty posters, and "the backdrop is
a photograph" would have exempted the first screen in the app. So that text is
measured instead, by a method the ancestor-walk cannot manage:

1. Every poster on the wall is forced to **pure white**, which bounds every
   real poster there could ever be. Whether a bright one happens to sit under
   the headline when the gate runs is luck, and a gate that depends on luck is
   not a gate.
2. The page is screenshotted, the PNG is handed back to the browser — which
   has a decoder — and read off a canvas. What is measured is what a reader
   sees: veil, poster, blur, border and all.
3. The **brightest pixel** in each text block's box is taken as the
   background, and the ratio is computed against the ink's own computed
   colour.

Measured on the wall: headline **8.4:1**, tagline **6.4:1**, promise
**7.2:1**, list name **14.4:1**, list credit **6.3:1**. Falsified by thinning
the veil, which drops the headline to 2.1:1 and names it.

Modelling this instead was the first attempt and it was wrong twice — once
about the plate, whose `backdrop-filter` turned out to have nothing behind it
at all, and once about the SE, where a veil written in viewport percentages
left the headline in the weak part of the gradient.

**Reduce Motion.** design.md calls the identical-end-state rule non-optional
and "tested per milestone". The reveal ceremony was rewritten the same day -
the inscription moved onto the badge's ribbon and types letter by letter - so
the claim is now asserted rather than assumed: the suite runs the reveal
twice, with and without `prefers-reduced-motion`, and compares the end state
field by field (layers landed, letters struck, inscription text, list name,
buttons shown). Falsified by skipping the ribbon when reduced and watching
the check name the differing field.

## Dynamic Type, XS to accessibility sizes (2026-11-17)

AGENTS.md: "Dynamic Type from XS to accessibility sizes without truncation or
overlap." Unmeasured until now, and **failing on four of six screens**. On
iOS this is the system text-size setting; in a browser it is the root font
size, which every `rem` in the stylesheet follows. `drive.js` now sweeps five
screens at **12, 16, 20, 24, 28 and 32px** root.

What was broken, worst first:

- **The splash headline.** `.intro h1` had `white-space: nowrap` and a
  `clamp()` whose floor is `2rem`. A floor that grows with the reader's text
  size and a refusal to wrap cannot both hold: at a 24px root the headline
  was 48px, "What's your Top 10?" ran 440px wide on a 393px screen, and **the
  first screen anybody sees scrolled sideways**. Wrapping costs nothing at
  the default (the `10vw` term resolves to 39px and the line still fits).
- **The finished screen's last row** was an inline `display:flex` with no
  wrap; its two buttons ran 57px off the side at 24px and 176px at 32px.
  Two buttons that do not fit side by side stack, like everywhere else.
- **The dock's top row**, same fault, 19px.
- **The add glyph** is an ICON in a fixed 44px target on a poster corner.
  Sized in `rem` it outgrew its own 28px disc. Icons that live inside a
  fixed-size control are sized in px; the control is the thing that must be
  44pt, not the glyph inside it.
- **Names in the title page's fact column.** This one was self-inflicted:
  giving the links 44px targets made them `inline-flex`, and **a flex
  container puts its text in one anonymous item that never breaks**, so
  "Quentin Tarantino" stayed 242px wide in a 203px column. `display: block`
  with vertical padding reaches 44px *and* wraps.

**The separators between those names are gone.** Each name used to carry its
own dot inside a `white-space: nowrap` wrapper, so a line could never start
with punctuation - a good rule that had the side effect of stopping the NAME
wrapping too. The dots have no job left now that the names are spaced flex
items with underlines; the row breaks wherever it needs to.

**Measure the text, not the box.** The sweep uses a `Range` over each
element's own text nodes. `scrollWidth` counts absolutely-positioned
descendants, and several controls carry a `::after` deliberately wider than
the button (the 44px hit areas), which reported "Map clipped by 6px" at every
size including the default. Three things are explicitly not failures: an
ellipsis that was asked for, a `-webkit-line-clamp` on a card title, and
anything inside a horizontal scroller - a rail is meant to run off the edge.

## 44x44, hit-tested rather than measured (2026-11-17)

AGENTS.md has always set a 44x44pt floor on touch targets. It had never been
measured. A sweep of every interactive control on every screen found **62
under it**, including the ten sheet's reorder arrows at 44x32 - which
design.md names as the *accessible* path for ranking ("Ranking must be fully
operable without drag"). `drive.js` now runs the sweep on five screens.

**It hit-tests; it does not measure boxes.** A control is allowed to LOOK 32px
tall and carry a bigger hit area - that is what Apple's own small controls do,
and a box measurement calls those failures. The question asked is the real
one: if a thumb lands anywhere in the 44x44 region centred on this control,
does the tap reach it (`elementFromPoint`, centre plus four edge midpoints).

Three things the test had to learn, each of which made it lie first:

| it did | and that was wrong because |
|---|---|
| probe the square's **corners** | they fall outside a pill. A point 21px left and 21px up from a 64x44 chip's centre is 23.5px from the arc centre; the radius is 22. Every pill in the app failed however large. Edge midpoints ask the same question without demanding square corners. |
| judge **occluded** controls | a control behind an open sheet or under the dock is unreachable by design. 177 "failures", of which 115 were that. |
| clamp probe points to the **viewport** | a point pushed onto the screen edge lands on whatever is there. A control whose square runs off-screen is not judged. |

**What got fixed, and how:**

- **Reorder arrows**, 44x32 stacked. Fixed by growing the row to 88px, not by
  expanding hit areas: the up and down targets would then overlap, and a
  control that silently steals its neighbour's tap is worse than a small one
  - here it would move the item the wrong way. The poster grew 40x60 to 48x72
  with the row, which this screen wanted anyway.
- **Filter chips**, 36px. Made 44px for real. A pseudo-element could not work:
  `.chips` is `overflow-x: auto`, and overflow in one axis clips the other, so
  a hit area reaching above the chip was cut off by its own row. Costs 8px of
  header.
- **Map / Start over**, 32px tall and 28px wide. Pseudo-element hit areas,
  expanded in both axes. The gap between them is 12px and the expansion is
  8px, so neither can reach the other - which the sweep verifies rather than
  assumes.
- **Links in prose** on the title page, 25px. The hardest case: expanding an
  inline link upward steals taps from the line above. Laying the fact row out
  as a wrapping flex of 44px items puts the LINES 44px apart too, so the
  targets grow and cannot collide.

The `.tap-y` / `.tap-xy` utilities expand a hit area in one axis or both
without touching layout. Expand in **one** axis wherever the control sits in a
wrapping flow.

## The main screen's vertical budget (2026-11-17)

**The rule: one whole rail clears the dock, at 393x659, at rest.**
`drive.js` asserts it. It is the cheapest possible statement of "the main
screen shows the main thing", and it survives the header being redesigned.

It was failing by a wide margin. Measured:

| | before | after |
|---|---|---|
| header, title to first poster | 334px | 281px |
| dock | 130px | 118px |
| band left for content | **195px** | **260px** |
| height of one rail | 229px | 229px |

70% of the screen was chrome, and the first row of the app's first screen
could not fit on it. What came back:

- **The subtitle, 52px with its gap.** `topicPrompt` builds it FROM the
  title, so "Top 10 Movies of All Time" sat directly above "Your 10 favorite
  movies of all time." It is a restatement by construction and could never
  add information. Deleted.
- **"Start over" moved into the summary row**, beside Map. It cannot share
  the title's line: `fitline` shrinks the headline until it holds one line,
  and a sibling button took enough width that "Top 10 Animated Movies of the
  2000s" wrapped to two even at the 20px floor. The suite caught that within
  a minute of the attempt.
- **The gap above the first row**, 32px to 16px. `.stickybar + section` only
  — above the bar is a control surface the eye skips, between rows is content
  the eye reads, and those deserve different spacing.
- **The dock, one step tighter** top and bottom.

**The test was measuring a screen that does not exist.** `drive.js` resized
to 393x852 before its layout assertions — the DEVICE size, not the viewport.
At 852 the budget check passed no matter what the header did; it was proved
worthless by putting the subtitle back and watching it stay green. All of the
suite's viewports are now named constants at real browser heights (`PHONE`
393x659, `SMALL` 375x553), which immediately surfaced a second latent bug: a
sticky-bar assertion had been relying on the taller page clamping an earlier
scroll back to zero.

## The hero Ten, and the phone viewport we actually get (2026-11-17)

> **The component is gone (2026-11-18)** — see the wall at the end of this
> file. `.hero-ten` and `.mini-ten` were removed with the splash that used
> them, and nothing else in the app drew either. **The viewport finding
> below is not superseded and never will be**: Playwright's iPhone 15 Pro
> profile is 393×659, not 393×852, and every layout gate in the suite is
> measured at the smaller number.

**The component.** `.hero-ten` presents a finished Top 10 as a physical
object: a surface, an edge, a shadow, and inside it the byline, the list name,
the badge and ten posters in a 5x2 grid with the rank on each. Five across and
two down is deliberate — the shape of the grid is the promise. A complete
thing, not a feed that keeps going.

`.mini-ten` is the same idea at a glance: four posters, a name, and what makes
that list different. Four is Letterboxd's number and it is not an accident —
it is the most identity you can read in one look. The list name has its
`Top 10 ` prefix stripped in this context, because the prefix is identical on
every card and at 84px wide it was consuming the half of the line that says
which list this is. Four of six read "Top 10…" before the strip.

**A phone gives you 659px, not 852.** Playwright's own `iPhone 15 Pro`
profile is 393x659: mobile Safari's chrome takes about 190px off the height on
the spec sheet, and `100svh` on the device reflects that. The prototype is
read in a browser, so **659 is the default case and the roomier layout is the
`min-height: 741px` enhancement**, not the other way round. Designing at 852
and adding a "short phone" exception gets this backwards and hides the real
target behind a media query.

**Two layout traps found building this, both silent:**

1. **An undefined custom property voids its whole declaration.** The 4pt scale
   is 4/8/12/16/24/32 — there is deliberately no `--s5`. `padding: var(--s5)
   16px 16px` therefore computed to `0px`, and the hero grid escaped its card.
   The same bug was already live in `.title-cta { margin-top: var(--s5) }`,
   where the title page's Add button had had no top margin since it was built
   and no screenshot had caught it. `drive.js` now fails on any `var(--token)`
   the stylesheets never declare, checking every sheet and accepting tokens
   scoped to a selector rather than only those on `:root`.

2. **A grid item defaults to `min-width: auto`,** so a `nowrap` title refuses
   to shrink below its own text and GROWS past its parent's padding instead of
   overflowing it. `scrollWidth` then equals `clientWidth`, so a fit-to-width
   helper concludes the largest size fits and a spill assertion reads zero —
   while the title sits underneath the badge at full size. Measure ink against
   the thing it must not touch (a `Range`'s bounding box against the badge),
   never `scrollWidth`, and put `min-width: 0` on the children.


## The splash's other categories: readable, and tappable (2026-11-18)

> **Superseded the same day** by *"The splash is a wall, and the wall is
> made of lists"* at the end of this file. `.mini-ten` and the tap-to-swap
> interaction are gone with the hero they sat under. The RULE they were
> written for survives and still has tests: a list name on the splash is
> never cut off, and every list in the pool is measured, not only the ones
> that happen to be on the first screen. The plate inherited both.

**Mischa, reviewing the build:** *"the other categories below should never have
text cut off, it should be clear those are tappable to expand them into the
space above. Maybe they cycle thru?"*

**Three failures, one cause: the tile was too narrow for a name.** Six tiles
across a 393pt phone are 63pt wide, which leaves about eight characters a
line. The caption was `-webkit-line-clamp: 2`, so *"Animated Movies of the
2000s"* rendered as *"Animated Movies o…"* — on the one element of the splash
whose entire job is to say what else is in here. Removing the clamp alone made
it worse: at 63pt the words broke mid-letter (*"Hitch-cock"*).

| | was | is |
|---|---|---|
| Topics | 6, three of them ever visible | **4**, all of them visible |
| Tiles | 6 at a fixed 54–84pt | **3 sharing the row**, ~112pt each |
| Label | 2 lines, clamped, `text.secondary` | **two rows by construction**, lead + sub |
| Mosaic | 2×2 of 2/3 posters | **3 in a row**, height `clamp(38px, 6.6svh, 58px)` |
| Element | `<figure>` | **`<button>`** with a press state |

**The mosaic's height is now a constant, not a consequence of the width.** A
2×2 grid of 2/3 posters scales with the tile, so widening the tile from 63 to
112pt took the mosaic from 37pt tall to 153pt and the splash overflowed its own
screen by up to 40pt — the single failure this screen is not allowed to have.
Three posters in a row inside a clamped band says *"a list"* just as well and
costs a fixed slice of the budget whatever the tile does. Swept across five
phone viewports × six hero positions: overflow 1px everywhere (the pre-existing
rounding the splash sweep already tolerates), nothing clipped, two lines at
most.

**The label is the kicker and ONE line under it** *(amended 2026-11-18, Mischa:
"can the smaller ones be Top 10 on top line and then one line below it")*.

| row | what it holds |
|---|---|
| `kicker` | **"TOP 10"** — 10pt/700, uppercase, `text.secondary` |
| `lead` | everything else, on one line — **11pt/700** `accent.ink`, `nowrap` |

```
Top 10 Crime Movies of the 90s       ->  TOP 10 / Crime 90s
Top 10 Animated Movies of the 2000s  ->  TOP 10 / Animated 2000s
Top 10 Hitchcock Movies              ->  TOP 10 / Hitchcock
Top 10 Drama Shows                   ->  TOP 10 / Drama Shows
```

Three things come out of the name. **"Top 10 "** is the kicker's job.
**"of the"** goes because a tile is a label, not a sentence. And **"Movies"**
goes because it is the *unmarked* case — a shelf here is films unless it says
otherwise, so dropping it costs nothing, while **"Shows"** and **"Books"** are
precisely the cases that must keep their noun or a tile would claim to be
about films. That asymmetry is the rule, not an oversight.

**11pt is measured, not chosen.** The longest label the four topics produce is
"Animated 2000s": in the 100pt column it is **98pt at 12pt** — two pixels of
slack, which breaks the moment a wider face loads, and CI's DejaVu is about
10% wider, which has broken this screen twice. At **11pt it is 90pt**, so the
margin matches what the font difference costs. Verified at 11pt in the system
face and both CI fallbacks.

`white-space: nowrap` is deliberate: a label that outgrows its column **clips
visibly** rather than quietly becoming two lines again, which is the failure
this went through two rounds to remove. The harness measures the line's
**width** against its column for the same reason — a `nowrap` line cannot grow
taller, so a height-only check would pass every label however far past the
edge it ran, which is the vacuous-gate shape this suite has been caught by
twice before.

## The splash's leftover height is shared, not banked (2026-11-18)

> **Superseded the same day** by the wall, which has no bands to share
> height between: the rows divide the screen and the copy sits in flow at
> the bottom of it. The finding keeps its value as a method — a band that
> centres inside itself banks the slack where nobody can see it, and 125pt
> of dead air on a 659pt screen is what that looks like when measured.

*Mischa: "make the hero bigger, and/or fix the spacing."* Both, and the
measurements say why neither alone was enough.

**The spacing.** `.art` held `flex: 1 1 auto` and centred inside itself, so it
took **all** the leftover height and split it above the hero and below the
strip: on a 393×659 phone that was **71pt of nothing above the hero and 54pt
below the strip** — 125pt, a fifth of the screen, doing no work. The bands now
size to their content under `justify-content: space-between`, so the hero sits
flush to the top frame and the slack becomes the two gaps that separate things:
**64pt** strip→headline, **63pt** headline→button.

**The hero.** It could not answer this by growing, because its width was capped
at **`54svh`** — a cap meant to stop it becoming absurd on a tablet, which was
quietly binding on *phones*. Hardest on an iPhone SE, where it held the posters
to **48pt in a column with room for 58**. Swept across six viewports:

| | SE | 13 mini | 15 Pro | Pro Max | iPad mini |
|---|---|---|---|---|---|
| poster at `54svh`, 20pt margin | 48.1 | 56.3 | 57.4 | 68.8 | 91.4 |
| poster at `64svh`, 14pt margin | **57.8** | **57.8** | **61.4** | 68.8 | 94.8 |

At 64 the **column** is what limits the hero everywhere a phone is concerned
and the cap only speaks again on a tablet. The splash's side margin drops to
**14pt** (6pt a side is 12pt of poster, and on this screen the artwork *is* the
content) and the hero card's padding to 12pt; the strip shares the margin, so
the two still line up. The CTA and the promise stay on screen on all six
viewports.


**At accessibility text sizes a row breaks mid-word rather than spilling.**
`overflow-wrap: break-word`, which fires only when a word cannot fit a line of
its own: at every size from 12px to 32px, in the system face and both CI
fallbacks, no label overflows its box. It never triggers at ordinary sizes —
"Hitchcock" is 72pt in a 100pt column — and at a 32px root a broken word is the
right trade against text running out of its tile.

Found by the Dynamic Type sweep, not by looking: the first version dropped
`overflow-wrap` entirely to stop words breaking in the old 63pt tile, and at a
28px root in DejaVu Serif "Hitchcock Movies" then ran 19px past its box. A
`scrollHeight` check does not see that — horizontal overflow of a text node is
only visible to a Range over the text, which is what the sweep uses and why it
caught what a hand check had not.

*Rejected on the way: hiding the strip above a text size.* There is no media
query for it. `em` in a media query resolves against the browser's **initial**
font size, not `html { font-size }`, so `@media (max-height: 30em)` is a fixed
480px and did nothing — confirmed by sweeping it, after which the dead rule was
removed rather than left in with a comment claiming otherwise.

**Tappable is said in the app's own vocabulary, not a new one.** The label is
`accent.ink` — the same colour as Map, Start over and a title page's fact
links, every other thing in this app that does something when you touch it.
`--accent-ink` rather than `--accent` because at 12pt only the former clears
AA. The tile also carries a surface, a border, a hover edge and a 0.96 press
scale, and is well past 44pt in both directions.

**They cycle by tap, and do not auto-advance.** Tapping a tile **swaps** it
with the hero: the list that was up top lands in exactly the slot just tapped,
so three visible of five is not a ceiling — a few taps reach everything.

A swap, not a rotation. Rotating the set was the first version, and it loses
the list you just left: with three tiles of five showing, the old hero landed
in fourth place and off the end of the strip, so tapping away from a topic made
it disappear. A swap is also the only model of this a person can guess without
being told. Auto-advancing was considered and
rejected: WCAG 2.2.2 requires a pause mechanism for anything that auto-updates
for more than five seconds, the splash has no room for a pause control, and
motion on the first screen competes with the one button it exists to get
pressed. If we want it later it is a timer and a crossfade, and a visible
pause.

## Reordering is direct: hold a poster and drag it (2026-11-18)

**Mischa:** *"rearranging your order should be done by holding and dragging the
mini posters around. Need to have a persistent 'drag to rearrange' tip while
also having an easy way to enter a vertical arranging mode."*

**The gesture.** Press and **hold 220ms** on a filled dock slot, then drag
along the row. The slot lifts (accent outline, raised shadow), the others slide
by one step to open a gap, and release commits. The hold is what keeps the
gesture from eating taps: a drag that began on the first pixel of movement
would steal every tap on the row, and more than **8pt of movement before the
hold completes cancels it** — that movement is a scroll or a swipe, not a grab.

Three things make this smaller than a general drag-and-drop, and all three are
properties of this dock rather than luck: every slot is the same width, so the
target index is `round(dx / step)` and not hit-testing; the dragged node never
leaves the row, so nothing is cloned into a layer; and the row holds ten things,
so moving the rest is ten transforms.

**`touch-action: none` goes on only once the hold is recognised.** On the row
from the start it would kill every ordinary scroll that begins on the dock; at
the moment a slot is picked up it stops the browser panning the row out from
under a drag already in progress.

**The tip is permanent and costs no height.** From two picks the dock's hint
line reads **"Hold a *poster* to reorder"** — the artwork noun from `DOMAINS`,
so a books shelf says *cover* — and it replaces *"n to go"*, which was
arithmetic the line above had already done (*"4 of 10"* says six to go).

**And the vertical list opens from two.** The **Arrange** button was disabled
until ten, which left the sheet reachable only by tapping the unlabelled strip
of slots — the one gesture now spoken for by the drag. It is enabled from two
picks and opens the same list, with its own up/down buttons at 44×44.

That is not a convenience. **WCAG 2.5.7 (Dragging Movements) requires a
single-pointer alternative to any drag**, and a drag alone cannot be one. The
vertical list is the alternative, which makes the labelled way into it a
requirement rather than a nicety.

## The splash is a wall, and the wall is made of lists (2026-11-18, Mischa)

Mischa, on the built screen: *"This What's your top 10 page looks bad. Needs
an overhaul."* Three directions were built side by side in a scratch file at a
real phone viewport (393×659) with the real catalog — **A** the artifact as a
stack (#1 large, the rest receding), **B** a full-bleed wall with the copy over
it, **C** the ten read as a list — and his answer settled it: *"My pick is B,
and the wall should auto-scroll. Can we have a version that scrolls through
custom lists in a wall-like format with big posters?"*

Building all three rather than describing them is the point. Each took about
fifteen minutes because the catalog and the tokens were already there, and the
comparison was between three rendered screens instead of three paragraphs.

### Anatomy

| Part | What it is |
|---|---|
| `.wallrows` | Four and a half rows, `position: absolute; inset: 0`, flex column, own stacking context |
| `.wallrow` | One list. `flex: 1 1 0`, so a row's height is the screen divided by 4.5 |
| `.wallrow:last-child` | The half row: `flex-grow: .5`, masked to nothing. Hidden under 620pt |
| `.wallrail` | The moving part, `inset: 0`, carrying the edge mask |
| `.strip` | `ten posters × 2`, drifting `0 → −50%` |
| `.plate` | **Pinned**, alternating side, **a whole poster slot** — one poster wide and the full height of the row. `TOP 10` over the list's name, and nothing else |
| `.poster` | `aspect-ratio: 2/3`, height 100% of its row, rank 1–10 on the artwork |
| `.wallveil` | The gentle one: seats the wall, never past `.32` |
| `.wallcopy::before` | The strong one: sized to the copy, not the viewport |
| `.wallcopy` | Headline, tagline, CTA, promise — in flow at the bottom |

### The nameless wall, and why the plate is pinned (2026-11-18, found by measuring)

The first build carried the plate as a cell in the strip, so a name arrived,
its ten drifted past, and the next name arrived behind them. It read
beautifully in every screenshot. It was also **broken for most of the time
anyone looked at it**, and nothing in the suite said so.

Sampled every 250ms with the animations restarted so `t=0` is the same instant
for every row:

| | average names on screen | nameless | longest gap |
|---|---|---|---|
| first 15s, plate in the strip | 0.30 | **78%** | 11.8s |
| steady state (90s), plate in the strip | 0.66 | 40% | 12.5s |
| first 15s, plate pinned | **2.00** | **0%** | 0s |

The cause is arithmetic, not tuning. Ten posters is **1,110px of travel
between one name and the next**, on a screen **393px** wide, at 37px/s. A row
shows its name about 15% of a cycle, and a cycle is 30 seconds while a look at
a splash is ten.

Two fixes were tried and measured before the real one:

- **A wider plate made it worse** — 88% nameless. A label that is wide is
  *fully* visible for less of its pass, not more: the window is
  `(screen − plate) / speed`, so widening the plate shrinks it twice over.
- **Spreading the rows' phases made it worse too.** In a fifteen-second look
  only half a cycle happens at all, so spreading four rows over a whole cycle
  simply moved most of the names outside the window.

So the plate is pinned to its row and the posters pass behind it. It
alternates sides with the drift — a row running left wears its plate on the
left, so its posters travel *towards* the name and slip under it — which also
means four plates read as a zigzag down the wall rather than a column of
labels down one edge.

**It is real glass now**, which it never was before: as a flex sibling of the
posters nothing was behind it, and the contrast probe caught the
`backdrop-filter` sampling flat `--vault-bg` at every viewport. Pinned over a
moving rail there is finally something to blur. `--vault-plate` is the vault
at 88%, set by measurement against a white poster, and the gate forces every
poster white before sampling: **12.2:1** for the name, **5.3:1** for the
credit line.

**The phase spread stayed**, for a different reason. Without it every row
starts at the same point in its cycle, the vertical seams between posters line
up across all four rows, and the wall reads as one lattice sliding about
rather than four independent lists.

**The gate that was missing.** The claim "this is a wall of lists" now has a
test: sample the first 8 seconds and require a readable name at every moment,
and more than one on average. A screenshot proves one frame; this proves the
frames between them, which is precisely what a dozen screenshots of the broken
version failed to notice.

### One poster wide, and four and a half rows (2026-11-18, Mischa)

*"For each row freeze the list name but shortened… and have it just take up
the space of 1 poster, so that at least 3 posters are seen cycling through the
row at any time… what if we have 4.5 rows in that treatment and the last half
row is faded out."* Both, and the sweep says why both.

The pinned plate that fixed the nameless wall was **56% of the row wide** and
carried three lines — kicker, name, and the crowd credit *"From 2,800+ Top
10s"*. It left about **1.5 posters** visible in each row, which is a wall of
labels with some artwork behind it rather than the other way round.

So the plate is **exactly one poster wide** (`width: 66.7cqh`, since a poster
is `2/3` of the row's height) and, from Mischa's next note the same day —
*"the card on each row would be the full height of the row (with a bit bigger
text) so it's more visible"* — **the full height of its row too**. At 2:3 that
makes the card exactly a poster's shape, so every row reads as one sentence:
here is a title card, and here are its ten.

That is the better idea for a reason worth keeping. As a chip in a corner it
was a label stuck *on* the wall; at a poster's size it is a card *in* it. It
also buys the type its room back — a chip 59pt tall had to hold two lines in
43pt of it, while a full-height card has 120pt, so the name goes from
**10.9px to 15.6px**.

**Its text is top-aligned, and that is a measurement not a preference.** A
full-height card bottom-aligns its name into the lowest 40pt of the row, which
on the third row is exactly where the copy begins — so going full height cost
a legible name until the text moved up. Two names legible bottom-aligned,
three top-aligned.

The plate carries **two lines only**. The credit line goes: at one
poster wide there is no room, and the tagline underneath already says the same
thing about the whole corpus. No list on this screen wears a byline, which is
the rule from 2026-11-17 arrived at from the other end, and the suite asserts
the plate says the kicker and the name and *nothing else*.

**The glass is 82%, swept too.** The worst case behind the card is a white
poster, measured with every poster forced white:

| alpha | list name | `TOP 10` kicker | |
|---|---|---|---|
| .88 | 12.0:1 | 6.7:1 | reads as a black box, not glass |
| **.82** | **10.1:1** | **5.6:1** | posters ghost through, margin intact |
| .76 | 8.1:1 | 4.5:1 | at the bar exactly, which is no margin |
| .70 | 6.6:1 | 3.7:1 | fails |

88% was right when the plate carried an 11px credit line. That line is gone
and the name is 15.6px, so the ceiling moved and the artwork behind the card
is visible again — which is the whole point of calling it glass.

**The row count, swept at 393×659:**

| rows | names legible | posters cycling | poster | name |
|---|---|---|---|---|
| 4 | 3 | 2.5 | 103×155 | 12.4px |
| **4.5** | **3 + a peek** | **3.0** | **91×136** | **10.9px** |
| 5 | 4 | 3.4 | 81×122 | 9.8px |
| 6 | 4 | 4.2 | 67×101 | 8.0px |

Six is where the name stops being readable — 8px, under the **11px floor this
screen measured for itself** on 2026-11-17 — so the choice was between the
first three. **4.5 is the only one that meets "at least 3 posters cycling"
without spending the name to get there**, and it was Mischa's own suggestion.

The half row earns its place twice: it takes a share of the column, so the
four full rows are 136pt rather than 155 — which is what buys the third poster
— and it shows the top edge of a *fifth* list fading into the copy, which says
the wall carries on past the screen without claiming a row it cannot show. It
is masked at the ROW level, plate and all, unlike the others: a name at full
strength on a row you can only half see is a promise the row cannot keep.

**Under 620pt of viewport the half row goes.** The plate's type is a fraction
of its row, so 4.5 shares of an SE's 553pt put the name at 9.6px. Dropping the
peek gives the four real rows their height back and the name returns to 11px.
The old splash hid its strip at the same boundary for the same reason: what
goes is the thing that was extra.

Measured across nine viewports, nothing clipped and nothing scrolling: the
name runs **11px on an SE to 17.3px on an iPad**, with 2.2–4.2 posters
cycling. The one soft spot is a tall narrow browser (393×820), where the rows
grow to 172pt and only 2.2 posters fit beside the plate — a viewport no phone
actually hands us.

### Six things that are decisions, not defaults

**The row height is a division, not a clamp.** `flex: 1 1 0` across four rows
makes a row exactly the leftover divided by four on every screen, and the
poster's width follows from `aspect-ratio`. The marquee this replaces picked
its poster height in `svh` — `clamp(96px, 20svh − 26px, 210px)` — and even
after being corrected by 26px it was a number that had to be right for every
viewport at once. Measured: posters are **128px** tall on an SE, **155px** on
a 15 Pro, **240px** on a tablet. The hero they replace gave them **58px**.

**The gap is `margin-right` on the cell, never `gap` on the strip.** With
`gap`, a strip of 2N cells is 2N widths plus 2N−1 gaps, so half of it falls
half a gap short of a whole copy and the loop jumps 4px every pass. As a
margin each copy is exactly N × (width + gap), and −50% lands where the first
copy began. The suite measures the seam off `getBoundingClientRect`, not
`offsetLeft`/`scrollWidth`: a 5/4 plate on a 155px row is 193.75px wide, and
integer rounding alone put the measurement half a pixel out on a layout that
was exactly right.

**One speed token, four derived numbers.** `--m-wall: 30s` is the time a row
takes to travel its own list once. Reverse rows take `× 1.3`; each row's phase
offset is `calc(var(--i) × var(--m-wall) / −7)`, so the four plates are
scattered at first paint rather than stacked in a column down the left edge.
Measured on a 15 Pro: **44px/s** forward, **34px/s** back — one poster every
two and a half seconds, the screen's width in nine. The first value tried was
52s; at 25px/s the wall read as still unless you watched it.

**The edge mask belongs to the moving part.** It lives on `.wallrail`, not on
the row: applied to the row it also faded the pinned name plate, which does
not move and has no business being faded.

**Both edges fade to a quarter, not to nothing.** A strip clipped square reads
as broken — the first frame had a name plate sliced down the middle by the
edge of the phone. A fade to transparent swallowed the first characters of the
name on the row whose plate starts flush left, so the mask ends at `.25`: the
cut is softened and the content is still legible.

**Two veils, because they answer two questions.** The one on `.wallveil`
seats the wall and never passes `.32`. The one that makes the copy legible is
a pseudo-element on `.wallcopy` itself, reaching two frames above the block it
belongs to. It has to be: a veil written in viewport percentages is a
different veil on every phone — at 66% of a 15 Pro it sits exactly over the
headline, and at 66% of an SE, where the copy is a bigger share of a shorter
screen, it is 40px below it, leaving the headline in the weak part of the
gradient over whatever poster happens to be bright. The SE caught that.

**The splash is the only screen that is not a 560px column.** `.wrap.bare`
drops the app's `max-width`. Capped at 560 on a wide window the wall became a
column of posters with the page's own background either side, and the plate at
the left edge was cut against white. A wall that stops has nothing behind it.
The copy still reads as a column — `.wallcopy > *` caps at 520px — because a
headline is still a line of text and a CTA is still a button.

### The Vault is now a surface language, not one screen

`--vault-bg` and `--vault-text` existed for the badge reveal. The splash is
the second screen that takes the whole display and fills it with photographic
artwork, and a Gallery-light surround fights four rows of film posters in
exactly the way it fights the reveal. So the vault tokens are defined **once,
outside the colour-scheme blocks**, and both ceremonies read the same in
Gallery and in Vault.

| Token | Value | Usage |
|---|---|---|
| `vault.rgb` | `18 17 16` | The vault as channels, so a scrim can take it at any alpha without a second copy of the hex. The splash veil needs six |
| `vault.bg` | `rgb(var(--vault-rgb))` | |
| `vault.text` | `#F4F1EA` | |
| `vault.textDim` | `#A79F92` | Secondary ink on the vault — the dark theme's `text.secondary` |
| `vault.surface` | `rgb(244 241 234 / .07)` | A surface on the vault. The relationship `bg.surface` has to `bg.base` in the lit themes |
| `vault.line` | `rgb(244 241 234 / .16)` | The hairline that edges it |

### The plate's type is in container units, and that is the exception

Everything a reader has to read on this screen — headline, tagline, CTA,
promise — is in `rem` and honours Dynamic Type in full. The **wall's own
labels are not**, and the reasoning is worth keeping because it is the only
place in the app where that is true:

- The plate is artwork. It is inside `aria-hidden` wall furniture, it cannot
  be tapped, and what it says is said again in words in the tagline under it.
- Sized in `rem` it grew with the reader's text size inside a box sized off
  the **screen**, so at accessibility sizes the label overflowed a plate it
  could not push — and silent clipping is the one failure this project does
  not allow. In `cqh` it is always the same fraction of its row.
- It also fixes the opposite end. A fixed 17px name is right on a phone and
  reads as a caption lost in a 240px panel on a tablet. In `cqh` it is 14px on
  an SE, 17px on a 15 Pro, 26px on a tablet — it scales with the wall, like
  the posters it sits among.

`.wallrow` carries `container-type: size` for this, and the rank badges on the
posters are sized the same way for the same reason. The Dynamic Type sweep
found that one: at a 28px root, `.rank`'s numeral overflowed its own badge by
6px, on every rank on the wall at once.

### What it costs, measured

Forty posters at `w342`, about **0.8–1.2MB**, roughly **1.0s** to networkidle
on localhost, and **no API call** — the artwork is the catalog's own, as the
splash rule has required since Stack. Forty is four rows of ten; the second
copy of each strip reuses the same URLs and costs nothing. **The lever, if
this ever needs to be cheaper, is the row count** — not the poster size, which
is the thing that was asked for.

### The tagline wraps, and where it wraps is ours

Mischa's line is two sentences and 44 characters. Measured as rendered, in a
353pt column at 15.7px:

| | 393pt phone | 375pt phone |
|---|---|---|
| SF Pro (system) | **one line**, by 1pt | **two lines** |
| Liberation Sans | one line | one line |
| DejaVu Sans (what CI renders in, ~10% wider) | **two lines** | **two lines** |

So it is one line or two depending on the phone and the face, and **that is
the design** rather than a defect to chase. Both ways of forcing one line are
worse: dropping to 14px is marginal again on a 375pt phone — a pixel or two of
slack, which is what this screen has already been caught by twice — and a
hard-coded break is a break the device does not need.

*(The line was "5,000+ lists from other users." until Mischa revised it to
"from the community" on 2026-11-18. Two characters longer, and it moved the
375pt phone from one line to two. The layout did not need changing, because it
was already measured with the tagline on two lines on all eight viewports.)*

So the one-line rule now covers the **headline** and not the tagline, and what
is asserted instead is what matters: at most two lines, no spill, and the
splash still fits every phone *with the tagline on two lines* — tested on all
eight viewports by squeezing the paragraph rather than by hoping the right
font is installed.

**The break itself is not left to the font.** Filling greedily, DejaVu put
*"Share"* at the end of the first line and *"yours."* alone on the second. A
non-breaking space inside "Share yours." makes the second sentence one
unbreakable unit, so the only place the paragraph can break is between the two
sentences — and the second line is then the invitation, sitting directly above
the button that acts on it. No `text-wrap: balance` here for the same reason:
balancing a two-line fill splits *"other users."* across them.

*The gate for this was vacuous on its first attempt.* It squeezed the
paragraph to a typed 240px, which in this machine's font happened to land
exactly on the sentence boundary — so it passed with the non-breaking space
removed. The squeeze is now measured off the element's own `nowrap` width
minus 24px, which forces exactly one unit onto the second line in whatever
font is installed.

### Auto-scroll and WCAG 2.2.2, honestly

2.2.2 wants a mechanism to pause, stop or hide motion that starts on its own,
lasts more than five seconds and sits beside other content. The wall honours
`prefers-reduced-motion`, which on iOS is the system Reduce Motion switch —
the platform's own mechanism, already in the reader's hands, and what an ADA
jury would expect an iOS app to use. It does **not** put a pause control on
the splash, because a second control on a screen whose entire job is one CTA
is a worse screen.

That is a position, not a conformance claim. If a review ever says the
platform switch is not enough, the cheapest honest answer is to stop the drift
after one full pass rather than to add a button.

The still frame is not a fallback. With motion off every row sits at its
start, which is its name plate flush left, so Reduce Motion gets four list
names stacked and legible — the same composition the motion begins from, which
is the standing rule for every ceremony in this app.

## The Badge Case — your Top 10s, with the badges as the page (2026-11-18)

The profile Req 11 has always asked for, built the night after the splash. It
is the first screen in the prototype whose subject is **you** rather than a
list, and the anatomy follows from one line of the requirement: *the badge
case is the profile's hero*.

### Anatomy

| Part | What it is |
|---|---|
| `.case` | `grid-template-columns: repeat(auto-fill, minmax(132px, 1fr))` — two badges across on every phone, three on a Pro Max in landscape, four on a tablet, with no breakpoint deciding it |
| `.case-item` | A button. The badge at 112pt, the list's full name under it. Nothing else |
| `.case-empty` | A locked badge, what a badge is for, and one way out |
| `[data-act="resume"]` | The draft, shown as the one thing on the screen without a badge |

**112pt is a floor, not a preference.** It is the smallest size at which the
plate's inscription ring reads as type rather than as texture; below it the
badge reads as a coin, which is the one thing it must not.

**The inscription is not repeated under the badge.** It is already struck on
the ribbon. The first build printed it twice and it read as a duplicate rather
than a caption — the caption's job is the one thing the badge does not say,
which is which list it is.

**The full list name, not a shortened one.** The splash shortens because its
plates are one poster wide; here the column is 132pt and the name is the
item's identity, so it reads the way it does on a discover card and on the
share page. One object, one name, everywhere.

### What it is reachable from, and what it is not

Two entry points, **neither in the topbar**: the screen that just handed you a
badge, and the foot of discovery — other people's, then yours. The build
screen's topbar is deliberately left alone. A 44pt control beside a criteria
name takes a quarter of the column, which is exactly why *"Start over"* was
moved off that line in round 8.

`Done` returns to wherever the case was opened from, which is why the scene
records it. A back button that means two different things on two different
routes is a back button nobody trusts.

### The rule the case made explicit

**Your own badge is never locked.** Req 12's gate is about *other people's*
badges; a reader gated from their own would be the mechanic pointed the wrong
way. The suite asserts it directly — every item in the case is drawn, none is
a `lockedbadge` — because it is the kind of thing a later refactor of the
badge renderer could break without anything looking wrong.

## The topic page — the crowd, before you argue with it (2026-11-18)

Req 9's screen, built the same night as the badge case, and the two are a
pair: one is what you have made, the other is what you could make next and who
has already made it.

**It exists because every route into a topic was a commitment.** The rising
chips, the weekly pick and the suggestion cards all went straight to the build
screen, so the only way to find out what *"Top 10 Westerns"* is was to start
making one and read the shelf. The rule the screen establishes, and the one to
keep: **only a CTA commits.** *"Make this one"* and *"Make yours"* start a
build; a chip and the weekly card open the topic.

### What is on it, in order

1. The name, and how much there is to choose from — `600 movies in the
   collection.`
2. **The crowd's ten, as its own artifact**, under *"What everyone picked"*.
   Not a preview strip: the same `.tenrow` anatomy the finished screen and the
   share page use, so one object looks like itself everywhere.
3. The takes on it, each saying whether its badge is open to you.
4. The ever-present action.

### The comparison that had nowhere to live

In-app you could compare yourself with a **person**. The object model's
`shared_with_consensus` — how far you sit from the **crowd** — existed in the
SQL, in `TopTenKit`, and on no screen. It is here now: on a topic you have
made, the page says **"You share 6 of 10 with them"**, marks those rows in the
crowd's list and prints your own rank beside each.

Without it the splash's argument was unfinishable. *Yours will be different*
is only worth saying if the app can then say **by how much**.

Nought out of ten keeps the designed line it has on the share page — *"Not one
movie in common. Incredible."* — rather than an empty state. It is the most
interesting outcome on the screen and the one most likely to be screenshotted.

### The gate this one needed, and the one it caught

The comparison is asserted against a take **constructed to overlap by exactly
five**: the crowd's top five plus five films the crowd does not have. The
first version used the ten least-rated films on the shelf, which overlapped by
**zero** — so the check compared 0 with 0 and would have passed against a
screen that printed *nought* whatever you had picked. Third time this project
has caught a gate of its own shaped that way, and the tell is the same every
time: a test whose expected value is whatever the code happens to produce.

## The page a reader gets with JavaScript off (2026-11-18)

Both public pages — `ten.html` and `topic.html` — carried **nothing** without
JavaScript until this was measured: zero characters, a white screen. They now
render a designed fallback instead.

### Anatomy

| part | what it is | why |
|---|---|---|
| masthead | the same `.masthead` the real page uses | a stranger who hit a wall should still know whose wall it is |
| `h1` | *"This Top 10 is in the link, and the link needs JavaScript"* | the serif display face, so the page reads as made rather than errored |
| `.byline` | one sentence on *why*, one on what to do | the lock says what opens it — the rule the badge gate already follows |
| `footer` | the standard prototype footer | unchanged, so the page ends the way every other one does |
| **no CTA** | — | see below |

### No button, on purpose

Every destination this page could offer — the app, a topic, another Ten —
also needs JavaScript. A button here would be a key that opens onto a second
blank page, which is worse than no key, because it spends the reader's one
remaining action. **The instruction is the way out**, and it is in the body
copy where a reader is already looking.

This is the same principle as the badge gate's *"a lock with no key on it is
just a wall"*, applied to a case where the key is a sentence rather than a
control.

### It reuses the page's own classes, and is duplicated on purpose

The fallback is plain markup inside `#page` — the element the script
overwrites — using `.masthead`, `h1`, `.byline` and `footer` from the page's
own `<style>`. It is **not** shared with `share.js`, because `share.js` is
precisely the thing that is not running. Two short blocks that can drift are
the right trade against a shared helper that cannot execute.

Sitting inside `#page` is also what stops it reaching a browser that *can*
run the page: `<noscript>` already does that, and the overwrite does it
again. Removing either leaves the other.

### What it does not do

It does not render the list. It cannot — in the prototype the ten travel in
the query string and a static file server never sees one. PRD Req 8's
"renders well with no JS" is owed against the server-rendered page and is
still open.

## A poster that does not load: `.no-art` (2026-11-18)

Artwork comes from TMDB, TMDB paths rotate, and readers have bad networks —
so a poster failing is an ordinary state, not an error state, and it gets a
designed one.

| | |
|---|---|
| **what it is** | the recessed plate the artwork sits on, with a hairline inset |
| **how** | `.no-art { background: var(--bg-recessed); box-shadow: inset 0 0 0 1px var(--border-subtle); }` |
| **where it is defined** | in each page's own `<style>`, beside that page's `.thumb` / `.art` / `.cel` sizing |
| **what applies it** | one capture-phase `error` listener in `share.js`, which all four pages load |
| **what it never shows** | the browser's broken-image glyph |

The image itself is **hidden, not removed**: `.no-art > img { visibility:
hidden }`. The glyph is painted by the browser on top of the element's box,
so hiding the element is enough to suppress it — and the element stays in the
DOM with its box intact, so anything that measures or clones it still works.
The first version removed it, and CI went red on the add animation, which
flies a clone of the card's poster into the dock slot.

### The plate keeps the poster's box

The failed `<img>` is removed, not hidden — but the box is the *parent's*, so
nothing moves. Measured at 56×84 on the Ten page with artwork 404ing, which
is the same 56×84 it occupies with artwork. A fallback that collapses the
layout would be a second bug wearing the first one's clothes.

### No letter, no icon, no "image unavailable"

Considered and rejected for now:

- **The title's initial, set in the serif.** More informative, and it would
  keep the splash wall from reading as a grid of blanks if TMDB were ever
  unreachable. It needs the title plumbed to the `<img>` as a data attribute
  at every render site, and it is a visible design decision — so it is
  Mischa's to take, not one to make at 09:40 while he is asleep.
- **An icon or the words "no artwork".** Both label the absence. Laurel's
  rule is that the app does not narrate its own failures to a reader who can
  see them; the plate is the honest shape of "nothing here".

The plate is what ships until that is decided.

### On the wall it is a vault colour, not a scheme colour

`--bg-recessed` follows the colour scheme. **The splash wall does not** — it
is the Vault in both. So the first spelling of `.no-art` painted `#F1EDE6`
plates onto a near-black wall whenever the browser was in light mode: fifty
white rectangles where the artwork should be.

```css
.wallrow .cel.no-art { background: var(--vault-surface);
  box-shadow: inset 0 0 0 1px var(--vault-line); }
```

Measured, composited over the wall: **luminance 0.021 in both schemes**,
against **0.850** for the scheme-following version in Gallery.

This is the second time a scheme-following token has been used on an
always-dark surface — `--vault-accent` exists because of the first, one day
earlier. **The rule: a surface that ignores the colour scheme takes `--vault-*`
tokens, never the `--bg-*` / `--text-*` / `--accent-*` ones.** Anything drawn
on the splash is such a surface.

It was caught by *looking at the screenshot*, not by a gate — which is the
division this project already states: screenshots judge layout and colour,
tests judge behaviour. The gate exists now so it stays caught.

### Why the behaviour is shared and the appearance is not

`error` does not bubble, so a listener on `document` never fires — capture is
the only thing that works, and one listener covers every image on the page
including the ones rendered later, which is most of them. That belongs in the
one file every page loads. The *look* belongs with the sizes it has to match,
which are already per-page: `ten.html` and `topic.html` each define their own
`.thumb` today.

## The comparison says two different things, on purpose (2026-11-18)

The same number — how many of their ten are also yours — appears on two
surfaces, and they are not the same sentence, because they are not the same
argument.

| | **in the app** (topic page, other-person page) | **on the web page** (a shared link) |
|---|---|---|
| who you are compared with | **the crowd** — the Borda consensus of every take | **a person** — whoever sent you the link |
| the line | *"You share 6 of 10 with them."* | *"You agree on 6, and disagree on 4."* |
| at zero | *"Not one movie in common. Incredible."* | *"Not one pick in common. Someone is wrong."* |
| at ten | — | *"The same ten. Different order, maybe."* |
| the noun | the domain's: movie / show / book | **"pick"** — the page may not know the domain |

**"Incredible." is for the crowd; "Someone is wrong." is for a person.**
Sharing nothing with a thousand people is a statistical marvel and the app
says so. Sharing nothing with *one* person is an argument, and the web page
says that instead. A single string across both would have to be the weaker
of the two.

**The web page says "pick" because it may not know better.** `topic` is an
optional parameter on a shared link; the app always has the domain in hand.
A page that says "film" about a book list is worse than one that says "pick"
about either.

### `your #n` is the reader's rank, never the row's

Each shared row that the reader also picked carries *their* position, not the
position it occupies in the list they are reading. The distinction is
invisible whenever the two happen to agree, which is why the test's fixture
gives the reader the sender's top five **in reverse** — the sender's #1 is
the reader's #5. A renderer printing the row's own rank back passes every
other spelling of that test.
