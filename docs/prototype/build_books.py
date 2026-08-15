"""Add books to the baked catalog — the third domain (Mischa, 2026-08-15).

Mirrors build_tv.py's shape so the prototype needs no per-domain code paths:
same fields, same dominant-color pass, plus the axes that are a book's
equivalent of a film's authorship — the author, the series, the imprint.

Book ids are offset by BOOK_OFFSET because every catalog the app reads numbers
its own things from 1. Films use raw TMDB ids, shows use 10_000_000 + id,
books use 20_000_000 + id. One id space in the app, one place where that is
arranged.

WHY THESE SOURCES (2026-08-15, Claude — see specs/prd.md Req 6 amendment)

The obvious book catalogs are not reachable from the build container: this
session's egress proxy refuses CONNECT to openlibrary.org and to
covers.openlibrary.org (403), and www.googleapis.com/books/v1 answers every
request with `Quota exceeded ... limit "Queries per day" ... quota_limit_value
"0"`. Verified with curl before a line of this was written; do not "fix" this
script by pointing it back at them without re-checking.

What IS reachable is raw.githubusercontent.com, so all three sources are files
in public GitHub repositories:

  1. zygmuntz/goodbooks-10k — the 10,000 most-rated books on Goodreads.
     Supplies the thing nothing else here has: a reliable ORIGINAL publication
     year, plus the Goodreads rating and rating count that make "well known"
     measurable, plus 6M user ratings that give a real "often read together"
     edge rather than a guessed one.
  2. scostap/goodreads_bbe_dataset — Goodreads "Best Books Ever", 52,478 rows.
     Supplies clean genre lists, series names, and the edition's publisher.
     Its firstPublishDate is MM/DD/YY with a two-digit year ("01/28/13" for
     Pride and Prejudice), so it is useless for a year and is never used for
     one.
  3. standardebooks/* — one repo per book, each holding a public-domain cover
     under images/cover.jpg, and Dublin Core metadata under
     src/epub/content.opf.

Standard Ebooks is what bounds the shelf, and that is a deliberate trade.
Every cover host that carries modern books (Goodreads' own i.gr-assets.com,
Amazon, Google Books, Open Library) is blocked here, and a books shelf whose
artwork is missing is not a books shelf — the whole screen is artwork. Standard
Ebooks' covers are reachable AND released CC0, which additionally makes them
the only book artwork we are allowed to mirror into this repo (TMDB's licence
forbids exactly that for the film posters, which is why those are fetched at
runtime). The cost is that the shelf is public-domain classics only; that is
recorded in specs/prd.md rather than hidden.

There is no way to LIST the Standard Ebooks org from here — api.github.com is
scoped to this session's own repositories — so repo names are derived from the
author and title we already have and then VERIFIED by asking for the cover.
A book only reaches the shelf if its cover really answered 200. That is the
inherited "check ids, don't trust them" rule, applied to a repo slug.

Run:  python3 build_books.py          (≈20 min cold, ≈1 min with a warm cache)
      BOOKS_CACHE=/some/dir python3 build_books.py
"""

import ast
import colorsys
import csv
import io
import json
import math
import os
import re
import tempfile
import unicodedata
import urllib.error
import urllib.request
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "books.js")
COVERS = os.path.join(HERE, "covers")
CACHE = os.environ.get("BOOKS_CACHE", os.path.join(tempfile.gettempdir(), "topten-books-cache"))
BOOK_OFFSET = 20_000_000
TARGET = 500
RAW = "https://raw.githubusercontent.com"
SE = f"{RAW}/standardebooks"
GB = f"{RAW}/zygmuntz/goodbooks-10k/master"
BBE = f"{RAW}/scostap/goodreads_bbe_dataset/main/Best_Books_Ever_dataset/books_1.Best_Books_Ever.csv"

