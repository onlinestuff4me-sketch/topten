# Top Ten — Badge System Specification

**Status:** Draft v1
**Last updated:** 2026-11-17
**Owner:** Mischa

## What a badge is

The badge is the reward for finishing a Ten and the currency of the reveal
gate. It must feel: **crafted** (belongs to a designed family, never AI
slop), **personal** (visibly derived from *this* list), and **witty** (the
inscription is an inside joke that lands if you know the list).

**Decided 2026-08-14 (Mischa):** badges are **procedurally composed from a
hand-crafted design kit, with on-device Foundation Models choosing the
composition and writing the inscription.** No diffusion/image-gen in v1.
Reasoning: per-badge image-gen has cost, moderation burden, and quality
variance — and one mid badge deflates the whole ritual; a composed system
guarantees the floor while the LLM supplies the personal wit. Image-gen may
return as a premium tier (P1, licensing permitting).

## Anatomy — five layers, back to front

1. **Backplate** — the badge's silhouette. Kit of ~12 hand-drawn shapes
   (circle seal, shield, laurel oval, ticket stub, star burst, pennant,
   hexagon plaque, ribbon rosette, film reel, marquee lozenge, keystone,
   scalloped medal). Each shape carries domain affinity metadata (ticket
   stub/film reel skew movies) but any shape is legal anywhere.
2. **Field** — the backplate's fill: a material (enamel gloss, brushed
   brass, velvet matte, frosted glass, lacquer) + a two-color palette, both
   snapped into Laurel-safe LCH ranges (L 25–75, C ≤ 60).

   **Amended 2026-11-17 (Claude, measured).** The hue comes from the
   **topic**; the artwork sets the **tone** within it. This supersedes
   "derived from the Ten's artwork (dominant hues of the top 3 items)",
   which was measured against the real catalogue and found to do the
   opposite of what it promised. The dominant hue of all 3,469 posters:

   | Lab hue | what it is | share |
   |---|---|---|
   | 20–120° | amber / olive / yellow | **66%** |
   | 220–300° | blue / violet | 25% |
   | everything else | | 9% |

   Two thirds of all artwork sits in one 100° band, because that is the band
   the industry grades to. A badge whose hue is read off it is not a badge
   that belongs to *this* list — it is the same badge as everybody else's,
   and eleven of the first twenty rendered badges came out the same olive.
   Raising chroma made them more olive; the band itself was the problem.

   Hanging the hue on the topic fixes the distribution (a hash is flat where
   poster hues are not — measured at 11.3–13.7% across the eight enamels
   over 4,000 topic names) and is the better product rule besides: **every
   take on one topic is one colour**, so a topic's badges read as a set.
   The remix graph is the engine of this app, and a shared enamel makes a
   topic visible as a place rather than a string. The artwork keeps its job
   — a list of dark posters is fired deeper than a list of bright ones — so
   two takes on a topic are the same colour and never the same badge.

   **The enamels.** Eight, and the yellow band is deliberately absent:
   anything in 62–128° at these lightnesses is olive, and olive beside a
   gold rim is mud.

   | | hue | | hue |
   |---|---|---|---|
   | oxblood | 12° | teal | 205° |
   | terracotta | 38° | navy | 248° |
   | forest | 148° | aubergine | 288° |
   | verdigris | 176° | plum | 330° |

   A palette of eight that recurs is a family you recognise across a shelf;
   a continuous hue is a gradient soup where every badge is a near-miss of
   its neighbour. Real enamel badges work this way because the kiln had a
   finite set too.
3. **Motif** — the central emblem. A curated library (~120 at launch,
   grows over time) of custom-drawn glyphs tagged with themes: genres
   (a tommy gun for crime, a katana, a rose, a spaceship, a briefcase-glow),
   moods, eras, and famous-object references. Motifs are the visual half of
   the inside joke — the briefcase-glow motif on a Tarantino badge does the
   winking.
