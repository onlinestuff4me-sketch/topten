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
- **No user-entered list names or descriptions** (2026-08-15, Mischa). A list's
  name is its criteria — *"Top 10 Crime Movies of the 90s"* — and every one of
  its ten entries satisfies them; there is no field to type one in, and no
  blurb under it. Free text on a social surface is a moderation and
  safety surface, and the app already knows more about a list than its author
  would type. See the Requirement 12 amendment for the generator and for where
  Foundation Models fit.
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
  Its **name is derived, not stored as input**: computed from the ten items'
  own metadata (see the Req 12 amendment, 2026-08-15), so re-ranking or
  swapping an item can rename the list — the name is a view of the contents,
  not a field beside them.
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
- **Launch blocker (2026-11-18).** The splash tagline claims a corpus size —
  "5,000+ lists from the community" — and that figure is a fixture held in one
  constant, `CORPUS_CLAIM`. Before the app is in front of anybody outside this
  project it is read from the published-Tens count, or the sentence loses its
  number. Every other invented figure in the prototype is a fixture a reader
  cannot act on; this one is a claim about how many people are already here.

  *The server side of it is already built:* `public.product_stats.published_tens`
  (migration `0002`) is that count, `security_invoker`, granted to `anon`. The
  remaining work is a read — **and it may not happen on the splash**. "The
  first screen never waits on an API" is a standing rule with a test behind
  it, so the count is baked at build time or fetched in the background and
  cached, with `CORPUS_CLAIM` as the floor it falls back to. A tagline that
  flickers from a fixture to a real number on a cold start would be worse
  than either.

**Amendment 2026-08-15 (Mischa, round 5) — the shape of a session, and the
domains beyond film.**

*"The onboarding should be a splash screen to introduce the app and its major
value props… then jump you straight into making your first top 10 list…
Discovering lists from other users should be introduced to them after their
2nd list."*

**The order of the first session is now a decision, not an accident:**

1. **Intro.** One screen that shows the product rather than describing it —
   two drifting rows of hand-picked, widely-known artwork wearing the app's own
   rank numerals — the three things the app is for, and what it costs (nothing).
   The artwork is baked in: this is the first screen, often on a cold cache, and
   a screen whose whole job is to look finished is the worst place in the app
   for a loading state. Stack learned this the same way (`stack/specs/onboarding.md`).
   **Deliberately not skippable** — it only tells, so a Skip would be a second
   CTA competing with the real one.
2. **Straight into the first Ten**, on Movies. No account, no questions first.
3. **On finishing**, two offers side by side: *more films, closer in* (the
   rabbit hole, unchanged) and *a different kind of list* (the other domains).
4. **After the second finished Ten, and not before,** discovery appears. Other
   people's lists are interesting once the mechanic is understood and merely
   confusing before it is — at list one the user has not yet made the thing
   they would be comparing against.

**Domains (Mischa's order):** movies, **TV shows**, **books**, video games,
restaurants, travel destinations. Movies, TV and books are built (books added
2026-08-15 — see the amendment under Requirement 6) and share every mechanic —
a Ten never mixes domains, and each domain's authorship axis is its own (a
film's director and studio; a show's creator and network; a book's author,
series and imprint). The unbuilt domains are **named in the picker rather than
hidden**: a list showing only what exists tells the user the app is smaller
than it is going to be.

**The reveal gate, now real (Req 12).** Discovery shows other people's lists,
each on a topic. Every list is fully readable; only the badge is locked, and it
opens for **all** takes on that topic the moment you finish your own — per
topic, retroactively. A Movies Ten does not open a Crime films badge, which is
what makes crossing the gate worth anything.

*Amended 2026-08-15 (round 5 build): the prototype now shows **seven lists on
six topics** — two people have both taken on Crime films. It was six lists on
six topics, and with one list per topic the retroactive half of the promise was
literally unobservable: unlocking "every take on that topic" and unlocking "the
one take on that topic" look identical. Two lists on one topic make the
simultaneous open visible on screen and assertable in the harness.*

**Amended 2026-11-18 (Mischa raised it, Claude built it) — where the seed
lists come from, and what they are allowed to claim to be.** The seven lists
were attributed to Sam, Priya, Marcus, Nour, Theo, Eddie and Rae: invented
users. Mischa, reviewing the build: *"who is this Mischa guy, do I know him,
is he someone from my contacts?"* — and the question lands harder against a
fabricated name than a real one, because in an identity product a stranger's
name reads as somebody you were supposed to recognise, and failing to is a
small social embarrassment. They were also not real, which is the one thing a
product about honest self-description cannot be casual about.

Three candidates were weighed, all Mischa's:

| | what it gives | why it is not the whole answer |
|---|---|---|
| **A real person** (him, MySpace-Tom style) | keeps a human in a product whose thesis is being *seen*; the only option that does | *"who?"* — solved by a role line, not by hiding the name. Does not scale: one human credibly holding a Top 10 for every topic the engine invents is the same fiction, one level up |
| **An authority** (NYT, Rotten Tomatoes) | the most arguable list there is; people enjoy disagreeing with critics | a named third-party brand is a licensing and partnership decision, not a design one. And it tilts the frame from *what do you love* to *how close are you to correct*, which is this product inverted |
| **"From the community"** | no name problem, no brand problem, scales | a lie at zero users, and **unarguable**: you cannot disagree with an average, only sit above or below it |

**The decision: every seed list states what it is.** Either a **person**, shown
with a role you can read in three words, or a **house list**, openly derived
from the collection and named for its own ordering rule — *Best known* (most
rated), *Rated highest* (score, not fame), *Less obvious* (well scored, less
rated). A derived list says what the derivation found — *"Alien scores above
Interstellar, on a fraction of the ratings"* — rather than wearing a person's
name. House lists scale to any topic the engine invents, because they are
functions of the shelf rather than of a person.

Two consequences follow and are binding:

1. **A generated list is never attributed to a named real person.** Mischa's
   two cards are stand-ins whose contents come from the same engine, and that
   is only acceptable in a prototype whose job is to settle anatomy. His
   actual ten replaces them before anyone outside the team sees the screen.
2. **No third-party brand appears until that is a decided partnership.** The
   house lists stand on data the collection already carries; nothing here
   needs anyone's permission.

Still seven lists, still two topics carrying two takes — and the demonstration
is better than it was, because Mischa's crime ten and the crowd's crime ten
disagree for a reason that is visible on the card. The two takes on a topic
are no longer adjacent in the list: identical headings stacked read as a
rendering fault rather than as the point being made.