# The mirrored cover. 240px wide is twice the 120pt card the prototype draws,
# which is the size at which these are actually judged; the full Standard
# Ebooks artwork averages 680KB and a shelf of those is a page nobody waits for.
COVER_W = 240
COVER_Q = 72
TYPESET_W = 560          # where the cover's own typography is drawn, before downscaling
# League Spartan is the typeface on every Standard Ebooks cover. Fetched from
# the Google Fonts repository because fonts.google.com itself is not reachable
# from this container and the SE org cannot be listed from here either.
FONT_URL = "https://raw.githubusercontent.com/google/fonts/main/ofl/leaguespartan/LeagueSpartan%5Bwght%5D.ttf"

# Imprints whose name is a promise — the same allowlist test the film side
# applies to studios and the TV side to networks. This axis is weaker for books
# than for films and is treated as such: a publisher here is the EDITION's
# imprint, not the work's, so only names a reader would follow are allowed
# through, and each one is verified against the built shelf below before it is
# allowed to label anything.
IMPRINTS = [
    "Penguin Classics", "Oxford University Press", "Vintage", "Modern Library",
    "Everyman's Library", "Dover Publications", "Bantam Classics",
    "Signet Classics", "W. W. Norton & Company", "Harper Perennial",
    "Faber & Faber", "New York Review Books", "Picador", "Scribner",
    "Vintage Classics", "Penguin Books",
]
# What the scraped publisher string has to start with to count as that imprint.
IMPRINT_MATCH = {
    "Penguin Classics": ("penguin classics",),
    "Penguin Books": ("penguin books", "penguin"),
    "Oxford University Press": ("oxford university press", "oxford univ"),
    "Vintage Classics": ("vintage classics",),
    "Vintage": ("vintage",),
    "Modern Library": ("modern library",),
    "Everyman's Library": ("everyman's library", "everymans library"),
    "Dover Publications": ("dover",),
    "Bantam Classics": ("bantam classics",),
    "Signet Classics": ("signet classics", "signet"),
    "W. W. Norton & Company": ("w. w. norton", "w.w. norton", "norton"),
    "Harper Perennial": ("harper perennial",),
    "Faber & Faber": ("faber",),
    "New York Review Books": ("new york review books", "nyrb"),
    "Picador": ("picador",),
    "Scribner": ("scribner",),
}

# Goodreads shelves are not genres. These are the ones that say nothing about
# a book because they are true of nearly every book on a classics shelf, or
# because they describe the reader rather than the book.
STOP_GENRES = {
    "classics", "fiction", "literature", "books", "novels", "adult", "owned",
    "school", "audiobook", "read-for-school", "unfinished", "book-club",
    "read", "to-read", "favorites", "currently-reading", "default", "kindle",
    "ebook", "library", "classic-literature", "literary-fiction", "novel",
    "translated", "english", "british", "american", "19th-century",
    "20th-century", "literatura", "roman", "own", "want-to-read",
}
# Shelf tags, canonicalized to the genre names the badge motifs already know.
CANON = {
    "science-fiction": "Science Fiction", "sci-fi": "Science Fiction",
    "scifi": "Science Fiction", "fantasy": "Fantasy", "horror": "Horror",
    "mystery": "Mystery", "crime": "Crime", "thriller": "Thriller",
    "romance": "Romance", "historical-fiction": "Historical", "history": "History",
    "historical": "Historical", "adventure": "Adventure", "war": "War",
    "philosophy": "Philosophy", "poetry": "Poetry", "plays": "Drama",
    "drama": "Drama", "humor": "Comedy", "humour": "Comedy", "comedy": "Comedy",
    "childrens": "Family", "children-s": "Family", "young-adult": "Family",
    "gothic": "Gothic", "short-stories": "Short Stories", "biography": "Biography",
    "memoir": "Biography", "nonfiction": "Nonfiction", "non-fiction": "Nonfiction",
    "religion": "Religion", "psychology": "Psychology", "science": "Science",
    "westerns": "Western", "western": "Western", "dystopia": "Dystopia",
    "satire": "Satire", "essays": "Essays", "travel": "Travel", "music": "Music",
    "detective": "Mystery", "vampires": "Horror", "ghosts": "Horror",
    "russian-literature": "Russian", "politics": "Politics", "spirituality": "Religion",
    "self-help": "Self-help", "art": "Art", "sociology": "Sociology",
    "feminism": "Feminism", "novella": "Short Stories", "fairy-tales": "Fairy Tales",
    "mythology": "Mythology", "epic": "Mythology", "war-ii": "War",
}