4. **Metals** — trim ring, rivets, laurel sprigs. Rank-signaling: sprigs
   appear only on badges for topics where the user's take was among the
   first three ever made (a quiet founder's mark).
5. **Inscription** — a **ribbon** carrying the LLM-written line. ≤ 6 words,
   set in New York per design.md.

   **Amended 2026-11-17 (Claude).** "or arc" is struck. An arc is a circle,
   and five of the eight backplates are not circles: drawn as an arc the
   inscription ran outside the shape on every one of those and crossed the
   motif on the rest. Clipping it to the plate only moved the fault — on the
   ticket stub and the keystone the text then stopped dead at the edge,
   which reads as a rendering bug rather than as a design.

   The ribbon is a banner across the lower third with swallowtail ends that
   **overhang** the plate. It is identical on all eight shapes by
   construction, which an arc can never be. It is drawn in the enamel's own
   shadow with gold lettering, not gold with dark lettering: the rim and the
   motif are already gold, and a third gold mass turns the badge into one
   metal blob.

   The text is sized to the band and then pinned with `textLength` +
   `lengthAdjust="spacingAndGlyphs"`. The serif differs on every surface a
   badge renders on (New York on iOS, Georgia in most browsers, DejaVu Serif
   on the CI runner, half again as wide), and a badge is an identity object
   that has to look the same in the app, on the share page and in a link
   preview. Identical beats unconstrained.

A badge is fully described by a small JSON-able struct
(`BadgeComposition`): shape id, material, palette seeds, motif id,
metal options, inscription string, plus the generation seed. **Badges are
data, rendered live** — SwiftUI/Core Graphics on iOS, a matching renderer
for web/OG images. Never stored as flattened images (except cached exports).

## The generation pipeline

1. **Inputs:** the completed Ten (items + ranks + metadata: genres, people,
   years, keywords from the catalog), the topic, and the user's badge
   history (to avoid repeating shapes/motifs across their case).
2. **Deterministic pre-pass (pure Swift, in `TopTenKit`):** derive palette
   from artwork; compute candidate motif set by metadata tags; compute
   candidate shapes weighted by domain + not-recently-used. This pass alone
   must yield a complete, good-looking badge — it IS the fallback.
3. **Foundation Models pass (on-device, guided generation):** a `@Generable`
   `BadgeDirection` struct — the model picks one motif from the candidate
   set (id-constrained enum, so it cannot hallucinate assets), one shape,
   one material, and writes the **inscription**: a reference to one item's
   iconic quote/scene/detail that resonates with the whole list's theme.
   Prompt receives the ranked items + topic + motif candidate descriptions.
   Guardrails: inscriptions must pass the framework's safety checks; output
   is structurally constrained, so failure modes are "bland," never
   "broken."
4. **Assembly & render:** compose layers, run the reveal.

Rules for the inscription (enforced in prompt + post-check):

- ≤ 6 words, no item title verbatim from rank 1 (too obvious — prefer ranks
  2–10 or a cross-list theme), no quotation marks, no emoji.
- It must be *derived from* the list — a quote fragment, a scene reference,
  a shared trope — not a generic compliment ("Great taste!") which is the
  quality floor we reject. Post-check: if the model returns a line that
  contains none of the candidate reference tokens supplied in the prompt,
  fall back to the template inscriptions (below).

**Amendment 2026-08-14 (M1.5 prototype, Claude):** the post-check must be
**code that rejects, not a rule the generator is asked to follow** — and it
must police the templates too, not only the model. The prototype's own
template `Ten kept, <title> last` produced "Ten kept, The Shawshank
Redemption last": exactly six words by luck, and eight with a longer title.
Nothing in the pipeline would have caught it, because the templates were
assumed safe. Every candidate line — model-written or template-filled — is
now filtered on word count and on containing the rank-1 title, and a
candidate that fails is discarded rather than trimmed. Trimming produces
half-jokes; discarding produces a different joke.
- Language matches the user's locale.

**Fallback ladder** (device unsupported / Apple Intelligence off / model
unavailable / post-check failed): deterministic pre-pass composition +
template inscriptions built from list metadata ("Ten heists, zero regrets" -
style patterns with slot-filled metadata). The reveal ritual is identical —
users must not be able to tell which path ran.

Latency budget: ≤ 3s end-to-end (Req 4). Generation runs during the rank
ceremony's final beats when possible (speculative start once 8 of 10 are
slotted; discard on change).

## The reveal draws the whole badge (2026-11-17)

`revealSequence` has always specified "backplate, motif, metals,
**inscription last, letter-by-letter**". The prototype was doing the first
three and then typing the inscription into a separate line of DOM text under
the badge, while the badge's own inscription layer was never switched on at
all. So the reveal - the one screen that draws a badge at 260px - was the
only surface in the product showing a badge without its ribbon.

