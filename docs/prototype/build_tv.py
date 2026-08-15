"""Add TV shows to the baked catalog — the second domain (Mischa, 2026-08-15).

Mirrors build_catalog.py's shape so the prototype needs no per-domain code
paths: same fields, same poster-colour pass, plus the axes that are TV's
equivalents of a film's authorship — the creator, and the network.

TV ids are offset by TV_OFFSET because TMDB numbers films and shows in
separate spaces and 1399 is both Game of Thrones and a film. One id space in
the app, one place where that is arranged.
"""

import colorsys
import io
import json
import math
import os
import urllib.parse
import urllib.request
from collections import Counter
from concurrent.futures import ThreadPoolExecutor

from PIL import Image

KEY = os.environ["EXPO_PUBLIC_TMDB_API_KEY"]
API = "https://api.themoviedb.org/3"
IMG = "https://image.tmdb.org/t/p"
HERE = os.path.dirname(os.path.abspath(__file__))
CAT = os.path.join(HERE, "catalog.js")
TV_OFFSET = 10_000_000
REGIONS = ("GB", "US")
TARGET = 320

# Networks whose name is a promise, the same allowlist test the film side
# applies to studios. Verified against TMDB before use.
NETWORKS = {
    213: "Netflix", 49: "HBO", 2739: "Disney+", 1024: "Prime Video",
    2552: "Apple TV+", 4330: "Paramount+", 3353: "Peacock", 453: "Hulu",
    56: "Cartoon Network", 174: "AMC", 67: "Showtime", 4: "BBC One", 16: "CBS",
    332: "BBC Two", 71: "The CW", 2: "ABC", 6: "NBC",
    19: "FOX", 43: "National Geographic", 3186: "HBO Max",
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


def read_catalog():
    src = open(CAT).read()
    head = src[: src.index("window.CATALOG = ")]
    body = src[src.index("window.CATALOG = ") :]
    films = json.loads(body[body.index("[") : body.index(";\nwindow.SERVICES")])
    services_js = body[body.index("window.SERVICES = ") :]
    return head, films, services_js


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

sources = []
for page in (1, 2, 3, 4, 5):
    sources.append(("/tv/top_rated", {"page": page}))
    sources.append(("/tv/popular", {"page": page}))
for gid in ("18", "35", "80", "10765", "9648", "10759", "16", "99", "10768"):
    for page in (1, 2):
        sources.append(("/discover/tv", {"with_genres": gid, "sort_by": "vote_count.desc", "page": page}))
for title in (
    "The Sopranos", "The Wire", "Breaking Bad", "Mad Men", "Succession", "Fleabag",
    "The Leftovers", "Twin Peaks", "Six Feet Under", "Deadwood", "Chernobyl",
    "Band of Brothers", "The Thick of It", "Peep Show", "I May Destroy You",
    "Atlanta", "Barry", "Better Call Saul", "The Bear", "Severance", "Andor",
    "Arrested Development", "Curb Your Enthusiasm", "Seinfeld", "Frasier",
    "Buffy the Vampire Slayer", "Battlestar Galactica", "Firefly", "The Office",
):
    sources.append(("/search/tv", {"query": title}))

shows = {}
with ThreadPoolExecutor(max_workers=8) as pool:
    for payload in pool.map(lambda s: get(s[0], **s[1]), sources):
        for m in payload.get("results", []):
            if not m.get("poster_path") or not m.get("first_air_date"):
                continue
            if m["id"] in shows or m.get("vote_count", 0) < 150:
                continue
            shows[m["id"]] = {
                "id": TV_OFFSET + m["id"], "tmdb": m["id"], "dm": "tv",
                "t": m.get("name") or m.get("original_name"),
                "y": int(m["first_air_date"][:4]),
                "p": m["poster_path"],
                "g": [genres.get(g, "") for g in m.get("genre_ids", [])][:3],
                "v": round(m.get("vote_average", 0), 1),
                "pop": round(m.get("popularity", 0), 1),
                "vc": m.get("vote_count", 0),
            }

standing = lambda f: f["v"] * math.log10(max(f["vc"], 10))
shows = dict(sorted(shows.items(), key=lambda kv: -standing(kv[1]))[:TARGET])
print(f"{len(shows)} shows selected")

ids = [s["tmdb"] for s in shows.values()]
by_tmdb = {s["tmdb"]: s for s in shows.values()}
in_catalog = {TV_OFFSET + i for i in ids}


def details(tid):
    d = get(f"/tv/{tid}")
    creators = [c["name"] for c in (d.get("created_by") or [])][:2]
    nets = [NETWORKS[n["id"]] for n in (d.get("networks") or []) if n["id"] in NETWORKS]
    return creators, nets[:2]


def credits(tid):
    c = (get(f"/tv/{tid}/aggregate_credits").get("cast") or [])[:4]
    return [p["name"] for p in c]


def recs(tid):
    got = []
    for m in get(f"/tv/{tid}/recommendations").get("results", []):
        if TV_OFFSET + m["id"] in in_catalog and m["id"] != tid:
            got.append(TV_OFFSET + m["id"])
    return got[:10]


def providers(tid):
    res = get(f"/tv/{tid}/watch/providers").get("results") or {}
    out = {}
    for region in REGIONS:
        flat = (res.get(region) or {}).get("flatrate") or []
        names = [p["provider_name"] for p in flat]
        if names:
            out[region] = names[:6]
    return out


with ThreadPoolExecutor(max_workers=10) as pool:
    for tid, (creators, nets) in zip(ids, pool.map(details, ids)):
        if creators:
            by_tmdb[tid]["d"] = creators[0]
        if nets:
            by_tmdb[tid]["br"] = nets
    for tid, cast in zip(ids, pool.map(credits, ids)):
        if cast:
            by_tmdb[tid]["ca"] = cast
    for tid, rr in zip(ids, pool.map(recs, ids)):
        if rr:
            by_tmdb[tid]["r"] = rr
    for tid, colour in zip(ids, pool.map(lambda t: dominant_colour(by_tmdb[t]["p"]), ids)):
        by_tmdb[tid]["c"] = colour or "#6E675D"
    for tid, sv in zip(ids, pool.map(providers, ids)):
        if sv:
            by_tmdb[tid]["svraw"] = sv

head, films, services_js = read_catalog()
for f in films:
    f.setdefault("dm", "movie")
merged = [f for f in films if f.get("dm") != "tv"] + list(shows.values())

with open(CAT, "w") as fh:
    fh.write(head)
    fh.write("window.CATALOG = ")
    json.dump(merged, fh, ensure_ascii=False, separators=(",", ":"))
    fh.write(";\n")
    fh.write(services_js)

print("films:", sum(1 for f in merged if f.get("dm") == "movie"),
      "| shows:", sum(1 for f in merged if f.get("dm") == "tv"))
print("shows with creator:", sum(1 for s in shows.values() if s.get("d")),
      "| network:", sum(1 for s in shows.values() if s.get("br")),
      "| cast:", sum(1 for s in shows.values() if s.get("ca")),
      "| recs:", sum(1 for s in shows.values() if s.get("r")))
print("sample:", [(s["t"], s["y"], s.get("d"), s.get("br")) for s in list(shows.values())[:5]])
print("size:", os.path.getsize(CAT))
