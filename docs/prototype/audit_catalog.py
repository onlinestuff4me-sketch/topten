"""What the shelf is throwing away, and which gate threw it.

Run after the three build stages. Read-only: it fetches from TMDB and prints,
and never touches catalog.js.

    python3 audit_catalog.py            # the report
    python3 audit_catalog.py --pins     # plus a paste-ready CANON block

── Why this exists ──────────────────────────────────────────────────────────

The build has five numeric gates and, until now, not one of them had ever been
checked against what it discards (Mischa, 2026-08-16: "I'm concerned we may be
losing a lot of great movies that are below some arbitrary thresholds"):

    VOTE_FLOOR    400   a film with fewer votes never enters the pool at all
    TARGET       2000   the standing cutoff — the top N survive
    GENRE_REACH   100   per-genre most-rated, admitted outright
    CANON_FLOOR   150   a named film needs at least this many votes
    EXPAND_FLOOR  250   a named director's lesser work

Each is defensible on its own and none was ever measured. A threshold nobody
has audited is a guess with a number written next to it.

The gates fail in opposite directions, which is why the report separates them:

  * **`standing` is acclaim** — rating blended with vote count. It under-selects
    anything widely seen but modestly rated. That is what the per-genre reach
    floor now catches, and the report checks whether it is catching enough.

  * **`VOTE_FLOOR` is a popularity gate wearing a quality costume.** It is
    blind in the other direction: a revered film that few people have logged —
    older, foreign-language, documentary — is refused entry before any
    judgement about quality is made. Nothing in the build compensates for this,
    which makes it the most likely place great films are being lost.

The report is deliberately about *decisions*, not counts. Every section names
what is missing, by title, so it can be argued with.
"""

import json
import os
import sys
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

KEY = os.environ["EXPO_PUBLIC_TMDB_API_KEY"]
API = "https://api.themoviedb.org/3"
HERE = os.path.dirname(os.path.abspath(__file__))
CAT = os.path.join(HERE, "catalog.js")

VOTE_FLOOR = 400        # must match build_catalog.py
WORKERS = 16
SHOW = 25               # titles listed per section


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


def pages(path, n, **params):
    """Fetch n pages concurrently and return the flattened results."""
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        out = pool.map(lambda p: get(path, page=p, **params).get("results", []), range(1, n + 1))
    return [m for page in out for m in page]


def shelf():
    """The films actually on the shelf, by TMDB id. TV ids are offset, so
    filtering by domain is what keeps this comparing like with like."""
    src = open(CAT, encoding="utf-8").read()
    body = src[src.index("window.CATALOG = "):]
    end = body.index(";\nwindow.SERVICES") if ";\nwindow.SERVICES" in body else body.rindex(";")
    films = json.loads(body[body.index("["): end])
    return {f["id"]: f for f in films if (f.get("dm") or "movie") == "movie"}


def line(m, why=""):
    return (f"    {m.get('title', '?')[:44]:<46} {m.get('release_date', '')[:4]:<6} "
            f"{m.get('vote_average', 0):>4.1f}  {m.get('vote_count', 0):>6} votes  {why}")


def report(name, missing, note):
    print(f"\n── {name} " + "─" * max(0, 74 - len(name)))
    print(f"   {note}")
    if not missing:
        print("   nothing missing.")
        return
    print(f"   {len(missing)} missing:")
    for m in missing[:SHOW]:
        print(line(m))
    if len(missing) > SHOW:
        print(f"    …and {len(missing) - SHOW} more")


