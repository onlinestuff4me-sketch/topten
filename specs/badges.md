# Badges

**Rewritten 2026-11-18 (Mischa).** Everything below this line replaces a
spec for a per-list badge composer. What it replaced, and why, is the first
section — the reasoning is kept because the old design was reached by
argument and the new one has to beat it on the record, not by forgetting it.

---

## What changed, and why

Mischa, 2026-11-18: *"The badge system seems complicated and confusing. We
could have a standard set of badges that reward you for making lists (e.g.
made 10 lists, made a list in each category). But not a badge for each list."*
And: *"Badges is a new system, like achievements, just one set of achievements
you unlock for taking actions in the app."*

**The old system.** Every finished Ten produced a badge composed from a kit:
8 backplate shapes × 4 materials × 8 enamels × 16 motifs = 4,096 visual
combinations, plus an inscription written by an on-device model with a
template fallback. It was specified in detail and built in full.

**What it actually produced**, measured across 103 real topics
(`docs/badge-mechanics-audit.md`):

| | |
|---|---|
| inscriptions that said nothing about the list | **47%** |
| badges reading *"Argued into this order"* | **one in five** |
| motifs landing on compass / eye / mask | **36%** |
| dimensions derived from a hash and signalling nothing | **shape, material** |

Hitchcock got an eye. Westerns got a sun. Documentaries got a Roman column.
Comedies of the 80s got a smiley face.

**The diagnosis was not "tune it".** The complexity sat in the dimensions
that carried no meaning, and the two that were supposed to make a badge
personal failed about half the time. More motifs and more templates would
have raised the floor and kept the shape: a gold-rimmed enamel roundel of a
kind an ADA jury has seen on a thousand gamified apps, carrying a line that
could sit on any list ever made.

**And a badge for finishing is a participation trophy.** You got one every
time, so it said nothing about you. That is the deeper reason the audit
numbers were bad: there was nothing for the system to be *about*.

---

## What a badge is now

**One fixed set of ten, hand-drawn, identical for everybody**, earned for
what you have done across the app. Nothing is generated, so there is nothing
to audit and no way for the system to produce something embarrassing.

| | glyph | earned for |
|---|---|---|
| **First Ten** | star | finishing your first Top 10 |
| **Ten Tens** | laurel | ten lists |
| **The Long Shelf** | column | fifty lists |
| **All-Rounder** | compass | a list in every category |
| **Time Served** | planet | lists covering five different decades |
| **First In** | flame | being first to take on a topic |
| **Answered** | sword | making your own version of someone else's topic |
| **Started Something** | sun | ten people taking on a topic you made first |
| **Nobody Agrees** | skull | a Ten sharing nothing with the crowd |
| **Exactly Right** | eye | a Ten the crowd agrees with completely |

The last two run on `shared_with_consensus`, which has been in the schema and
in `TopTenKit` since M1 and previously had nowhere to show.

### Three rules it is built on

1. **About you, not about a list.** This is the whole difference. A badge you
   get for finishing is a receipt; a badge you get for finishing *fifty* is a
   fact about you.
2. **Locked ones are visible, and state their condition.** The exact opposite
   of the old reveal gate, deliberately. A locked achievement that hides what
   it wants cannot ask you for anything. Progress is shown where the target is
   above 1 — *4 of 10 lists* — because the bar is the invitation.
3. **Nothing is composed.** The tenth person to earn *Ten Tens* gets the
   identical object the first one did. That is what makes it worth having, and
   it is why there is no generation pipeline in this document any more.

### The marks

The glyphs are the ones `badge.js` already carried for the old motif layer.
They were drawn as decoration that meant nothing in particular; here each one
means exactly one thing, which is the job they were always better suited to.

Drawn on a plain disc: earned is a filled disc with a gold rim and a gold
glyph; unearned is an empty disc with a hairline rim and a secondary-text
glyph. **Fill *and* stroke**, because several of the kit are drawn as strokes
— the sun's rays, the compass needle, the planet's ring — and a fill-only
rule renders them as a dot with ghost lines. (Found by measuring: every
glyph's bounding box came back 63–97 units across, so nothing was small; they
were simply unpainted.)

---

## The reveal, after the badge

Finishing a Ten used to assemble a badge: plate, motif, metals, then an
inscription struck letter by letter onto a ribbon. **What finishing gives you
is the list**, so the ceremony lands on the list:

1. the list's name arrives,
2. the ten rows settle in rank order, one every 90ms,
3. **only if this list earned one**, an achievement mark strikes in.

Most finishes will show nothing at step 3, and that is correct — see rule 1.
Reduce Motion lands every row on the same end state with no timeline at all,
and `skipReveal` does the same on demand.

---

## There is no gate

**Retired 2026-11-18 (Mischa):** *"You can read and share anyone's list, and
you can form your own version of someone's list."*

The reveal gate hid other people's badges until you made your own take on
their topic, and `AGENTS.md` called it "the engine that turns browsing into
creating". With no badge per list there is nothing left for it to hide, and
"you have not earned the right to see that someone has made ten lists" is
meaningless.

**What replaces it as the engine: the remix offer.** Every list you read
carries the obvious next move — *Make your own Top 10 Crime Movies of the
90s* — and on a topic you have already made, the same place offers the way
back to yours. The pull is the topic, not a lock.

Consequences, so nothing is left half-retired:

- `unlockedTopics()` is now `finishedTopics()`; the set is still needed to
  know whether a tray is a draft.
- The locked-badge renderer, the `badgecell` on discover cards, and the
  *"Badge locked until you make yours"* lines are gone.
- The database's `topic_unlocks` table and the `badges` table are now dead
  weight — see `specs/prd.md` Req 12 for the migration still owed.

---

## Still true, and still worth keeping

- **Badges are data, rendered live**, never flattened images. One renderer
  serves the app, the share page and the OG card, which is why they cannot
  disagree.
- **Moderation is now trivial.** There is no generated text and no generated
  composition, so the whole "anti-slop" and safety apparatus the old pipeline
  needed does not apply. An achievement name is written once, by us.
- **Extension is adding a row to a table**, not growing a glyph library:
  a new achievement is a predicate and a glyph.

## What is deliberately not here any more

The composition kit, the enamel-per-topic rule, the material sheens, the
inscription rules, the `@Generable` pass, the fallback ladder, the latency
budget for generation, and the anti-slop tests. All of it served a per-list
badge. The enamel rule was good work and measured — hues flat at 11.3–13.7%
across 4,000 topic names — and it is recorded here only so that nobody
rediscovers it as new: if a topic ever needs a colour again, that is where
the answer is, in this file's history.