Now the ribbon cloth lands as the final layer and the letters are struck onto
it one at a time, which is what the sequence said. The line under the badge
is the **list name**, which the reveal had never stated out loud despite
being the moment you finish that list.

The inscription is emitted as one `tspan` per character on every surface, so
any renderer can animate it; outside the vault they are simply all visible.
`drive.js` reads the inscription off the drawn tspans rather than off a
neighbouring element - a stronger assertion, because it proves the words are
on the artifact and not merely on the screen.

**An inner keyline** was added to the metals layer at the same time: a thin
rule inset 12% from the plate edge. A 260px badge of one flat field and one
large glyph reads as a sticker; a border for the field to sit inside is what
most separates a struck badge from a drawn one. It costs two paths and is
visible on all eight plates.

## A locked badge is a badge, frosted (2026-11-17)

badges.md has always said "silhouette under frost". It was drawn as a rounded
square with a padlock on it — the icon every app uses for every locked thing
— and on the splash that is the first thing anybody sees of the badge system.

It is now the real kit: a plate from the eight, a motif behind the lock, both
in a flat frost tone. **The silhouette is seeded from the topic**, so a
topic's locked badge is consistently ITS shape with ITS motif, and the shape
you glimpse locked is the shape you get when it opens. A frosted silhouette
says "there is a particular object here that you have not earned yet"; a
padlock says "no".

**A hash fix came with it.** The seed goes through `badgeHash`, and every use
of that hash is a modulo — enamel, plate, motif — so the LOW bits are the
only ones that matter, and FNV-1a's low bits are its weak end. Across 208 of
the app's real topic names the raw hash spread fine (10.6–13.5% per bucket),
but the seven stand-in people's topics put five of six on the same plate,
which on one screen reads as a bug rather than as chance. A final avalanche
mixes the high bits down: those six become four distinct shapes and the
spread over real titles stays healthy (7.7–15.4%).

## Reveal & gating rules

- The badge is **never previewable** during creation — no partial renders,
  no "generating…" spinner visible before the ceremony (speculative work is
  silent).
- Reveal runs `Motion.revealSequence` (design.md), skippable after 0.8s,
  offline-capable, narrated for VoiceOver.
- **Your** badges are always visible to you (badge case).
- **Others'** badges render locked (silhouette under frost, per design.md)
  until you complete your own take on that topic; then all badges on that
  topic unlock for you, retroactively and forever.
- The *list* is never gated — only badges. (PRD Req 12; open question there
  tracks whether to tighten this.)
- Re-ranking a published Ten: **offer, never force** (decided 2026-08-15,
  Mischa). The badge persists unless membership changes, or ≥3 items move ≥3
  slots — then regeneration is *offered*: "Your Top 10 changed. New badge?"

  A badge is an earned object and the user may be attached to it, so a small
  edit must not silently replace one; but a badge that no longer describes its
  list is a lie the app is telling on the user's behalf. The line between
  those two lives in `TopTenKit/BadgeEligibility.swift` rather than in this
  paragraph, because *"significant change"* is exactly the kind of phrase two
  people read two different ways. Membership is judged on sets before order is
  considered at all: a badge composed from items that have left the list is
  stale wherever the survivors ended up.

## Quality bar & anti-slop tests

Every kit asset is hand-approved. Before any badge-affecting change ships:

- **The lineup test:** render 20 random badges as a wall — they must read
  as one family (a real product screen: the Badge Case) with no two
  near-identical neighbors.
- **The stranger test:** an inscription shown without its list should be
  intriguing; shown *with* its list it should land. If it needs the list's
  author to explain it, it failed.
- **The floor test:** force the fallback ladder's bottom rung; the result
  must still be a badge you'd screenshot.

## Moderation & safety

Inscriptions come from a safety-guarded on-device model with structurally
constrained output, referencing catalog metadata — exposure is low by
construction. Still: profanity/slur list check post-generation (kit-level,
locale-aware); badge reports on web pages route to takedown of the
inscription (badge re-renders with template line) pending review. Freeform
topics (P1) will require a real moderation pass — flagged in the PRD.

## Extension points (design now, build later)

- **Premium image-gen tier (P1):** `BadgeComposition` gains an optional
  `heroImageRef`; the composed badge remains the frame so even generated
  art stays in-family. Licensing re-audit required first (PRD Non-Goals).
- Seasonal metal finishes; founder sprigs already reserve the metadata slot.
- Motif library growth is content ops, not code — assets + tags ship in
  catalog updates.
