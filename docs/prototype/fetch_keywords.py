"""fetch_keywords.py — the tags that carry "heist", "procedural", "dystopia".

    python3 fetch_keywords.py

Writes `keywords.js`, a map of catalogue id to keyword list, loaded by the app
beside `catalog.js`.

WHY A SEPARATE FILE AND A SEPARATE SCRIPT.

`build_catalog.py` regenerates `catalog.js` wholesale. If keywords lived in
that file, every catalogue rebuild would silently drop them and nobody would
notice until a root stopped filling. A separate file is regenerated on its
own and can be rebuilt without touching the catalogue.

WHY KEYWORDS AT ALL (Mischa, 2026-11-18): roots are sets of tags, and the tag
space we had was genre (27, flat), decade, studio (21% of titles), director
and franchise. None of them carries the words people actually type. "Crime
dramas" is a genre pair; "crime procedurals" is a keyword, and without this
file the app can never offer it.

THE TRAP, measured before writing a line of the fetch: the two endpoints do
not agree on the shape of their own response.

    /movie/{id}/keywords  ->  { "id": …, "keywords": [ {id, name}, … ] }
    /tv/{id}/keywords     ->  { "id": …, "results":  [ {id, name}, … ] }

A fetcher that reads `keywords` gets every film and silently zero shows.
"""
import json
import os
import pathlib
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

API = "https://api.themoviedb.org/3"
KEY = os.environ["EXPO_PUBLIC_TMDB_API_KEY"]
WORKERS = 16            # TMDB tops out around 25 req/s from here either way
HERE = pathlib.Path(__file__).parent


# ── What a keyword has to be, to be a list subject ────────────────────────
#
# 11,074 distinct keywords came back and 859 of them reach ten titles. They
# are not one kind of thing. Read the top 200 and three classes fall out:
#
#   SUBJECTS   heist, dystopia, time travel, coming of age, neo-noir, spy,
#              serial killer, zombie, detective, small town, lgbt
#              -> exactly what Mischa asked for. Keep.
#
#   MOOD       amused (114), intense (113), suspenseful (97), excited (87),
#              bold, hilarious, absurd, admiring, audacious, awestruck…
#              -> TMDB tags how a film FEELS. "Top 10 Awestruck Movies" is
#                 not a list anybody wants. Block.
#
#   PIPELINE   duringcreditsstinger (245), aftercreditsstinger (222)
#              -> facts about the edit, invisible to a viewer. Block.
#
# Two more that have to go for structural reasons rather than taste:
#
#   BARE DECADES  1970s, 1960s, 1980s… duplicate the `decade` axis the app
#                 already has, and would let somebody build "Top 10 1970s
#                 Movies of the 90s".
#   woman director  a fact about the maker, not the film, and the app already
#                 has a `director` axis. A list of films by women directors is
#                 a fine thing to want; it should come from that axis, named
#                 deliberately, not from a tag that happens to be in the data.
MOOD = {
    "amused", "intense", "suspenseful", "excited", "dramatic", "bold",
    "hilarious", "absurd", "admiring", "aggressive", "audacious",
    "enthusiastic", "awestruck", "cheerful", "adoring", "inspirational",
    "hopeful", "ambiguous", "complex", "whimsical", "playful", "powerful",
    "nostalgic", "melancholy", "shocking", "vibrant", "philosophical",
    "joyful", "compassionate", "frightened", "anxious", "tragic",
    "antagonistic", "lighthearted", "thoughtful", "appreciative",
    "cautionary", "witty", "tense", "angry", "empathetic", "sentimental",
    "gripping", "chilling", "heartwarming", "uplifting", "bleak", "quirky",
    "charming", "moving", "disturbing", "unsettling", "exhilarating",
    "poignant", "sombre", "somber", "wistful", "euphoric", "dreamy",
}
PIPELINE = {"duringcreditsstinger", "aftercreditsstinger", "woman director"}

import re as _re
_DECADE = _re.compile(r"^(18|19|20)\d0s$")


