# How a list gets its subject, and how lists relate (2026-11-18)

Mischa: *"Is it asking you to make a more specific list (e.g. top 10 crime
drama movies)? Or is it kept simple and broad? … Does the app have more
structured sub-genre data … Then when you find one of these lists do they
behave like a tiktok video, where there's an originator and a bunch of others
that are remixed from that … We should be specific in the mechanics."*

Four questions. Three of them have answers in the code and the catalogue
already; one is a real fork. Everything below is measured, not remembered.

---

## 1. What the app asks for today: the broad one

First launch asks for **"Your 10 favorite movies of all time."** Category
level, no narrowing. The same for TV and books.

Narrower topics arrive *after* you finish one, as suggestions derived from
what you picked — *"Top 10 Crime Movies of the 90s"*, *"Top 10 Hitchcock
Movies"*. You never choose a topic cold; the app proposes one.

**This is the right default and should stay.** A first-run screen that asks
somebody to pick a sub-genre before they have picked a film is asking them to
do the hard part first.

## 2. "Crime dramas" is not expressible today, and that is a real gap

A topic narrows on **one value per axis**:

```js
if (t.genre   && !f.g.includes(t.genre))              return false;
if (t.decade  && Math.floor(f.y/10)*10 !== t.decade)  return false;
if (t.director && f.d !== t.director)                 return false;
if (t.actor   && !(f.ca||[]).includes(t.actor))       return false;
```

One genre. So **Crime**, or **Drama**, but never **Crime + Drama**. Mischa's
own example is a list the app cannot currently name or fill.

Fixing it is small — `t.genre` becomes a list and the check becomes
`every` — but it changes what the topic namer has to produce, so it is a
decision rather than a patch.

## 3. There are no sub-genres in the data, and there do not need to be

**Measured on the real catalogue** (3,469 titles, movies only for the pairs):

| | |
|---|---|
| genres | **27**, flat — TMDB has no hierarchy |
| keywords / sub-genre field | **none fetched** |
| genres per title | 2.45 average, 3 maximum |
| genre **pairs** with ≥10 films | **87** of 143 |

So a sub-genre taxonomy is not needed, because **the combinations already are
the sub-genres**. Typing `crime` can honestly offer, with real counts:

```
Crime Thrillers 189   Crime Dramas 187   Crime Action 96
Crime Comedies   69   Crime Mysteries 65   Crime Horror 18
Crime History    12   Crime Adventure 11   Crime Romance 11
```

…plus every decade cut of those, and *Crime Movies of the 90s*, and the 21
directors with ten or more films.

**What is NOT available: "crime procedurals".** That is a TMDB *keyword*, and
`build_catalog.py` does not fetch keywords. It could — TMDB exposes them per
title — at the cost of ~3,500 extra API calls on a catalogue build and a
larger `catalog.js`. Worth doing only if genre pairs prove too coarse in
front of real people.

### The rule that governs any topic picker

Already in the code, and it is the important one:

```js
const supply    = t => CAT.filter(f => inTopic(f, t)).length;
const offerable = t => supply(t) >= 10;
```

**A list nobody can fill is not a list.** *"Top 10 Hitchcock Thrillers"* is a
fine name and an unofferable topic, because the catalogue holds eight. So the
picker must offer only topics it can prove have ten — which is exactly why
free text is the wrong input and autocomplete over known combinations is the
right one.

**Recommendation:** a type-ahead that searches the *known offerable set* —
genres, genre pairs, decades, decade cuts, directors, actors — and shows the
supply beside each (`Crime Dramas · 187 films`). No free text, because free
text can name a list that cannot exist.

## 4. Decided: you join a ROOT, not a person (2026-11-18, Mischa)

> *"It seems like you're not joining a person's list, you're joining a
> genre/sub-genre root… you could be one of the first to make a list for a
> particular root — which should come with a set of badges. We should also
> have a way to make a free-text custom list (e.g. top 10 disney animated
> movies of the 2000s), and you can join in and make your own top 10 list on
> that. A more sophisticated version of this app would look at all the
> elements of a movie (studio = disney, era = 2000s, format = animated), so
> that people could map any free-text to a tagged set."*

**A root is a set of tags.** Not a string, and not a person's list. That is
the whole model, and it is sharper than the "topic is a room" version it
replaces, because it says what a room *is*:

