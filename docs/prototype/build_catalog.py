"""Build the prototype's baked catalog from TMDB.

THIS IS STAGE ONE OF THREE. Run all three, in order:

    python3 build_catalog.py    # films: ids, titles, genres, poster colours
    python3 enrich_catalog.py   # sv (services), ca (cast), r (recommendations)
    python3 build_tv.py         # the second shelf, appended to the same file

Stopping after this one produces a catalog.js that loads without complaint and
is missing cast, recommendations, streaming availability and every TV show —
so the actor filter, `See similar` and the services filter are all silently
dead, and the TV domain is empty. It looks fine. It parses fine. Ask how it was
built before trusting it (learned the hard way, 2026-08-16).

Writes docs/prototype/catalog.js. The key is used here, at build time, and is
never shipped: the prototype ships with the data already in it, so the page
needs no API key and works on a plane.

For each film we keep the dominant poster colour, computed from the real
artwork, so badge palettes in the prototype genuinely derive from the Ten's
posters (specs/badges.md, "Field") rather than being decorative.

Selection philosophy (unchanged in kind, widened in scale — 2026-08-15):

  1. **Canon-weighted, not popular.** Everything is ranked by `standing`,
     rating blended with vote count, and the top TARGET survive. Raw
     popularity would fill the shelf with whatever opened this month, which
     is the wrong prompt for "your ten favourite films of all time".
  2. **The whole eligible universe is the candidate pool.** TMDB holds ~9,300
     films with 400+ votes; sampling a few hundred of them by genre page was
     an approximation of "the canon" that we no longer need to make — the
     complete sweep is 466 requests. The genre/keyword/company sources below
     are kept on top of it, both as redundancy against discover's deep-paging
     gaps and because they document which clusters the prototype needs dense
     enough for "three of your ten are heists" to fire.
  3. **Named canon is PINNED.** The by-name list exists because standing
     buries these films; leaving them to compete against standing therefore
     defeated the list — 17 of the 49 named titles were trimmed out of the
     620-film build, including The Master, Drive My Car and Past Lives. Named
     titles now skip the trim. That is the only hand in the ranking.
  4. **Full filmographies for directors who appear more than once.** A rabbit
     hole into a director is worthless if their work is missing.
  5. **A per-genre floor by reach.** `standing` is an acclaim score and acclaim
     is not evenly distributed across genres — comedies and horror rate below
     dramas — so a single global cutoff under-selects them. Each primary genre
     therefore also admits its most-rated films outright. This is why Zoolander
     and Borat were absent: not buried in a row, never on the shelf.
"""

import colorsys
import math
import io
import json
import os
import unicodedata
import urllib.parse
import urllib.request
from collections import Counter
from concurrent.futures import ThreadPoolExecutor

from PIL import Image

KEY = os.environ["EXPO_PUBLIC_TMDB_API_KEY"]
API = "https://api.themoviedb.org/3"
IMG = "https://image.tmdb.org/t/p"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "catalog.js")

TARGET = 2000          # films on the shelf (Mischa, 2026-08-15: 620 was thin)
VOTE_FLOOR = 400       # a film nobody voted on is not a candidate for a Ten
EXPAND_FLOOR = 250     # …but a named director's lesser work still belongs
CANON_FLOOR = 150      # …and a named film is named because votes bury it
WORKERS = 16           # TMDB tops out around 25 req/s from here either way


def get(path, **params):
    params["api_key"] = KEY
    url = f"{API}{path}?{urllib.parse.urlencode(params)}"
    for _ in range(3):
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                return json.load(r)
        except Exception:
            pass
    return {}


def dominant_colour(poster_path):
    """Most-common saturated hue in the poster, returned as hex.

    Posters are mostly dark or desaturated, so a plain average turns
    everything to mud. We quantise, throw away near-black/near-white/grey,
    and take the most common remaining bucket — then normalise it into
    Laurel-safe territory (badges.md caps L and C so a badge can never come
    out fluorescent).
    """
    try:
        with urllib.request.urlopen(f"{IMG}/w92{poster_path}", timeout=30) as r:
            im = Image.open(io.BytesIO(r.read())).convert("RGB").resize((23, 34))
    except Exception:
        return None

    buckets = Counter()
    for r_, g_, b_ in im.getdata():
        h, l, s = colorsys.rgb_to_hls(r_ / 255, g_ / 255, b_ / 255)
        if s < 0.18 or l < 0.12 or l > 0.92:
            continue
        buckets[(round(h * 24), round(s * 4), round(l * 4))] += 1

    if not buckets:
        return None

    (hb, sb, lb), _ = buckets.most_common(1)[0]
    h = hb / 24
    s = min(max(sb / 4, 0.35), 0.72)   # keep chroma in a printable band
    l = min(max(lb / 4, 0.30), 0.62)   # L 30–62%, roughly badges.md's L 25–75
    r_, g_, b_ = colorsys.hls_to_rgb(h, l, s)
    return "#%02X%02X%02X" % (round(r_ * 255), round(g_ * 255), round(b_ * 255))


