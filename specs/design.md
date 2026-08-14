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
  the badge's silhouette in `status.locked` under frosted glass with a
  keyhole-free lock glyph and the line "Make your Ten on this to reveal."
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

## Web parity (share pages)

The web page is Laurel translated, not approximated: same tokens exported to
CSS custom properties from `TopTenKit` (single source), New York substituted
by `Georgia`-stack with matched metrics (or licensed alternative later), no
glass (static header), same Share Card renderer for OG images. The page's
job: look worthy of the list, convert to "Make your Ten."