def keepable(kw):
    """True if this keyword could head a list somebody would want."""
    if kw in MOOD or kw in PIPELINE:
        return False
    if _DECADE.match(kw):
        return False
    return True


def get(path, **params):
    params["api_key"] = KEY
    url = f"{API}{path}?{urllib.parse.urlencode(params)}"
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return {}
        except Exception:
            pass
    return {}


def catalogue():
    """Ids and kinds, read out of the generated catalogue.

    `catalog.js` holds more than one assignment — the titles, then the
    streaming-service table. Taking everything between the first "[" and the
    last "]" spans both and parses as nothing, so the array is decoded from
    its own marker and allowed to end where it ends.
    """
    src = (HERE / "catalog.js").read_text()
    marker = "window.CATALOG = "
    start = src.index(marker) + len(marker)
    rows, _ = json.JSONDecoder().raw_decode(src, start)
    return [(f["id"], f.get("dm") or "movie") for f in rows]


def keywords_for(item):
    tid, kind = item
    data = get(f"/{kind}/{tid}/keywords")
    # movies answer under "keywords", shows under "results" — see the header.
    raw = data.get("keywords") if kind == "movie" else data.get("results")
    return tid, sorted({k["name"].strip().lower() for k in (raw or []) if k.get("name")})


def main():
    items = catalogue()
    raw_path = HERE / "keywords.raw.json"

    # The RAW fetch is cached, so changing what counts as a list subject never
    # costs 3,469 more API calls. The cache is gitignored; keywords.js is not.
    if raw_path.exists() and "--refetch" not in sys.argv:
        raw = {int(k): v for k, v in json.loads(raw_path.read_text()).items()}
        print(f"{len(raw)} titles from keywords.raw.json (--refetch to go again)")
    else:
        print(f"{len(items)} titles, {WORKERS} at a time")
        raw, done = {}, 0
        with ThreadPoolExecutor(max_workers=WORKERS) as pool:
            for tid, kws in pool.map(keywords_for, items):
                if kws:
                    raw[tid] = kws
                done += 1
                if done % 250 == 0:
                    print(f"  {done}/{len(items)}", flush=True)
        raw_path.write_text(json.dumps(raw, separators=(",", ":"), sort_keys=True))

    dropped = {}
    out = {}
    for tid, kws in raw.items():
        keep = []
        for k in kws:
            (keep.append(k) if keepable(k) else dropped.setdefault(k, 0))
            if not keepable(k):
                dropped[k] = dropped.get(k, 0) + 1
        if keep:
            out[tid] = keep
    print(f"dropped {len(dropped)} keyword kinds as mood, pipeline or duplicate-axis")

    tagged = len(out)
    total = sum(len(v) for v in out.values())
    distinct = len({k for v in out.values() for k in v})
    counts = {}
    for v in out.values():
        for k in v:
            counts[k] = counts.get(k, 0) + 1
    fillable = sum(1 for n in counts.values() if n >= 10)

    body = json.dumps(out, separators=(",", ":"), sort_keys=True)
    (HERE / "keywords.js").write_text(
        "// Generated by fetch_keywords.py — TMDB keywords, id -> tag list.\n"
        "// Kept out of catalog.js on purpose: build_catalog.py rewrites that\n"
        "// file wholesale and would drop these without a word.\n"
        "// Data courtesy of TMDB; this product uses the TMDB API but is not\n"
        "// endorsed or certified by TMDB.\n"
        f"window.KEYWORDS = {body};\n"
    )

    print(f"\n{tagged} of {len(items)} titles tagged "
          f"({round(tagged / len(items) * 100)}%)")
    print(f"{total} keyword uses, {distinct} distinct")
    print(f"{fillable} keywords reach ten titles — those are the ones that can carry a root")
    print("\ntop 20:")
    for k, n in sorted(counts.items(), key=lambda kv: -kv[1])[:20]:
        print(f"  {n:5}  {k}")
    size = (HERE / "keywords.js").stat().st_size
    print(f"\nkeywords.js  {size // 1024}KB")


if __name__ == "__main__":
    sys.exit(main())
