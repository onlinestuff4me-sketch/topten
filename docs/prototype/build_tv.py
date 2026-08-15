"""Add TV shows to the baked catalog — the second domain (Mischa, 2026-08-15).

Mirrors build_catalog.py's shape so the prototype needs no per-domain code
paths: same fields, same poster-colour pass, same canon-weighted trim, same
pinned named-canon list, same "expand anyone who appears more than once" —
plus the axes that are TV's equivalents of a film's authorship: the creator,
and the network.

TV ids are offset by TV_OFFSET because TMDB numbers films and shows in
separate spaces and 1399 is both Game of Thrones and a film. One id space in
the app, one place where that is arranged.

Two things this script now does that it did not (2026-08-15, catalog round):

  * **`sv`, not `svraw`.** It used to write the raw TMDB provider names under
    `svraw`, which nothing reads — so every show in the app was unwatchable
    everywhere. Availability is now canonicalised through the same tables the
    film side uses (imported, not copied) and written to `sv`, and any service
    only TV carries is merged into `window.SERVICES`.
  * **A creator fallback.** `created_by` is empty for a quarter of the shelf —
    most British and nearly all Japanese shows — which left `d` blank and the
    creator facet thin. Where it is empty we take a "Creator" credit from the
    aggregate credits we are already fetching for the cast.
"""

import colorsys
import io
import json
import math
import os
import re
import unicodedata
import urllib.parse
import urllib.request
from collections import Counter
from concurrent.futures import ThreadPoolExecutor

from PIL import Image

# The film side owns the provider tables; importing them is the only way the
# two domains cannot drift apart. enrich_catalog does nothing on import.
from enrich_catalog import CANON as SV_CANON, FREE as SV_FREE, STOREFRONT

KEY = os.environ["EXPO_PUBLIC_TMDB_API_KEY"]
API = "https://api.themoviedb.org/3"
IMG = "https://image.tmdb.org/t/p"
HERE = os.path.dirname(os.path.abspath(__file__))
CAT = os.path.join(HERE, "catalog.js")
TV_OFFSET = 10_000_000
REGIONS = ("GB", "US")

TARGET = 700          # shows on the shelf (Mischa, 2026-08-15: 320 was thin)
VOTE_FLOOR = 150      # a show nobody voted on is not a candidate for a Ten
EXPAND_FLOOR = 100    # …but a named creator's lesser show still belongs
CANON_FLOOR = 60      # …and a named show is named because votes bury it
WORKERS = 16

# Genres that are not what "your ten favourite shows" means. Excluded from the
# universe sweep only — a curated source or the named list can still bring one
# in on purpose.
SKIP_GENRES = "10763,10767,10764"   # News, Talk, Reality

# Networks whose name is a promise, the same allowlist test the film side
# applies to studios. Verified against TMDB before use. The additions
# (2026-08-15) were taken from a census of the networks actually carrying the
# top 600 shows, not guessed — a guessed id is exactly what verify_networks
# exists to catch.
NETWORKS = {
    213: "Netflix", 49: "HBO", 2739: "Disney+", 1024: "Prime Video",
    2552: "Apple TV+", 4330: "Paramount+", 3353: "Peacock", 453: "Hulu",
    56: "Cartoon Network", 174: "AMC", 67: "Showtime", 4: "BBC One", 16: "CBS",
    332: "BBC Two", 71: "The CW", 2: "ABC", 6: "NBC",
    19: "FOX", 43: "National Geographic", 3186: "HBO Max",
    88: "FX", 30: "USA Network", 77: "Syfy", 318: "STARZ",
    54: "Disney Channel", 44: "Disney XD", 13: "Nickelodeon",
}


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
    r_, g_, b_ = colorsys.hls_to_rgb(hb / 24, min(max(lb / 4, 0.30), 0.62), min(max(sb / 4, 0.35), 0.72))
    return "#%02X%02X%02X" % (round(r_ * 255), round(g_ * 255), round(b_ * 255))