**Amendment 2026-11-18 (Mischa, reviewing the build) — reordering is direct
manipulation, and the splash is navigable.**

*Req 2/3 (the build screen).* Your order is changed by **holding a poster in
the dock and dragging it**, not only by opening a list. The dock carries a
permanent tip saying so from the second pick, and **Arrange** — the labelled
way into the vertical list — is enabled from the second pick rather than the
tenth. The vertical list is not optional: WCAG 2.5.7 requires a single-pointer
alternative to any drag, so it is the accessible path and has to be easy to
find. Acceptance: a held drag moves the poster it was given and does not also
open the list; a tap opens the list and reorders nothing; the tip names the
domain's own artwork word.

*Req 1 (the first screen).* The other topics under the hero are **tappable**
and swap themselves into the hero, so the set cycles by use rather than by
moving on its own. No label on them is ever truncated — see `design.md` for the
naming rule and the measurements, including why there are now three tiles
rather than six. Acceptance: every intro topic, shown as a tile, renders its
label in full on every phone viewport; tapping one promotes it and the one it
replaced returns to the strip.

**Amendment 2026-11-18 (Mischa) — what to make next: today, this week, and
what is rising.** Held open since the overnight build with one condition on
it: *"it needs a conversation about how often a person should be given
something new, because that's a retention decision, not a layout one."* The
cadence is therefore the decision, and it is three different ones:

| | cadence | shape | why that cadence |
|---|---|---|---|
| **Today** | one topic, new each calendar day | sits **next to what you have already made** | the small, repeatable reason to open the app. A topic, not a film, because the unit of this product is a list |
| **This week** | one topic, new each ISO week | deliberately **broader** — a genre or a decade, never a person | a week is long enough that a bigger list is not a chore, and the breadth keeps the two from reading as the same suggestion twice |
| **Rising now** | continuous | a row of topics | not a suggestion at all — what the collection is busy with, so the screen has a pulse that is not about you |

Both picks are **deterministic within their period**: the same day gives the
same topic on every render and on every device. A suggestion that moved when
the screen redrew would be a slot machine. Both are also drawn from the pool
of topics that are **offerable** — the collection has ten of them — so a pick
can never be a list of nine, and neither ever offers a topic you have already
finished.

**Today's reason is read off your own ten**, not asserted: *"Because 10 of
your picks were crime movies."* With no history it falls back to a fact about
the topic itself (*"240+ to choose from"*). On the device this is Apple's
Foundation Models choosing from the same pool with your own lists as the
prompt; the prototype computes the same shape so what is being judged is the
mechanism rather than a mock-up.

**Rising now is a stand-in, and the label says only what is true.** In the
product it is other people's activity. There are no other people yet, and
inventing counts is exactly what the seed-source decision of this same
morning refused to do — so it is derived from the one signal that is real
here: genres whose films are both recent and widely rated. It is labelled
*"Rising now"* and never *"N people made this today"*. When there is a
database behind it, the derivation is replaced and the label does not have to
change.

*Where it lives:* the top of **discovery**, not the build screen. The build
screen already has a topic, and offering a different one on top of the one you
are filling is an interruption rather than an invitation.

- Acceptance: every pick is offerable and is not one you have finished; today
  and this week never coincide; seven consecutive days give at least five
  different topics and four consecutive weeks at least three; a re-render
  changes neither; tapping a pick starts exactly the topic it named.

**2. Gather.** Building a Ten is two phases; phase one is *gathering* — an
unordered tray of up to 10 candidates. Sources: search (catalog-backed with
artwork) and a suggestion rail (popular/classic/acclaimed for the topic,
filtered toward the user's services when known, plus "because you picked X"
entries once 3+ items are in the tray). Candidates can exceed intent —
gathering 14 then cutting to 10 is a supported, labeled moment ("the cut").
- Acceptance: tray persists as a draft across launches; search returns
  catalog results with artwork in <1s on broadband; the cut is required
  before ranking when the tray holds >10.

**Amendment 2026-08-14 (Mischa, round 1 on the prototype) — Requirements 2
and 3 are one screen.** Gathering and ranking are no longer two phases the
user is marched through. One screen holds search, refinements, suggestions and
the Ten itself; items are added from either source without losing the other,
and the Ten is reordered in place. The guided placement flow in Req 3 survives
as an offered aid and as the accessible path, not as the only road to an order.
Reasoning: the two-phase split made sense as a description of the work, but as
an interface it separated the list from the things that fill it, and it meant
the answer to *"what have I got so far"* was always on another screen.

Req 2 additionally gains **refinement by subscription service, genre, director
and actor**, services first — the only refinement that changes what the user
could actually watch tonight, and the one Mischa named the value proposition.
Service data is canonicalised at catalog-build time; see design.md for the
storefront trap inherited from Stack.

Req 5's rabbit hole also starts **during** gather, not only after completion:
every suggestion can be drilled into (*more like this*), and the path taken is
a walkable trail. See design.md, "Branching suggestions".

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

**Amendment 2026-08-15 (Mischa, round 4) — "more like this" has more than one
answer, and the model's job is to pick which.**

Similarity was one weighted formula, so every rail answered the same question.
Mischa's observation is the requirement: *"In some cases it makes sense (eg
when the director is well known and the movie is tied to that identity and
authorship… and other cases where there isn't a clear authorship component and
it's more about genre similarity or franchise or studio alignment (more like
Toy Story should show Toy Story 2, 3, 4, 5, Buzz Lightyear, and then more
classic Pixar movies)."*

So a link is scored on **axes**, and the strongest axis both ranks the film and
**labels it**, because *More Toy Story*, *Also Pixar*, *With Tom Cruise* and
*Also Christopher Nolan* are different promises and the user is owed the one
being made:

| Axis | Weight | Why |
|---|---|---|
| Same series (`belongs_to_collection`) | 14 | The least ambiguous answer there is |
| Shared lead actor | 6 | Top Gun: Maverick is a Cruise film before it is anything else |
| Same director | 5 (×1.2 if prolific here) | Real, but no longer able to swamp a rail |
| Brand studio (Pixar, Ghibli, A24, …) | 5 | Only where the name is a promise — an allowlist, verified against TMDB at build time |
| Often watched together (TMDB) | 5 | Crowd behaviour: useful, not authoritative |
| Shared genre / era | 1.5 / 1 | The floor |