# ── Fetching, cached on disk so a re-run costs a minute, not twenty ─────────
def cached(name, produce, binary=True):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, name)
    if os.path.exists(path):
        with open(path, "rb") as fh:
            return fh.read()
    data = produce()
    if data is None:
        return None
    with open(path, "wb") as fh:
        fh.write(data)
    return data


def get(url, timeout=120):
    for _ in range(3):
        try:
            with urllib.request.urlopen(url, timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
        except Exception:
            pass
    return None


def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = s.lower().replace("&", " and ").replace("'", "").replace("’", "")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def norm(s):
    """A join key. Two catalogs spell the same book differently; this is the
    part of a title and an author they agree on."""
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"\s*[\(\[].*$", "", s)
    s = re.sub(r"^(the|a|an)\s+", "", s)
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def strip_series(title):
    return re.sub(r"\s*[\(\[][^\)\]]*[#\)\]].*$", "", title).strip() or title.strip()


def series_from_title(title):
    """goodbooks-10k writes the series into the title: "The Hound of the
    Baskervilles (Sherlock Holmes, #5)". That parenthetical is real source
    data, not a guess."""
    m = re.search(r"[\(\[]([^\)\]]+?)(?:,?\s*#[\d.\-]+)?[\)\]]\s*$", title)
    if not m:
        return None
    name = m.group(1).strip(" ,")
    if not name or re.fullmatch(r"[\d\s#.,-]+", name):
        return None
    if len(name) > 44 or name.lower() in ("novel", "unabridged", "illustrated"):
        return None
    return name


# ── 1. goodbooks-10k: the famous books, with years that can be trusted ──────
print("fetching goodbooks-10k …")
books_csv = cached("goodbooks_books.csv", lambda: get(f"{GB}/books.csv"))
tags_csv = cached("goodbooks_tags.csv", lambda: get(f"{GB}/tags.csv"))
book_tags_csv = cached("goodbooks_book_tags.csv", lambda: get(f"{GB}/book_tags.csv"))
if not books_csv:
    raise SystemExit("goodbooks-10k is unreachable — nothing to build from.")

gb_rows = list(csv.DictReader(io.StringIO(books_csv.decode("utf-8"))))
print(f"  {len(gb_rows)} books")

tag_name = {r["tag_id"]: r["tag_name"] for r in csv.DictReader(io.StringIO(tags_csv.decode("utf-8")))}
shelves = defaultdict(list)
for r in csv.DictReader(io.StringIO(book_tags_csv.decode("utf-8"))):
    shelves[r["goodreads_book_id"]].append((int(r["count"]), tag_name.get(r["tag_id"], "")))

# ── 2. Best Books Ever: genres, series, imprint ─────────────────────────────
print("fetching Best Books Ever (74MB) …")
csv.field_size_limit(10 ** 9)
bbe_csv = cached("bbe.csv", lambda: get(BBE, timeout=600))
bbe = {}
if bbe_csv:
    for r in csv.DictReader(io.StringIO(bbe_csv.decode("utf-8", "replace"))):
        key = (norm(r["title"]), norm(r["author"].split(",")[0]))
        try:
            n = int(r["numRatings"])
        except Exception:
            n = 0
        if key not in bbe or n > bbe[key][0]:
            bbe[key] = (n, r)
    print(f"  {len(bbe)} distinct works")
else:
    print("  unavailable — genres will fall back to Goodreads shelves")