def director(movie_id):
    """Name AND TMDB person id, from the one credits call.

    The id comes free in the crew row, so the filmography expansion below no
    longer needs a /search/person round trip per name — which also removes the
    chance of expanding the wrong Michael Bay."""
    crew = get(f"/movie/{movie_id}/credits").get("crew") or []
    for c in crew:
        if c.get("job") == "Director":
            return c.get("name"), c.get("id")
    return None, None


def slug(s):
    """Accent- and punctuation-insensitive title key, so the named-canon list
    can be written in ASCII and still match 'Y Tu Mamá También'."""
    s = unicodedata.normalize("NFKD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c))
    return " ".join("".join(ch if ch.isalnum() else " " for ch in s.lower()).split())


# --- 1. the eligible universe: every film with enough votes to be anyone's
# --- favourite, in one sweep, so the trim below ranks the real field.
UNIVERSE = {"sort_by": "vote_count.desc", "vote_count.gte": str(VOTE_FLOOR),
            "include_adult": "false"}
_first = get("/discover/movie", page=1, **UNIVERSE)
_pages = min(_first.get("total_pages", 1), 500)   # TMDB refuses page > 500
print(f"universe: {_first.get('total_results')} films with {VOTE_FLOOR}+ votes, {_pages} pages")

sources = [("/discover/movie", {**UNIVERSE, "page": p}) for p in range(1, _pages + 1)]

# --- 2. a spread: canon, crowd-pleasers, and enough of a few clusters that
# --- "three of your ten are heists" can actually fire in the prototype.
for page in range(1, 16):
    sources.append(("/movie/top_rated", {"page": page}))
for page in range(1, 6):
    sources.append(("/movie/popular", {"page": page}))
for kw in ("9748", "10051", "4344", "9663", "10683", "779", "818", "5565",
           "9799", "9715", "12554", "10714"):
    # revenge, heist, musical, sequel, coming-of-age, martial arts, based on
    # novel, biography, romantic comedy, superhero, dystopia, road movie
    for page in (1, 2):
        sources.append(("/discover/movie", {"with_keywords": kw, "sort_by": "vote_count.desc", "page": page}))
for company in ("41077", "420", "3", "10342", "1", "3172", "521", "6704", "2"):
    # A24, Marvel, Pixar, Ghibli, Lucasfilm, Blumhouse, DreamWorks Animation,
    # Illumination, Walt Disney Pictures — the brands enrich_catalog.py labels
    for page in (1, 2):
        sources.append(("/discover/movie", {"with_companies": company, "sort_by": "vote_count.desc", "page": page}))
for genre in ("27", "35", "878", "16", "80", "18", "12", "53", "10749", "36",
              "10752", "37", "14", "9648", "10402", "99", "28", "10751"):
    for page in range(1, 7):
        sources.append(("/discover/movie", {"with_genres": genre, "sort_by": "vote_count.desc", "page": page}))
for lang in ("ja", "ko", "fr", "it", "es", "de", "cn", "zh", "hi", "sv", "da",
             "ru", "fa", "pt", "pl", "no", "th", "tr"):
    for page in (1, 2, 3):
        sources.append(("/discover/movie", {"with_original_language": lang,
                                            "sort_by": "vote_count.desc", "page": page}))

genres = {g["id"]: g["name"] for g in get("/genre/movie/list").get("genres", [])}


def row(m):
    return {
        "id": m["id"],
        "t": m["title"],
        "y": int(m["release_date"][:4]),
        "p": m["poster_path"],
        "g": [genres.get(g, "") for g in m.get("genre_ids", [])][:3],
        "v": round(m.get("vote_average", 0), 1),
        "pop": round(m.get("popularity", 0), 1),
        "vc": m.get("vote_count", 0),
    }


films = {}
with ThreadPoolExecutor(max_workers=WORKERS) as pool:
    for payload in pool.map(lambda s: get(s[0], **s[1]), sources):
        for m in payload.get("results", []):
            if not m.get("poster_path") or not m.get("release_date"):
                continue
            if m["id"] in films or m.get("vote_count", 0) < VOTE_FLOOR:
                continue
            films[m["id"]] = row(m)
print(f"{len(films)} candidates from {len(sources)} source pages")


# --- 3. Canon that popularity sorting reliably buries. A prototype for "your
# --- ten favourite films of all time" is worthless if the rail is all this
# --- month's releases, so these are fetched by name AND exempted from the
# --- trim — see the module docstring, point 3.
CANON = (
    # The original round-3 list, unchanged.
    "Casablanca", "Hereditary", "Moonlight", "No Country for Old Men",
    "There Will Be Blood", "Vertigo", "Chinatown", "Rear Window",
    "Apocalypse Now", "Raging Bull", "Blade Runner", "Do the Right Thing",
    "In the Mood for Love", "Lawrence of Arabia", "Singin' in the Rain",
    "The Third Man", "Come and See", "Paris, Texas", "Stalker", "Rashomon",
    "The Prestige", "Dunkirk", "Oppenheimer", "Tenet", "Insomnia", "Following",
    "Heat", "The Insider", "Zodiac", "Prisoners", "Sicario", "Arrival",
    "Under the Skin", "The Master", "Phantom Thread", "Punch-Drunk Love",
    "Burning", "Portrait of a Lady on Fire", "Aftersun", "Past Lives",
    "The Zone of Interest", "Anatomy of a Fall", "Drive My Car", "Roma",
    "Y Tu Mama Tambien", "Amores Perros", "City of God", "Oldboy", "Memories of Murder",
    # Widened for the 2,000-film shelf. A bigger shelf that is still 90% post-2000
    # English-language is a bigger version of the same complaint, so the extension
    # is deliberately weighted to the eras and languages that vote counts bury.
    "Citizen Kane", "Sunset Boulevard", "Double Indemnity", "All About Eve",
    "Some Like It Hot", "The Apartment", "It's a Wonderful Life", "His Girl Friday",
    "Bringing Up Baby", "The Night of the Hunter", "Touch of Evil", "The Searchers",
    "12 Angry Men", "Paths of Glory",
    "Dr. Strangelove or: How I Learned to Stop Worrying and Love the Bomb",
    "2001: A Space Odyssey",
    "Barry Lyndon", "The Bridge on the River Kwai", "On the Waterfront",
    "Metropolis", "M", "Nosferatu", "The General", "City Lights", "Modern Times",
    "The Gold Rush", "Sunrise: A Song of Two Humans", "Battleship Potemkin",
    "The Cabinet of Dr. Caligari", "The Great Dictator",
    "Seven Samurai", "Tokyo Story", "Ikiru", "High and Low", "Yojimbo", "Ran",
    "Harakiri", "Grave of the Fireflies", "Perfect Blue", "Akira",
    "Princess Mononoke", "My Neighbor Totoro", "Spirited Away", "Only Yesterday",
    "The Tale of the Princess Kaguya", "Millennium Actress", "Paprika",
    "8½", "La Dolce Vita", "Bicycle Thieves", "The 400 Blows", "Breathless",
    "Persona", "The Seventh Seal", "Wild Strawberries", "Andrei Rublev",
    "Solaris", "Cleo from 5 to 7", "Au Hasard Balthazar", "Playtime",
    "The Rules of the Game", "Le Samourai", "Army of Shadows", "Wings of Desire",
    "The Lives of Others", "Amelie", "La Haine", "A Man Escaped",
    "Pather Panchali", "The Battle of Algiers", "Cinema Paradiso",
    "The Wages of Fear", "Rome, Open City", "L'Avventura", "Umberto D.",
    "Parasite", "The Handmaiden", "Poetry", "A Brighter Summer Day", "Yi Yi",
    "Chungking Express", "Farewell My Concubine", "Raise the Red Lantern",
    "Hard Boiled", "A Better Tomorrow", "Crouching Tiger, Hidden Dragon",
    "Infernal Affairs", "The Host", "Mother", "A Separation", "Taste of Cherry",
    "Close-Up", "Where Is the Friend's House?",
    "Central Station", "The Secret in Their Eyes", "Pan's Labyrinth",
    "Talk to Her", "All About My Mother", "The Motorcycle Diaries",
    "The Conversation", "Dog Day Afternoon", "Network", "Nashville", "Badlands",
    "The Last Picture Show", "Five Easy Pieces", "McCabe & Mrs. Miller",
    "The French Connection", "Serpico", "Midnight Cowboy", "Bonnie and Clyde",
    "Easy Rider", "Deliverance", "Straw Dogs", "The Wild Bunch",
    "Once Upon a Time in the West", "The Good, the Bad and the Ugly",
    "The Thing", "Halloween", "The Texas Chain Saw Massacre", "Rosemary's Baby",
    "Suspiria", "Don't Look Now", "Videodrome", "The Fly", "Audition", "Ring",
    "Let the Right One In", "The Witch", "It Follows", "Get Out", "Midsommar",
    "Trainspotting", "Withnail & I", "Kes", "Get Carter", "The Red Shoes",
    "A Matter of Life and Death", "Brief Encounter", "If....", "Naked",
    "Secrets & Lies", "Four Lions", "In Bruges", "Shaun of the Dead", "Hot Fuzz",
    "Mulholland Drive", "Blue Velvet", "Eraserhead", "Being John Malkovich",
    "Adaptation.", "Synecdoche, New York", "Eternal Sunshine of the Spotless Mind",
    "Her", "Ex Machina", "Whiplash", "The Florida Project", "Lady Bird",
    "Call Me by Your Name", "Manchester by the Sea", "First Reformed",
    "The Lighthouse", "Uncut Gems", "Leave No Trace", "Minari", "Nomadland",
    "Sound of Metal", "The Worst Person in the World", "Decision to Leave",
    "Perfect Days", "All of Us Strangers", "Tar", "The Banshees of Inisherin",
    "Everything Everywhere All at Once", "Poor Things", "The Substance",
    "Killers of the Flower Moon", "The Brutalist", "Anora", "Sinners",
    "Hoop Dreams", "Man on Wire", "Grizzly Man", "The Act of Killing",
    "Waltz with Bashir", "Persepolis", "The Triplets of Belleville",
    "Fantastic Mr. Fox", "The Iron Giant", "Wolfwalkers",
)


# TMDB's own title is the key we match on, but its search index cannot always
# find that title from itself: querying "8½" returns Code 8 and 8 Mile. Where
# the two differ, the search term is given here and the match still has to be
# exact — a fuzzy fallback is how you pin the wrong film.
QUERY_FOR = {"8½": "Otto e mezzo"}


def resolve(title):
    """The single film a named canon entry means, or None.

    Only an exact (accent-folded) title match is pinned; a fuzzy top hit is
    how you end up pinning the 2019 remake of something. Unmatched names are
    printed rather than swallowed — a name that stops resolving is the list
    rotting, and we want to see it."""
    want = slug(title)
    best = None
    for m in get("/search/movie", query=QUERY_FOR.get(title, title)).get("results", []):
        if not m.get("poster_path") or not m.get("release_date"):
            continue
        if slug(m.get("title")) != want and slug(m.get("original_title")) != want:
            continue
        if m.get("vote_count", 0) < CANON_FLOOR:
            continue
        if best is None or m["vote_count"] > best["vote_count"]:
            best = m
    return best


pinned = set()
unresolved = []
with ThreadPoolExecutor(max_workers=WORKERS) as pool:
    for title, m in zip(CANON, pool.map(resolve, CANON)):
        if not m:
            unresolved.append(title)
            continue
        films.setdefault(m["id"], row(m))
        pinned.add(m["id"])
print(f"named canon: {len(pinned)} pinned, {len(unresolved)} unresolved {unresolved}")


def standing(f):
    """Blend rating with how many people voted, so the catalog reads as a
    canon rather than a new-releases shelf. Raw popularity would fill the
    suggestion rail with whatever opened this month, which is the wrong
    prompt for 'your ten favourite films of all time'."""
    return f["v"] * math.log10(max(f["vc"], 10))


# --- 4. A shelf of 220 was too thin to explore: following Interstellar could
# --- not reach The Prestige, Dunkirk, Oppenheimer or Tenet because none of
# --- them were in it (Mischa, round 3). Before trimming, pull the fuller
# --- filmography of any director who already appears more than once — a
# --- rabbit hole into a director is worthless if their work is missing.
# ---
# --- Directors are resolved on a shortlist (the pinned canon plus the top
# --- 2×TARGET by standing) rather than on all ~9,300 candidates: a credits
# --- call per candidate is 6 minutes of wall clock to learn who directed
# --- films that the trim will drop anyway.
_shortlist = [i for i in pinned] + [
    fid for fid, _ in sorted(films.items(), key=lambda kv: -standing(kv[1]))[: TARGET * 2]
    if fid not in pinned]
_seed_directors = {}
_person_id = {}
with ThreadPoolExecutor(max_workers=WORKERS) as pool:
    for fid, (name, pid) in zip(_shortlist, pool.map(director, _shortlist)):
        if name:
            films[fid]["d"] = name
            _seed_directors.setdefault(name, []).append(fid)
            if pid:
                _person_id[name] = pid

_people = [pid for name, fids in _seed_directors.items()
           if len(fids) >= 2 and (pid := _person_id.get(name))]

extra = []
with ThreadPoolExecutor(max_workers=WORKERS) as pool:
    jobs = [(pid, page) for pid in _people for page in (1, 2)]
    payloads = pool.map(
        lambda j: get("/discover/movie", with_crew=str(j[0]), sort_by="vote_count.desc", page=j[1]),
        jobs)
    for payload in payloads:
        extra.extend(payload.get("results", []))
for m in extra:
    if not m.get("poster_path") or not m.get("release_date") or m["id"] in films:
        continue
    if m.get("vote_count", 0) < EXPAND_FLOOR:
        continue
    films[m["id"]] = row(m)
print(f"{len(_people)} directors expanded; {len(films)} films before trim")

# The trim: pinned canon first, then the field by standing, to exactly TARGET.
_rest = sorted((kv for kv in films.items() if kv[0] not in pinned),
               key=lambda kv: -standing(kv[1]))[: max(TARGET - len(pinned), 0)]
_cut = standing(_rest[-1][1]) if _rest else 0
_rescued = sum(1 for i in pinned if standing(films[i]) < _cut)
_kept = dict([(i, films[i]) for i in pinned] + _rest)

# --- 5. A per-genre floor, ranked by REACH rather than standing.
# ---
# --- `standing` is an acclaim score, and acclaim is not evenly distributed
# --- across genres: comedies and horror rate systematically below dramas, so
# --- a single global cutoff quietly under-selects them. That is not a
# --- ranking artefact inside a row, it is a hole in the CATALOG — Zoolander,
# --- Borat and Bridesmaids were not buried in the Comedies row, they were
# --- never on the shelf at all (Mischa, 2026-08-16).
# ---
# --- So each primary genre also gets its most-rated films admitted outright.
# --- Vote count is the closest thing TMDB has to "would you recognise this",
# --- which is exactly the axis a global acclaim cutoff is blind to.
# ---
# --- This ADDS rather than reshuffles: everything the standing trim chose is
# --- still here. The alternative — a quota that displaces acclaimed films —
# --- would re-roll the whole shelf to fix a gap at its edges.
# 100, not 40. At 40 the floor admitted Borat, Superbad, Dumb and Dumber and
# Ace Ventura but not Zoolander, which sits 93rd among comedies by vote count —
# so the first attempt fixed some of the hole and left the rest, which is worse
# than either fixing it or not, because it looks fixed.
GENRE_REACH = 100

_by_genre = {}
for _fid, _f in films.items():
    _g = (_f.get("g") or [None])[0]
    if _g:
        _by_genre.setdefault(_g, []).append((_fid, _f))

_added = 0
for _g, _pool in _by_genre.items():
    _pool.sort(key=lambda kv: -kv[1]["vc"])
    for _fid, _f in _pool[:GENRE_REACH]:
        if _fid not in _kept:
            _kept[_fid] = _f
            _added += 1

films = _kept
print(f"{len(films)} films (standing cutoff {_cut:.1f}; {_rescued} pinned titles "
      f"the cutoff would have dropped; {_added} admitted by per-genre reach "
      f"that acclaim alone would have missed); fetching colours and directors…")

with ThreadPoolExecutor(max_workers=WORKERS) as pool:
    ids = list(films)
    for fid, colour in zip(ids, pool.map(lambda i: dominant_colour(films[i]["p"]), ids)):
        films[fid]["c"] = colour or "#6E675D"
    missing = [i for i in ids if not films[i].get("d")]
    for fid, (name, _pid) in zip(missing, pool.map(director, missing)):
        if name:
            films[fid]["d"] = name

catalog = sorted(films.values(), key=lambda f: -f["pop"])

with open(OUT, "w") as fh:
    fh.write("// Generated from TMDB at build time — see scratchpad/build_catalog.py.\n")
    fh.write("// Baked in so the prototype needs no API key and works offline.\n")
    fh.write("// Data and artwork courtesy of TMDB; this product uses the TMDB API\n")
    fh.write("// but is not endorsed or certified by TMDB.\n")
    fh.write("window.CATALOG = ")
    json.dump(catalog, fh, ensure_ascii=False, separators=(",", ":"))
    fh.write(";\n")

print(f"wrote {OUT} ({os.path.getsize(OUT)} bytes)")
print("directors:", sum(1 for f in catalog if f.get("d")), "/", len(catalog))
print("decades:", sorted(Counter(f["y"] // 10 * 10 for f in catalog).items()))
print("sample:", [(f["t"], f["y"], f["c"], f.get("d")) for f in catalog[:4]])