Plus a **diversity cap of four films per director per rail** — a rail that is
one person's filmography answers a question the user did not ask, and *"Also
Nolan"* is one tap away when it IS the question.

**Where Foundation Models belong (decided 2026-08-15, and this is what to
build towards).** The axes above are computable; *which axis matters for this
film* is a cultural judgement that is not in the metadata. Nothing in TMDB
says that a Safdie brothers film is an authored object while a Marvel entry is
a franchise one, or that Top Gun: Maverick is sold on its star. That judgement
is exactly what a language model knows and a weights table does not.

The role is therefore **the model chooses the axis, never the films**:

1. **Deterministic pre-pass (`TopTenKit`, testable, offline):** compute every
   candidate link and its axis scores, as now. This alone must produce a good
   rail — it is the fallback, and it is what ships first.
2. **`@Generable` pass (on-device):** given the seed film and the *candidate
   axes only*, the model returns a ranked axis choice plus the one-line reason
   — an id-constrained enum, so it cannot invent a film, a director, or a
   studio that is not in the candidate set. Same shape as the badge pipeline
   in `badges.md`: constrained output means failure modes are "bland", never
   "wrong".
3. **Post-check:** an axis the pre-pass did not offer is discarded.

This keeps the guarantee that matters — every film shown is a real film from
the catalog with a real connection — while letting the model supply the part
that is genuinely taste: *what kind of "more like this" this film deserves*.
Reordering axes is cheap, low-latency, and degrades safely; asking a model to
pick titles would risk hallucinated films and is explicitly not the plan.

**6. Catalogs (v1 domains: movies + TV).** Items come from TMDB (search,
metadata, artwork), reusing Stack's integration knowledge. TMDB attribution
shown per licence. Topic scopes may bind to catalog filters (person, genre,
collection) so suggestion rails can be auto-populated.
- Acceptance: search + artwork for movies and TV; attribution present;
  missing-artwork items render a designed fallback, never a broken image.

**Measured 2026-11-18 (Claude, overnight) — there was no fallback, designed
or otherwise.** With every poster answering 404, all ten on a shared Ten drew
**Chromium's torn-photo glyph**, and so did all fifty on the splash wall.
`share.js` had carried a comment since August saying "a missing poster is a
grey plate, never a broken image icon — this page is somebody's first
impression"; the comment described an intention nobody had implemented.

Two reasons it survived three months of a green suite:

- An **empty `alt` does not suppress the glyph**, and no background can cover
  it: the browser paints it on top of the element's own box. The plate was
  there the whole time, behind the glyph.
- The harness **aborts or 204s every TMDB request**, so every screenshot it
  has ever taken was of broken images, and nothing in it ever asked.

Fixed by removing the failed `<img>` and marking the plate `.no-art` — one
capture-phase listener in `share.js`, which all four pages load. Twelve
checks across the two suites, falsified by deleting the listener.

**Amendment 2026-08-15 (Claude, books) — the third catalog, and why it is not
the one you would expect.**

Books are now a built domain in the prototype (`ready`, with a topic of its
own), the third after movies and TV. The mechanics are unchanged — a Ten never
mixes domains, the same ten slots, the same rails, the same badge — so the
amendment is only about where the books come from and what that costs.

*Sources (verified reachable before anything was built).* The obvious catalogs
are unusable from this build environment: the egress proxy refuses CONNECT to
`openlibrary.org` and `covers.openlibrary.org` (403), and
`www.googleapis.com/books/v1` answers every request, keyed or not, with
`Quota exceeded … "Queries per day" … quota_limit_value "0"`. What is
reachable is `raw.githubusercontent.com`, so the shelf is built from three
public repositories: **goodbooks-10k** (the 10,000 most-rated books on
Goodreads — original publication year, rating, rating count, and 6M user
ratings for a real *often read together* edge), **Goodreads Best Books Ever**
(genres, series, the edition's publisher), and **Standard Ebooks** (the cover
artwork and Dublin Core metadata, one repository per book).