# ── 3. Standard Ebooks: does a repo exist for this book? ────────────────────
def candidates(row):
    author = row["authors"].split(",")[0].strip()
    a = slug(author)
    out = []
    for t in (row["original_title"], row["title"]):
        t = strip_series(t or "")
        if not t:
            continue
        s = slug(t)
        for v in (s, re.sub(r"^(the|a|an)-", "", s)):
            repo = f"{a}_{v}"
            if v and repo not in out:
                out.append(repo)
    return out


def head_ok(repo):
    req = urllib.request.Request(f"{SE}/{repo}/master/images/cover.jpg", method="HEAD")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status == 200
    except Exception:
        return False


def maybe_public_domain(row):
    """Standard Ebooks only publishes what is public domain in the US, so a
    2011 novel is 10,000 wasted requests. 1964 rather than 1930 because the
    1929-1963 copyright-renewal gap put a fair number of mid-century books
    into the public domain too, and because a missing year is not a no."""
    try:
        return int(float(row["original_publication_year"])) <= 1964
    except Exception:
        return True


probe_path = os.path.join(CACHE, "se_probe.json")
probed = json.load(open(probe_path)) if os.path.exists(probe_path) else {}
wanted = []
for row in gb_rows:
    if not maybe_public_domain(row):
        continue
    for repo in candidates(row):
        if repo not in probed:
            wanted.append(repo)
wanted = list(dict.fromkeys(wanted))
print(f"probing {len(wanted)} Standard Ebooks repo names …")
if wanted:
    os.makedirs(CACHE, exist_ok=True)
    with ThreadPoolExecutor(max_workers=32) as pool:
        for repo, ok in zip(wanted, pool.map(head_ok, wanted)):
            probed[repo] = ok
    json.dump(probed, open(probe_path, "w"))
print(f"  {sum(1 for v in probed.values() if v)} of {len(probed)} names are real repos")

# One repo per book, and one book per repo: the first candidate that verified.
resolved, taken = {}, set()
for row in gb_rows:
    if not maybe_public_domain(row):
        continue
    for repo in candidates(row):
        if probed.get(repo) and repo not in taken:
            resolved[row["book_id"]] = repo
            taken.add(repo)
            break
print(f"{len(resolved)} books have a verified Standard Ebooks cover")

by_id = {r["book_id"]: r for r in gb_rows}


# ── Metadata from the ebook itself ──────────────────────────────────────────
def opf(repo):
    raw = cached(f"opf_{repo}.xml", lambda: get(f"{SE}/{repo}/master/src/epub/content.opf"))
    if not raw:
        return {}
    x = raw.decode("utf-8", "replace")
    head = x[: x.find("<manifest")] if "<manifest" in x else x
    out = {}
    m = re.search(r'<dc:title[^>]*>(.*?)</dc:title>', head, re.S)
    if m:
        out["title"] = re.sub(r"\s+", " ", m.group(1)).strip()
    authors = re.findall(r'<dc:creator[^>]*>(.*?)</dc:creator>', head, re.S)
    if authors:
        out["authors"] = [re.sub(r"\s+", " ", a).strip() for a in authors]
    subs = re.findall(r'<dc:subject[^>]*>(.*?)</dc:subject>', head, re.S)
    out["subjects"] = [re.sub(r"\s+", " ", s).strip() for s in subs]

    # A Standard Ebooks "collection" is two different things wearing one tag:
    # collection-type="series" is Sherlock Holmes, collection-type="set" is
    # "Le Monde's 100 Books of the Century". Taking the first one gave Pride
    # and Prejudice a series of "The BBC's 100 Greatest British Novels (2015)",
    # which the app would then have offered as "More The BBC's 100 Greatest…".
    # Only a series is a series. (The award sets are a good rail of their own
    # one day — noted in specs/prd.md, not used here.)
    types = dict(re.findall(r'<meta property="collection-type" refines="#([^"]+)"[^>]*>(.*?)</meta>', head, re.S))
    for tag, name in re.findall(r'<meta ([^>]*property="belongs-to-collection"[^>]*)>(.*?)</meta>', head, re.S):
        cid = re.search(r'id="([^"]+)"', tag)
        if cid and types.get(cid.group(1), "").strip() == "series":
            out["series"] = re.sub(r"\s+", " ", name).strip()
            break
    return out


