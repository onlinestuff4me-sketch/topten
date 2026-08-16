"""Build the prototype's baked catalog from TMDB.

THIS IS STAGE ONE OF FIVE. Run all five, in order:

    python3 build_catalog.py              films, genres, poster colours
    python3 enrich_catalog.py             cast, recommendations, raw providers
    python3 enrich_catalog.py --details   studios and collections
    python3 enrich_catalog.py --providers canonical service ids + SERVICES
    python3 build_tv.py                   the second shelf

Stopping early produces a catalog.js that loads without complaint and is
missing whole field sets — cast, recommendations, streaming availability,
studios, collections, or all 700 TV shows — so the actor filter, `See similar`
and the services filter go silently dead and a whole domain empties. It looks
fine. It parses fine. Ask how it was built before trusting it (learned the
hard way, twice, 2026-08-16).

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
  6. **A per-decade floor, for the same reason.** Vote count is not comparable
     across decades: a 1935 film loses a comparison it was never in. The audit
     found the 1930s missing 18 of TMDB's own top 40 for that decade and the
     1940s missing 16, while everything from the 1970s on was complete. Each
     decade now admits its own most-rated films.
  7. **English-language sweeps, plus four hand-written exceptions** (Mischa,
     2026-08-16). The automatic sources ask TMDB for English only. What is
     NAMED is exempt, because a language rule that overrides the only
     deliberate judgements in the build is a rule overriding the wrong thing:

         CANON             world cinema someone decided belongs
         OSCAR_ENGLISH     Best Picture winners, and nominees
         OSCAR_FOREIGN     non-English Academy Award winners, and nominees
         ENGLISH_MISTAGGED films in English TMDB tags as foreign productions

     The rule is enforced after collection as well as during it, because the
     keyword, company and genre sources take no language parameter and would
     otherwise let other languages in sideways.

     Both Oscar lists are PARTIAL and were written without a source to check
     them against — TMDB carries no awards data and wikipedia.org, oscars.org
     and wikidata.org are all blocked at this environment's proxy. Year and
     country sit beside each entry so a wrong one can be caught by reading.

`audit_catalog.py` is how any of the numbers above get checked. Every one of
them is a judgement, and until that script existed not one had ever been
measured against what it discards.
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
# English-language, by decision (Mischa, 2026-08-16): the shelf is
# English-language films plus, from every other language, the ones that won an
# Academy Award. Those arrive through OSCAR_FOREIGN below, which is exempt from
# this restriction — a rule and its stated exception, rather than a rule with a
# quietly leaky edge.
UNIVERSE = {"sort_by": "vote_count.desc", "vote_count.gte": str(VOTE_FLOOR),
            "with_original_language": "en", "include_adult": "false"}
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
# No per-language sweep any more. Non-English films reach the shelf only by
# winning an Academy Award, and they arrive by name through OSCAR_FOREIGN,
# which is resolved with the same title search the rest of the canon uses.

# --- 3. Older decades, swept on their own terms.
# ---
# --- The audit found the 1930s missing 18 of TMDB's own top 40 by votes for
# --- that decade and the 1940s missing 16, while every decade from the 1970s
# --- on was complete (2026-08-16). One global `vote_count.desc` sweep is a
# --- sweep of recent film: a 1935 release does not accumulate votes the way a
# --- 2015 one does, so it loses a comparison it was never really in.
for _d0 in range(1920, 1980, 10):
    for page in (1, 2, 3):
        sources.append(("/discover/movie", {
            "sort_by": "vote_count.desc", "with_original_language": "en",
            "primary_release_date.gte": f"{_d0}-01-01",
            "primary_release_date.lte": f"{_d0 + 9}-12-31", "page": page}))

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
        # Stored so the English-language rule can be CHECKED rather than
        # trusted. A filter whose input is not in the output is a filter
        # nobody can audit.
        "lang": m.get("original_language", ""),
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
# ── Non-English films that won an Academy Award ─────────────────────────────
#
# The shelf is English-language (see UNIVERSE). This is the stated exception:
# from every other language, the films that actually won an Oscar (Mischa,
# 2026-08-16).
#
# ** THIS LIST IS COMPILED FROM MEMORY AND WAS NOT VERIFIED AGAINST A SOURCE. **
# TMDB carries no awards data, and wikipedia.org, oscars.org and wikidata.org
# are all blocked at this environment's egress proxy — so there was nothing to
# check it against. The year and country sit beside each title precisely so a
# wrong one can be spotted by reading rather than by trusting me. Treat a
# correction as expected maintenance, not as a defect report.
#
# The rule applied is WON, not nominated. That is a harder line than it sounds:
# it excludes Seven Samurai, Amélie, City of God, Oldboy, Shoplifters and Das
# Boot, all of which were nominated and none of which won. They are absent on
# purpose.
# ── English-language Academy Award canon ───────────────────────────────────
#
# Pinned for the same reason CANON is: a shelf ranked by vote count buries
# older films, and a check found 20 of the 79 Best Picture winners missing —
# Wings, Cavalcade, Mrs. Miniver, Marty, Gigi, Oliver!, Ordinary People,
# Chariots of Fire, The Artist, Birdman among them. Not obscure films; old
# ones, which on TMDB is the same thing.
#
# Winners, then the nominees I can state with confidence. Like OSCAR_FOREIGN
# this is a list to grow rather than a claim to be complete: Best Picture
# alone has had over 600 nominees, and there is no reachable source here to
# check a longer list against.
OSCAR_ENGLISH = (
    # Best Picture winners.
    "Wings", "Cavalcade", "It Happened One Night", "Mutiny on the Bounty",
    "You Can't Take It with You", "Gone with the Wind", "Rebecca",
    "How Green Was My Valley", "Mrs. Miniver", "Casablanca", "Going My Way",
    "The Lost Weekend", "The Best Years of Our Lives", "Gentleman's Agreement",
    "Hamlet", "All the King's Men", "All About Eve", "An American in Paris",
    "The Greatest Show on Earth", "From Here to Eternity", "On the Waterfront",
    "Marty", "Around the World in 80 Days", "The Bridge on the River Kwai",
    "Gigi", "Ben-Hur", "The Apartment", "West Side Story", "Lawrence of Arabia",
    "Tom Jones", "My Fair Lady", "The Sound of Music", "A Man for All Seasons",
    "In the Heat of the Night", "Oliver!", "Midnight Cowboy", "Patton",
    "The French Connection", "The Godfather", "The Sting",
    "The Godfather Part II", "One Flew Over the Cuckoo's Nest", "Rocky",
    "Annie Hall", "The Deer Hunter", "Kramer vs. Kramer", "Ordinary People",
    "Chariots of Fire", "Gandhi", "Terms of Endearment", "Amadeus",
    "Out of Africa", "Platoon", "The Last Emperor", "Rain Man",
    "Driving Miss Daisy", "Dances with Wolves", "The Silence of the Lambs",
    "Unforgiven", "Schindler's List", "Forrest Gump", "Braveheart",
    "The English Patient", "Titanic", "Shakespeare in Love", "American Beauty",
    "Gladiator", "A Beautiful Mind", "Chicago", "The Lord of the Rings: The Return of the King",
    "Million Dollar Baby", "Crash", "The Departed", "No Country for Old Men",
    "Slumdog Millionaire", "The Hurt Locker", "The King's Speech", "The Artist",
    "Argo", "12 Years a Slave", "Birdman", "Spotlight", "Moonlight",
    "The Shape of Water", "Green Book", "Parasite", "Nomadland", "CODA",
    "Everything Everywhere All at Once", "Oppenheimer", "Anora",
    # Nominees that a vote-count shelf is most likely to have buried.
    "The Grapes of Wrath", "Citizen Kane", "The Maltese Falcon",
    "Double Indemnity", "It's a Wonderful Life", "Sunset Boulevard",
    "A Streetcar Named Desire", "High Noon", "Roman Holiday", "Sabrina",
    "12 Angry Men", "Witness for the Prosecution", "Anatomy of a Murder",
    "Some Like It Hot", "The Hustler", "To Kill a Mockingbird",
    "Dr. Strangelove", "Who's Afraid of Virginia Woolf?", "Bonnie and Clyde",
    "The Graduate", "Butch Cassidy and the Sundance Kid", "Easy Rider",
    "A Clockwork Orange", "The Last Picture Show", "Cabaret", "Chinatown",
    "Jaws", "Network", "Taxi Driver", "All the President's Men",
    "Apocalypse Now", "Raging Bull", "The Elephant Man", "Reds",
    "Raiders of the Lost Ark", "Tootsie", "The Right Stuff", "The Killing Fields",
    "Witness", "Hannah and Her Sisters", "Fatal Attraction", "Broadcast News",
    "Dead Poets Society", "Field of Dreams", "Goodfellas", "Awakenings",
    "JFK", "The Prince of Tides", "A Few Good Men", "Scent of a Woman",
    "The Fugitive", "In the Name of the Father", "Pulp Fiction",
    "The Shawshank Redemption", "Quiz Show", "Apollo 13", "Sense and Sensibility",
    "Fargo", "Jerry Maguire", "L.A. Confidential", "Good Will Hunting",
    "Saving Private Ryan", "The Thin Red Line", "The Green Mile",
    "The Insider", "The Sixth Sense", "Traffic", "Erin Brockovich",
    "Moulin Rouge!", "The Lord of the Rings: The Fellowship of the Ring",
    "The Pianist", "The Hours", "Mystic River", "Lost in Translation",
    "Sideways", "Finding Neverland", "Little Miss Sunshine", "The Queen",
    "Babel", "Michael Clayton", "Juno", "There Will Be Blood", "Milk",
    "Frost/Nixon", "The Reader", "Up in the Air", "Inglourious Basterds",
    "District 9", "An Education", "Precious", "Black Swan", "The Fighter",
    "Inception", "The Social Network", "Toy Story 3", "127 Hours",
    "The Descendants", "Hugo", "Moneyball", "The Tree of Life", "War Horse",
    "Lincoln", "Life of Pi", "Zero Dark Thirty", "Django Unchained",
    "Gravity", "Her", "Nebraska", "Philomena", "The Wolf of Wall Street",
    "Boyhood", "The Grand Budapest Hotel", "The Imitation Game", "Whiplash",
    "The Theory of Everything", "The Big Short", "Bridge of Spies",
    "Brooklyn", "Mad Max: Fury Road", "The Martian", "The Revenant", "Room",
    "Arrival", "Fences", "Hacksaw Ridge", "Hell or High Water", "Hidden Figures",
    "La La Land", "Lion", "Manchester by the Sea", "Call Me by Your Name",
    "Darkest Hour", "Dunkirk", "Get Out", "Lady Bird", "Phantom Thread",
    "The Post", "Three Billboards Outside Ebbing, Missouri", "BlacKkKlansman",
    "Black Panther", "Bohemian Rhapsody", "The Favourite", "A Star Is Born",
    "Vice", "Ford v Ferrari", "The Irishman", "Jojo Rabbit", "Joker",
    "Little Women", "Marriage Story", "Once Upon a Time... in Hollywood",
    "1917", "The Father", "Judas and the Black Messiah", "Mank",
    "Minari", "Promising Young Woman", "Sound of Metal", "The Trial of the Chicago 7",
    "Belfast", "Don't Look Up", "Drive My Car", "Dune", "King Richard",
    "Licorice Pizza", "Nightmare Alley", "West Side Story",
    "All Quiet on the Western Front", "Avatar: The Way of Water",
    "The Banshees of Inisherin", "Elvis", "The Fabelmans", "Tár",
    "Top Gun: Maverick", "Triangle of Sadness", "Women Talking",
    "American Fiction", "Anatomy of a Fall", "Barbie", "The Holdovers",
    "Killers of the Flower Moon", "Maestro", "Past Lives", "Poor Things",
    "The Zone of Interest", "The Brutalist", "A Complete Unknown", "Conclave",
    "Dune: Part Two", "I'm Still Here", "Nickel Boys", "The Substance",
    "Wicked",
)

# Films in English that TMDB tags as a foreign PRODUCTION. `original_language`
# records where a film was made, not what is spoken in it, so these would be
# deleted by the letter of "English-language films" against its plain meaning.
# Kept deliberately short: each entry is a claim that a specific film is in
# English despite its tag, and a list like this earns its keep only while every
# line can still be checked by reading it.
ENGLISH_MISTAGGED = (
    "Léon: The Professional",   # tagged fr — French production, English film
    "The Fifth Element",        # tagged fr — likewise
)

OSCAR_FOREIGN = (
    # Best International Feature Film (and its predecessors), by ceremony year.
    "Shoeshine",                        # 1947 Italy (honorary)
    "Monsieur Vincent",                 # 1948 France (honorary)
    "Bicycle Thieves",                  # 1949 Italy (honorary)
    "Rashomon",                         # 1951 Japan (honorary)
    "Forbidden Games",                  # 1952 France (honorary)
    "Gate of Hell",                     # 1954 Japan (honorary)
    "La Strada",                        # 1956 Italy
    "Nights of Cabiria",                # 1957 Italy
    "Mon Oncle",                        # 1958 France
    "Black Orpheus",                    # 1959 France/Brazil
    "The Virgin Spring",                # 1960 Sweden
    "Through a Glass Darkly",           # 1961 Sweden
    "Sundays and Cybele",               # 1962 France
    "8½",                               # 1963 Italy
    "Yesterday, Today and Tomorrow",    # 1964 Italy
    "The Shop on Main Street",          # 1965 Czechoslovakia
    "A Man and a Woman",                # 1966 France
    "Closely Watched Trains",           # 1967 Czechoslovakia
    "War and Peace",                    # 1968 USSR
    "Z",                                # 1969 Algeria/France
    "Investigation of a Citizen Above Suspicion",  # 1970 Italy
    "The Garden of the Finzi-Continis", # 1971 Italy
    "The Discreet Charm of the Bourgeoisie",  # 1972 France
    "Day for Night",                    # 1973 France
    "Amarcord",                         # 1974 Italy
    "Dersu Uzala",                      # 1975 USSR
    "Black and White in Color",         # 1976 Ivory Coast
    "Madame Rosa",                      # 1977 France
    "Get Out Your Handkerchiefs",       # 1978 France
    "The Tin Drum",                     # 1979 West Germany
    "Moscow Does Not Believe in Tears", # 1980 USSR
    "Mephisto",                         # 1981 Hungary
    "Fanny and Alexander",              # 1983 Sweden
    "Dangerous Moves",                  # 1984 Switzerland
    "The Official Story",               # 1985 Argentina
    "The Assault",                      # 1986 Netherlands
    "Babette's Feast",                  # 1987 Denmark
    "Pelle the Conqueror",              # 1988 Denmark
    "Cinema Paradiso",                  # 1989 Italy
    "Journey of Hope",                  # 1990 Switzerland
    "Mediterraneo",                     # 1991 Italy
    "Indochine",                        # 1992 France
    "Belle Epoque",                     # 1993 Spain
    "Burnt by the Sun",                 # 1994 Russia
    "Antonia's Line",                   # 1995 Netherlands
    "Kolya",                            # 1996 Czech Republic
    "Character",                        # 1997 Netherlands
    "Life Is Beautiful",                # 1998 Italy
    "All About My Mother",              # 1999 Spain
    "Crouching Tiger, Hidden Dragon",   # 2000 Taiwan
    "No Man's Land",                    # 2001 Bosnia
    "Nowhere in Africa",                # 2002 Germany
    "The Barbarian Invasions",          # 2003 Canada
    "The Sea Inside",                   # 2004 Spain
    "Tsotsi",                           # 2005 South Africa
    "The Lives of Others",              # 2006 Germany
    "The Counterfeiters",               # 2007 Austria
    "Departures",                       # 2008 Japan
    "The Secret in Their Eyes",         # 2009 Argentina
    "In a Better World",                # 2010 Denmark
    "A Separation",                     # 2011 Iran
    "Amour",                            # 2012 Austria
    "The Great Beauty",                 # 2013 Italy
    "Ida",                              # 2014 Poland
    "Son of Saul",                      # 2015 Hungary
    "The Salesman",                     # 2016 Iran
    "A Fantastic Woman",                # 2017 Chile
    "Roma",                             # 2018 Mexico
    "Parasite",                         # 2019 South Korea
    "Another Round",                    # 2020 Denmark
    "Drive My Car",                     # 2021 Japan
    "All Quiet on the Western Front",   # 2022 Germany
    "The Zone of Interest",             # 2023 UK/Germany
    "I'm Still Here",                   # 2024 Brazil
    # ── Nominated, not won ───────────────────────────────────────────────
    # Mischa, 2026-08-16: winners AND nominees. This is a PARTIAL list. The
    # International Feature category alone has five nominees a year since 1956
    # — roughly 350 films — and with no reachable source to check against,
    # writing all of them from memory would be inventing most of them. What
    # follows is the subset I can state with confidence, which skews recent
    # because recent nominees are the ones a shelf built on vote counts is
    # most likely to be missing anyway. Additions welcome; this is a list to
    # grow, not a claim to be complete.
    "Das Boot",                         # 1982 Germany, 6 nominations
    "Downfall",                         # 2004 Germany
    "Shoplifters",                      # 2018 Japan
    "A Prophet",                        # 2009 France
    "The White Ribbon",                 # 2009 Austria/Germany
    "Incendies",                        # 2010 Canada
    "Biutiful",                         # 2010 Mexico
    "Monsieur Lazhar",                  # 2011 Canada
    "Footnote",                         # 2011 Israel
    "Bullhead",                         # 2011 Belgium
    "The Hunt",                         # 2012 Denmark
    "Kon-Tiki",                         # 2012 Norway
    "No",                               # 2012 Chile
    "War Witch",                        # 2012 Canada
    "The Broken Circle Breakdown",      # 2013 Belgium
    "The Missing Picture",              # 2013 Cambodia
    "Omar",                             # 2013 Palestine
    "The Hunt",                         # 2012 Denmark
    "Leviathan",                        # 2014 Russia
    "Wild Tales",                       # 2014 Argentina
    "Timbuktu",                         # 2014 Mauritania
    "Tangerines",                       # 2014 Estonia
    "Mustang",                          # 2015 France/Turkey
    "Embrace of the Serpent",           # 2015 Colombia
    "Theeb",                            # 2015 Jordan
    "A War",                            # 2015 Denmark
    "Toni Erdmann",                     # 2016 Germany
    "Land of Mine",                     # 2016 Denmark
    "A Man Called Ove",                 # 2016 Sweden
    "Tanna",                            # 2016 Australia/Vanuatu
    "The Insult",                       # 2017 Lebanon
    "Loveless",                         # 2017 Russia
    "On Body and Soul",                 # 2017 Hungary
    "The Square",                       # 2017 Sweden
    "Cold War",                         # 2018 Poland
    "Capernaum",                        # 2018 Lebanon
    "Never Look Away",                  # 2018 Germany
    "Pain and Glory",                   # 2019 Spain
    "Les Misérables",                   # 2019 France
    "Corpus Christi",                   # 2019 Poland
    "Honeyland",                        # 2019 North Macedonia
    "Collective",                       # 2020 Romania
    "Quo Vadis, Aida?",                 # 2020 Bosnia
    "Better Days",                      # 2020 Hong Kong
    "The Man Who Sold His Skin",        # 2020 Tunisia
    "Flee",                             # 2021 Denmark
    "The Hand of God",                  # 2021 Italy
    "Lunana: A Yak in the Classroom",   # 2021 Bhutan
    "Close",                            # 2022 Belgium
    "Argentina, 1985",                  # 2022 Argentina
    "EO",                               # 2022 Poland
    "The Quiet Girl",                   # 2022 Ireland
    "Society of the Snow",              # 2023 Spain
    "The Teachers' Lounge",             # 2023 Germany
    "Io Capitano",                      # 2023 Italy
    "The Seed of the Sacred Fig",       # 2024 Germany/Iran
    "Emilia Pérez",                     # 2024 France
    "The Girl with the Needle",         # 2024 Denmark
    "Flow",                             # 2024 Latvia — won Animated Feature
    # Animated Feature nominees in other languages.
    "Howl's Moving Castle",             # 2005 Japan
    "The Wind Rises",                   # 2013 Japan
    "The Red Turtle",                   # 2016 France/Japan
    "My Life as a Zucchini",            # 2016 Switzerland
    "Mirai",                            # 2018 Japan
    # Other categories.
    "Hero",                             # 2002 China
    "House of Flying Daggers",          # 2004 China
    "Volver",                           # 2006 Spain
    # Non-English films that won in OTHER categories.
    "La Dolce Vita",                    # 1961 Costume Design
    "Divorce Italian Style",            # 1962 Original Screenplay
    "Two Women",                        # 1961 Actress, Sophia Loren
    "Il Postino",                       # 1995 Original Dramatic Score
    "Talk to Her",                      # 2002 Original Screenplay
    "Spirited Away",                    # 2002 Animated Feature
    "Pan's Labyrinth",                  # 2006 Cinematography, Art Direction, Makeup
    "Letters from Iwo Jima",            # 2006 Sound Editing
)

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


# CANON and OSCAR_FOREIGN are resolved together and pinned together — the
# only difference is that OSCAR_FOREIGN is how a non-English film reaches an
# English-language shelf at all, so an unresolved title there is a film simply
# missing rather than a film ranked out.
ALL_NAMED = CANON + OSCAR_ENGLISH + OSCAR_FOREIGN + ENGLISH_MISTAGGED
pinned = set()
exempt = set()          # …from the English-language rule. ONLY the Oscar list.
unresolved = []
with ThreadPoolExecutor(max_workers=WORKERS) as pool:
    for title, m in zip(ALL_NAMED, pool.map(resolve, ALL_NAMED)):
        if not m:
            unresolved.append(title)
            continue
        films.setdefault(m["id"], row(m))
        pinned.add(m["id"])
        # EVERY named title is exempt from the English-language rule, not
        # only the Oscar lists (Mischa, 2026-08-16: "keep CANON's world cinema
        # as its own exception"). CANON is a hand-written list of films someone
        # decided belong on the shelf; a language rule that overrides it is a
        # rule overriding the only deliberate judgement in the whole build.
        #
        # The rule therefore governs the SWEEPS — which is where it was always
        # needed, since those are what filled the shelf with whatever TMDB
        # happened to rank highly in each language.
        exempt.add(m["id"])
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


# ── The English-language rule, enforced once, LAST ──────────────────────────
#
# After the expansion, not before it. The first version ran before, and the
# expansion then walked pinned directors' full filmographies straight back
# through the door: Miyazaki arrived via Spirited Away and brought Princess
# Mononoke and Howl's Moving Castle. The script reported 152 non-English films
# and the artifact held 217. Storing `lang` is what made that visible.
#
# Being NAMED exempts a film; being swept in does not. Three lists are exempt,
# and all three are hand-written, which is the point — the rule governs the
# automatic sources, not the deliberate ones:
#
#   CANON                world cinema someone decided belongs (Mischa, 2026-08-16)
#   OSCAR_FOREIGN        non-English Academy Award winners AND nominees
#   ENGLISH_MISTAGGED    films in English that TMDB tags as a foreign production
#
# An earlier version exempted only the Oscar list, which removed about eighty
# revered films — Seven Samurai, Tokyo Story, In the Mood for Love, Akira,
# Totoro, City of God, Amélie — because CANON's 96 non-English titles lost
# their exemption. That was the rule doing exactly what it said and the rule
# being wrong.
#
# `spoken_languages` was tried as the test and is not one. TMDB lists English
# among the spoken languages of Parasite and Das Boot as readily as of Léon,
# so it separates nothing. `original_language` is at least consistently wrong
# in one direction — it is a production tag — which is exactly what a short,
# readable exception list is for.
_dropped = [i for i, f in films.items()
            if f.get("lang") != "en" and i not in exempt]
for i in _dropped:
    del films[i]
# `pinned` is a set of ids, and some of those ids have just been deleted — a
# pinned CANON title that is not an Oscar winner is exactly what this rule is
# meant to remove. The trim below indexes `films` by every pinned id, so
# leaving them in the set makes the rule crash on its own successes.
_was_pinned = sum(1 for i in _dropped if i in pinned)   # count BEFORE pruning
pinned &= films.keys()
_left = sum(1 for f in films.values() if f.get("lang") != "en")
print(f"english-language rule: dropped {len(_dropped)} non-English films "
      f"(including {_was_pinned} that were pinned canon); "
      f"{_left} non-English remain, every one of them a named exception")

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

# The audit found the 1930s missing 18 of TMDB's own top 40 by votes for that
# decade and the 1940s missing 16, while every decade from the 1970s on was
# complete. Vote count is not comparable ACROSS decades — a 1935 film loses a
# comparison it was never in — so each decade admits its own most-rated films,
# exactly as each genre does.
DECADE_REACH = 60

_by_decade = {}
for _fid, _f in films.items():
    _by_decade.setdefault(_f["y"] // 10 * 10, []).append((_fid, _f))

_decade_added = 0
for _d, _pool in _by_decade.items():
    _pool.sort(key=lambda kv: -kv[1]["vc"])
    for _fid, _f in _pool[:DECADE_REACH]:
        if _fid not in _kept:
            _kept[_fid] = _f
            _decade_added += 1

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
      f"that acclaim alone would have missed; {_decade_added} by per-decade "
      f"reach, which is how anything from before 1950 survives a vote count "
      f"comparison against 2015); fetching colours and directors…")

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
