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

## 4. Originator vs. room — the one real fork

**What exists today in the database** (`supabase/migrations/0001_init.sql`):

- `topics` — a first-class table, so a topic is an object, not a string
- `remix_edges` — `from_ten_id → to_ten_id`, with `no_self_remix`
- …and the prototype uses **neither**. There is no originator concept in the
  app at all; `isFirstTake()` in `achievements.js` is a fixture check.

So the schema already supports both of these, and the app commits to neither:

| | **A — the topic is a room** | **B — the list is a root (TikTok)** |
|---|---|---|
| what you join | the topic | a specific person's list |
| the unit of gravity | *Crime Dramas* | *Sam's Crime Dramas* |
| what you see on arrival | everyone's lists, and what everyone picked | the original, then its remixes |
| lineage | flat — all takes are equal | a tree, depth matters |
| consensus | natural: merge all lists in the room | awkward: merge across a tree? |
| failure mode | nobody feels like an author | the first mover owns the topic forever |

**Recommendation: A, with originator credit.** The topic is the room, so
*what everyone picked* keeps working — it is the thing the whole comparison
feature is built on, and it is the app's best trick. But the **first list on a
topic is credited on the topic page** (*"Started by Sam"*), which buys the
TikTok hook — somebody authored this corner of the app — without a tree that
makes consensus incoherent and lets a first mover own a subject forever.

The `Started Something` achievement already assumes exactly this shape:
*start a topic ten other people go on to make.*

---

## What this implies, if the recommendations hold

1. **Keep the broad first list.** No change.
2. **Let a topic carry more than one genre.** `t.genre` becomes an array;
   `inTopic` uses `every`; the namer learns to say *Crime Dramas*.
3. **Build a topic picker** that type-aheads over offerable combinations and
   shows supply. This is the screen that answers *"how do I make a list about
   the thing I actually want?"*, and the app does not have it.
4. **Credit the first list on a topic**, and leave `remix_edges` unused until
   there is a reason for a tree.

Open, and genuinely Mischa's: whether a topic should be *findable by typing*
at all before the first list is finished, or whether the picker lives only in
the discovery surface. Asking somebody to type a sub-genre on first run is
the thing section 1 argues against.
