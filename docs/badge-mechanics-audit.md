# What the badge system actually produces (2026-11-18, Claude)

Mischa, 2026-11-18: *"I question the mechanics behind the badges, we should
revisit that and simplify."*

This is the measurement that question deserves, taken before proposing
anything. Method: compose a badge for every topic the real catalogue can
fill — every genre, every genre × decade from the 1970s to the 2010s, and
eight directors — **103 topics with a full ten**. Reproduce with
`node shots.js badges` for the picture, and the audit script in this
commit's message for the numbers.

## The promise

`specs/badges.md`: a badge must feel **crafted**, **personal** ("visibly
derived from *this* list"), and **witty** ("the inscription is an inside joke
that lands if you know the list"). The motif is "the visual half of the
inside joke".

## What 103 topics actually get

### Inscriptions — about half say nothing about the list

| | |
|---|---|
| distinct lines across 103 topics | **46** |
| pure filler (`Argued into this order`, `Ten hills, all defended`) | **36 = 35%** |
| filler + decade-only lines (`The 2010s never let go`) | **48 = 47%** |

```
  21x  Argued into this order
  15x  Ten hills, all defended
   8x  The 2010s never let go
   4x  The 2000s never let go
   3x  Ranked in crime order
   2x  Everything after Inception
```

**One badge in five reads "Argued into this order."** That is the opposite of
an inside joke — it is a line that could sit on any list ever made. The
generator builds a candidate list from list metadata and falls through to two
hard-coded constants whenever the list is not unusually concentrated by
director, genre, decade or span; on a real catalogue that is most of the time.

The decade lines are worse than filler, because they look specific and are
not: `The 2010s never let go` lands on **Romances** and **War Movies**, whose
topics carry no decade at all. The decade is derived from the films, so it is
technically true and reads as random.

### Motifs — the three vaguest glyphs carry a third of the system

All 16 are reachable, but:

```
  13x compass   12x eye   12x mask     ← 36% of all badges
   8x star       8x column  6x planet
   6x flame      6x skull   6x grin
   6x briefcase  5x rose    4x sun
   3x sword      3x note    3x helm     2x laurel
```

Read the sheet rather than the table: **Hitchcock Movies gets an eye.
Westerns get a sun. Documentaries get a Roman column. Comedies of the 80s get
a smiley face. Thrillers of the 70s get an eye as well.** Roughly four of
twelve say anything about their topic. A compass on a Drama badge is not the
visual half of a joke; it is clip-art with a gold rim.

### Shapes — six variants of the same blob, signalling nothing

```
  22x hex   19x lozenge   16x oval   16x stub   15x seal   15x shield
```

Evenly spread, and **meaningless by construction**: the shape is
`SHAPES[hash(ids + title) % 8]`. It is not derived from the list, the topic or
the domain. At the size a badge is actually seen — 112pt in the case, 150px
on a sheet — the six read as one rounded plate with a gold rim.

## The diagnosis

**The machinery is in the dimensions that carry no meaning, and the
dimensions that are supposed to make a badge personal fail about half the
time.**

| dimension | variants | does it say anything about your list? |
|---|---|---|
| shape | 8 | **no** — a hash |
| material | 4 | **no** — a hash |
| enamel colour | 8 | yes — the topic's, and this part works |
| motif | 16 | rarely — 36% land on compass/eye/mask |
| inscription | 46 observed | **47% generic** |

8 × 4 × 8 × 16 = **4,096 visual combinations**, and the sentence a person
actually reads is identical on one badge in five. The system spends its
complexity on variety nobody can name and underfunds the one thing that could
be personal.

**This is not a tuning problem.** More motifs and more templates would raise
the floor slightly and keep the shape: a familiar enamel-roundel-with-ribbon
that an ADA jury has seen on a thousand gamified apps, carrying a line that
says nothing.

## What is worth keeping

- **The enamel-per-topic rule.** Measured flat (11.3–13.7% across eight
  enamels over 4,000 topic names), and it is a real product rule: every take
  on one topic is one colour, so a topic's badges read as a set. Keep.
- **Badges as data, rendered live.** Keep — it is why one renderer serves the
  app, the share page and the OG card.
- **The gate.** Keep. But note what it currently hides: an emblem. The thing
  worth hiding is the *joke*.