def slug(s):
    s = unicodedata.normalize("NFKD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c))
    return " ".join("".join(ch if ch.isalnum() else " " for ch in s.lower()).split())


def read_catalog():
    src = open(CAT).read()
    head = src[: src.index("window.CATALOG = ")]
    body = src[src.index("window.CATALOG = ") :]
    films = json.loads(body[body.index("[") : body.index(";\nwindow.SERVICES")])
    tail = body[body.index("window.SERVICES = ") + len("window.SERVICES = ") :]
    services = json.loads(tail[: tail.index(";\n")])
    return head, films, services


def verify_networks():
    bad = []
    for nid, expected in NETWORKS.items():
        actual = (get(f"/network/{nid}") or {}).get("name") or "?"
        if expected.lower() not in actual.lower() and actual.lower() not in expected.lower():
            bad.append(f"{nid}: expected {expected!r}, TMDB says {actual!r}")
    if bad:
        raise SystemExit("Network ids have drifted:\n  " + "\n  ".join(bad))
    print(f"{len(NETWORKS)} network ids verified")


genres = {g["id"]: g["name"] for g in get("/genre/tv/list").get("genres", [])}
verify_networks()

# --- 1. the eligible universe, same sweep the film side does.
UNIVERSE = {"sort_by": "vote_count.desc", "vote_count.gte": str(VOTE_FLOOR),
            "without_genres": SKIP_GENRES, "include_adult": "false"}
_first = get("/discover/tv", page=1, **UNIVERSE)
_pages = min(_first.get("total_pages", 1), 500)
print(f"universe: {_first.get('total_results')} shows with {VOTE_FLOOR}+ votes, {_pages} pages")

sources = [("/discover/tv", {**UNIVERSE, "page": p}) for p in range(1, _pages + 1)]
for page in range(1, 11):
    sources.append(("/tv/top_rated", {"page": page}))
    sources.append(("/tv/popular", {"page": page}))
for gid in ("18", "35", "80", "10765", "9648", "10759", "16", "99", "10768"):
    for page in range(1, 6):
        sources.append(("/discover/tv", {"with_genres": gid, "sort_by": "vote_count.desc", "page": page}))
for nid in NETWORKS:
    for page in (1, 2):
        sources.append(("/discover/tv", {"with_networks": str(nid), "sort_by": "vote_count.desc", "page": page}))


def row(m):
    return {
        "id": TV_OFFSET + m["id"], "tmdb": m["id"], "dm": "tv",
        "t": m.get("name") or m.get("original_name"),
        "y": int(m["first_air_date"][:4]),
        "p": m["poster_path"],
        "g": [genres.get(g, "") for g in m.get("genre_ids", [])][:3],
        "v": round(m.get("vote_average", 0), 1),
        "pop": round(m.get("popularity", 0), 1),
        "vc": m.get("vote_count", 0),
    }


shows = {}
with ThreadPoolExecutor(max_workers=WORKERS) as pool:
    for payload in pool.map(lambda s: get(s[0], **s[1]), sources):
        for m in payload.get("results", []):
            if not m.get("poster_path") or not m.get("first_air_date"):
                continue
            if m["id"] in shows or m.get("vote_count", 0) < VOTE_FLOOR:
                continue
            shows[m["id"]] = row(m)
print(f"{len(shows)} candidates from {len(sources)} source pages")


# --- 2. Named canon, pinned past the trim. British comedy in particular never
# --- reaches the vote counts an American drama does, so leaving these to
# --- standing is the same mistake the film side made.
CANON = (
    # The original round-5 list, unchanged.
    "The Sopranos", "The Wire", "Breaking Bad", "Mad Men", "Succession", "Fleabag",
    "The Leftovers", "Twin Peaks", "Six Feet Under", "Deadwood", "Chernobyl",
    "Band of Brothers", "The Thick of It", "Peep Show", "I May Destroy You",
    "Atlanta", "Barry", "Better Call Saul", "The Bear", "Severance", "Andor",
    "Arrested Development", "Curb Your Enthusiasm", "Seinfeld", "Frasier",
    "Buffy the Vampire Slayer", "Battlestar Galactica", "Firefly", "The Office",
    # Widened for the 700-show shelf.
    "The Shield", "Justified", "Friday Night Lights", "Halt and Catch Fire",
    "Rectify", "The Americans", "Homeland", "Boardwalk Empire", "Oz",
    "Fargo", "True Detective", "Mr. Robot", "Ozark", "The Last of Us",
    "House of the Dragon", "Watchmen", "Station Eleven", "Mare of Easttown",
    "Sharp Objects", "Big Little Lies", "Euphoria", "Reservation Dogs", "Beef",
    "Shōgun", "The Penguin", "Slow Horses", "The Underground Railroad",
    "30 Rock", "Parks and Recreation", "Community", "Veep", "Silicon Valley",
    "It's Always Sunny in Philadelphia", "The Good Place", "Schitt's Creek",
    "Ted Lasso", "What We Do in the Shadows", "Broad City", "Insecure",
    "Girls", "Louie", "Master of None", "The Larry Sanders Show",
    "Mr. Show with Bob and David", "Freaks and Geeks", "My So-Called Life",
    "Fawlty Towers", "Blackadder", "The Young Ones", "Spaced", "The IT Crowd",
    "The Inbetweeners", "Black Books", "Father Ted", "I'm Alan Partridge",
    "Brass Eye", "Garth Marenghi's Darkplace", "Toast of London",
    "This Country", "Stath Lets Flats", "Detectorists", "Motherland",
    "Catastrophe", "Chewing Gum", "Derry Girls", "Sex Education",
    "The End of the F***ing World", "Ghosts", "Fleabag",
    "Happy Valley", "Line of Duty", "Broadchurch", "The Fall", "Utopia",
    "Black Mirror", "Doctor Who", "Sherlock", "Luther", "Peaky Blinders",
    "Top Boy", "Wolf Hall", "The Crown", "Small Axe", "Normal People",
    "Adolescence", "Baby Reindeer", "This Is England '86",
    "The Twilight Zone", "M*A*S*H", "Cheers", "I Love Lucy", "Columbo",
    "Hill Street Blues", "The West Wing", "ER", "NYPD Blue",
    "Northern Exposure", "Homicide: Life on the Street", "Taxi",
    "The Golden Girls", "Star Trek: The Next Generation",
    "Star Trek: Deep Space Nine", "The X-Files",
    "Cowboy Bebop", "Neon Genesis Evangelion", "Fullmetal Alchemist: Brotherhood",
    "Death Note", "Attack on Titan", "Monster", "Steins;Gate", "Hunter x Hunter",
    "Vinland Saga", "Mob Psycho 100", "One-Punch Man", "Samurai Champloo",
    "Ping Pong the Animation", "Frieren: Beyond Journey's End",
    "The Simpsons", "King of the Hill", "Bob's Burgers", "Rick and Morty",
    "BoJack Horseman", "Adventure Time", "Gravity Falls",
    "Avatar: The Last Airbender", "Steven Universe", "Over the Garden Wall",
    "Arcane", "Samurai Jack", "Batman: The Animated Series", "Futurama",
    "South Park", "Regular Show", "The Venture Bros.", "Invincible",
    "Scavengers Reign", "Primal",
    "Dark", "Babylon Berlin", "Borgen", "Call My Agent!", "Lupin", "Gomorrah",
    "My Brilliant Friend", "The Young Pope", "Squid Game", "Kingdom", "Signal",
    "Reply 1988", "My Mister", "Narcos", "Fauda", "Tehran",
)


def resolve(title):
    """Exact (accent-folded) title match only — a fuzzy top hit is how you pin
    the wrong Ghosts. Where two shows share a name exactly, the more-voted one
    wins, which is the same tie-break the film side uses."""
    want = slug(title)
    best = None
    for m in get("/search/tv", query=title).get("results", []):
        if not m.get("poster_path") or not m.get("first_air_date"):
            continue
        if slug(m.get("name")) != want and slug(m.get("original_name")) != want:
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
        shows.setdefault(m["id"], row(m))
        pinned.add(m["id"])
print(f"named canon: {len(pinned)} pinned, {len(unresolved)} unresolved {unresolved}")


def standing(f):
    return f["v"] * math.log10(max(f["vc"], 10))


# --- 3. Full filmographies for creators who appear more than once, the TV
# --- twin of the film side's director expansion. /discover/tv has no crew
# --- filter, so the walk is person → tv_credits → "Creator" credits.
_shortlist = list(pinned) + [
    tid for tid, _ in sorted(shows.items(), key=lambda kv: -standing(kv[1]))[: TARGET * 2]
    if tid not in pinned]
_details = {}


def details(tid):
    d = get(f"/tv/{tid}")
    _details[tid] = d
    return d


_creators = {}
with ThreadPoolExecutor(max_workers=WORKERS) as pool:
    for tid, d in zip(_shortlist, pool.map(details, _shortlist)):
        for c in (d.get("created_by") or [])[:1]:
            _creators.setdefault(c["id"], []).append(tid)

_people = [pid for pid, tids in _creators.items() if len(tids) >= 2]
extra = []
with ThreadPoolExecutor(max_workers=WORKERS) as pool:
    for payload in pool.map(lambda p: get(f"/person/{p}/tv_credits"), _people):
        extra += [c for c in (payload.get("crew") or []) if c.get("job") == "Creator"]
for m in extra:
    if not m.get("poster_path") or not m.get("first_air_date") or m["id"] in shows:
        continue
    if m.get("vote_count", 0) < EXPAND_FLOOR:
        continue
    shows[m["id"]] = row(m)
print(f"{len(_people)} creators expanded; {len(shows)} shows before trim")

_rest = sorted((kv for kv in shows.items() if kv[0] not in pinned),
               key=lambda kv: -standing(kv[1]))[: max(TARGET - len(pinned), 0)]
_cut = standing(_rest[-1][1]) if _rest else 0
_rescued = sum(1 for i in pinned if standing(shows[i]) < _cut)
shows = dict([(i, shows[i]) for i in pinned] + _rest)
print(f"{len(shows)} shows (standing cutoff {_cut:.1f}; {_rescued} pinned titles "
      f"the cutoff would have dropped)")

ids = [s["tmdb"] for s in shows.values()]
by_tmdb = {s["tmdb"]: s for s in shows.values()}
in_catalog = {TV_OFFSET + i for i in ids}


def creator_and_network(tid):
    d = _details.get(tid) or get(f"/tv/{tid}")
    creators = [c["name"] for c in (d.get("created_by") or [])][:2]
    nets = [NETWORKS[n["id"]] for n in (d.get("networks") or []) if n["id"] in NETWORKS]
    return creators, nets[:2]


def credits(tid):
    """Top billing, plus a creator of last resort.

    `created_by` is empty for most non-US shows; the aggregate credits we need
    anyway carry a "Creator" job for a good share of them, so one call answers
    both questions rather than leaving `d` blank."""
    agg = get(f"/tv/{tid}/aggregate_credits")
    cast = [p["name"] for p in (agg.get("cast") or [])[:4]]
    creator = None
    for c in agg.get("crew") or []:
        if any(j.get("job") == "Creator" for j in (c.get("jobs") or [])):
            creator = c["name"]
            break
    return cast, creator


def recs(tid):
    got = []
    for m in get(f"/tv/{tid}/recommendations").get("results", []):
        if TV_OFFSET + m["id"] in in_catalog and m["id"] != tid:
            got.append(TV_OFFSET + m["id"])
    return got[:10]


SV_USED = {}


def providers(tid):
    """Same rules as the film side: subscriptions from `flatrate`, free-with-ads
    from `free`/`ads`, storefront rows dropped (Stack's 43% false positives)."""
    res = get(f"/tv/{tid}/watch/providers").get("results") or {}
    out = {}
    for region in REGIONS:
        r = res.get(region) or {}
        sids = []

        def collect(bucket, table, free):
            for p in (r.get(bucket) or []):
                name = p["provider_name"]
                if re.search(STOREFRONT, name, re.I):
                    continue
                for sid, label, pat in table:
                    if re.search(pat, name, re.I):
                        if sid not in sids:
                            sids.append(sid)
                            SV_USED[(sid, free)] = label
                        break

        collect("flatrate", SV_CANON, 0)
        collect("free", SV_FREE, 1)
        collect("ads", SV_FREE, 1)
        if sids:
            out[region] = sids
    return out


with ThreadPoolExecutor(max_workers=WORKERS) as pool:
    for tid, (creators, nets) in zip(ids, pool.map(creator_and_network, ids)):
        if creators:
            by_tmdb[tid]["d"] = creators[0]
        if nets:
            by_tmdb[tid]["br"] = nets
    for tid, (cast, creator) in zip(ids, pool.map(credits, ids)):
        if cast:
            by_tmdb[tid]["ca"] = cast
        if creator and not by_tmdb[tid].get("d"):
            by_tmdb[tid]["d"] = creator
    for tid, rr in zip(ids, pool.map(recs, ids)):
        if rr:
            by_tmdb[tid]["r"] = rr
    for tid, colour in zip(ids, pool.map(lambda t: dominant_colour(by_tmdb[t]["p"]), ids)):
        by_tmdb[tid]["c"] = colour or "#6E675D"
    for tid, sv in zip(ids, pool.map(providers, ids)):
        if sv:
            by_tmdb[tid]["sv"] = sv

head, films, services = read_catalog()
for f in films:
    f.setdefault("dm", "movie")
merged = [f for f in films if f.get("dm") != "tv"] + list(shows.values())

# A service TV carries and film does not would otherwise be filterable data
# with no chip in the sheet.
have = {(s[0], s[2]) for s in services}
added = [[sid, label, free] for (sid, free), label in SV_USED.items() if (sid, free) not in have]
services = services + added

with open(CAT, "w") as fh:
    fh.write(head)
    fh.write("window.CATALOG = ")
    json.dump(merged, fh, ensure_ascii=False, separators=(",", ":"))
    fh.write(";\nwindow.SERVICES = ")
    json.dump(services, fh, ensure_ascii=False, separators=(",", ":"))
    fh.write(";\n")

tv = list(shows.values())
print("films:", sum(1 for f in merged if f.get("dm") == "movie"), "| shows:", len(tv))
for k, label in (("d", "creator"), ("br", "network"), ("ca", "cast"),
                 ("r", "recs"), ("sv", "watchable"), ("c", "colour")):
    print(f"  shows with {label}: {sum(1 for s in tv if s.get(k))}/{len(tv)}")
if added:
    print("services added by TV:", [a[1] for a in added])
print("decades:", sorted(Counter(s["y"] // 10 * 10 for s in tv).items()))
print("sample:", [(s["t"], s["y"], s.get("d"), s.get("br")) for s in tv[:5]])
print("size:", os.path.getsize(CAT))
