# Hypelist, and what a Top 10 can take from it

**Asked by Mischa, 2026-11-20:** *"How do they make it easy to create lists,
share them, discover them, and socialize around them. How can we take the best
from this app and apply it to our philosophy: a constrained list of your top 10
turns a list into a symbol of your taste that's worth sharing and riffing on."*

Researched on Mobbin — 10 flows and ~30 screens across iOS. **This is a reading
of the surfaces, not of the product.** Screenshots show what the app offers;
they cannot show whether the recommendations are good, whether people come back,
or which of these features is load-bearing. Everything below is about mechanics.

---

## 1. What Hypelist is

A list app for anything — places, TV & movies, books, music, games. Lists are
unbounded, unranked, and tracker-flavoured. You pick a category, name the list,
give it a cover image, choose public or private, then add items one at a time.

The item counts on its own discovery screen tell you most of what you need to
know about the product:

> 5 items · 8 items · 13 items · 14 items · 19 items · 24 items · 42 items · 52 items

**That number is the whole difference between their product and ours**, and §4
is about what follows from it.

### Create — [flow](https://mobbin.com/flows/b6152800-98e7-452f-8c55-51797da394f4)

Onboarding opens on **"Start creating your first Hypelist"** with four
illustrated category cards (Places, TV & Movies, Books, Music) and a "Skip for
now". Category first, before anything else.

Then one screen: a name field, and under it a cover-art picker with three tabs —
**Color, Camera Roll, Stock Photos**. The clever part: **the stock-photo search
is pre-filled with the list name you just typed.** Type "Game Bucket List" and
the grid below is already full of game photography. It is the only piece of
genuine thoughtfulness in the creation flow.

The empty list says *"Add your first item to your Hypelist"* with a hand-drawn
arrow pointing at a floating bar: **Assistant ✨ · ♡ · ＋ · 💬 · ☆**.

Adding an item is search → pick → a detail sheet with notes, a star rating,
images, a date, a website, and free-text **sub-categories within the list**
(Watched / To Watch; Playing / Shelved / Uncategorized).

### Share — [sharing settings](https://mobbin.com/flows/7ac1f7a1-0f2c-458d-917f-1ce8bc35338c) · [collaborators](https://mobbin.com/flows/69f4ca7b-05d9-4bec-b3d7-3b63263594c9)

Two different things, and they are not the same thing:

- **Public/private**, a segmented toggle in the top right of the creation
  screen, with a sheet that spells both out: *"Public — All users will have the
  ability to see your Hypelist and you will be able to create a shareable
  link."* Private is the default.
- **Invite Collaborator** — search users, Invite, *"People you invite can add or
  edit items."* Shared editing of one list.

### Discover — [Discover More](https://mobbin.com/screens/d4ea7401-f7b7-4080-81ed-5d3f2cc013b0) · [search](https://mobbin.com/screens/e3516870-7d0f-47db-b1a8-39d8c50e4744) · [topic grid](https://mobbin.com/screens/2cb66d46-56a7-4908-9c0c-9288ce58b069)

The list card is the unit, and it is a good one: **full-bleed cover photo,
author's avatar and name top-left, item count and title bottom-left, and a
single number bottom-right — the save count, next to a star.** One number. No
likes, no followers, no comments on the card.

Around it: a hero carousel of featured lists, category chips (For You / TV &
Movies / Places / Music), a **Trending** rail, a **"Discover More" grid of named
topics** (Anime, Crochet, Design, Fandoms, Fitness, Hobbies, K-Drama, Makeup,
Nail Art, Outfits, Productivity, Recipes), a **Nearby map** for places, and
search with four tabs — **For You / Items / People / Hypelists**.

There is also an **editorial Top 10** rail on the TV & Movies tab, with big
numerals behind the posters — aggregate popularity, not anybody's list.

### Socialize — [comments](https://mobbin.com/flows/2ae8a624-d061-4bd1-a461-bab5061f7e6a) · [saving](https://mobbin.com/flows/3b1404ba-998f-4986-a275-8f8611c06733) · [also added by](https://mobbin.com/flows/c8f762a8-1545-4b90-a8be-408da33a0bf6)

Three reactions on every list, in one floating bar: **♥ likes · ☆ saves ·
💬 comments**. Profiles have following/followers, a Hypelists tab and a Saved
tab. There is a following feed of other people's item activity.

**And then the one genuinely excellent idea**, which is easy to miss because it
is buried at the bottom of an item detail sheet:

> **Also added by `_cerilith_` and others  ›**

Tapping it opens **"Item also added in:"** with three tabs — **Everyone ·
Following · Your Lists** — showing every other list that holds this same item.

That is a discovery engine made out of the items themselves. No editorial, no
recommendation model, no trending maths. It works the day there is a second
list in the database.

---

## 2. What to take

### 1. The item graph — and we can state it better than they can

Steal **"Also added in: Everyone / Following / Your Lists"** outright. Tap any
film in any Ten and see the other Tens it stands in.

It is worth *more* to us than to them, and this is the key point of this
teardown. In Hypelist an item appearing in another list is weak information —
the list might hold 52 things and mean nothing by including one of them. In Top
Ten, **an item appearing in somebody's list means they put it in their top ten**,
out of everything. And because our lists are ranked, we can write a sentence
Hypelist structurally cannot:

> **The Godfather · in 34 other Top 10s · 6 of them at number one**

Scarcity makes the overlap meaningful and rank makes it quotable. Hypelist
invented the affordance; the constraint is what gives it teeth.