- **free text is an INPUT, not a storage format.** You type *"disney animated
  movies of the 2000s"*; the app resolves it to
  `studio:Walt Disney Pictures + genre:Animation + decade:2000`; the root is
  that tag set.
- **so two people who type different words land in the same place.** *"Disney
  cartoons from the 2000s"* resolves to the same three tags and joins the same
  root. A raw string would have made two rooms and split the crowd.
- **a person is never the thing you join.** Being first on a root is credit,
  not ownership.

The database already fits this: `topics` is a first-class table, so a root is
an object with an id. `remix_edges` stays unused — lineage is not the model.

### The root space, measured

Tagging every title with genre / decade / studio / director / franchise
yields **2,303 distinct tags** over 3,469 titles, and:

| | roots that can be filled |
|---|---|
| one tag | **87** |
| two tags | **423** |
| | **~510 real roots today** |

Which axes can actually carry a root:

| axis | tags | fill ten | share of titles tagged |
|---|---|---|---|
| genre | 27 | **24** | 100% |
| decade | 13 | **11** | 100% |
| studio | 36 | 26 | **21%** |
| director | 1,714 | **22** | 96% |
| franchise | 511 | **2** | 26% |

**Genre × decade is the backbone.** Both tag every title, and between them
they produce most of the 510. Studio and director are a thin garnish —
1,714 directors and only 22 of them have ten films — and franchise is
effectively unusable at 2.

### Mischa's own example does not fill, and that is the point

```
Walt Disney Pictures + Animation            28 titles  ✓
                     + decade 2000           9 titles  ✗  one short
```

*"Top 10 Disney animated movies of the 2000s"* is **nine films**. The rule in
section 3 — `offerable(t) = supply(t) >= 10` — forbids it, correctly: a list
that cannot be filled must not be offerable, or the tenth slot is a lie.

This is not an edge case to engineer around. It is what the picker has to be
*designed for*, because studio tagging covers 21% of titles and most
three-tag phrases a person types will land short. So:

1. **Show supply live while typing**, per candidate root:
   `Disney animated movies · 28` / `…of the 2000s · 9, needs 10`.
2. **When a phrase near-misses, offer the nearest root that fills** — drop the
   narrowest tag and say so: *"Nine of those. Try Disney animated movies —
   28."*
3. **Never fail silently into a half-built list.**

### Being early on a root: a set of badges, not one

Mischa asked for a set. The ladder, and what each needs from the backend:

| | earned for | needs |
|---|---|---|
| **First Here** | the first list on a root | a root's created-at, already implied by `topics` |
| **Early** | among the first ten on a root | a count at publish time |
| **Started Something** | a root you were first on that ten others join | the same count, read later |
| **Trailblazer** | first on ten different roots | a tally |

All four are counts against `topics` / `tens`, which the schema already
supports. None needs `remix_edges`.

### What a "more sophisticated version" would actually need

Mischa is right that the richer the tag space, the more free text resolves.
What we have and what we do not:

| element | have it? |
|---|---|
| genre (incl. *format* — Animation, Documentary) | yes, 100% |
| era / decade | yes, 100% |
| studio | **21% only** |
| director, cast | yes |
| franchise | yes but unusable |
| **keywords** (*heist, procedural, coming-of-age*) | **no — not fetched** |
| country, certification, runtime band | no |

The single biggest unlock is **TMDB keywords**: it is the field that carries
*procedural*, *heist*, *dystopia*, *time travel*. Cost is roughly 3,500 extra
calls on a catalogue build and a larger `catalog.js`. Studio coverage would
improve by taking production companies more fully rather than the curated
brand list now in `br`.

---

## What this implies, if the recommendations hold

1. **Keep the broad first list.** No change.
2. **A root is a SET of tags**, not one value per axis. `inTopic` must match
   every tag, and the namer must say *Crime Dramas* and *Disney Animated
   Movies of the 2000s*. Without this none of Mischa's examples can exist.
3. **Build the picker**: type-ahead over offerable roots, supply shown beside
   each, and a near-miss offers the nearest root that fills. This is the
   screen that answers *"how do I make a list about the thing I actually
   want?"* and the app does not have it at all.
4. **Credit the first list on a root**, and ship the four-badge ladder above.
5. **Leave `remix_edges` unused.** Lineage is not the model.

Open, and genuinely Mischa's: whether the picker is reachable on first run or
only after the first list is finished. Section 1 argues for the latter —
asking somebody to type a sub-genre before they have picked a film is the
hard part first.