def main():
    have = shelf()
    print(f"shelf: {len(have)} films\n")
    print("=" * 78)
    print("WHAT THE GATES ARE DISCARDING".center(78))
    print("=" * 78)
    suggestions = {}

    def missing_from(results, extra=lambda m: True):
        seen, out = set(), []
        for m in results:
            if m["id"] in have or m["id"] in seen or not extra(m):
                continue
            seen.add(m["id"])
            out.append(m)
        return out

    # ── 1. TMDB's own top-rated list ────────────────────────────────────────
    # The single most direct question: of the films TMDB itself ranks highest,
    # which are we not carrying?
    top = pages("/movie/top_rated", 25)
    report("TMDB top rated", missing_from(top),
           "TMDB's own top-rated ranking. Anything here is a film the source "
           "itself considers canon.")
    suggestions["top_rated"] = missing_from(top)

    # ── 2. Revered but rarely logged — the VOTE_FLOOR blind spot ────────────
    # High rating, vote count BELOW the floor: these never entered the pool, so
    # no amount of fixing the trim could ever have reached them. This is the
    # gate with no compensating mechanism anywhere in the build.
    below = []
    for floor, ceiling in ((100, VOTE_FLOOR), (200, VOTE_FLOOR)):
        below += pages("/discover/movie", 8, sort_by="vote_average.desc",
                       **{"vote_count.gte": floor, "vote_count.lte": ceiling})
    report("Acclaimed, but under the 400-vote floor", missing_from(below),
           f"Rated highly with {100}–{VOTE_FLOOR} votes, so refused entry to the "
           "pool before quality was ever considered. Older, foreign-language and "
           "documentary films land here. NOTHING in the build compensates for this.")
    suggestions["under_floor"] = missing_from(below)

    # ── 3. Widely seen, modestly rated — what the reach floor is for ────────
    seen_lots = pages("/discover/movie", 12, sort_by="vote_count.desc",
                      **{"vote_count.gte": 2000})
    report("Widely seen, still not on the shelf", missing_from(seen_lots),
           "Thousands of people have rated these. If the per-genre reach floor "
           "is doing its job this list is short and unsurprising.")
    suggestions["widely_seen"] = missing_from(seen_lots)

    # ── 4. Is any decade starved? ───────────────────────────────────────────
    print(f"\n── By decade " + "─" * 66)
    print("   A shelf for 'your ten favourite films of all time' that holds forty")
    print("   films from before 1970 is a shelf about this century.")
    for start in range(1930, 2030, 10):
        got = sum(1 for f in have.values() if start <= f.get("y", 0) < start + 10)
        best = pages("/discover/movie", 2, sort_by="vote_count.desc",
                     **{"primary_release_date.gte": f"{start}-01-01",
                        "primary_release_date.lte": f"{start + 9}-12-31",
                        "vote_count.gte": 400})
        gap = missing_from(best)
        print(f"   {start}s: {got:>4} on the shelf   "
              f"top-40 by votes missing: {len(gap):>2}"
              + (f"   e.g. {gap[0]['title'][:34]}" if gap else ""))

    # ── 5. Is English-language canon crowding out everything else? ──────────
    print(f"\n── By language " + "─" * 64)
    for lang, label in (("fr", "French"), ("ja", "Japanese"), ("ko", "Korean"),
                        ("it", "Italian"), ("es", "Spanish"), ("de", "German"),
                        ("hi", "Hindi"), ("zh", "Chinese"), ("sv", "Swedish"),
                        ("da", "Danish"), ("fa", "Persian"), ("pt", "Portuguese")):
        got = sum(1 for f in have.values() if f.get("lang") == lang)
        best = pages("/discover/movie", 2, sort_by="vote_count.desc",
                     with_original_language=lang, **{"vote_count.gte": 200})
        gap = missing_from(best)
        print(f"   {label:<11} top-40 by votes missing: {len(gap):>2}"
              + (f"   e.g. {', '.join(m['title'][:26] for m in gap[:2])}" if gap else ""))
        suggestions[f"lang_{lang}"] = gap

    # ── 6. A paste-ready pin block ──────────────────────────────────────────
    if "--pins" in sys.argv:
        print("\n" + "=" * 78)
        print("SUGGESTED CANON ADDITIONS".center(78))
        print("=" * 78)
        print("# Paste into build_catalog.py's CANON tuple. Pinned titles skip the")
        print("# trim entirely, which is the mechanism for 'this belongs regardless")
        print("# of what its vote count says'. Read them first — this is a proposal,")
        print("# not a patch.\n")
        picked, out = set(), []
        for key in ("top_rated", "under_floor", "widely_seen"):
            for m in suggestions.get(key, [])[:40]:
                t = m.get("title")
                if t and t not in picked:
                    picked.add(t)
                    out.append(f'    "{t}",  # {m.get("release_date","")[:4]} '
                               f'{m.get("vote_average",0):.1f}/{m.get("vote_count",0)}')
        print("\n".join(out) if out else "    # nothing to add")

    print("\n" + "=" * 78)
    print("Every number above is a judgement, not a measurement. The point of the")
    print("report is that the judgements are now visible enough to argue with.")


if __name__ == "__main__":
    main()