print("reading Standard Ebooks metadata …")
with ThreadPoolExecutor(max_workers=16) as pool:
    opfs = dict(zip(resolved, pool.map(opf, resolved.values())))


# ── Genres ─────────────────────────────────────────────────────────────────
def canon_genres(names):
    out = []
    for raw_name in names:
        key = re.sub(r"[^a-z0-9]+", "-", str(raw_name).lower()).strip("-")
        if key in STOP_GENRES:
            continue
        name = CANON.get(key)
        if not name:
            if len(key) > 22 or "-" in key and key not in CANON:
                continue
            name = str(raw_name).strip().title()
        if name and name not in out:
            out.append(name)
    return out


def genres_for(bid, row):
    key = (norm(row["title"]), norm(row["authors"].split(",")[0]))
    hit = bbe.get(key) or bbe.get((norm(row["original_title"] or ""), key[1]))
    if hit:
        try:
            got = canon_genres(ast.literal_eval(hit[1]["genres"]))
        except Exception:
            got = []
        if got:
            return got[:3], hit[1]
    top = [t for _, t in sorted(shelves.get(row["goodreads_book_id"], []), reverse=True)][:25]
    return canon_genres(top)[:3], (hit[1] if hit else None)


# ── Often read together: 6M real Goodreads ratings, not a guess ────────────
print("fetching goodbooks-10k ratings (72MB) for the co-read edge …")
ratings_csv = cached("goodbooks_ratings.csv", lambda: get(f"{GB}/ratings.csv", timeout=900))
co = defaultdict(Counter)
if ratings_csv:
    liked = defaultdict(list)
    ours = set(resolved)
    reader = csv.DictReader(io.StringIO(ratings_csv.decode("utf-8")))
    for r in reader:
        if r["book_id"] in ours and int(r["rating"]) >= 4:
            liked[r["user_id"]].append(r["book_id"])
    for uid, ids in liked.items():
        if len(ids) < 2 or len(ids) > 40:
            continue
        for a in ids:
            for b in ids:
                if a != b:
                    co[a][b] += 1
    print(f"  {len(liked)} readers contributed")
else:
    print("  unavailable — books will have no co-read edge")


# ── Covers: mirror, downscale, and take the dominant color ─────────────────
def dominant_color(im):
    """The same pass build_tv.py runs on a poster: bucket the pixels in HLS,
    drop the greys and the extremes, and take the most common bucket back to
    a usable mid-tone."""
    im = im.convert("RGB").resize((23, 34))
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


