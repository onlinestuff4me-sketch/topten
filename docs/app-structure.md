# App structure: where the two jobs live

**Question (2026-11-19, Mischa):** *"How are we thinking about browsing other
people's lists relevant to you and browsing trending popular lists? What's the
structure of the app that will give the most focus to the core experience
(1. making/sharing your lists & 2. browsing other popular/relevant lists)?"*

Two named jobs. This is what the prototype does with them today, measured, and
what it should do instead.

---

## 1. What the structure is today

Twelve screens — `intro`, `build`, `cut`, `rank`, `reveal`, `done`, `discover`,
`other`, `topic`, `you`, `mine`, `pick`, `title` — and **no navigation at all.**
Every one is a push with a "Done" or a "Back" link, and the stack's floor is
whatever you did last.

### Home is a receipt

`backhome` is the app's only idea of home:

```js
case 'backhome': S.scene = (S.done || []).length ? 'done' : 'build';
```

Once you have finished a list, **home is the celebration screen of your most
recent one** — the screen whose buttons are "Watch the reveal again" and "Start
over". Both core jobs are links on that receipt.

### Each job is an escape hatch on the other's screen

| Screen | Button leading away |
|---|---|
| `discover` — "Other Top 10 Lists" | "Your own Top 10s" → `you` |
| `you` — "You" | "Other people's Top 10 lists" → `discover` |
| `done` — the receipt | "Your Top 10s" → `you` |

Neither job is anywhere. Each is a door in the other's wall.

### Making a list is two taps behind a screen about yourself

Measured by walking it: from `discover`, starting a new list is
`opencase` → `you` → `pick`. **Two taps, through a screen about you, to reach
job #1.** `data-act="pick"` appears exactly once in the whole app, on the You
screen.

### And the screen you spend the most time on has no exit but destroying your work

Every `data-act` reachable mid-draft, measured in the browser:

| Screen | Everything it can reach |
|---|---|
| `build`, 4 films into a draft | `openmap`, `restart`, `arrange`, `openten` |
| a topic page | `topicback` |
| somebody's list | `backhome`, `opencase` |

From the build screen there is **no route to browsing, to your own lists, or to
anything else.** `restart` throws the draft away. The screen where a person
spends the most time is the one with the fewest ways out.

---

## 2. Relevance is real. Trending is not.

The discovery screen opens with `whatsNext()` — three offers — and then a flat
list of other people's lists. So **it already mixes "what to make" with "what to
read"**, which is the two jobs stacked on one screen with no line between them.

Of the three offers:

- **Today's pick** is genuinely personal. `todaysPick()` reads `myLeanings()`
  and writes the reason out loud: *"Because 10 of your picks were crime
  movies."* This works.
- **This week's pick** is a seeded rotation. Fine as it is.
- **"Rising now" is not rising, and not now.** `risingNow()` scores *genres* by
  the summed TMDB vote counts of catalogue films released in the last four
  years:

  ```js
  const fresh = CAT.filter(f => f.y >= now - RISING_YEARS);
  for (const f of fresh) for (const g of f.g || [])
    score.set(g, (score.get(g) || 0) + (f.vc || 0));
  ```

  **No list anybody makes in this app moves that number.** It is the
  catalogue's popularity wearing the word "now". Renamed to **"From recent
  releases"** today (2026-11-19), which is what it measures. The honest version
  of trending needs data we do not have yet — see §5.

---

## 3. Recommendation: two tabs, and create is an action

**Two tabs, because there are two jobs and they are peers.** Mischa numbered
them 1 and 2, not parent and child. Anything other than a tab bar makes one of
them a detour from the other, which is exactly the fault above.

| Tab | Holds | Default? |
|---|---|---|
| **Browse** | Other people's lists: relevant, popular, new. §4. | Yes, once you have finished your first list |
| **Yours** | Your lists, and your ten achievements | — |

**Browse is the launch tab**, because the app has to be worth opening on a day
you have nothing to say. Making a list is a deliberate act; reading one is not.

