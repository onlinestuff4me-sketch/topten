"""Build the prototype's baked catalog from TMDB.

Writes docs/prototype/catalog.js. The key is used here, at build time, and is
never shipped: the prototype ships with the data already in it, so the page
needs no API key and works on a plane.

For each film we keep the dominant poster colour, computed from the real
artwork, so badge palettes in the prototype genuinely derive from the Ten's
posters (specs/badges.md, "Field") rather than being decorative.
"""

import colorsys
import math
import io
import json
import os
import urllib.parse
import urllib.request
from collections import Counter
from concurrent.futures import ThreadPoolExecutor

from PIL import Image

KEY = os.environ["EXPO_PUBLIC_TMDB_API_KEY"]
API = "https://api.themoviedb.org/3"
IMG = "https://image.tmdb.org/t/p"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "catalog.js")


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
    crew = get(f"/movie/{movie_id}/credits").get("crew") or []
    for c in crew:
        if c.get("job") == "Director":
            return c.get("name")
    return None


# --- gather a spread: canon, crowd-pleasers, and enough of a few clusters
# --- that "three of your ten are heists" can actually fire in the prototype.
sources = []
for page in (1, 2, 3, 4, 5, 6, 7, 8):
    sources.append(("/movie/top_rated", {"page": page}))
for page in (1, 2, 3):
    sources.append(("/movie/popular", {"page": page}))
for kw, page in (("9748", 1), ("10051", 1), ("4344", 1)):   # revenge, heist, musical
    sources.append(("/discover/movie", {"with_keywords": kw, "sort_by": "vote_count.desc", "page": page}))
for person in ("138",):                                      # Tarantino
    sources.append(("/discover/movie", {"with_crew": person, "sort_by": "vote_count.desc", "page": 1}))
for company in ("41077", "420"):                             # A24, Marvel Studios
    sources.append(("/discover/movie", {"with_companies": company, "sort_by": "vote_count.desc", "page": 1}))
for genre in ("27", "35", "878", "16", "80", "18", "12", "53", "10749", "36", "10752", "37", "14", "9648", "10402"):
    for page in (1, 2):
        sources.append(("/discover/movie", {"with_genres": genre, "sort_by": "vote_count.desc", "page": page}))

# Canon that popularity sorting reliably buries. A prototype for "your ten
# favourite films of all time" is worthless if the rail is all this month's
# releases, so these are fetched by name rather than left to chance.
for title in (
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
):
    sources.append(("/search/movie", {"query": title}))

genres = {g["id"]: g["name"] for g in get("/genre/movie/list").get("genres", [])}

films = {}
with ThreadPoolExecutor(max_workers=8) as pool:
    for payload in pool.map(lambda s: get(s[0], **s[1]), sources):
        for m in payload.get("results", []):
            if not m.get("poster_path") or not m.get("release_date"):
                continue
            if m["id"] in films or m.get("vote_count", 0) < 400:
                continue
            films[m["id"]] = {
                "id": m["id"],
                "t": m["title"],
                "y": int(m["release_date"][:4]),
                "p": m["poster_path"],
                "g": [genres.get(g, "") for g in m.get("genre_ids", [])][:3],
                "v": round(m.get("vote_average", 0), 1),
                "pop": round(m.get("popularity", 0), 1),
                "vc": m.get("vote_count", 0),
            }


def standing(f):
    """Blend rating with how many people voted, so the catalog reads as a
    canon rather than a new-releases shelf. Raw popularity would fill the
    suggestion rail with whatever opened this month, which is the wrong
    prompt for 'your ten favourite films of all time'."""
    return f["v"] * math.log10(max(f["vc"], 10))


# A shelf of 220 was too thin to explore: following Interstellar could not
# reach The Prestige, Dunkirk, Oppenheimer or Tenet because none of them were
# in it (Mischa, round 3). Before trimming, pull the fuller filmography of any
# director who already appears more than once — a rabbit hole into a director
# is worthless if their work is missing.
_seed_directors = {}
with ThreadPoolExecutor(max_workers=10) as pool:
    ids0 = list(films)
    for fid, name in zip(ids0, pool.map(director, ids0)):
        if name:
            films[fid]["d"] = name
            _seed_directors.setdefault(name, []).append(fid)

_people = {}
for name, fids in _seed_directors.items():
    if len(fids) >= 2:
        found = get("/search/person", query=name).get("results") or []
        if found:
            _people[name] = found[0]["id"]

extra = []
with ThreadPoolExecutor(max_workers=8) as pool:
    payloads = pool.map(
        lambda pid: get("/discover/movie", with_crew=str(pid), sort_by="vote_count.desc", page=1),
        list(_people.values()))
    for payload in payloads:
        extra.extend(payload.get("results", []))
for m in extra:
    if not m.get("poster_path") or not m.get("release_date") or m["id"] in films:
        continue
    if m.get("vote_count", 0) < 300:
        continue
    films[m["id"]] = {
        "id": m["id"], "t": m["title"], "y": int(m["release_date"][:4]), "p": m["poster_path"],
        "g": [genres.get(g, "") for g in m.get("genre_ids", [])][:3],
        "v": round(m.get("vote_average", 0), 1), "pop": round(m.get("popularity", 0), 1),
        "vc": m.get("vote_count", 0),
    }
print(f"{len(_people)} directors expanded; {len(films)} films before trim")

films = dict(sorted(films.items(), key=lambda kv: -standing(kv[1]))[:620])
print(f"{len(films)} films; fetching colours and directors…")

with ThreadPoolExecutor(max_workers=10) as pool:
    ids = list(films)
    for fid, colour in zip(ids, pool.map(lambda i: dominant_colour(films[i]["p"]), ids)):
        films[fid]["c"] = colour or "#6E675D"
    missing = [i for i in ids if not films[i].get("d")]
    for fid, name in zip(missing, pool.map(director, missing)):
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
print("sample:", [(f["t"], f["y"], f["c"], f.get("d")) for f in catalog[:4]])