def typeset(im, svg):
    """images/cover.jpg is only half of a Standard Ebooks cover: the artwork.
    The other half is images/cover.svg, which lays that artwork under a
    translucent box and sets the title and author over it in League Spartan.
    Without this pass every book on the shelf is an untitled painting, and a
    reader scanning a shelf of paintings cannot find a book. So the SVG is
    replayed here rather than approximated — its own box, its own coordinates,
    its own typeface (fetched from Google Fonts, the same open family).
    Anything unparseable falls back to the bare artwork."""
    if not svg or not FONT:
        return im, False
    # A long title is set in its own class — title-small, title-xsmall — so the
    # size is read per class rather than assumed. Matching only "title" left
    # The Decline and Fall of the Roman Empire wearing nothing but its author.
    sizes = dict(re.findall(r"\.([a-z][a-z-]*)\s*\{\s*font-size:\s*([\d.]+)px", svg))
    box = re.search(r'class="title-box"[^>]*d="M\s*([\d.,\s]+?)Z"', svg)
    lines = re.findall(r'<text class="([a-z][a-z-]*)" x="([\d.]+)" y="([\d.]+)"[^>]*>(.*?)</text>', svg)
    spacing = float((re.search(r"letter-spacing:\s*([\d.]+)px", svg) or [0, 5])[1])
    if not (sizes and box and lines):
        return im, False

    scale = TYPESET_W / 1400.0                     # the SVG's own viewBox is 1400×2100
    base = im.convert("RGB").resize((TYPESET_W, int(TYPESET_W * 1.5)), Image.LANCZOS)
    pts = [tuple(float(v) for v in p.split(",")) for p in box.group(1).split() if "," in p]
    if len(pts) >= 4:
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        shade = Image.new("RGBA", base.size, (0, 0, 0, 0))
        ImageDraw.Draw(shade).rectangle(
            [min(xs) * scale, min(ys) * scale, max(xs) * scale, max(ys) * scale], fill=(0, 0, 0, 191))
        base = Image.alpha_composite(base.convert("RGBA"), shade).convert("RGB")

    draw = ImageDraw.Draw(base)
    for cls, x, y, text in lines:
        text = re.sub(r"<[^>]+>", "", text)
        text = re.sub(r"&#(\d+);", lambda m: chr(int(m.group(1))), text).replace("&amp;", "&").strip()
        if not text:
            continue
        font = ImageFont.truetype(io.BytesIO(FONT), max(int(float(sizes.get(cls, 40)) * scale), 6))
        gap = spacing * scale
        widths = [draw.textlength(ch, font=font) for ch in text]
        cx = float(x) * scale - (sum(widths) + gap * max(len(text) - 1, 0)) / 2
        for ch, w in zip(text, widths):
            draw.text((cx, float(y) * scale), ch, font=font, fill=(255, 255, 255), anchor="ls")
            cx += w + gap
    return base, len(lines) >= 2


def cover(job):
    bid, repo = job
    raw = cached(f"cover_{repo}.jpg", lambda: get(f"{SE}/{repo}/master/images/cover.jpg", timeout=180))
    if not raw:
        return bid, None, None, False
    svg = cached(f"cover_{repo}.svg", lambda: get(f"{SE}/{repo}/master/images/cover.svg"))
    try:
        im = Image.open(io.BytesIO(raw))
        # The color is taken from the artwork, before the title box darkens it —
        # it stands in for the book on badges and placeholders, where what is
        # wanted is the picture's color, not the typography's.
        color = dominant_color(im)
        drawn, titled = typeset(im, svg.decode("utf-8", "replace") if svg else None)
        thumb = drawn.convert("RGB")
        thumb.thumbnail((COVER_W, COVER_W * 3), Image.LANCZOS)
        os.makedirs(COVERS, exist_ok=True)
        name = f"{BOOK_OFFSET + int(bid)}.jpg"
        thumb.save(os.path.join(COVERS, name), "JPEG", quality=COVER_Q, optimize=True, progressive=True)
        return bid, f"covers/{name}", color, titled
    except Exception as e:
        print("  cover failed", repo, e)
        return bid, None, None, False


FONT = cached("league-spartan.ttf", lambda: get(FONT_URL))
if not FONT:
    print("  League Spartan unavailable — covers will carry artwork without their titles")

print(f"mirroring {len(resolved)} covers …")
art, titled = {}, 0
with ThreadPoolExecutor(max_workers=12) as pool:
    for bid, path, color, got_type in pool.map(cover, list(resolved.items())):
        if path:
            art[bid] = (path, color)
            titled += bool(got_type)
print(f"  {len(art)} covers mirrored into {COVERS}; {titled} carry their own title and author")
if art and titled < len(art):
    print(f"  {len(art) - titled} covers are artwork only — their cover.svg did not parse")