**Create is not a tab.** A tab is a place you can *be*; create is something you
*finish and leave*. Apple's own apps put "new" in a toolbar (Notes, Reminders)
and the HIG is explicit that tabs are destinations. So: **a "Start a list"
button in the toolbar of both tabs** — job #1 becomes **one tap from anywhere**,
against two taps through an unrelated screen today.

This also fixes the trap. With a tab bar, the build screen is no longer a
dead end: the tabs are always there.

**The draft needs a home.** Today a half-finished Ten lives in `S.tray` on the
build screen and vanishes when you leave. iOS 26's `tabViewBottomAccessory` is
the Apple-blessed slot for an in-progress thing — it is where Music puts the
now-playing bar — so the draft sits there, *"Top 10 Crime Movies · 6 of 10"*,
above the tab bar, on every screen, tappable to resume. One answer to "where
did my list go", in the place the platform already puts that answer.

**No tabs before the first finished list.** The locked decision is that you
finish the generic list first; until you have, the app is one job and the
chrome would be furniture around an empty room. Tabs appear when there is
something to put in them.

### Why not the alternatives

- **Three tabs (Browse / Create / You).** Puts an action in a destination slot,
  and promotes achievements to a peer of the two core jobs, which Mischa's own
  ordering does not.
- **One stack with a persistent Start button.** This is what we have. It makes
  browsing a modal detour from a receipt.
- **Create as the centre tab (the TikTok pattern).** Defensible, and it is the
  pattern a lot of people's hands already know. It costs the same HIG argument
  as above, and it makes the tab bar asymmetric for an ADA jury to look at.
  Worth revisiting if the toolbar button under-performs on device.

---

## 4. What Browse is: three rows, each saying why you are seeing it

The unifying rule: **every row answers "why is this in front of me".** That is
the thing the current discovery screen cannot do — its list of other people's
lists has no stated reason at all.

**1. Because of what you've made.** Roots are sets of tags (PRD Req 15), and
your finished lists carry those tags. Score every offerable root by tag overlap
with the roots you have made, drop the ones you have made, and the reason
writes itself: *"Because you made Top 10 Crime Movies of the 90s."*

This is a better signal than the one `todaysPick()` uses today. `myLeanings()`
reads the genres of the **films you picked** — an inference about you. The
**roots you chose** are a deliberate statement. Both are free; the root is the
stronger of the two, and it arrives with the tag model we just built.

**2. Popular.** Roots ranked by how many finished lists they hold. A count, not
a rate.

**3. New rooms.** Roots one person has started that nobody has answered yet.
This row does double duty: it is the inventory for the **First Here**
achievement, and it is what gives **Started Something** anything to measure.

**Trending is a fourth row and a different sum.** Popular is a count; trending
is a ratio — lists started this week over the root's all-time baseline. A root
with 200 lists and 3 this week is not trending. One with 12 all-time and 9 this
week is. Conflating them is how a "trending" row ends up showing the same six
things for a year.

---

## 5. What can actually be built, and what cannot

| Row | Needs | Buildable now? |
|---|---|---|
| Because of what you've made | your own lists + a root index | **Yes.** On device, no account. |
| Popular | published-list counts per root | No — needs the database |
| New rooms | publish timestamps, first-author | No — needs the database |
| Trending | publish timestamps + baseline | No — needs the database |

**One of the four.** The other three are fixtures until Supabase holds published
lists, and the prototype should say so in its own copy rather than compute a
number from TMDB and call it "rising" — which is the exact mistake corrected in
§2.

This also raises the priority of the migration already owed: `0001_init.sql`
still carries `badges` and `topic_unlocks` tables for the system retired on
2026-11-18, has no achievements table, and has no per-root list counts or
timestamps — which is to say it cannot answer three of the four rows above.
**Three of the four Browse rows and the achievement set are blocked on the same
migration.**

---

## 6. Open, for Mischa

A tab bar is a structural decision, not a tweak, so nothing here is built
beyond the honest-copy fixes in §2. The question on the table is §3: **two
tabs, Browse as the launch tab, create as a toolbar action on both.**