This also answers an open problem from `docs/app-structure.md` §5, where three
of four proposed Browse rows were blocked on data we do not have. **The item
graph needs nothing but published lists** — no timestamps, no baselines, no
trending ratio — and it is a better row than "Popular" because it arrives
attached to something you were already looking at.

### 2. "Add Suggestion" beside "Add a comment"

Their comment box has two controls: a text field, and a separate **Add
Suggestion** button. A suggestion is a typed contribution — it proposes an item
rather than saying words.

Hypelist built this for a tracker. **It belongs to us far more than to them,
because a Top 10 is an argument and the reply to an argument is always
"you missed one."** *"No Unforgiven?"* is the single most natural thing a person
can say to a ranked list of westerns, and it should be a first-class object, not
free text — because a suggestion is one tap from the remix: *they say you missed
one → "then make yours."*

### 3. One number on the card, and make it an invitation

Hypelist puts exactly one number on a list card: saves. One signal, no clutter.
Take the discipline; change the number.

A save count measures *how many people filed this away*. For us the number
should be **how many Tens exist on this topic** — which measures how live the
argument is, and reads as a door rather than a trophy:

> **Top 10 Crime Movies of the 90s · 34 people have made theirs**

Same pixel budget, and it recruits instead of boasting.

### 4. The named-topic grid

Hypelist's "Discover More" grid of hand-picked tiles (Anime, Crochet, K-Drama…)
is the right shape, and **ours can be better without any editorial work**: our
rooms are computed from the tag space and already guaranteed fillable
(`offerable(t) = supply(t) >= 10`, PRD Req 15). They curate a dozen tiles by
hand; we can generate hundreds that are all real.

### 5. One search across three kinds of thing

Their search tabs — Items / People / Hypelists — are right. We already have two
of the three built: searching a **title** is start-from-a-title (Req 17),
searching a **topic** is the picker (Req 16). **People is the missing one**, and
it is only missing because there are no accounts yet.

---

## 3. What to refuse, and why

**Collaborators.** The most obviously copyable feature in the app, and the one
that would do us the most damage. *"People you invite can add or edit items"* is
the opposite of a statement of personal taste — a Top 10 with four authors is
nobody's. **Our version of inviting somebody into your list is the remix: you
don't edit mine, you make yours.** Worth writing down precisely because it looks
like an easy win.

**The cover-photo picker.** A creation tax paid by every list, and a quality
lottery — their own discovery screen has titles set in white over busy stock
photography, several of them barely legible. **We already have ten pieces of
real poster art per list.** The card should be made of the Ten itself. Take the
ambition — a list in a feed must be a beautiful object with its author's face on
it — not the mechanism.

**Private by default.** Hypelist defaults to private and makes publishing a
decision. Our locked decision is the opposite: everything is readable by
everybody. A draft is private because it is unfinished, not because it is
secret — that is a state, not a toggle.

**Sub-categories inside a list** (Watched / To Watch, Playing / Shelved). Tracker
mechanics, which `AGENTS.md` already rules out, and incoherent with ten ranked
slots besides.

**Three reactions.** ♥ and ☆ and 💬 on one bar splits one signal three ways and
makes none of them mean anything. Saving exists on Hypelist because their lists
are *useful* — a list of restaurants is a thing you file for later. Ours are
*expressive*, and you do not bookmark a statement of taste. You answer it.

But a list with no visible response is a cold room, and not everyone will make
their own. So: **one reaction, and make it ranked-list-native.** Instead of
liking the list, you tap a single film in it to say *this one, yes.* One
gesture that does three jobs at once — it is a reaction, it is the data behind
"6 people put it at number one", and it tells the author which pick landed. A
like tells them nothing.

---

## 4. The through-line

Everything Hypelist bolts on — saves, likes, collaborators, follower counts, an
AI assistant — is machinery for manufacturing engagement that **a constrained
ranked list produces for free.**

Forty-two items is not a symbol of anything. You cannot hold it in your head,
you cannot disagree with it, and a save button is the only honest response
because there is nothing to argue with. Ten ranked items is a claim: it has an
edge, it excludes things, somebody will be annoyed that you left out *Heat*, and
being annoyed is the beginning of making your own.

**So: take Hypelist's surfaces and drive them with our constraint.** Their item
graph, their one-number card, their suggestion affordance and their topic grid
are all good furniture. Each one gets sharper when the list behind it is ten
things in order, and several of them say something ours can say and theirs
cannot.

---

## 5. What this changes about the structure proposal

`docs/app-structure.md` recommended two tabs and a Browse screen of rows that
each say why you are seeing them, and §5 admitted that only one of four rows
could be built before the database exists. This adds a fifth row that is better
than three of the four:

| Row | Needs | Buildable |
|---|---|---|
| Because of what you've made | your lists + tag index | **now** |
| **Where else this film stands** | **published lists only** | **as soon as any exist** |
| Popular | list counts per root | database |
| New rooms | timestamps, first author | database |
| Trending | timestamps + baseline | database |

And it is not really a row — it is reachable from every poster on every screen,
which is the better place for it.

## 6. For Mischa

Nothing here is built. The recommendation is to take four things — the item
graph, suggestions-as-comments, one number that recruits, the topic grid — and
to refuse collaborators outright.

**The one real decision is the reaction.** Likes and saves are the default
answer and I think they are wrong for this product; "tap a pick to say *this
one, yes*" is the alternative, and it is the thing that makes the item graph
readable at rank level. It is also the only proposal here that invents a gesture
rather than borrowing one, so it deserves a yes or a no before anything is
built.
