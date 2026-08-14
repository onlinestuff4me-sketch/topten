"""Add the data the Gather experience needs to the baked catalog.

Run after build_catalog.py. Adds, per film:

  sv   streaming subscriptions carrying it, per region (GB/US) — the
       top-priority filter: "show me things I can actually watch tonight"
  ca   top-billed cast, so a Ten can be filtered/branched by actor
  r    TMDB's own recommendations, narrowed to films in this catalog — the
       edges that make "more like Inception" a real branch rather than a
       genre guess

Providers are region-specific and their ids drift (inherited Stack lesson,
tech-stack.md), so names are stored alongside ids and the prototype matches
on id with the name only for display.
"""

import json
import os
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

KEY = os.environ["EXPO_PUBLIC_TMDB_API_KEY"]
API = "https://api.themoviedb.org/3"
HERE = os.path.dirname(os.path.abspath(__file__))
CAT = os.path.join(HERE, "catalog.js")
REGIONS = ("GB", "US")


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


def read_catalog():
    """Parse the generated catalog.js back into Python. It holds two
    statements now (CATALOG and SERVICES), so bound the slice explicitly
    rather than reaching for the last semicolon."""
    src = open(CAT).read()
    head = src[: src.index("window.CATALOG = ")]
    body = src[src.index("window.CATALOG = ") :]
    end = body.index(";\nwindow.SERVICES") if ";\nwindow.SERVICES" in body else body.rindex(";")
    return head, json.loads(body[body.index("[") : end])


def fetch():
    head, films = read_catalog()
    ids = {f["id"] for f in films}

    def providers(fid):
        """Subscription (flatrate) services only — rent/buy is not what
        'I subscribe to Netflix' means."""
        res = (get(f"/movie/{fid}/watch/providers").get("results") or {})
        out = {}
        for region in REGIONS:
            flat = (res.get(region) or {}).get("flatrate") or []
            if flat:
                out[region] = [[p["provider_id"], p["provider_name"]] for p in flat[:6]]
        return out


    def cast(fid):
        c = (get(f"/movie/{fid}/credits").get("cast") or [])[:4]
        return [p["name"] for p in c]


    def recs(fid):
        got = []
        for page in (1, 2):
            for m in get(f"/movie/{fid}/recommendations", page=page).get("results", []):
                if m["id"] in ids and m["id"] != fid and m["id"] not in got:
                    got.append(m["id"])
            if len(got) >= 10:
                break
        return got[:10]


    order = [f["id"] for f in films]
    by_id = {f["id"]: f for f in films}

    with ThreadPoolExecutor(max_workers=10) as pool:
        for fid, sv in zip(order, pool.map(providers, order)):
            if sv:
                by_id[fid]["sv"] = sv
        for fid, ca in zip(order, pool.map(cast, order)):
            if ca:
                by_id[fid]["ca"] = ca
        for fid, rr in zip(order, pool.map(recs, order)):
            if rr:
                by_id[fid]["r"] = rr

    # A compact index of which services appear at all, so the filter sheet can be
    # built without scanning every film at runtime.
    services = {}
    for f in films:
        for region, lst in (f.get("sv") or {}).items():
            for pid, name in lst:
                services.setdefault(region, {})[str(pid)] = name

    with open(CAT, "w") as fh:
        fh.write(head)
        fh.write("window.CATALOG = ")
        json.dump(films, fh, ensure_ascii=False, separators=(",", ":"))
        fh.write(";\nwindow.SERVICES = ")
        json.dump(services, fh, ensure_ascii=False, separators=(",", ":"))
        fh.write(";\n")

    print(f"{len(films)} films")
    print("with providers:", sum(1 for f in films if f.get("sv")))
    print("with cast:", sum(1 for f in films if f.get("ca")))
    print("with in-catalog recs:", sum(1 for f in films if f.get("r")))
    print("avg recs:", round(sum(len(f.get("r", [])) for f in films) / len(films), 1))
    for region, svc in services.items():
        print(region, len(svc), "services:", list(svc.values())[:8])
    print("size:", os.path.getsize(CAT), "bytes")


# ── Canonicalisation ────────────────────────────────────────────────────────
# Run as `python3 enrich_catalog.py --canonical` after the fetch above.
# TMDB returns storefronts as if they were subscriptions ("Paramount+ Amazon
# Channel"), and Stack measured 43% false positives for Prime because of it
# (stack/src/lib/streamingServices.ts). A storefront is not a subscription:
# holding Prime does not get you Paramount+ through Prime. Those are dropped,
# and the remaining names collapse onto one canonical service each.
CANON = [
    ("netflix",   "Netflix",        r"^netflix"),
    ("prime",     "Prime Video",    r"^amazon prime video"),
    ("disney",    "Disney+",        r"^disney"),
    ("max",       "Max",            r"^(hbo )?max$|^hbo max$"),
    ("appletv",   "Apple TV+",      r"^apple tv"),
    ("paramount", "Paramount+",     r"^paramount"),
    ("now",       "NOW",            r"^now\b"),
    ("mubi",      "MUBI",           r"^mubi"),
    ("hulu",      "Hulu",           r"^hulu"),
    ("peacock",   "Peacock",        r"^peacock"),
    ("skygo",     "Sky Go",         r"^sky go"),
    ("iplayer",   "BBC iPlayer",    r"bbc iplayer"),
    ("itvx",      "ITVX",           r"^itvx"),
    ("film4",     "Channel 4",      r"^channel 4|^film4"),
    # Added round 3 (Mischa): a YouTube Premium subscription genuinely carries
    # films, and leaving it out made a real subscription unrepresentable.
    ("youtube",   "YouTube Premium", r"^youtube premium"),
]
STOREFRONT = r"amazon channel|roku premium channel|apple tv channel|plus channel"


def canonicalise():
    import re
    src = open(CAT).read()
    head = src[: src.index("window.CATALOG = ")]
    body = src[src.index("window.CATALOG = ") :]
    films = json.loads(body[body.index("[") : body.index(";\nwindow.SERVICES")])

    used = {}
    for f in films:
        out = {}
        for region, lst in (f.get("sv") or {}).items():
            ids = []
            for _pid, name in lst:
                if re.search(STOREFRONT, name, re.I):
                    continue
                for sid, label, pat in CANON:
                    if re.search(pat, name, re.I):
                        if sid not in ids:
                            ids.append(sid)
                            used[sid] = label
                        break
            if ids:
                out[region] = ids
        if out:
            f["sv"] = out
        else:
            f.pop("sv", None)

    services = [[sid, label] for sid, label, _ in CANON if sid in used]
    with open(CAT, "w") as fh:
        fh.write(head)
        fh.write("window.CATALOG = ")
        json.dump(films, fh, ensure_ascii=False, separators=(",", ":"))
        fh.write(";\nwindow.SERVICES = ")
        json.dump(services, fh, ensure_ascii=False, separators=(",", ":"))
        fh.write(";\n")
    print("canonical services:", [s[1] for s in services])
    for region in REGIONS:
        n = sum(1 for f in films if (f.get("sv") or {}).get(region))
        print(f"{region}: {n}/{len(films)} films on a subscription")
    print("size:", os.path.getsize(CAT))


if __name__ == "__main__":
    import sys
    canonicalise() if "--canonical" in sys.argv else fetch()