*The trade, stated plainly.* Standard Ebooks publishes only US public-domain
work, so **the books shelf is classics: 232 of them, none published after
1930.** No Harry Potter, no Dune. This was chosen over a bigger shelf with no
artwork, because a books screen IS artwork — every cover host carrying modern
books (Goodreads' own, Amazon, Google Books, Open Library) is blocked here, and
a shelf of grey rectangles would have tested nothing. Standard Ebooks covers
are additionally CC0, which is why they can be mirrored into the repo at all;
TMDB's licence forbids exactly that for the film posters, which is why those
are still fetched at runtime. **If the egress policy ever allows Open Library
or Google Books, the right move is to replace the source, not to grow this
one** — the builder is a single file and nothing else in the app knows where
books come from.

*What is not there yet.* 232 books, not the ~500 asked for. The ceiling is not
laziness: only goodbooks-10k carries a trustworthy *original* publication year
(Best Books Ever stores `firstPublishDate` as `MM/DD/YY`, so Pride and
Prejudice reads `01/28/13`), and the Standard Ebooks organisation cannot be
enumerated from here — repository names are derived from author and title and
then verified by asking for the cover, so a book only reaches the shelf if its
cover really answered 200. Widening the shelf means finding a reachable source
of original publication years for the other ~1,200 Standard Ebooks titles.

*Fields, and which axis is which.* A book's authorship axis is the **author**
(`d`), exactly where a film's director and a show's creator sit, so the
existing rails, facets and rabbit-hole topics needed no new code. **Series**
(`col`) comes from Standard Ebooks' own collection metadata — and only where
that metadata says `collection-type="series"`, because the same tag also
carries award lists, and taking the first one gave *Pride and Prejudice* a
series of "The BBC's 100 Greatest British Novels (2015)". 34% of books have a
series; those award sets are a good rail of their own one day, and are
deliberately unused today. **Publisher** (`br`) is an allowlist of imprints a
reader would follow (Penguin Classics, Oxford, Everyman's, Modern Library,
Vintage, Signet, Dover, Norton …), each verified against the built shelf and
dropped if it labels fewer than three books — Harper Perennial was dropped by
that rule. It is the weakest of the axes and is treated as such: this is the
*edition's* imprint, not the work's. **Related** (`r`) is co-reading computed
from 6M real Goodreads ratings, the direct analogue of TMDB's recommendation
edge. Coverage: author 100%, cover 100%, subjects 100%, related 100%, series
34%, imprint 52%.

*Copy.* US spelling throughout, matching this document rather than the
prototype's earlier drift ("favourite" is now "favorite" everywhere in the
prototype's copy). A book is a **book**, never a novel — the shelf holds
essays, poetry and memoir too, and "novels" would be both wrong and a second
word for the same thing.

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

**Measured 2026-11-18 (Claude, overnight) — "renders well with no JS" was
rendering nothing at all.** With JavaScript disabled, `ten.html` produced
**zero characters**: no heading, no list, the generic `<title>`, a white
screen. `topic.html` the same. Nothing reported it because nothing asked —
the share suite had 45 checks and not one of them turned JavaScript off.

**The prototype cannot satisfy this requirement, and that is a property of
the prototype rather than of the product.** A shared Ten travels in the query
string (`?t=…&items=…`), and a static file server never sees a query string.
The shipping page renders server-side from the `published_tens` row — which
is exactly why the schema stores `title_at_publish` — so the requirement is
owed against *that* page and is still open.

What was fixable here was the white screen, which is the one outcome worse
than a generic page: both public pages now carry a `<noscript>` that renders
the masthead, says the list is inside the link, and says to turn JavaScript
on. 458 characters on the Ten page, 440 on the topic page, in the page's own
type. No button — every destination Top Ten could offer also needs
JavaScript, and a key that opens onto another blank page is not a key.

**Open decision for Mischa.** Making the *prototype* truly no-JS means
rendering it on Vercel — an edge function reading the query string and
emitting the markup. That buys a real test of this requirement before the
backend exists, and costs a second renderer to keep in step with `share.js`;
`share.js`'s own comment is that "two renderers agree only for as long as
somebody checks". Recommendation: **don't**, until the Supabase read is being
built anyway, and then do it once, server-side, from the row. The nine new
checks in `drive_share.js` hold the floor in the meantime.

**9. Discovery.** A browse surface of topics and published Tens: trending
topics, new takes on topics you've done, and the **Consensus Ten** per topic
(computed per the object model) presented as its own artifact ("The people's
Tarantino Ten"). Entering any topic shows the consensus, notable takes, and
the ever-present "Make yours" action.
- Acceptance: every discovery card leads to either a Ten page or a topic
  page; consensus recomputes on publish (eventual, ≤1 min lag acceptable);
  empty topics (n=1) suppress consensus and show the lone take.

**Built 2026-11-18 (Claude, overnight) — the topic page, and the middle step
that was missing.** Every route into a topic went straight to the build
screen: the rising chips, the weekly pick, the suggestion cards. So the only
way to find out what *"Top 10 Westerns"* is was to start making one and read
the shelf — **a browse gesture answered with a commitment**.

The topic page is what a chip opens now. It carries, in this order: the
topic's name, how much there is to choose from, **the crowd's ten as its own
artifact** under *"What everyone picked"*, the takes on it with their badge
state, and the ever-present action.

**Only a CTA commits.** *"Make this one"* on today's pick and *"Make yours"*
on the topic page start a build; a chip and the weekly card open the topic.
That division is the rule the screen exists to establish.

**It is also where Req 10's other half finally appears.** In-app you could
compare yourself with a *person*; `shared_with_consensus` — how far you sit
from the crowd — had nowhere to show. On a topic you have made, the page says
**"You share 6 of 10 with them"**, marks those rows in the crowd's list and
prints your own rank beside each. Nought out of ten keeps the designed line
rather than an empty state (*"Not one movie in common. Incredible."*). Without
this the splash's whole argument was unfinishable: *yours will be different*
is only interesting if the app can say by how much.

**The action changes rather than disappearing.** On a topic you have already
made, *"Make yours"* becomes *"Open your Top 10 Crime Movies of the 90s"* —
the page stops being an invitation and becomes the way back.

**10. Comparison.** Viewing someone else's Ten on a topic you've completed
overlays agreement: shared picks marked, rank deltas shown ("their #1 is
your #7"), a headline stat ("You share 6 of 10"). This is the payoff for
remixing and the hook in every share.
- Acceptance: comparison renders in-app and on the web page (when the viewer
  arrived from a link with their own published take); zero-overlap states get
  a designed treatment.

  *Amended 2026-11-18 (Claude): the example line used to read "Not one film
  in common. Incredible." Two things were wrong with it. The noun is stale —
  books arrived on 2026-08-15 and the app has read the noun from the domain
  (`domainMeta(topic).one`) ever since, so it says "movie", "show" or "book".
  And it implied one string across both surfaces, which is not what shipped
  and should not be: the app compares you with **the crowd** ("Not one movie
  in common. Incredible.") and the web page compares you with **a person**
  ("Not one pick in common. Someone is wrong."). Two jokes, because they are
  two different arguments. The requirement is a designed treatment, which
  both have; the exact wording lives in `specs/design.md`.*

**Tested 2026-11-18 (Claude, overnight) — the web half had never been
checked.** `compareBlock` and the `your #n` rows have run on every shared
link since August with **no assertion of any kind** over them. Seventeen
checks now cover five of ten, none of ten, all ten, and no-take-at-all.

The fixture is built so it can fail: the reader's five are the sender's top
five **in reverse**, so `your #n` cannot be read off the row it sits on. The
obvious fixture — same five, same order — passed against a renderer printing
the row's own rank straight back, which is what the falsification pass
proved by making exactly that change.

**11. Profile — the Badge Case.** A user's profile is their shelf of
completed Tens shown as badges (the Badge Case), plus their takes. Own
profile shows drafts. Public profile shows published Tens only.
- Acceptance: badge case is the profile's hero; tapping a badge opens the
  Ten; drafts never visible to others.

**Built 2026-11-18 (Claude, overnight) — and the hole it closed was bigger
than the requirement.** Until this screen existed, a finished Ten was
**unreachable the moment you left the screen that announced it**. `S.done`
was read twice in the whole prototype — to gate other people's badges and to
aim the daily pick — and never rendered. An app whose stated job is *"define
yourself through your favourites, and be seen doing it"* had nowhere to see
what you had made.

Decisions taken in building it:

- **The badges are the page.** Req 11 says the case is the profile's hero, so
  the grid is made of badges at 112pt with the list name underneath. A row
  layout with a thumbnail would have made the badge a caption on something
  else.
- **Every badge in your own case is revealed.** The lock in Req 12 is about
  *other people's*; gating a reader from their own badge is the mechanic
  pointed the wrong way.
- **The inscription is not repeated under the badge.** It is already struck on
  the badge's ribbon. Printing it twice was the first build and it read as a
  duplicate, not as a caption.
- **Newest first.** A case that grows downward buries the thing you just made.
- **No handle, no account.** The prototype is local-first (Req 7) and
  publishing is what introduces identity. Inventing a name for a device would
  be the same fiction the seed-source decision threw out the same morning.
  The handle appears when accounts do — `TopTenKit/Handle.swift` already
  generates them.
- **The case is a hub, not a trophy shelf.** Opening one of your own leads to
  the other takes on that topic — *"Your badge opened all 2 the moment you
  finished"* — because a list of your own that does not lead back to the
  argument it is part of is the product with its engine removed.
- **Two entry points, neither in the topbar.** From the screen that just gave
  you a badge, and from the foot of discovery: other people's, then yours.
  The build screen's topbar is deliberately left alone — a 44pt control beside
  a criteria name takes a quarter of the column, which is why "Start over"
  was moved off it in the first place.
- **It counts something real.** *"Between them they have opened 4 of other
  people's"* is computed from the gate, and it is the one place Req 12's
  retroactive half is countable rather than merely asserted.

**12. The reveal gate.** On someone else's published Ten, their badge appears
**locked** (present, desirable, obscured). It unlocks — for you — when you
complete your own take on that topic. Unlocking notifies nothing in P0 but
records the remix edge; your take then appears in that topic's takes and in
the original's remix lineage.
- Acceptance: locked badges are visually consistent everywhere (app + web);
  completing a remix unlocks the original's badge immediately and
  retroactively (all previously-locked badges on that topic unlock at once);
  the gate never blocks viewing the *list itself* — only the badge.

**Amendment 2026-08-15 (Mischa, round 5 on the prototype) — discovery leads
with the LIST, and a list's name is generated, never typed.**

The discovery screen is called **"Other Top 10 Lists"** and carries no
explanatory line under its title: the cards below it already show what the
screen is, and a paragraph that describes them only pushes the first one down
the page.

**1. The list name is the card.** A card led with *"Sam · Crime films"* — a
person and a category, in that order, in one undifferentiated line. A list is
the artifact here (design.md's core insight), so the **name is the only
display-size type on the card** (22pt serif); the topic sits above it as an
11pt label and the creator below it as a 12pt byline. You should be able to
read a screen of these and know which lists you want before you have read a
single name of a person.

**2. A list's name is its criteria. User-entered free text is deliberately
excluded.** No-free-text is Mischa's product decision rather than a technical
one: a free text field on a social surface is a moderation and safety surface
— it invites the work of policing names, images and abuse, and it buys nothing
this product needs, because the app already knows more about the list than the
author would bother to type.

**Amended 2026-08-15 (Mischa), reversing this section's first answer.** The
generator described here read a finished ten and made a *claim* about it —
*"Everything Hitchcock touched"*, *"The 90s did it better"*. Every such name
was true, and every one of them was the wrong kind of thing. A list is named by
the **criteria all ten of its entries satisfy**:

> Top 10 Crime Movies of the 90s · Top 10 Sci-Fi Franchises · Top 10 Miyazaki
> Movies · Top 10 Hitchcock Thrillers · Top 10 Al Pacino Movies · Top 10 Eddie
> Murphy Comedies

A name is therefore a **rule, true of 10 out of 10** — not because anything
re-checks it after the fact, but because the rule is exactly what filtered the
shelf the list was built from. Naming and scoping are the same act. A list
called *Top 10 Crime Movies of the 90s* that holds four crime movies from the
1990s is not a badly-named list; it is a different list wearing the name.

**The fraction is a REASON, and reasons live on the completion screen.** The
census this section used to name lists with is still exactly the right input
for deciding *which list to offer someone next* — it was only ever pointed at
the wrong output. Where the old generator would have titled a list *"The 90s
did it better"*, the completion screen now offers:

> **Top 10 Crime Movies of the 90s**
> 4 of your 10 were crime movies from the 90s.

The name is the rule; the fraction is why we are suggesting it. Keeping those
two apart is the whole of the amendment, and the harness asserts a reason never
contains the name it justifies.

**A criteria name is a promise the next screen has to keep, so an unfillable
list is never offered.** *Top 10 Hitchcock Thrillers* is a perfectly good name
for a list this collection cannot supply — it holds eight. Every offered
topic is gated on **≥10 candidates** matching its criteria. This is a real
gate with real refusals, not a formality: on the 2,700-title collection it
passes Crime-of-the-90s (54) and Miyazaki (11), and refuses Hitchcock thrillers
(8) and Eddie Murphy comedies (6). It also caught a live bug — a decade
arriving as the string `"1990"` made every decade-scoped list silently empty,
and the gate is what made the silence audible.

**Shortening a name is the one judgement in it.** *Alfred Hitchcock* becomes
*Hitchcock* because that is the list people ask for; *Eddie Murphy* stays whole
because Cillian and Ryan Murphy are also on the shelf, and *Hayao Miyazaki*
stays whole because Goro is. The deterministic rule is surname-if-unique, with
particles kept attached (*Robert De Niro* → *De Niro*, never *Niro*).

**Where Foundation Models fit.** Unchanged in shape, changed in job. The model
no longer chooses among candidate *names* — there is nothing to choose, since
the criteria name themselves. It chooses **which criteria are worth offering**,
and may shorten a name the way a person would. It never writes one, because a
written name can be false while a rule cannot. The deterministic namer is the
floor and is what ships first.

**3. Nothing on a card is a description.** The hand-written character lines
("Argues about endings.") are gone from the prototype entirely — they were the
only user-shaped text on the surface and they modelled a field that will not
exist.

**4. One CTA per card, and it says what it does.** The action was a floating
line of grey text between the posters and the card's edge, reading as neither
label nor button. Each card now carries exactly one control — a full-width
48pt pill, *"Read Sam's Top 10"* — and the gate is stated separately as a
**status**, not a second verb: the badge's plate in `status.locked` wearing a
lock, "BADGE LOCKED", and the one sentence that opens it ("Unlocks when you
make your own Crime films Ten"). Unlocked, the same row shows the real badge
and says so. A status and an action competing as two verbs on one card is what
made the old one unreadable.

- Acceptance (added): every discovery card's list name renders larger than its
  creator's name; no card carries a description line or any user-entered text;
  each card has exactly one action, ≥44pt, fully inside the card, whose label
  states the action; the locked state names both the lock and its key.
- Acceptance (amended 2026-08-15): every list name is its topic's own name and
  begins *"Top 10 "*; every one of a list's ten entries satisfies the criteria
  that name it; no two different topics render to the same name; no topic is
  offered whose criteria the collection cannot fill ten times; and no
  suggestion's reason contains the name of the list it is offering.

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
- **More domains:** music (Apple Music API — native, artwork-rich), games;
  each is a catalog adapter + topic seeds. (Books moved out of P1 and into the
  built set on 2026-08-15 — see the Requirement 6 amendment for what that
  shelf is and is not.)
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

## Answered

- **[Product] Identity model** — *answered 2026-08-15 (Mischa): **handles are
  generated, changeable later.*** Everyone gets a readable handle at publish
  time and nobody is asked to invent one. The reasoning is about where the cost
  falls: a chosen handle puts a form and a uniqueness check in front of the
  single action the product is for, at the exact moment somebody has just
  finished a Ten and wants to send it. Renaming is a settings screen somebody
  can want later. Implemented as `TopTenKit/Handle.swift`, whose validity rule
  is the same rule as the database's `handle_shape` constraint — a client that
  can mint a handle the database refuses is a client that fails at publish.
- **[Data] Analytics** — *answered 2026-08-15 (Mischa): **aggregate,
  server-side.*** Counts of publishes, remixes and completions; no per-person
  event stream, no third-party SDK, no identifiers leaving the device.
  `supabase/migrations/0002_aggregate_stats.sql` implements it as **views over
  rows that already exist**, so there is no counter to keep in step and nothing
  that can drift from what it summarises. A day is the finest bucket, because
  an hour-by-hour series over a small user base is a per-person event stream
  wearing a timestamp. This makes the Success Metrics section measurable.
- **[Infra] The Supabase project** — *answered 2026-08-15 (Mischa): **he
  creates it, Claude writes the client.*** See `supabase/README.md` for exactly
  what is needed. The migration is written and tested; applying it needs a
  dashboard this environment cannot reach.

- **[Product] Re-ranking a published Ten** — *answered 2026-08-15 (Mischa):
  **offer, never force.*** The badge persists unless membership changes or ≥3
  items move ≥3 slots, and then regeneration is offered rather than applied.
  Implemented as `TopTenKit/BadgeEligibility.swift`, not as prose: "significant
  change" is a phrase two people read two ways. See badges.md.
- **[Product] The user-facing voice** — *answered 2026-08-15 (Mischa): **"Top
  10", in digits, everywhere a person reads it.*** AGENTS.md's earlier locked
  example ("What's your Ten?") is superseded; "Ten" stays in the specs and in
  type names, where it is a term rather than copy.
- **[Product] Fixture people on the discovery screen** — *answered 2026-08-15
  (Mischa): keep them as obvious fixtures.* First names, generated lists, and
  the app never implies they are real accounts. Revisit at M5, when there are
  real published Tens to show instead.

## Open Questions

- **[Product]** Can you view the *full list* of someone's Ten before making
  yours, or tease only the top 3 + badge? Current call: full list visible,
  only the badge gated (Req 12) — revisit if remix conversion underwhelms.
- **[Legal]** TMDB non-commercial licence is load-bearing for "no
  monetisation." P1 badge premium tier conflicts with it — resolve before
  any paid feature.

## Phasing

See `KICKOFF.md` for the milestone plan (M0–M6). P0 requirements 1–8 are the
launchable core ("make, reveal, share"); 9–12 complete the social loop;
13–14 are continuous gates, not phases.

## The first screen is a wall of other people's lists, and it moves (2026-11-18, Mischa)

**Supersedes the two sections below in FORM, not in argument.** What the
splash claims is unchanged and was settled on 2026-11-17: the first screen
shows other people's ranked tens rather than explaining a rule, and it is
attributed to a crowd rather than to a stranger. What changed is that one
list inside a card was the wrong way to show it.

**Decision.** The splash is a full-bleed wall of four lists, drifting
sideways on its own, with the question, a tagline, one CTA and the price
promise over it. Each row is one list: a name plate — `TOP 10` over the rest
of the list's real name, over "From N+ Top 10s" — followed by that list's ten
posters in rank order, then the same again so the loop has no seam. Rows
alternate direction. Six lists are in the pool and four are on screen; which
four rotates per visit.

**Reasoning.** Mischa, having looked at the built screen: *"This What's your
top 10 page looks bad. Needs an overhaul."* Three directions were built side
by side at a real phone viewport with the real catalog — the artifact as a
stack, the artifact as a full-bleed wall, the artifact as a read list — and he
picked the wall: *"My pick is B, and the wall should auto-scroll. Can we have
a version that scrolls through custom lists in a wall-like format with big
posters?"*

The old screen's problem was not its argument but its packaging. One list
presented as an object needs a card, and a card needs a border, a caption and
a badge, and on a 393×659 phone all of that chrome left the posters at **58px
tall** — the artwork, which is the only thing on the screen doing any
persuading, reduced to thumbnails so its own frame could fit. The wall spends
that budget the other way: the posters are **155px** on the same phone, 2.7×
the area, and four lists are legible at once instead of one plus three
thumbnails.

**The name plate is the whole decision, so it has to stay on screen.** A wall
of posters says "this app has a lot of films in it", which is not a claim
worth making and not one we could honour. A wall of *named, numbered lists*
says "this app is full of other people's Top 10s", which is the product.

*Amended 2026-11-18, hours after it shipped.* The plate first LED each pass of
the strip — a name arrived, its ten drifted past, the next name arrived behind
them. Measured, that wall showed **no list name at all for 78% of the first
fifteen seconds**: ten posters is 1,110px of travel between names on a 393pt
screen, so a row carries its name about 15% of the time and a cycle is three
times longer than a look at a splash. It is **pinned to its row** now, bottom
corner, alternating side with the drift, with the posters passing behind it.
Nameless 0% of the time, three names on screen at all times. The reasoning,
the two fixes that measured worse, and the gate that now holds it are in
design.md — along with the sweep that then narrowed it to one poster wide over
four and a half rows, so the artwork gets the room back.

**The tagline is Mischa's, and its number is a placeholder with a condition
on it.** *"The tag line should be '5000+ lists from the community. Share
yours.'"* It renders as **"5,000+ lists from the community. Share yours."** —
the separator is ours, because every other round figure in the app goes
through `roughly()` and comes out punctuated, and one bare number on the first
screen would be the odd one out.

*He wrote "from other users" first and revised it to "from the community" the
same day.* That is not the reversal it looks like against the seed-source
decision above, which weighed "From the community" as an **attribution** and
rejected it for being unarguable — you cannot disagree with an average, only
sit above or below it. This is an **aggregate**, not an attribution: it says
how much is here, and no list on the screen claims to have been made by a
crowd. Every row still names a real topic and the discover cards still say
what each list is. The other objection raised there — "a lie at zero users" —
is the launch blocker below, and it binds either wording.

The figure itself is a claim about a corpus that does not exist. It is the
single invented number on the screen and it is held in one named constant,
`CORPUS_CLAIM`. **It is a launch blocker:** before the app is in front of
anybody who is not us, that number is read from `select count(*) from tens
where published`, or the sentence loses its number. Shipping "5,000+ lists"
over an empty database is the one thing on this screen that would be a lie
rather than a fixture, and the seed-source decision taken the same morning
already refused to invent counts for the discover screen.

**Mischa's two examples are not shapes the namer can make.** He wrote "top 10
crime thrillers" and "top 10 disney animated". A topic narrows by exactly one
genre, and a studio is not a facet at all — `{studio: 'Walt Disney Pictures'}`
falls through to "Top 10 Movies of All Time". The two nearest real lists lead
the pool instead ("Top 10 Crime Movies of the 90s", "Top 10 Animated Movies of
the 2000s"), and the gap is recorded here rather than papered over with a
hand-typed title nothing in the app could produce. **Two facets worth having
next**, in this order: a second genre ("Crime Thrillers"), which the shelf
filter already supports and only the namer lacks; and `studio`, which needs a
field TMDB does supply and would open the whole "Disney animated / A24 / Studio
Ghibli" family of lists people actually name out loud.

**Acceptance:**
- Four and a half rows, each one list: a plate carrying `TOP 10` over the
  list's own name and nothing else, pinned to the row and occupying **a whole
  poster slot** — one poster wide, the full height of the row — then ten
  posters ranked 1–10, twice. The half row is a peek,
  faded out, and goes on a screen under 620pt.
- **At least three posters cycling in each row** (Mischa, 2026-11-18), which
  is what sets both the plate's width and the row count.
- **A list name is readable at every moment**, and more than one on average —
  sampled over the first eight seconds, not inferred from a screenshot.
- The strip's two copies are the same width to within a sub-pixel, so the
  −50% loop has no visible seam.
- The wall runs to all four edges at every supported size, and the whole
  splash fits the smallest supported iPhone (375×553) with the CTA on screen
  and nothing scrolling.
- It drifts without being touched, alternate rows in opposite directions, and
  **Reduce Motion stops it** on a still frame that is every row's name legible
  in full.
- Every word on the screen clears WCAG AA against the brightest artwork that
  could be behind it, measured as rendered pixels with the posters forced to
  white — not modelled.
- Every list in the pool reaches the wall across successive visits, and none
  of their names is cut off in its plate.
- The splash makes no API call.

**What this supersedes.** The hero card (`.hero-ten`), its 5×2 grid, its
locked badge and the tap-to-swap strip of three mini tiles below it, all
agreed 2026-11-17 and 2026-11-18. The *arguments* in the two sections below —
crowd not stranger, topics not people, show don't explain, the price promise
as fine print, the one-line rule, no Skip — all still hold and all still have
tests. The locked badge on the splash is the one mechanic that goes with the
card: it survives everywhere else it already lives (Req 12, the discover
cards, the share pages), and the splash simply stopped being a place that
shows a badge.

## The first screen shows the crowd's verdict, not a stranger's taste (2026-11-17, Mischa)

**Amends the decision below, the same day.** The first build of this screen
put a fictional person's list on it — "Sam's Top 10 Crime Movies of the 90s" —
and Mischa asked the three questions that killed it: *who is Sam, why do I
care about his Top 10, and why would that make me want to make my own?*

There is no good answer, and the failure is in the analogy. The Letterboxd
Top 4 works because it sits on the profile of somebody you already follow;
identity-density only pays off once identity is attached. On a cold first
screen a stranger's byline is not an asset, it is noise with a possessive
apostrophe.

So the hero is **the consensus Ten for a topic**, labelled with where it came
from ("From 5,000+ Top 10s"), and the three questions answer themselves:

- **Who is it?** Not a person — everyone. The thing only this product can
  show, and the thing that gets better as the product grows.
- **Why care?** A stranger's taste is noise; a crowd's ranking is a *claim*,
  and the reaction we want is disagreement. Nobody argues with somebody's
  taste. Everybody argues with a ranking that presents itself as definitive.
- **Why make my own?** Because `shared_with_consensus` can then tell you
  exactly how far from the crowd you are, and that number does not exist until
  you have made one.

  *Amended 2026-11-18 (Mischa): the sub-line that said this out loud —*
  *"Yours will be different. See how."* — *is cut. "It's not needed."* The
  screen makes the argument without a sentence about it: a stranger's ranked
  ten, four more lists you can swap into its place, and a headline asking what
  **yours** is. A line explaining a screen that explains itself is the same
  cost the blurb above the discovery cards was removed for on 2026-08-15. The
  assertion in `drive.js` went with the copy — a suite that still demands a
  line the product has deliberately dropped is a suite arguing with the
  product.

**The badge on the hero is LOCKED**, which is the mechanic the product already
runs on (Req 12): you cannot see what was earned on a topic until you have
your own take on it. On the splash it turns the artifact into a door.

  *Amended 2026-11-18 (Mischa): the hero is gone and the badge goes with it —*
  *see "The first screen is a wall of other people's lists" above. The locked
  badge is unchanged everywhere it still lives: the discover cards, the share
  pages, Req 12. The splash simply stopped being a screen that shows one list
  as an object, so there is no artifact on it for a badge to sit on.*

**The strip underneath is other TOPICS, not other people.** A cold visitor is
choosing an argument to join, not a person to follow. *(2026-11-18: the strip
is now the wall's other rows, and the rule is unchanged — every row is a
topic, and the only name on the screen is the crowd's.)* People belong on this
screen later, in one case specifically: a visitor arriving from a shared link
should see *their friend's* Ten with the byline intact, because then the name
is the whole point. That is the referred-visit splash and it is not built yet.

**Fixture honesty.** The voter count is invented and marked as a fixture in
the code. The prototype has seven fictional people, two of whom share this
topic; "according to 2 people" would have had Mischa judging the fixture
instead of the design.

## The browse screen opens on Popular, and "recent" means recent AND seen (2026-11-17)

Two rows lead the browse screen, and both were wrong.

**Order.** It opened on "Recent releases". The topic is "Top 10 Movies of All
Time", and the first row has to make somebody want to start picking — which
means films they already have opinions about, not this month's. Popular leads
now: Interstellar, Inception, The Avengers, The Dark Knight. Recent follows.
Measured, the two do not overlap at all in their first twenty: all-time reach
and three-year reach pick different films.

**Contents.** "Recent releases" sorted by year and then by reach, which is not
a tie-break — strict year order put the whole of 2026 ahead of the whole of
2025, so the app opened on Project Hail Mary, Obsession, Michael, Disclosure
Day and Backrooms: five films almost nobody has seen yet, as the first thing
anyone saw. The comment above the code already said what it should have done
("a 2026 release with nine votes is not a release anybody is looking for");
the code did the opposite of its own comment. It is now a three-year window
ordered by reach — Deadpool & Wolverine, Dune: Part Two, Inside Out 2, The
Substance, Superman, Sinners. Recent AND recognisable, which is what the row
always claimed to be.

A row's NAME cannot catch this, so the suite now checks its CONTENTS: the
first six cards of each opening row must clear a reach floor. Falsified by
restoring the year sort and watching it report 2,822 votes.

## The discover card leads with an argument, not a byline (2026-11-17)

**The same three questions, one screen later.** The splash decision above
removed the stranger from the FIRST screen. It left him on the discover
screen, where every card read:

> **Top 10 Crime Movies of the 90s**
> A Top 10 by Sam

— which is the exact framing the splash had just rejected, two taps further
in. The screen was contradicting its own opening.

Discovery is different from the splash in one way that matters: here the
person's list IS the content, so it cannot be replaced by the crowd. But the
byline still cannot carry the card, because on day one there is no social
graph and dressing one up — follower counts, bios, badges nobody earned —
would be faking the thing the product has to go and build.

**So the card leads with a claim drawn from the list, and the name becomes
attribution rather than the headline.** Two forms, both derived:

| when | the line | why |
|---|---|---|
| no take of your own on this topic | *"Nour puts Vertigo above Psycho."* | Where they depart from the crowd is the most arguable thing about a list — a sentence with a reply, and the reply is a Ten. |
| you have a take | *"You and Sam agree on 6 of 10."* | The best line in the product, and it was one screen too deep. Nought out of ten gets its own wording. |

The three questions now answer themselves on this screen too:

- **Who is Sam?** Someone who ranked these. Deliberately thin — the name is
  attribution, and it earns weight later, when there is a real graph behind it.
- **Why care?** Because the card states something about a thing you have
  opinions about. Taste is noise; a ranking is a claim.
- **Why make my own?** Because the card has just told you something about
  your own taste that you cannot check any other way — and once you have a
  take, every card on that topic turns into a number.

**No free text, still.** Every claim is generated from the list; `drive.js`
asserts each one matches one of the three shapes the generator can produce,
which is a stronger guard than the paragraph-count proxy it replaced — a
hand-written sentence fails it.

**A fixture fix came with it.** The stand-in people ranked their whole shelf
by rating average, and average is not reach: an obscure title with eleven
generous votes outscored a famous one, so Rae's card read *"Rae puts Teach
You a Lesson above Game of Thrones"* — not a claim anybody can argue with,
because nobody has heard of it. Their lists are now drawn from the 60
best-known titles on the topic and ranked by rating within that, which is
what a person's list looks like: titles you recognise, in an order you would
fight about. It reads *"Rae puts Chernobyl above Game of Thrones"* now.

## The first screen shows somebody's Ten, not the rules (2026-11-17, Mischa)

*(Superseded the same day by the section above — the structure survives, the
byline does not.)*

**Decision.** The splash opens on a real, complete, ranked Top 10 — byline,
badge and all ten posters — with a strip of other people's lists beneath it,
then the headline and one CTA. The three bullets that explained the limit, the
badge and the price are gone; the price promise survives as one line of fine
print under the button.

**Reasoning.** The trigger was the Letterboxd sale: The New York Times entered
advanced talks at roughly $330 million in November 2026, after A24, Sony and
the Times had all registered interest in September. Three buyers with nothing
else in common valued the same asset, and none of them wanted the tracking
app — they wanted the community that forms around curated lists.

The mechanism underneath that is not onboarding, it is the **shareable
artifact**. Letterboxd's "Top 4" — four posters on a profile — is the most
imitated object in film social media precisely because it is small, visual,
identity-dense and shaped like a screenshot. People post it unprompted.

Our equivalent already existed (the Ten plus its badge, the share pages, the
OG card) and the splash was not using it. A screen that opens by explaining a
constraint is asking for compliance; a screen that opens with somebody's taste
is asking a question. Nobody downloads a list app because they want to be
limited to ten — they download it because they saw a list and thought theirs
would be better.

**What this supersedes.** The 40/40/20 splash frame (poster marquee / copy /
CTA) and its three bullets, agreed 2026-08-15. The one-line rule from that
round still applies and still has tests; the bullets it was written for do not
exist any more.

**Related decisions taken the same day (Mischa):**

- **Launch domains: movies, TV and books.** Restaurants wait. Books already
  carry a catalog of 232 titles with covers, authors and co-read edges, and
  are already offered by `otherDomains()`; restaurants need a new data source
  (Yelp or Google Places), location handling and their own licensing answer.
  Three domains ship now rather than four stalling.
- **Trending and AI editorial picks: prototype them against fixtures now**,
  the way the rest of the prototype works, rather than waiting for published
  lists. The cheapest moment to discover the design is wrong is before any
  backend depends on it.
- **Institutional seeding is a TOPIC, never a byline.** "Top 10 Movies of
  2026 — the critics' pick. What's yours?" The institution sets the prompt;
  every list in the product is still a person's own. This keeps the object
  model intact (a Ten belongs to somebody) and avoids republishing editorial
  selections we have no permission to republish — which matters more while the
  TMDB non-commercial question is still open.