# ── Assemble ───────────────────────────────────────────────────────────────
books = {}
imprint_hits = Counter()
for bid, repo in resolved.items():
    if bid not in art:
        continue
    row = by_id[bid]
    try:
        year = int(float(row["original_publication_year"]))
    except Exception:
        continue                      # a book with no year is a book we cannot place
    if not 1000 < year <= 2026:
        continue
    meta = opfs.get(bid) or {}
    title = meta.get("title") or strip_series(row["original_title"] or row["title"])
    authors = meta.get("authors") or [a.strip() for a in row["authors"].split(",")]
    g, bbe_row = genres_for(bid, row)
    series = meta.get("series") or series_from_title(row["title"]) or (
        re.sub(r"\s*#[\d.\-]+\s*$", "", bbe_row["series"]).strip() if bbe_row and bbe_row.get("series") else None)

    imprint = None
    if bbe_row and bbe_row.get("publisher"):
        pub = bbe_row["publisher"].strip().lower()
        for name in IMPRINTS:
            if any(pub.startswith(p) for p in IMPRINT_MATCH[name]):
                imprint = name
                imprint_hits[name] += 1
                break

    path, color = art[bid]
    b = {
        "id": BOOK_OFFSET + int(bid), "gb": int(bid), "dm": "book",
        "t": title,
        "y": year,
        "p": path,
        "img": path,
        "g": g,
        # One field, one scale. Goodreads rates out of five and TMDB out of
        # ten, and `v` is compared and sorted in code that does not know which
        # domain it is holding, so books are stored on the app's scale.
        "v": round(float(row["average_rating"]) * 2, 1),
        "vc": int(row["ratings_count"]),
        "d": authors[0],
        "c": color or "#6E675D",
    }
    if len(authors) > 1:
        b["ca"] = authors[1:3]
    if series:
        b["col"] = series
    if imprint:
        b["br"] = [imprint]
    books[bid] = b

standing = lambda b: b["v"] * math.log10(max(b["vc"], 10))
books = dict(sorted(books.items(), key=lambda kv: -standing(kv[1]))[:TARGET])
print(f"{len(books)} books on the shelf")

# Verify the imprint allowlist against what was actually built, the same test
# build_tv.py runs on its network ids: a name that labels one book is not a
# name anybody follows, so it is dropped rather than shown.
kept = {n for n, c in imprint_hits.items() if c >= 3}
dropped = sorted(set(imprint_hits) - kept)
for b in books.values():
    if b.get("br") and b["br"][0] not in kept:
        del b["br"]
print("imprints kept:", ", ".join(f"{n}×{imprint_hits[n]}" for n in sorted(kept)) or "none")
print("imprints dropped (fewer than 3 books):", ", ".join(dropped) or "none")

# Related books, now that the shelf is final.
in_catalog = set(books)
for bid, b in books.items():
    rel = [BOOK_OFFSET + int(o) for o, n in co[bid].most_common(40) if o in in_catalog and n >= 3]
    if rel:
        b["r"] = rel[:10]

with open(OUT, "w") as fh:
    fh.write("/* Books — built by build_books.py from Standard Ebooks (covers, CC0),\n"
             "   goodbooks-10k (years, ratings, co-read edges) and Goodreads Best Books\n"
             "   Ever (genres, series, imprint). Separate file from catalog.js so the\n"
             "   two builders never write the same bytes. */\n")
    fh.write("window.CATALOG_BOOKS = ")
    json.dump(list(books.values()), fh, ensure_ascii=False, separators=(",", ":"))
    fh.write(";\n")

pct = lambda f: f"{round(100 * sum(1 for b in books.values() if f(b)) / max(len(books), 1))}%"
print("field coverage —",
      "author:", pct(lambda b: b.get("d")),
      "| series:", pct(lambda b: b.get("col")),
      "| imprint:", pct(lambda b: b.get("br")),
      "| genres:", pct(lambda b: b.get("g")),
      "| related:", pct(lambda b: b.get("r")),
      "| color:", pct(lambda b: b.get("c")),
      "| cover:", pct(lambda b: b.get("img")))
print("sample:", [(b["t"], b["y"], b["d"], b.get("col"), b.get("br")) for b in list(books.values())[:5]])
print("books.js:", os.path.getsize(OUT), "bytes ·",
      "covers:", sum(os.path.getsize(os.path.join(COVERS, f)) for f in os.listdir(COVERS)), "bytes")
