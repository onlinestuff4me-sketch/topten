/* Drive the prototype end to end in a real browser at iPhone size.
   Tests judge behaviour; the screenshots this also writes judge layout.
   A run that cannot fail proves nothing, so every step asserts.

   Run:  npm i playwright && node drive.js [baseURL]
   Posters are served from POSTER_MIRROR if set (see build_catalog.py); this
   container cannot reach image.tmdb.org from Chromium, a real phone can. */
const { chromium, devices } = require('playwright');
const fs = require('fs');

/* Chromium: an explicit CHROMIUM wins, then this machine's pre-installed
   browser, then Playwright's own download. The path was hard-coded once and
   worked only on the box it was written on — CI has its browser somewhere
   else. */
const CHROME = process.env.CHROMIUM
  || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

const BASE = process.argv[2] || 'http://127.0.0.1:8788';
const SHOTS = process.env.SHOTS || './shots';
const MIRROR = process.env.POSTER_MIRROR || './posters';


/* The inscription, read off the badge itself.

   It used to be read from a separate line of DOM text under the badge. The
   reveal now strikes it onto the badge's ribbon, letter by letter, which is
   what design.md's `revealSequence` always specified ("inscription last,
   letter-by-letter") and what every other surface already drew. Reading the
   drawn tspans is also the stronger assertion: it proves the words are ON
   the artifact rather than merely somewhere on the screen. */
const badgeInscription = page => page.evaluate(() => {
  const t = document.querySelector('.vault #l-ribbon text');
  return t ? t.textContent.trim() : '';
});


/* ── 44x44, hit-tested ──────────────────────────────────────────────────────
   AGENTS.md sets a 44x44pt floor on touch targets. It had never been
   measured, and a sweep found 62 controls under it - including the ten
   sheet's reorder arrows, which design.md names as the ACCESSIBLE path for
   ranking ("Ranking must be fully operable without drag").

   This does not measure the element's box. A control may look 32px tall and
   carry a larger hit area through padding, a label or a pseudo-element -
   that is what Apple's own small controls do, and a box measurement calls
   those failures. It asks the real question: if a thumb lands anywhere in
   the 44x44 region centred on this control, does the tap reach it.

   Three things the test had to learn, each of which made it lie first:

   - EDGE MIDPOINTS, not corners. The corners of a 44x44 square fall outside
     a 64x44 pill's rounded ends - a point 21px left and 21px up from a
     filter chip's centre is 23.5px from the arc centre and the radius is 22
     - so a corner test failed every pill in the app however large.
   - SKIP WHAT IS OCCLUDED. A control behind an open sheet or under the dock
     is unreachable by design; counting those buried the real findings under
     a hundred false ones.
   - SKIP WHAT RUNS OFF THE SCREEN. A probe point clamped to the viewport
     edge lands on whatever is there and reports a miss nobody caused.

   It catches the opposite fault for free: if a fix gives one control an
   expanded area that covers a neighbour's edge, the neighbour fails. A
   target that silently steals its neighbour's taps is worse than a small
   one, which is why the stacked reorder arrows were fixed by growing the
   row rather than by overlapping hit areas. */
/* Backslashes in here are DOUBLED on purpose.

   These checks are template literals evaluated in the page, and a template
   literal processes escapes before the browser ever sees the text: `\(`
   becomes `(` and `\s` becomes the letter `s`. That silently turned

       /rgba?\\(([^)]+)\\)/      into      /rgba?(([^)]+))/

   so parsing "rgb(201, 162, 39)" captured "(201, 162, 39", Number() of that
   is NaN, every contrast ratio was NaN, and `NaN < need` is false - the
   check examined every element on every screen and could not report a
   failure if one existed. It passed a deliberately planted 2.1:1 element.

   This is the third escape-in-a-template bug today (a backtick quoting a CSS
   selector closed badge.js's string; another closed this file's). The rule:
   nothing inside one of these strings is read by a JS parser the way it
   looks. Double every backslash, and never use a backtick. */

/* ── VoiceOver: every control named, every rank spoken ──────────────────────
   AGENTS.md: "VoiceOver pass on every new screen; ranked positions announced
   meaningfully." design.md: "Rank announced semantically: 'Number one: Pulp
   Fiction' - numerals are never unlabeled decoration."

   A screen reader cannot be run here, but what it would read can be checked:
   every interactive control resolves to an accessible name, and no rank
   numeral is left as a bare digit. Name resolution follows the spec's order
   - aria-labelledby, aria-label, content, title - which is enough to catch a
   control with nothing at all.

   Two things this found. The discover cards' preview strips read as
   "1 2 3 4 5 6" with nothing attached, and the splash's hero grid read as
   "1 2 3 4 5 6 7 8 9 10" on the first screen of the app. Both are now a
   single labelled image announcing their list in order, because six or ten
   separate announcements ahead of a card's own call to action would bury it.

   Backslashes are doubled in here. See the banner above TAP_SWEEP. */
const VO_SWEEP = `(() => {
  const nameOf = el => {
    const by = el.getAttribute('aria-labelledby');
    if (by) {
      const t = by.split(/\\s+/).map(id => (document.getElementById(id) || {}).textContent || '').join(' ').trim();
      if (t) return t;
    }
    const al = el.getAttribute('aria-label');
    if (al && al.trim()) return al.trim();
    if (el.tagName === 'IMG') return (el.getAttribute('alt') || '').trim();
    if (el.tagName === 'INPUT') {
      const ph = el.getAttribute('placeholder');
      const lab = el.labels && el.labels[0];
      if (lab && lab.textContent.trim()) return lab.textContent.trim();
      if (ph && ph.trim()) return ph.trim();
      return (el.value || '').trim();
    }
    const txt = (el.innerText || el.textContent || '').replace(/\\s+/g, ' ').trim();
    if (txt) return txt;
    return (el.getAttribute('title') || '').trim();
  };

  const unnamed = [], hiddenTrap = [], bareNumerals = [];
  for (const el of document.querySelectorAll('button, a[href], input, select, textarea, [role="button"]')) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    if (el.getAttribute('aria-hidden') === 'true' || el.closest('[aria-hidden="true"]')) {
      hiddenTrap.push({ sel: el.tagName.toLowerCase() + '.' + String(el.className).split(/\\s+/)[0],
                        name: nameOf(el).slice(0, 24) });
      continue;
    }
    const n = nameOf(el);
    if (!n) unnamed.push({
      sel: el.tagName.toLowerCase() + '.' + String(el.className).split(/\\s+/)[0],
      w: Math.round(r.width), h: Math.round(r.height),
      html: el.outerHTML.replace(/\\s+/g, ' ').slice(0, 70),
    });
  }

  /* A rank numeral on its own is "1" to a screen reader. It needs either an
     aria-label that says what it ranks, or a container that carries the whole
     sentence. */
  for (const el of document.querySelectorAll('.num, .rk, .slotmini .gh, .mini b, .strip b')) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const txt = (el.textContent || '').trim();
    if (!/^\\d+$/.test(txt)) continue;
    const hidden = el.getAttribute('aria-hidden') === 'true' || !!el.closest('[aria-hidden="true"]');
    const labelled = !!el.getAttribute('aria-label');
    let owned = false;
    for (let n = el.parentElement; n; n = n.parentElement) {
      if (n.getAttribute && (n.getAttribute('aria-label') || n.getAttribute('role') === 'listitem'
          || n.tagName === 'LI' || n.tagName === 'BUTTON')) { owned = true; break; }
    }
    if (!hidden && !labelled && !owned) bareNumerals.push({
      sel: el.tagName.toLowerCase() + '.' + String(el.className).split(/\\s+/)[0], txt,
      parent: el.parentElement ? el.parentElement.tagName.toLowerCase() + '.' + String(el.parentElement.className).split(/\\s+/)[0] : '-',
    });
  }

  // Images that are decorative must say so; images that carry meaning must
  // have alt text. An empty alt is correct for a poster beside its own title.
  const imgs = [...document.querySelectorAll('img')].filter(i => {
    const r = i.getBoundingClientRect();
    return r.width > 1 && r.height > 1 && i.getAttribute('alt') === null;
  }).map(i => (i.src || '').slice(-28));

  return { unnamed, bareNumerals, hiddenTrap: hiddenTrap.slice(0, 4), imgsNoAlt: imgs.slice(0, 4) };
})()`;
const TAP_SWEEP = `(() => {
  const SEL = 'button, a[href], input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])';
  const MIN = 44, out = [];
  let skipped = 0;
  for (const el of document.querySelectorAll(SEL)) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || el.disabled) continue;
    if (r.bottom < 0 || r.top > innerHeight) continue;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2, h = MIN / 2 - 1;
    if (cy - h < 0 || cy + h > innerHeight || cx - h < 0 || cx + h > innerWidth) { skipped++; continue; }
    const at = document.elementFromPoint(cx, cy);
    if (at && !(at === el || el.contains(at))) {
      const over = at.closest('.dock, .sheet, .vault, .scrim, .coach, .coachscrim, .sheet-in');
      if (over && !over.contains(el)) { skipped++; continue; }
    }
    let miss = 0, covered = false;
    for (const [x, y] of [[cx, cy], [cx, cy - h], [cx, cy + h], [cx - h, cy], [cx + h, cy]]) {
      const hit = document.elementFromPoint(x, y);
      if (!hit || !(hit === el || el.contains(hit))) {
        const ov = hit && hit.closest('.dock, .sheet, .vault, .scrim, .coach, .coachscrim, .sheet-in');
        if (ov && !ov.contains(el)) { covered = true; break; }
        miss++;
      }
    }
    if (covered) { skipped++; continue; }
    if (!miss) continue;
    const at2 = document.elementFromPoint(cx, cy - h) || document.elementFromPoint(cx, cy);
    out.push({
      sel: el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className
        ? '.' + el.className.split(/\\s+/).filter(Boolean)[0] : ''),
      w: Math.round(r.width), h: Math.round(r.height), miss,
      thief: at2 ? at2.tagName.toLowerCase() + '.' + String(at2.className).split(/\\s+/)[0] : 'null',
      label: (el.getAttribute('aria-label') || el.innerText || el.type || '').replace(/\\s+/g, ' ').trim().slice(0, 28),
    });
  }
  return { bad: out, skipped };
})()`;

async function sweepTaps(page, where, check) {
  const { bad, skipped } = await page.evaluate(TAP_SWEEP);
  const names = bad.map(b => `${b.sel} ${b.w}x${b.h} "${b.label}" <- ${b.thief}`).slice(0, 4).join('; ');
  check(bad.length === 0,
    `every target on ${where} takes a 44x44 tap (${skipped} occluded or off-screen, not judged)`
    + (bad.length ? ` — ${bad.length} do not: ${names}` : ''));
}


/* ── Dynamic Type ───────────────────────────────────────────────────────────
   AGENTS.md: "Dynamic Type from XS to accessibility sizes without truncation
   or overlap." On iOS that is the system text-size setting; in a browser the
   equivalent is the root font size, which every `rem` here follows. 16px is
   the default and iOS's accessibility sizes run to roughly double.

   Unmeasured until 2026-11-17, and it was failing on four screens. The worst
   was the splash: `.intro h1` had `white-space: nowrap` and a clamp whose
   floor is `2rem`, so at a 24px root the headline was 48px, ran 440px wide
   on a 393px screen, and the FIRST screen anybody sees scrolled sideways.

   What counts as a failure, and what deliberately does not:
     - the PAGE spilling sideways counts; a rail scrolling does not, that is
       what a rail is for
     - text clipped by its own box counts, unless it asked for an ellipsis
       or a -webkit-line-clamp - those are choices, not failures
     - a control pushed outside the viewport counts, unless it is inside a
       horizontal scroller

   Text is measured with a Range over the element's own text nodes rather
   than by scrollWidth: several controls carry a ::after that is wider than
   the button on purpose (the 44px hit areas), and scrollWidth counts it,
   which reported "Map clipped by 6px" at every size including the default. */
const DT_CHECK = `(() => {
  const doc = document.documentElement;
  const pageSpill = Math.round(doc.scrollWidth - doc.clientWidth);
  const clipped = [], offscreen = [];
  const inScroller = el => {
    for (let n = el.parentElement; n; n = n.parentElement) {
      const o = getComputedStyle(n).overflowX;
      if (o === 'auto' || o === 'scroll') return true;
    }
    return false;
  };
  for (const el of document.querySelectorAll('h1,h2,h3,p,span,button,label,div')) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > innerHeight * 3) continue;
    if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    const cs = getComputedStyle(el);
    if (cs.textOverflow === 'ellipsis' || cs.webkitLineClamp !== 'none') continue;
    if (/auto|scroll/.test(cs.overflowX + cs.overflowY)) continue;
    const range = document.createRange();
    let hi = null, lx = null, rx = null;
    for (const n of el.childNodes) {
      if (n.nodeType !== 3 || !n.textContent.trim()) continue;
      range.selectNodeContents(n);
      const b = range.getBoundingClientRect();
      if (b.width < 1 && b.height < 1) continue;
      hi = hi === null ? b.bottom : Math.max(hi, b.bottom);
      lx = lx === null ? b.left : Math.min(lx, b.left);
      rx = rx === null ? b.right : Math.max(rx, b.right);
    }
    if (hi === null) continue;
    const box = el.getBoundingClientRect();
    const pad = k => parseFloat(cs['padding' + k]) || 0;
    const overX = Math.round(Math.max(Math.max(0, (box.left + pad('Left')) - lx),
                                      Math.max(0, rx - (box.right - pad('Right')))));
    const overY = Math.round(Math.max(0, hi - (box.bottom - pad('Bottom'))));
    // A serif glyph's ink overhangs its box by a pixel or two; that is a
    // font, not a truncation.
    if (Math.max(overX, overY) > 3) clipped.push({
      sel: el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className
        ? '.' + el.className.split(/\\s+/).filter(Boolean)[0] : ''),
      over: Math.max(overX, overY),
      text: el.textContent.replace(/\\s+/g, ' ').trim().slice(0, 26),
    });
  }
  for (const el of document.querySelectorAll('button, a[href], input')) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || inScroller(el)) continue;
    if (r.left < -1 || r.right > innerWidth + 1) offscreen.push({
      sel: el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className
        ? '.' + el.className.split(/\\s+/).filter(Boolean)[0] : ''),
      text: (el.getAttribute('aria-label') || el.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 22),
    });
  }
  const uniq = a => [...new Map(a.map(o => [o.sel + o.text, o])).values()];
  return { pageSpill, clipped: uniq(clipped).slice(0, 4), offscreen: uniq(offscreen).slice(0, 4) };
})()`;


/* ── Contrast at WCAG AA, light and dark ────────────────────────────────────
   AGENTS.md: "contrast at WCAG AA in both light and dark". Measured against
   the background a pixel is ACTUALLY painted on - walk up the ancestors
   compositing any translucent fill until something opaque is found - rather
   than the one the stylesheet nominally sets.

   Two exemptions, both deliberate. WCAG 1.4.3 excludes inactive controls, so
   a disabled button is skipped: the "Arrange" button at 0 of 10 measures
   2.2:1 and is meant to recede, while its enabled state is 5.2:1. And text
   sitting on artwork is skipped, because the backdrop is a photograph and
   this function can only reason about colours. */
const CONTRAST = `(() => {
  const lin = c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const lum = ([r, g, b]) => 0.2126 * lin(r / 255) + 0.7152 * lin(g / 255) + 0.0722 * lin(b / 255);
  const parse = s => {
    const m = /rgba?\\(([^)]+)\\)/.exec(s || '');
    if (!m) return null;
    const p = m[1].split(/[\\s,/]+/).filter(Boolean).map(Number);
    return { rgb: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 };
  };
  const over = (fg, bg, a) => fg.map((c, i) => c * a + bg[i] * (1 - a));
  const bgOf = el => {
    let acc = null;
    for (let n = el; n; n = n.parentElement) {
      const p = parse(getComputedStyle(n).backgroundColor);
      if (!p || p.a === 0) continue;
      acc = acc === null ? { rgb: p.rgb, a: p.a }
                         : { rgb: over(acc.rgb, p.rgb, acc.a), a: acc.a + p.a * (1 - acc.a) };
      if (acc.a >= 0.99) return acc.rgb;
    }
    return acc ? acc.rgb : [255, 255, 255];
  };
  const out = [];
  let seen = 0;
  for (const el of document.querySelectorAll('h1,h2,h3,p,span,button,a,label,div,li')) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > innerHeight) continue;
    if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    if (el.disabled || el.closest('[disabled]')) continue;
    let overArt = false;
    for (let n = el; n; n = n.parentElement) {
      if (n.tagName === 'DIV' && /card|hero-cell|mini|thumb|title-art/.test(String(n.className))) { overArt = true; break; }
    }
    if (overArt) continue;
    const fg = parse(cs.color); if (!fg) continue;
    seen++;
    const bg = bgOf(el);
    const f = fg.a < 1 ? over(fg.rgb, bg, fg.a) : fg.rgb;
    const L1 = lum(f), L2 = lum(bg);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const px = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700;
    const need = (px >= 24 || (bold && px >= 18.66)) ? 3 : 4.5;
    if (ratio + 0.05 < need) out.push({
      sel: el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className
        ? '.' + el.className.split(/\\s+/).filter(Boolean)[0] : ''),
      ratio: Math.round(ratio * 100) / 100, need,
      text: el.textContent.replace(/\\s+/g, ' ').trim().slice(0, 22),
    });
  }
  // The seen count guards against the worst kind of pass: a screen that did
  // not render, examined nothing and reported no problems. A check that is
  // green because it looked at an empty page is worse than no check.
  // (No backticks in here - this whole function is a template literal, and
  // quoting an identifier in one closes the string. Second time today.)
  return { seen, bad: [...new Map(out.map(o => [o.sel + o.text, o])).values()].slice(0, 5) };
})()`;


/* ── A books shelf never speaks like a film shelf ───────────────────────────
   design.md's rule: anything a domain says out loud belongs in DOMAINS, not
   in a string at the call site. Four instances have been caught this way and
   every one was invisible until a second domain existed - the noun, the axis
   label, the artwork word, and the title page's credit line, which said
   "DIRECTOR" over Jane Austen and offered "Where to watch" for a book.

   So this reads every visible string and every accessible name on the books
   flow and looks for a word only a film or television shelf should say. A
   book's own title or author may legitimately contain any word, so anything
   matching a real record on the shelf is allowed through. */
const FILM_WORDS = /\b(poster|posters|film|films|movie|movies|watched|watching|rewatch|screening|episode|season|network|studio|director|directed)\b/i;
const DOMAIN_SPEECH = `(() => {
  const out = [], seen = new Set();
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    for (const n of el.childNodes) {
      if (n.nodeType !== 3) continue;
      const t = n.textContent.replace(/\\s+/g, ' ').trim();
      if (t && !seen.has(t)) { seen.add(t); out.push(t); }
    }
    const al = el.getAttribute && el.getAttribute('aria-label');
    if (al) { const t = al.replace(/\\s+/g, ' ').trim(); if (t && !seen.has(t)) { seen.add(t); out.push(t); } }
  }
  const own = CAT.filter(f => inTopic(f, S.topic))
    .flatMap(f => [f.t, f.d, ...(f.ca || [])]).filter(Boolean).map(x => String(x).toLowerCase());
  return { said: out, own };
})()`;

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  /* Browser viewports, not device sizes.

     A phone reports 393x852; Safari spends about 190px of that on its own
     chrome, so the page gets 393x659 — which is what
     `devices['iPhone 15 Pro'].viewport` says too. This suite used to resize
     to 393x852 before its layout assertions, measuring a screen 193px taller
     than any real one. That is not a harmless slack: the browse-screen budget
     check passed at 852 no matter what the header did, and only failed —
     correctly — once it was measured at 659.

     Smaller phone: 375x667 is the DEVICE; its page gets about 553. */
  const PHONE = { width: 393, height: 659 };
  const SMALL = { width: 375, height: 553 };
  const ctx = await browser.newContext({ ...devices['iPhone 15 Pro'], isMobile: true, hasTouch: true });
  const page = await ctx.newPage();

  await page.route('**://image.tmdb.org/t/p/**', route => {
    const m = route.request().url().match(/\/t\/p\/(w\d+)(\/.+)$/);
    const file = m && `${MIRROR}/${m[1]}${m[2]}`;
    if (file && fs.existsSync(file)) return route.fulfill({ path: file, contentType: 'image/jpeg' });
    return route.fulfill({ status: 204, body: '' });
  });

  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const check = (cond, msg) => { if (!cond) throw new Error('FAILED: ' + msg); console.log('  ok — ' + msg); };

  /* US spelling is a standing rule (specs/design.md, "Voice and spelling",
     2026-08-15). Scan everything a user can actually read — visible text plus
     the strings only assistive tech reads — not the source, so a British word
     baked into a template shows up wherever it renders.
     Two kinds of text on screen are not ours to spell and are subtracted
     before the match: catalog titles, which stay as their makers wrote them
     ("The Favourite", 2018), and whatever the user has typed into the search
     field, which the Now showing bar quotes back at them. What is left is the
     copy this repo wrote, which is the whole of what the rule ever claimed. */
  const BRITISH = /favourite|colour|centre|organis|apologise/i;
  const noBritishSpelling = async where => {
    const found = await page.evaluate(re => {
      const rx = new RegExp(re, 'i');
      let text = document.body.innerText + '\n';
      for (const el of document.querySelectorAll('[aria-label],[placeholder],[title],[alt]'))
        text += ['aria-label', 'placeholder', 'title', 'alt']
          .map(a => el.getAttribute(a) || '').join(' ') + '\n';
      for (const f of (window.byId ? window.byId.values() : []))
        if (rx.test(f.t)) text = text.split(f.t).join(' ');
      const q = (window.S && window.S.q || '').trim();
      if (q && rx.test(q)) text = text.split(q).join(' ');
      const m = text.match(rx);
      return m ? text.slice(Math.max(0, m.index - 40), m.index + 40) : null;
    }, BRITISH.source);
    check(found === null, `no British spelling in what the user reads — ${where}` +
      (found === null ? '' : ` (found: …${found}…)`));
  };

  // Stack's splash rule, inherited: the first screen must be instant, so it
  // may not depend on a third party being up.
  const apiCalls = [];
  page.on('request', r => { if (/api\.themoviedb\.org/.test(r.url())) apiCalls.push(r.url()); });

  await page.goto(BASE, { waitUntil: 'networkidle' });

  // ── Intro ───────────────────────────────────────────────────────────────
  check(await page.locator('.intro').count() === 1, 'a new user lands on the intro, not on a form');

  /* ── The splash opens on somebody's actual Ten (Mischa, 2026-11-17) ──────
     It used to open on the rules — three bullets explaining the limit, the
     badge and the price — and those tests are gone with them. Nobody arrives
     wanting to obey a limit; they arrive because they saw a list and thought
     theirs would be better. So the assertions now are about the artifact:
     that a real, complete, ranked Ten is the first thing on the screen. */
  const hero = await page.evaluate(() => {
    const f = document.querySelector('.hero-ten');
    if (!f) return null;
    const card = f.getBoundingClientRect();
    const grid = f.querySelector('.hero-grid').getBoundingClientRect();
    return {
      posters: f.querySelectorAll('.hero-cell img').length,
      ranks: [...f.querySelectorAll('.hero-cell .rk')].map(r => r.textContent.trim()),
      by: (f.querySelector('.by') || {}).innerText,
      title: (f.querySelector('.what') || {}).innerText,
      badge: !!f.querySelector('.hero-badge svg'),
      badgeLocked: !!f.querySelector('.hero-badge .lockedbadge'),
      badgeInside: (() => {
        const b = f.querySelector('.hero-badge svg');
        if (!b) return false;
        const r = b.getBoundingClientRect();
        // `.lockedbadge.big` is 128px and its two classes outrank
        // `.hero-badge svg`, so the badge ignored its 62px slot entirely.
        return r.right <= card.right + 1 && r.top >= card.top - 1 && r.width <= 80;
      })(),
      badgeBox: (() => {
        const b = f.querySelector('.hero-badge svg');
        return b ? Math.round(b.getBoundingClientRect().width) + 'px' : 'none';
      })(),
      // The card is an object, so its contents have to be inside it. A padding
      // written with an undefined token voids the whole declaration and the
      // posters escape the card silently — which is exactly what shipped.
      inside: grid.right <= card.right + 1 && grid.bottom <= card.bottom + 1,
      padded: parseFloat(getComputedStyle(f).paddingLeft) > 0,
      // Measured as ink against the badge, not as scrollWidth. A grid item
      // with the default `min-width: auto` grows past its parent's padding
      // instead of overflowing it, so spill reads zero while the title sits
      // underneath the badge at full size.
      titleClearsBadge: (() => {
        const w = f.querySelector('.what'), bg = f.querySelector('.hero-badge');
        if (!w || !bg) return true;
        const r = document.createRange(); r.selectNodeContents(w);
        return r.getBoundingClientRect().right <= bg.getBoundingClientRect().left + 1;
      })(),
    };
  });
  check(!!hero, 'the first screen is somebody else\'s Top 10, not a pitch');
  check(hero.posters === 10, `all ten of it, not a teaser (${hero.posters} posters)`);
  check(hero.ranks.join(',') === '1,2,3,4,5,6,7,8,9,10',
    `ranked one through ten — the order IS the product (${hero.ranks.join(',')})`);
  /* NOT a byline. The first version showed a fictional person's Ten and
     Mischa asked who Sam is, why he should care, and why that would make him
     make his own — and there is no good answer. A stranger's taste is noise;
     a crowd's verdict is a claim you can disagree with, and disagreement is
     the thing that makes somebody open the app (2026-11-17). */
  check(/^From [\d,+]+ Top 10s$/i.test((hero.by || '').trim()),
    `attributed to the crowd, not to a stranger ("${hero.by}")`);
  check(/^Top 10 /.test((hero.title || '').trim()), `and a real list name ("${hero.title}")`);
  check(hero.badge, 'and its badge');
  check(hero.badgeLocked,
    'LOCKED — the artifact is a door, which is the mechanic the product already runs on (PRD Req 12)');
  check(hero.badgeInside, `and sized to its slot rather than bleeding off the card (${hero.badgeBox})`);
  check(hero.padded && hero.inside,
    'the whole Ten sits inside the card, which needs its padding to survive');
  check(hero.titleClearsBadge, 'and the list title stops before the badge rather than running under it');

  // The "browse other lists" half of the opening, before anyone is asked to
  // join. Four posters each: the most identity readable in one glance.
  /* Other TOPICS, not other people. A cold visitor is choosing an argument to
     join, not a person to follow — the people matter later, when they mean
     something. */
  const strip = await page.evaluate(() => {
    const minis = [...document.querySelectorAll('.mini-ten')];
    return { n: minis.length,
      posters: minis.map(m => m.querySelectorAll('img').length),
      people: document.querySelectorAll('.mini-ten .who').length };
  });
  check(strip.n >= 3, `other lists are on screen too (${strip.n} of them)`);
  /* Three, not four. The mosaic was a 2x2 grid of 2/3 posters, so it scaled
     with the tile - and widening the tile to fit its own label took it from
     37px tall to 153px and overflowed the splash. A row of three inside a
     clamped band says "a list" just as well at a fixed cost. */
  check(strip.posters.every(n => n === 3), `three posters each (${[...new Set(strip.posters)].join(',')})`);
  check(strip.people === 0, 'and not one of them is attributed to an invented person');
  /* Every list name begins "Top 10 ", which is identical on every card and
     eats the half of an 84px line that says WHICH list this is. With the
     prefix in, four of six read "Top 10…" and told you nothing. */
  const titles = await page.evaluate(() =>
    [...document.querySelectorAll('.mini-ten .what')].map(e => e.innerText.trim()));
  check(titles.length > 0 && !titles.some(t => /^Top 10/.test(t)),
    `each labelled by what makes it different, not by the words they share (${titles.slice(0, 3).join(' · ')}…)`);
  check(titles.every(t => t.length > 3), 'and none of them reduced to an ellipsis');

  const introText = await page.locator('.intro').innerText();
  check(/free/i.test(introText), 'it answers what this costs before asking for anything');
  check(await page.locator('.intro [data-act="begin"]').count() === 1, 'one CTA');
  check((await page.locator('.intro h1').innerText()).trim() === "What's your Top 10?",
    'the headline is still "What\'s your Top 10?" — the locked product voice');
  check(/Free\. No ads\. No subscription\. Ever\./.test(introText),
    'and the promise survives the redesign, as fine print under the CTA');
  // The answer to "why would that make me make my own?" has to be ON the
  // screen, not implied by it. `shared_with_consensus` is the payoff and this
  // line is the promise of it.
  check(/different/i.test(introText) && /see how/i.test(introText),
    'the screen says what making one gets you: yours will differ, and we show you how');

  /* The one-line rule still covers the headline and the list title. Mischa,
     2026-08-15: the splash "breaks our one-line rule twice". The bullets it
     was written for are gone; the rule is not. */
  const headLines = () => page.evaluate(() => ['h1', '.pitch', '.hero-ten .what'].map(sel => {
    const el = document.querySelector('.intro ' + sel);
    if (!el) return null;
    const lh = parseFloat(getComputedStyle(el).lineHeight);
    return { sel, text: el.innerText.trim(), lines: Math.round(el.getBoundingClientRect().height / lh),
      fs: Math.round(parseFloat(getComputedStyle(el).fontSize) * 10) / 10,
      spill: Math.round(el.scrollWidth - el.clientWidth) };
  }).filter(Boolean));
  const headOneLineAt = async label => {
    for (const h of await headLines()) {
      check(h.lines === 1 && h.spill <= 1,
        `${h.sel} is one line at ${label} — ${h.lines} line at ${h.fs}px, ` +
        `${h.spill}px spill: "${h.text}"`);
    }
  };
  await headOneLineAt('iPhone 15 Pro width (393px)');
  await page.setViewportSize(SMALL);
  await page.waitForTimeout(140);
  await headOneLineAt('the narrowest supported iPhone (375px)');
  const fitsSE = await page.evaluate(() => ({
    over: document.querySelector('.intro').scrollHeight > window.innerHeight + 2,
    ctaIn: document.querySelector('.intro [data-act="begin"]').getBoundingClientRect().bottom
           <= window.innerHeight + 1 }));
  check(!fitsSE.over && fitsSE.ctaIn,
    'and the whole splash still fits the smallest supported iPhone without scrolling');
  await page.setViewportSize(PHONE);
  await page.waitForTimeout(140);

  await noBritishSpelling('the intro');
  await page.screenshot({ path: SHOTS + '/13-intro-copy.png' });
  check(!/\bskip\b/i.test(introText), 'and no Skip — this screen only tells, so a Skip would compete with the CTA');
  check(apiCalls.length === 0, `the intro makes no API calls (${apiCalls.length})`);
  const ctaVisible = await page.evaluate(() => {
    const b = document.querySelector('.intro [data-act="begin"]');
    const r = b.getBoundingClientRect();
    return r.bottom <= window.innerHeight + 1 && r.top >= 0;
  });
  check(ctaVisible, 'the CTA is on screen without scrolling');
  check((await page.locator('.intro [data-act="begin"]').innerText()).trim() === 'Make your first list',
    'the CTA says "Make your first list"');

  await page.locator('[data-act="begin"]').click();
  await page.waitForTimeout(400);

  // ── The Services coach mark, on Stack's pattern ─────────────────────────
  // "Services" names a control; it does not say what the control gets you, and
  // what it gets you is the reason the catalog carries availability at all.
  // Modal because a coach mark you can scroll past is one nobody reads.
  const coach = await page.evaluate(() => {
    const c = document.querySelector('.coach'); if (!c) return null;
    const chip = document.querySelector('.chip[data-sheet="services"]');
    const box = c.querySelector('.coachbox').getBoundingClientRect();
    const a = c.querySelector('.arrow').getBoundingClientRect();
    const ch = chip.getBoundingClientRect();
    const scrim = getComputedStyle(c.querySelector('.coachscrim'));
    return { text: c.querySelector('#coachtext').innerText.replace(/\s+/g, ' ').trim(),
      dims: scrim.backgroundColor, spotlit: chip.classList.contains('spotlit'),
      frozen: document.getElementById('app').inert === true &&
              document.getElementById('dock').inert === true,
      pointsAtChip: a.left >= ch.left - 3 && a.right <= ch.right + 3 && a.top >= ch.bottom - 14,
      below: box.top >= ch.bottom, ok: (c.querySelector('.btn').innerText || '').trim(),
      okH: Math.round(c.querySelector('.btn').getBoundingClientRect().height) };
  });
  check(!!coach, 'the Services coach mark is shown before any service has been picked');
  check(/^Select your streaming services/.test(coach.text) && /already[\s\S]*included/.test(coach.text),
    `and it says what the filter gets you ("${coach.text}")`);
  check(/rgba?\(0, 0, 0/.test(coach.dims), `the screen behind it is dimmed (${coach.dims})`);
  check(coach.frozen, 'and frozen — nothing behind the callout is reachable');
  check(coach.spotlit, 'the Services chip is lifted out of the dim, so the target stays lit');
  check(coach.pointsAtChip && coach.below, 'the callout sits under the chip with its arrow on it');
  check(coach.ok === 'OK' && coach.okH >= 44, `one way out, at ${coach.okH}pt: "${coach.ok}"`);
  // A modal that blocks the screen must actually block it.
  const blocked = await page.locator('.rail .card .pin').first()
    .click({ timeout: 1200 }).then(() => false, () => true);
  check(blocked, 'a tap on the screen behind the callout does not reach it');
  await page.locator('.coachbox [data-act="tipok"]').click();
  await page.waitForTimeout(300);
  check(await page.locator('.coach').count() === 0, 'OK dismisses it');
  check(await page.evaluate(() => document.getElementById('app').inert !== true),
    'and gives the screen back');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  check(await page.locator('.coach').count() === 0, 'and it stays dismissed across a reload');

  // ── One screen: search, filters, suggestions, and the ten slots ──────────
  check(await page.locator('#q').count() === 1, 'search field is on the build screen, not a separate tab');
  check(await page.locator('.chip[data-sheet="services"]').count() === 1, 'services filter is present and first');
  check(await page.locator('.slotmini').count() >= 10, 'ten slots are visible in the dock before anything is picked');
  // "Always visible" has to mean visible — a tenth slot you must scroll the
  // strip to reach is not the count being ever-present.
  const slotsFit = await page.evaluate(() => {
    const strip = document.querySelector('.slots');
    return strip.scrollWidth <= strip.clientWidth + 1;
  });
  check(slotsFit, 'all ten slots fit on screen without scrolling the strip');
  // Nothing may hide behind the dock at the foot of the page.
  const clears = await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
    const dock = document.querySelector('.dock').getBoundingClientRect();
    const last = document.querySelector('footer.notes .build').getBoundingClientRect();
    return last.bottom <= dock.top + 1;
  });
  check(clears, 'the page scrolls clear of the dock — nothing is trapped behind it');
  check(await page.locator('.rail .card').count() > 0, 'suggestions are showing');

  // ── The page title never wraps (Mischa, 2026-08-15) ─────────────────────
  // A list name is a criteria sentence now, and they vary: 25 characters for
  // "Top 10 Movies of All Time", 35 for "Top 10 Animated Movies of the 2000s".
  // At one fixed size the long ones broke across two lines, and a wrapped page
  // title reads as two headings. Checked at the narrowest supported width and
  // against the longest name the app can currently generate.
  for (const w of [SMALL.width, PHONE.width]) {
    await page.setViewportSize({ width: w, height: w === SMALL.width ? SMALL.height : PHONE.height });
    for (const crit of [{}, { genre: 'Animation', decade: 2000 }, { genre: 'Science Fiction', decade: 1990 },
                        { actor: 'Robert De Niro' }, { director: 'Alfred Hitchcock', genre: 'Thriller' }]) {
      await page.evaluate(c => { window.S.topic = window.makeTopic(c); window.renderBuild(); }, crit);
      await page.waitForTimeout(120);
      const t = await page.evaluate(() => {
        const el = document.querySelector('.topbar h1');
        const lh = parseFloat(getComputedStyle(el).lineHeight);
        return { text: el.innerText.trim(), lines: Math.round(el.getBoundingClientRect().height / lh),
          fs: Math.round(parseFloat(getComputedStyle(el).fontSize)),
          spill: Math.round(el.scrollWidth - el.clientWidth) };
      });
      check(t.lines === 1 && t.spill <= 1,
        `the page title holds one line at ${w}px — ${t.lines} line at ${t.fs}px: "${t.text}"`);
      check(t.fs >= 20, `and stays readable doing it (${t.fs}px, floor is 20)`);
    }
  }
  // "Start over" came off the title's line for the same reason, and must not
  // have gone missing in the move. Assert the PROPERTY — off the title's
  // line, still present, still a real target — rather than one container, so
  // the check survives the next time it moves. (It has moved twice: out of
  // the title row into a subtitle row, then into the summary row when the
  // subtitle turned out to restate the headline by construction.)
  const restart = await page.evaluate(() => {
    const el = document.querySelector('[data-act="restart"]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { inTitleRow: !!el.closest('.topbar'), w: Math.round(r.width), h: Math.round(r.height),
             visible: r.width > 0 && r.height > 0 };
  });
  check(restart && restart.visible, '"Start over" is on the screen');
  check(restart && !restart.inTitleRow,
    'and off the title\'s line rather than competing for its width');

  // The row it moved into has to still fit: a count that ellipsises to
  // nothing is worse than the button being somewhere else.
  const sum = await page.evaluate(() => {
    const c = document.querySelector('.showing .summary .count');
    const row = document.querySelector('.showing .summary');
    if (!c || !row) return null;
    return { countW: Math.round(c.getBoundingClientRect().width),
             clipped: c.scrollWidth - c.clientWidth > 1,
             spill: Math.round(row.scrollWidth - row.clientWidth) };
  });
  check(sum && sum.spill <= 1, 'the summary row does not overflow: ' + JSON.stringify(sum));
  check(sum && sum.countW >= 120 && !sum.clipped,
    'and the count it carries is still readable beside it: ' + JSON.stringify(sum));

  /* The same row, in fonts this machine does not have.

     This assertion went red on CI while passing here, because the runner
     has none of the fonts this box does and its fallback is wider - so
     "All 2,500+ movies in our collection" fitted locally and ellipsised
     there. A layout assertion measured in one font is a measurement of this
     machine, not of the design. Checking a few concrete fallbacks is the
     cheap version of checking all of them. */
  for (const font of ['system-ui', 'Georgia, serif', '"DejaVu Serif", serif', '"Liberation Sans", sans-serif']) {
    await page.evaluate(f => { document.body.style.fontFamily = f; }, font);
    await page.waitForTimeout(80);
    const f = await page.evaluate(() => {
      const c = document.querySelector('.showing .summary .count');
      const row = document.querySelector('.showing .summary');
      return { clipped: c.scrollWidth - c.clientWidth > 1,
               spill: Math.round(row.scrollWidth - row.clientWidth) };
    });
    check(!f.clipped && f.spill <= 1, `and holds in ${font} (${JSON.stringify(f)})`);
  }
  await page.evaluate(() => { document.body.style.fontFamily = ''; });
  await page.setViewportSize(PHONE);
  await page.evaluate(() => { window.S.topic = window.makeTopic({ domain: 'movie' }); window.renderBuild(); });
  await page.waitForTimeout(200);

  // ── The map before anything is explored ─────────────────────────────────
  // THE 2026-08-15 defect: with an empty graph the map hung four speculative
  // films off the topic, on edges, wearing their own posters — four
  // selections nobody had made, under a title that claims to record
  // selections. The empty map must name no film at all.
  const wouldHaveShown = await page.evaluate(() => pool().slice(0, 4).map(f => f.t));
  await page.locator('.showing [data-act="openmap"]').click();
  await page.waitForTimeout(200);
  check(await page.locator('.mapview').count() === 1, 'the map is reachable before anything is explored');
  check((await page.locator('.map-head h2').innerText()).trim() === 'Map of your selections',
    'the map is titled "Map of your selections"');
  check(await page.locator('.map-empty').count() === 1, 'an empty graph gets a designed empty state');
  check(await page.locator('.map-node').count() === 0, 'and NOT one node of any kind');
  check(await page.locator('.mapview image').count() === 0, 'no poster is drawn anywhere on it');
  check(await page.locator('.map-edge').count() === 0, 'and nothing hangs off the topic on an edge');
  const blankText = await page.locator('.map-empty').innerText();
  check(wouldHaveShown.every(t => !blankText.includes(t)),
    `the empty map names no film from the shelf (would have shown: ${wouldHaveShown.join(', ')})`);
  check(/record of where you have actually been/i.test(blankText), 'it says what the map is for');
  check(/\+ Add/.test(blankText) && /Similar/.test(blankText),
    'and names both controls that put something on it');
  await page.screenshot({ path: SHOTS + '/16-map-empty.png' });
  await page.locator('.mapview [data-act="closemap"]').click();
  await page.waitForTimeout(150);
  check(await page.locator('.mapview').count() === 0, 'Done closes the empty map');

  // ── ONE card anatomy, everywhere (Mischa, 2026-08-16) ───────────────────
  // "Some rows have the Add button while other rows don't — the UI needs to be
  // consistent with its UX." Two anatomies were a deliberate choice and it was
  // the wrong one, so the test that pinned them apart is gone and this one
  // pins them together: every card, in every row, is the same shape.
  const anatomies = await page.evaluate(() => {
    const shape = c => JSON.stringify({
      art: !!c.querySelector('.art'), pin: !!c.querySelector('.pin'),
      title: !!c.querySelector('.t'), addButtons: c.querySelectorAll('.do-add').length,
    });
    const all = [...document.querySelectorAll('.rail .card')];
    return { kinds: [...new Set(all.map(shape))], n: all.length,
             browse: document.querySelectorAll('.rail .card.browse').length };
  });
  check(anatomies.kinds.length === 1,
    `every card in every row is the same shape (${anatomies.n} cards, ${anatomies.kinds.length} anatomy)`);
  check(anatomies.kinds[0] && JSON.parse(anatomies.kinds[0]).addButtons === 0,
    'and none of them carries a labelled Add button — the corner + is the whole affordance');

  const card0 = await page.evaluate(() => {
    const c = document.querySelector('.rail .card');
    const pin = c.querySelector('.pin'), art = c.querySelector('.art');
    const pr = pin.getBoundingClientRect(), ar = art.getBoundingClientRect();
    return { glyph: pin.querySelector('.glyph').textContent.trim(),
      pressed: pin.getAttribute('aria-pressed'), label: pin.getAttribute('aria-label'),
      tap: Math.round(Math.min(pr.width, pr.height)),
      onArt: pr.top >= ar.top - 1 && pr.right <= ar.right + 1,
      artOpens: art.hasAttribute('data-title') };
  });
  check(card0.glyph === '+', 'an unadded card shows a + in its corner');
  check(card0.onArt, 'sitting on the artwork, top-right');
  check(card0.tap >= 44, `with a ${card0.tap}px touch target around it, not a 28px one`);
  check(/add/i.test(card0.label) && card0.pressed === 'false',
    `and it says what it does to a screen reader ("${card0.label}")`);
  check(card0.artOpens, 'while the poster itself opens the title');

  const rowH = await page.evaluate(() =>
    Math.round(document.querySelector('.rail .card.browse').getBoundingClientRect().height));
  check(rowH < 300, `so a card is ${rowH}px tall, not a stack of controls`);

  // ── Adding: checkmark, ring, shimmer ────────────────────────────────────
  const firstBrowse = page.locator('.rail .card.browse').first();
  const browseId = await firstBrowse.getAttribute('data-card');
  await firstBrowse.locator('.pin').click();
  await page.waitForTimeout(120);
  const shimmering = await page.evaluate(id => {
    const c = document.querySelector(`.card[data-card="${id}"]`);
    const sheen = c.querySelector('.sheen');
    return { running: sheen && sheen.classList.contains('run'),
      anim: sheen ? getComputedStyle(sheen).animationName : null };
  }, browseId);
  check(shimmering.running && shimmering.anim === 'sheen',
    'adding runs a shimmer across the poster');
  await page.waitForTimeout(420);
  const afterAdd = await page.evaluate(id => {
    const c = document.querySelector(`.card[data-card="${id}"]`);
    const b = c.querySelector('.do-similar');
    const pin = c.querySelector('.pin');
    const r = b && b.getBoundingClientRect(), cr = c.getBoundingClientRect();
    const ar = c.querySelector('.art').getBoundingClientRect();
    return { glyph: pin.querySelector('.glyph').textContent.trim(),
      pressed: pin.getAttribute('aria-pressed'),
      ring: getComputedStyle(c.querySelector('.ring rect')).stroke,
      label: b ? b.innerText.trim() : null,
      inside: !!r && r.left >= cr.left - 1 && r.right <= cr.right + 1,
      belowArt: !!r && r.top >= ar.bottom - 1,
      top: r && Math.round(r.top), artBottom: Math.round(ar.bottom) };
  }, browseId);
  check(afterAdd.glyph === '✓', 'the + becomes a checkmark');
  check(afterAdd.pressed === 'true', 'and announces itself as pressed');
  check(afterAdd.ring !== 'none' && !/rgba\(0, 0, 0, 0\)/.test(afterAdd.ring),
    `while the ring draws itself around the poster (${afterAdd.ring})`);
  check(/^See similar/.test(afterAdd.label || ''), `and "${afterAdd.label}" appears beneath`);
  check(afterAdd.inside, 'fitting inside the card');
  // `.in` was the card's added-badge class and it is absolutely positioned, so
  // a reveal class called `.in` once put `See similar` on top of the poster.
  check(afterAdd.belowArt,
    `below the poster, not on it (control top ${afterAdd.top}, poster bottom ${afterAdd.artBottom})`);
  const others = await page.evaluate(id => document.querySelectorAll(
    `.card:not([data-card="${id}"]) .do-similar`).length, browseId);
  check(others === 0, 'and only that card grew one — the rest of the row is untouched');

  // Undoing must not be celebrated.
  await page.locator(`.card[data-card="${browseId}"] .pin`).click();
  await page.waitForTimeout(120);
  const onRemove = await page.evaluate(id => {
    const c = document.querySelector(`.card[data-card="${id}"]`);
    return { glyph: c.querySelector('.pin .glyph').textContent.trim(),
      shimmer: c.querySelector('.sheen').classList.contains('run'),
      similar: c.querySelectorAll('.do-similar').length };
  }, browseId);
  check(onRemove.glyph === '+' && onRemove.similar === 0, 'removing puts the card back');
  check(!onRemove.shimmer, 'with no shimmer — undoing is not celebrated');

  // ── The poster opens the title ──────────────────────────────────────────
  const openId = await page.locator('.rail .card').first().getAttribute('data-card');
  await page.locator('.rail .card').first().locator('.art').click();
  await page.waitForTimeout(350);
  const titlePage = await page.evaluate(() => ({
    scene: window.S.scene,
    h1: document.querySelector('.title-h1') && document.querySelector('.title-h1').innerText.trim(),
    facts: [...document.querySelectorAll('.title-facts .k')].map(k => k.innerText.trim()),
    jumps: document.querySelectorAll('.title-facts [data-facetjump]').length,
    ratings: /rating|review|out of 10|\/10|★/i.test(document.body.innerText),
    cta: document.querySelector('.title-cta .btn') &&
         document.querySelector('.title-cta .btn').innerText.trim(),
    similar: document.querySelectorAll('[data-rail="titlelike"] .card').length,
  }));
  check(titlePage.scene === 'title', 'tapping a poster opens the title page');
  check(!!titlePage.h1, `titled with the film ("${titlePage.h1}")`);
  // innerText reflects text-transform, so these come back upper-cased.
  check(titlePage.facts.some(f => /where to watch/i.test(f)) && titlePage.facts.length >= 3,
    `carrying its facts (${titlePage.facts.join(', ')})`);
  check(titlePage.jumps >= 2,
    `every one of which narrows the shelf (${titlePage.jumps} tappable facts) — the clearer path Mischa asked for`);
  check(!titlePage.ratings, 'and NO ratings or reviews — this product has one opinion per person, and it is a list');
  check(/add to my top 10/i.test(titlePage.cta || ''), `with one clear action ("${titlePage.cta}")`);
  check(titlePage.similar > 0, `and where it leads (${titlePage.similar} similar)`);

  await page.screenshot({ path: SHOTS + '/17-title-page.png' });

  // Narrowing from the title page must LEAVE it — the answer to "what else has
  // Guy Pearce in it" is a shelf, and staying put is the app withholding it.
  await page.locator('.title-facts [data-facetjump]').first().click();
  await page.waitForTimeout(350);
  const afterJump = await page.evaluate(() => ({
    scene: window.S.scene,
    filters: JSON.parse(JSON.stringify(window.S.filters)),
    // The facet chip is the query now: one row of chips, a summary beneath.
    // Narrowing to a director used to print `Steven Spielberg ×` twice, in
    // adjacent rows of a sticky header with a phone-sized budget.
    chips: [...document.querySelectorAll('.chips .chip.on')].map(c => c.innerText.trim()),
    summary: (document.querySelector('.showing .summary .count') || {}).innerText,
    duplicated: document.querySelectorAll('.showing .clause').length,
  }));
  check(afterJump.scene === 'build', 'narrowing from a title page lands you back on the shelf');
  check(afterJump.chips.length === 1,
    `with the narrowing stated once, on the chip that set it (${JSON.stringify(afterJump.chips)})`);
  check(afterJump.duplicated === 0,
    'and NOT repeated as a second chip in a second row');
  check(/\d/.test(afterJump.summary || ''),
    `with a summary underneath saying what it adds up to ("${afterJump.summary}")`);

  // ── The filter must be visibly global (Mischa, 2026-08-16) ──────────────
  // "It is currently only filtering the movies in that row." It was not — but
  // nothing on screen said so: the chip had scrolled off the top and the row
  // headings were unchanged. Both are now load-bearing.
  const sticky = await page.evaluate(() => {
    const bar = document.querySelector('.stickybar');
    return bar && bar.contains(document.querySelector('.showing'));
  });
  check(sticky, 'the active filters live INSIDE the sticky bar, so they cannot scroll away');
  await page.evaluate(() => window.scrollTo(0, 1600));
  await page.waitForTimeout(200);
  const stillThere = await page.evaluate(() => {
    const el = document.querySelector('.showing');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: Math.round(r.top), visible: r.top >= 0 && r.top < innerHeight };
  });
  check(stillThere && stillThere.visible,
    `and are still on screen 1600px down the page (y=${stillThere && stillThere.top}; it used to be -958)`);
  const filteredHeads = await page.evaluate(() =>
    [...document.querySelectorAll('.section-h')].map(h => h.innerText.trim()));
  const saidSo = filteredHeads.filter(h => /\b(WITH|BY|IN)\b/.test(h));
  check(saidSo.length >= 1,
    `and the rows on screen say what they are narrowed to (${JSON.stringify(saidSo.slice(0, 2))})`);

  // A wide filter keeps the browse rows, and each of them has to say so too.
  await page.evaluate(() => {
    window.S.filters = { services: [], genre: null, director: null, actor: null };
    window.S.tray = []; window.S.graph = { nodes: {}, roots: [], focus: null };
    window.renderBuild();
    const g = window.facetValues('genre')[0][0];
    window.S.filters.genre = g; window.renderBuild();
  });
  await page.waitForTimeout(250);
  const wideHeads = await page.evaluate(() =>
    [...document.querySelectorAll('.section-h')].map(h => h.innerText.trim()));
  check(wideHeads.length >= 3 && wideHeads.some(h => /\bIN\b/.test(h)),
    `a wide filter keeps the rows AND labels them (${JSON.stringify(wideHeads.slice(0, 3))})`);
  // "Popular dramas in Drama" is the app talking to itself.
  check(!wideHeads.some(h => /^POPULAR (\w+)S? IN \1/i.test(h)),
    'without a genre row repeating the genre back at itself');
  await page.evaluate(() => { window.S.filters = { services: [], genre: null, director: null, actor: null };
    window.S.tray = []; window.S.graph = { nodes: {}, roots: [], focus: null };
    window.S.scene = 'build'; window.save(); window.render(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => { window.S.tray = []; window.S.graph = { nodes: {}, roots: [], focus: null };
    window.renderBuild(); });
  await page.waitForTimeout(300);
  const verbs = await page.locator('.section-head .more').count();
  check(verbs === 0, 'no per-section "Back"/"Go deeper" verbs competing with each other');

  // ── Every spacing token used is a token that exists ─────────────────────
  // The 4pt scale is 4/8/12/16/24/32 — there is deliberately no --s5 or --s7,
  // because "nothing gets a bespoke gap" (design.md). A var() pointing at a
  // token that was never defined does not fall back: it voids the WHOLE
  // declaration, silently. `.title-cta { margin-top: var(--s5) }` shipped that
  // way and the button simply had no top margin, through every round of
  // screenshots, because nothing was looking (2026-11-17).
  const tokens = await page.evaluate(async () => {
    // Every stylesheet, not only the inline ones — tokens.css is where the
    // scale lives.
    let css = [...document.querySelectorAll('style')].map(s => s.textContent).join('\n');
    for (const l of document.querySelectorAll('link[rel=stylesheet]')) {
      try { css += '\n' + await (await fetch(l.href)).text(); } catch (e) { /* ignore */ }
    }
    const used = [...new Set((css.match(/var\(--[a-z0-9-]+\)/g) || []).map(v => v.slice(4, -1)))];
    // Declared ANYWHERE, not only on :root — `--frame` lives on `.intro` and
    // `--tile-h` on `.marquee`, and a locally scoped token is a legitimate
    // token. The first version of this check only looked at the root element
    // and called both of them missing.
    const declared = new Set((css.match(/--[a-z0-9-]+\s*:/g) || []).map(d => d.replace(/\s*:$/, '')));
    return { used: used.length, missing: used.filter(n => !declared.has(n)) };
  });
  check(tokens.missing.length === 0,
    `every CSS token the stylesheet uses is defined (${tokens.used} used, ` +
    `${tokens.missing.length} undefined${tokens.missing.length ? ': ' + tokens.missing.join(', ') : ''})`);

  // The query must be stated, not inferred.
  check(await page.locator('.showing').count() === 1, 'a Now showing bar states what is on screen');

  // ── The first screen is a place to browse, not a page with one shelf ─────
  // Mischa, 2026-08-15: "the first screen doesn't have nearly enough
  // browsing". The collection holds two thousand movies and the screen used to
  // offer sixteen of them under a single heading.
  const headings = await page.evaluate(() =>
    [...document.querySelectorAll('.section-h')].map(h => h.innerText.trim()));
  check(headings.length >= 8, `the first screen offers ${headings.length} rows to browse, not one`);
  /* Popular leads.

     The first row of the main screen has to make somebody want to start
     picking, and the topic is "Top 10 Movies of All Time" — so it should be
     films they already have opinions about, not this month's releases. It
     opens on Interstellar, Inception, The Avengers, The Dark Knight.

     "Recent releases" follows, and the two do not overlap at all in their
     first twenty (measured): all-time reach and three-year reach pick
     different films. */
  check(headings[0] === 'POPULAR', `and it opens on "${headings[0]}"`);
  check(headings[1] === 'RECENT RELEASES', `with recent releases under it ("${headings[1]}")`);

  /* And what is IN the opening rows, not just their names.

     "Recent releases" used to sort by year and then by reach, which is not a
     tie-break: strict year order put all of 2026 ahead of all of 2025, so
     the app opened on Project Hail Mary, Obsession, Michael, Disclosure Day
     and Backrooms — five films almost nobody has seen, as the first thing
     anyone saw. A row's NAME cannot catch that; only its contents can. */
  const rowReach = await page.evaluate(() => {
    const out = [];
    for (const sec of [...document.querySelectorAll('section')].slice(0, 2)) {
      const name = (sec.querySelector('.section-h') || {}).innerText || '?';
      const vc = [...sec.querySelectorAll('.card[data-card]')]
        .slice(0, 6)
        .map(c => (byId.get(Number(c.dataset.card)) || {}).vc || 0);
      out.push({ name: name.trim(), min: Math.min(...vc), n: vc.length });
    }
    return out;
  });
  for (const r of rowReach) {
    check(r.n >= 6 && r.min >= 3000,
      `the opening row "${r.name}" leads with films people have actually seen (lowest of its first ${r.n}: ${r.min} votes)`);
  }
  /* The main screen has to show the main thing.

     Measured at iPhone 15 Pro (393x659, and 659 is right: Safari's chrome
     takes ~190px of the 852 the device reports): the header ran to 334px and
     the dock to 130, leaving a 195px band for content — while one rail is
     229px tall. The first row of the app's first screen could not fit on it.
     70% of the screen was chrome.

     The subtitle was the clearest waste: `topicPrompt` builds it FROM the
     title, so "Top 10 Movies of All Time" sat above "Your 10 favorite movies
     of all time." It could never add information, and it cost 52px with its
     gap. This asserts the outcome rather than the cause — whatever the header
     grows into later, a whole rail still has to clear the dock. */
  /* At 659px, not 852.

     `devices['iPhone 15 Pro']` reports the DEVICE's 852, but Safari spends
     about 190 of those on its own chrome, so a page gets 659. Asserted at
     852 this check passes no matter what the header does — proved by putting
     the subtitle back and watching it stay green. The viewport is set
     explicitly here and restored after. */
  const REAL = PHONE;
  const wasViewport = page.viewportSize();
  await page.setViewportSize(REAL);
  await page.waitForTimeout(250);
  const budget = await page.evaluate(() => {
    const rail = document.querySelector('.rail'), dock = document.querySelector('.dock');
    if (!rail || !dock) return null;
    const r = rail.getBoundingClientRect(), d = dock.getBoundingClientRect();
    return { top: Math.round(r.top), railH: Math.round(r.height),
             dockTop: Math.round(d.top), vh: window.innerHeight };
  });
  check(budget && budget.top + budget.railH <= budget.dockTop,
    `the first row fits above the dock at ${budget && budget.vh}px tall `
    + `(header ${budget && budget.top}px + rail ${budget && budget.railH}px vs dock at ${budget && budget.dockTop}px)`);
  check(budget && budget.vh === REAL.height,
    `and that measurement was taken at Safari's real height, not the device's (${budget && budget.vh}px)`);
  if (wasViewport) await page.setViewportSize(wasViewport);
  await page.waitForTimeout(200);

  // "Popular" survives only on the row actually called Popular (Mischa,
  // 2026-08-16). A row named Comedies is a shelf; "Popular comedies" is an
  // argument nobody asked for.
  const genreRows = headings.slice(2);
  check(genreRows.length >= 5, `then a row per genre (${genreRows.length}: ${genreRows.slice(0, 4).join(', ')}…)`);
  check(!genreRows.some(h => /^POPULAR\b/.test(h)),
    'none of which says "Popular" a second time');

  // A genre row asks one of two questions, and which one depends on the row.
  //
  // For a CONTENT genre the question is "is this mostly a comedy", answered by
  // the primary genre — that is what keeps Pulp Fiction ([Thriller, Crime,
  // Comedy]) out of Comedies. For a MEDIUM the question is "is this animated",
  // answered by membership: TMDB files Princess Mononoke as [Adventure,
  // Fantasy, Animation], and a rule that calls that not-an-animated-film is
  // a rule that is simply wrong (Mischa, 2026-08-16).
  const fit = await page.evaluate(() => {
    const MEDIUM = new Set(['Animation', 'Documentary']);
    const rows = window.browseRows(new Set()).filter(r => r.id.startsWith('g:'));
    const bad = [];
    for (const r of rows) {
      const g = r.id.slice(2);
      for (const c of r.cards) {
        const ok = MEDIUM.has(g) ? c.f.g.includes(g) : c.f.g[0] === g;
        if (!ok) bad.push(`${c.f.t} [${c.f.g.join(', ')}] in ${g}`);
      }
    }
    return { rows: rows.length, bad: bad.slice(0, 3), n: bad.length };
  });
  check(fit.n === 0,
    `and every film in a genre row belongs there (${fit.rows} rows, ${fit.n} mismatches${fit.n ? ': ' + fit.bad.join('; ') : ''})`);

  // The specific films that rule exists for.
  const ghibli = await page.evaluate(() => {
    const row = window.browseRows(new Set()).find(r => r.id === 'g:Animation');
    const eligible = window.CATALOG.filter(f => (f.dm || 'movie') === 'movie' && f.g.includes('Animation'));
    const named = ['Spirited Away', 'Princess Mononoke', 'My Neighbor Totoro', "Howl's Moving Castle"];
    return { inRow: row ? row.cards.some(c => c.f.t === 'Spirited Away') : false,
             eligible: named.filter(t => eligible.some(f => f.t === t)).length };
  });
  check(ghibli.eligible === 4,
    `all four Ghibli films are eligible for the animation row (${ghibli.eligible}/4) — under the primary-genre rule three of them were not`);
  check(ghibli.inRow, 'and Spirited Away actually appears in it');

  // The archive tier: pinned award winners with double-digit vote counts stay
  // in the catalog and out of a row somebody is scanning.
  const tier = await page.evaluate(() => {
    const rows = window.browseRows(new Set());
    const offered = rows.flatMap(r => r.cards.map(c => c.f)).filter(f => f.lang && f.lang !== 'en');
    const inCatalog = window.CATALOG.filter(f => f.lang && f.lang !== 'en' && (f.vc || 0) < 500).length;
    return { archiveOffered: offered.filter(f => (f.vc || 0) < 500).map(f => f.t),
             offered: [...new Set(offered.map(f => f.t))], inCatalog };
  });
  check(tier.archiveOffered.length === 0,
    `no archive-tier international film is offered unasked (${tier.inCatalog} of them sit in the catalog, reachable by search and filter)`);
  check(tier.offered.length >= 4 && tier.offered.includes('Parasite'),
    `while the ones people know still appear (${tier.offered.join(', ')})`);

  // ── Studios are a filter, not a row (Mischa, 2026-08-16) ────────────────
  // No Studio Ghibli row by default; a Studio chip that gets you there.
  const studio = await page.evaluate(() => {
    const chips = [...document.querySelectorAll('.chips .chip')].map(c => c.innerText.trim());
    const offered = window.facetValues('studio').map(([v, n]) => `${v} (${n})`);
    window.S.filters.studio = 'Studio Ghibli';
    const rows = window.browseRows(new Set());
    const films = [...new Set(rows.flatMap(r => r.cards.map(c => c.f.t)))];
    const heading = rows.map(r => r.title).join(' | ');
    window.S.filters.studio = null;
    const byDefault = window.browseRows(new Set()).map(r => r.title);
    return { chips, offered, films, heading, byDefault };
  });
  check(studio.chips.includes('Studio'),
    `a Studio chip sits beside the others (${studio.chips.join(' · ')})`);
  check(studio.offered.length >= 8,
    `offering the studios the catalog actually labels (${studio.offered.slice(0, 4).join(', ')}…)`);
  check(!studio.byDefault.some(t => /ghibli/i.test(t)),
    'with no Studio Ghibli row by default');
  check(studio.films.includes('Princess Mononoke') && studio.films.includes('My Neighbor Totoro')
        && studio.films.length === 9,
    `and selecting it returns the whole studio (${studio.films.length} films: ${studio.films.slice(0, 3).join(', ')}…)`);
  check(/from Studio Ghibli/.test(studio.heading),
    `named for what was asked for ("${studio.heading}")`);

  // Asking for something IS expressing interest — an explicit filter must not
  // be second-guessed by the archive-tier gate.
  const asked = await page.evaluate(() => {
    window.S.filters.director = 'Akira Kurosawa';
    const n = window.browseRows(new Set()).flatMap(r => r.cards).length;
    window.S.filters.director = null;
    return n;
  });
  check(asked > 0, `naming a director returns their work whatever its vote count (${asked} films)`);

  // Adjacent rows showing the same three posters is what a screenshot caught.
  const echoes = await page.evaluate(() => {
    const rows = window.browseRows(new Set());
    const generic = new Set(rows.filter(r => r.id === 'recent' || r.id === 'popular')
      .flatMap(r => r.cards.map(c => c.f.id)));
    const dupes = rows.filter(r => r.id.startsWith('g:'))
      .flatMap(r => r.cards.filter(c => generic.has(c.f.id)).map(c => c.f.t));
    return dupes;
  });
  check(echoes.length === 0,
    `and no genre row echoes Recent releases or Popular (${echoes.length} repeats)`);

  // Comedies rate lower than dramas, so ranking a Comedies row by acclaim
  // quietly returns dramas with jokes.
  const comedies = await page.evaluate(() => {
    const r = window.browseRows(new Set()).find(x => x.id === 'g:Comedy');
    return r ? r.cards.map(c => c.f.t) : [];
  });
  check(comedies.length > 0 && ['The Hangover', 'Zombieland', 'Home Alone', 'The Mask', 'Ted']
      .some(t => comedies.includes(t)),
    `and the Comedies row holds comedies people have heard of (${comedies.slice(0, 5).join(', ')}…)`);
  // The genre rows are named with the same vocabulary a list name uses, so
  // "Science Fiction" is "sci-fi movies" in both places and "Comedy" is
  // "comedies" in both. A browse row inventing its own word for a genre is how
  // two parts of one app end up disagreeing about what they hold.
  check(headings.includes('COMEDIES') && headings.includes('SCI-FI MOVIES'),
    'genre rows use the list-name vocabulary, not raw catalog labels');
  // Each row must actually be full, or a browse screen is a screen of stubs.
  const railSizes = await page.evaluate(() =>
    [...document.querySelectorAll('.rail')].map(r => r.querySelectorAll('.card').length));
  check(railSizes.every(n => n >= 6), `every row is stocked (smallest ${Math.min(...railSizes)} cards)`);
  check(railSizes.reduce((a, b) => a + b, 0) >= 150,
    `${railSizes.reduce((a, b) => a + b, 0)} titles are reachable without searching`);
  // Rows overlap on purpose — a popular drama belongs in both Popular and
  // Popular dramas. What must NOT repeat is a row that is a copy of another.
  const railIds = await page.evaluate(() => [...document.querySelectorAll('.rail')].map(r =>
    [...r.querySelectorAll('.card')].map(c => c.dataset.card).join(',')));
  check(new Set(railIds).size === railIds.length,
    `no two rows hold the same ${railIds.length} titles in the same order`);

  // ── Search and the refinements stay put while you browse ─────────────────
  // At rest means at rest: say so rather than inheriting whatever scroll
  // position the previous block left. This passed only because the taller
  // (and wrong) 852px viewport made the document short enough that the
  // earlier scroll clamped back to 0.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(150);
  const stickyBefore = await page.evaluate(() =>
    Math.round(document.querySelector('.stickybar').getBoundingClientRect().top));
  await page.evaluate(() => window.scrollTo(0, 1600));
  await page.waitForTimeout(250);
  const stuck = await page.evaluate(() => {
    const r = document.querySelector('.stickybar').getBoundingClientRect();
    const q = document.querySelector('#q').getBoundingClientRect();
    return { top: Math.round(r.top), qTop: Math.round(q.top), qBottom: Math.round(q.bottom),
      vh: window.innerHeight,
      chips: document.querySelectorAll('.stickybar .chip').length, y: Math.round(window.scrollY) };
  });
  check(stuck.y > 800, `scrolled ${stuck.y}px down the browse screen`);
  check(stuck.top <= 1, 'the search bar and filters are still pinned to the top');
  check(stuck.qTop >= 0 && stuck.qBottom <= stuck.vh,
    `the search field itself is on screen, not just its container (${stuck.qTop}–${stuck.qBottom} of ${stuck.vh})`);
  check(stuck.chips >= 3, `and the refinements came with it (${stuck.chips} chips)`);
  check(stickyBefore > 0, 'it starts in the flow rather than permanently overlaying the title');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);

  // ── The services sheet must not jump when you tap a service ──────────────
  // It used to re-render itself on every tap, so the sheet replayed its enter
  // transition and appeared to fall away and come back (Mischa: "a weird
  // jitter"). The sheet element must survive the tap, and stay where it is.
  await page.locator('.chip', { hasText: 'Services' }).first().click();
  await page.waitForSelector('.sheet.on', { timeout: 4000 });
  await page.waitForTimeout(420);
  const svcChip = page.locator('.sheet [data-toggle-service]').first();
  const tappedService = (await svcChip.innerText()).trim();
  const settled = () => page.evaluate(() => {
    const sh = document.querySelector('.sheet');
    return { id: sh.dataset.probe, top: Math.round(sh.getBoundingClientRect().top),
      on: sh.classList.contains('on') };
  });
  await page.evaluate(() => { document.querySelector('.sheet').dataset.probe = 'same-element'; });
  const sheetBefore = await settled();
  await svcChip.click();
  // Sample across the whole window a re-render would have animated through.
  const frames = [];
  for (let i = 0; i < 8; i++) { frames.push(await settled()); await page.waitForTimeout(45); }
  check(frames.every(f => f.id === 'same-element'),
    'tapping a service leaves the sheet element in place — it is not rebuilt');
  check(frames.every(f => f.top === sheetBefore.top),
    `and the sheet does not move a pixel (tops: ${[...new Set(frames.map(f => f.top))].join(',')})`);
  check(frames.every(f => f.on), 'nor does it drop its open state and re-enter');
  check(await page.locator(`.sheet [data-toggle-service][aria-pressed="true"]`).count() === 1,
    `while the service itself did toggle on ("${tappedService}")`);
  await page.locator('.sheet [data-act="closesheet"]').click();
  await page.waitForTimeout(420);
  check(await page.locator('.tip').count() === 0,
    'and the tip retires once a service has been chosen, without being dismissed');
  // Put the filter back so the rest of the run sees the unfiltered shelf.
  await page.evaluate(() => { window.S.filters.services = []; window.S.tipDone = true; window.renderBuild(); });
  await page.waitForTimeout(200);

  // ── Copy regression: the repeated meaningless caption is gone ────────────
  const bodyText = await page.locator('body').innerText();
  check(!/widely called great/i.test(bodyText), 'no "Widely called great" caption under every poster');
  check(!/keep going and make the cut/i.test(bodyText), 'the "or keep going and make the cut" line is gone');
  // Round 3: "Everything" was a lie about a catalog of a few hundred titles.
  check(!/Everything —/.test(bodyText), 'the Now showing bar does not claim to show "Everything"');
  // A round figure and a "+" (Mischa, 2026-08-15): an exact count reads as the
  // end of the shelf, a floor reads as a collection that is still growing. The
  // figure must be a true floor — never larger than what is actually there.
  const shelfClaim = bodyText.match(/All ([\d,]+)\+ movies\b/);
  check(!!shelfClaim, `it states the size of the collection instead ("${(bodyText.match(/All [^\n]*collection/) || ['none'])[0]}")`);
  const claimed = shelfClaim ? Number(shelfClaim[1].replace(/,/g, '')) : Infinity;
  const realShelf = await page.evaluate(() => window.CAT.filter(f => (f.dm || 'movie') === 'movie').length);
  check(claimed <= realShelf, `and the figure is a floor, not a boast (${claimed} claimed, ${realShelf} on the shelf)`);
  // 2026-08-15: "shelf" is not a word the user ever sees.
  check(!/\bshelf\b/i.test(bodyText), 'the word "shelf" is gone from the build screen');
  await noBritishSpelling('the build screen');

  // ── One left edge: every section heading starts at the same x ────────────
  const xs = await page.evaluate(() => {
    const els = [document.querySelector('h1'), document.querySelector('.prompt'),
      ...document.querySelectorAll('.section-h'), document.querySelector('.search')];
    return els.filter(Boolean).map(e => Math.round(e.getBoundingClientRect().left));
  });
  check(new Set(xs).size === 1, `every block shares one left edge (${[...new Set(xs)].join(', ')}px)`);

  const railX = await page.evaluate(() => Math.round(document.querySelector('.rail .card').getBoundingClientRect().left));
  check(railX === xs[0], `the first card in a rail aligns to that same edge (${railX}px)`);

  // ── Adding: the card must NOT leave, and the poster must be seen moving ──
  const firstCard = page.locator('.rail .card').first();
  const firstId = await firstCard.getAttribute('data-card');
  const railCountBefore = await page.locator('.rail .card').count();
  await firstCard.locator('.pin').click();
  check(await page.locator(`.card[data-card="${firstId}"]`).count() === 1, 'the card stays put after adding — it does not vanish or jump');
  check(await page.locator('.rail .card').count() === railCountBefore, 'the rail does not reshuffle under the thumb');
  check(await page.locator(`.card[data-card="${firstId}"][data-in="1"]`).count() === 1, 'the card shows its new state in place');
  check((await page.locator('.dock-top .n').innerText()) === '1 of 10', 'the dock count advances');
  check(await page.locator('.slotmini img').count() === 1, 'the pick appears in slot one');

  // The travelling poster is what makes the destination unambiguous.
  await page.evaluate(() => window.__fliers = 0);
  await page.evaluate(() => new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes)
    if (n.classList && n.classList.contains('flier')) window.__fliers++; }).observe(document.body, { childList: true }));
  await page.locator('.rail .card').nth(1).locator('.pin').click();
  await page.waitForTimeout(80);
  check(await page.evaluate(() => window.__fliers) === 1, 'a poster visibly travels from the card to its slot');

  await page.screenshot({ path: SHOTS + '/1-build.png' });

  // ── Branching: more like this, with a trail you can walk back ────────────
  // Every card now offers `See similar` once it is added, and only then —
  // which is the first moment the question is worth asking, and the same on
  // every row since 2026-08-16. So drilling in is add, then follow.
  await page.evaluate(() => window.renderBuild());
  await page.waitForTimeout(250);
  const drill = page.locator('.rail .card:not(.browse)').nth(1);
  const branchFrom = await drill.getAttribute('data-card');
  await drill.locator('.pin').click();
  await page.waitForTimeout(420);
  await drill.locator('.do-similar').click();
  await page.waitForTimeout(120);
  const h2 = await page.locator('.section-h').first().innerText();
  check(/^MORE LIKE /i.test(h2), `drilling in opens a "${h2}" section`);
  check(await page.locator('.showing .clause').count() >= 1, 'the Now showing bar states the branch you are in');
  const branchCards = await page.locator('.rail').first().locator('.card').count();
  check(branchCards >= 3, `the branch has ${branchCards} films to offer`);
  await page.screenshot({ path: SHOTS + '/2-branch.png' });

  // Going deeper again extends the trail rather than replacing it — into a film
  // that is NOT already on the map. Re-entering a node you had already picked is
  // a different, documented behaviour ("tapping a followed node re-enters the
  // path there"), and taking that branch would make the walk-back assertion
  // below vacuous: it re-roots you on a node whose trail is one long. Which film
  // sits first in a rail is a fact about the shelf, not about the app, and the
  // 2,000-film shelf duly put an already-picked Spider-Man there.
  const fresh = await page.evaluate(() => {
    const rail = document.querySelector('.rail');
    for (const el of rail.querySelectorAll('.card')) {
      const id = +el.dataset.card;
      if (!window.S.graph.nodes[id]) return id;
    }
    return null;
  });
  check(fresh != null, 'the branch offers a film that is not already on the map');
  const nodesBeforeDeeper = await page.evaluate(() => Object.keys(window.S.graph.nodes).length);
  const freshCard = page.locator('.rail').first().locator(`.card[data-card="${fresh}"]`);
  await freshCard.locator('.pin').click();
  await page.waitForTimeout(420);
  await freshCard.locator('.do-similar').click();
  await page.waitForTimeout(120);
  const explored = await page.evaluate(() => Object.keys(window.S.graph.nodes).length);
  check(explored === nodesBeforeDeeper + 1,
    `going deeper extends the path rather than replacing it (${nodesBeforeDeeper} nodes \u2192 ${explored})`);
  const deepFocus = await page.evaluate(() => window.S.graph.focus);

  // THE round-2 defect: walking back used to delete everything ahead of the
  // node you returned to. Nothing may be lost by navigating.
  const nodesBefore = await page.evaluate(() => Object.keys(window.S.graph.nodes).length);
  await page.locator('.showing .clause').first().locator('button').first().click();
  await page.waitForTimeout(150);
  check(await page.evaluate(() => Object.keys(window.S.graph.nodes).length) === nodesBefore,
    `walking back keeps every explored node (${nodesBefore} still there)`);
  check(await page.evaluate(() => window.S.graph.focus) !== deepFocus, 'focus moved back up the path');

  // ── The map ─────────────────────────────────────────────────────────────
  await page.locator('[data-act="openmap"]').click();
  await page.waitForTimeout(200);
  // Scoped to the canvas: the legend's swatches are svgs of their own now.
  check(await page.locator('.map-scroll > svg').count() === 1, 'the map draws the explored graph as one canvas');
  check(await page.locator('.map-node').count() >= 3, `the map shows every node plus the origin (${await page.locator('.map-node').count()})`);
  check(await page.locator('.map-edge').count() >= 2, 'the map draws the edges between them');
  // Labels must not collide with their neighbours' — the map is unreadable
  // the moment two titles overlap.
  const collide = await page.evaluate(() => {
    const boxes = [...document.querySelectorAll('.map-node text')].map(t => t.getBoundingClientRect());
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) return true;
    }
    return false;
  });
  check(!collide, 'no two map labels overlap');
  check((await page.locator('.map-head h2').innerText()).trim() === 'Map of your selections',
    'the populated map carries the same title');
  // Round 3: the map must be somewhere you can go, not just a log.
  check(await page.locator('.map-node.ghost').count() > 0, 'the map offers unexplored next steps');

  // ── The legend is a visual key, not a sentence (2026-08-15) ─────────────
  check(await page.locator('.map-legend').count() === 0, 'the run-on legend sentence is gone');
  const keyCount = await page.locator('.map-key li').count();
  check(keyCount >= 3, `the legend is a key of ${keyCount} separate marked states`);
  check(await page.locator('.map-key li svg').count() === keyCount, 'every key carries its own drawn swatch');
  const keyLabels = (await page.locator('.map-key li span').allInnerTexts()).map(s => s.trim());
  /* "Top 10" is the product's own name for the object (AGENTS.md, amended
     2026-08-15: product copy says it in digits), and it reads as a single
     noun, so it counts as one word here. Without this the rule would push the
     legend back into the word "Ten", which every other user-facing string has
     just stopped saying. The gate still bites: a sentence-shaped label fails. */
  const keyWords = l => l.replace(/Top 10/g, 'Ten').split(/\s+/).length;
  check(keyLabels.length === keyCount && keyLabels.every(l => l.length > 0 && keyWords(l) <= 3),
    `each key is a short label, three words at most (${keyLabels.join(' | ')})`);
  check(new Set(keyLabels).size === keyLabels.length, 'no two keys carry the same label');
  // Accessibility gate: the states must be told apart with the colour thrown
  // away. In the vault theme --accent and --accent-bright are the same gold,
  // so a key separated by colour would separate nothing there. This signature
  // reads geometry only — tag, dash pattern, filled-or-not — never a hue.
  const sigs = await page.evaluate(() => [...document.querySelectorAll('.map-key li')].map(li =>
    [...li.querySelectorAll('svg *')].map(el => {
      const cs = getComputedStyle(el);
      return el.tagName
        + (cs.strokeDasharray && cs.strokeDasharray !== 'none' ? ':dashed' : '')
        + (cs.fill && cs.fill !== 'none' ? ':filled' : '');
    }).join(',')));
  check(new Set(sigs).size === sigs.length,
    `every key differs in shape, not only colour (${sigs.join(' / ')})`);
  await page.screenshot({ path: SHOTS + '/17-map-legend.png' });

  /* ── The map says so when it continues past the edge (2026-11-18) ─────
     The graph is wider than an iPhone for all but the shallowest path - the
     fan of unexplored steps alone overruns it by about 170px - and the view
     opens CENTRED on where you are, so a whole branch can sit off the left
     edge with nothing to say so. A fade now marks each side that has
     something beyond it.

     The rule under test is the exact one, not a sample of it: a side is faded
     if and only if there is scroll left in that direction. Asserting that at
     three positions catches a fade stuck on as surely as one stuck off, and
     does not depend on where the centring happens to land. The 2px slack
     matches the implementation's, for sub-pixel scroll positions. */
  const edgeState = () => page.evaluate(() => {
    const sc = document.querySelector('.map-scroll');
    const l = document.querySelector('.map-fade.l'), r = document.querySelector('.map-fade.r');
    if (!sc || !l || !r) return null;
    return { max: Math.round(sc.scrollWidth - sc.clientWidth), left: Math.round(sc.scrollLeft),
      l: l.classList.contains('on'), r: r.classList.contains('on') };
  });
  const edgesAgree = f => f && f.l === (f.left > 2) && f.r === (f.left < f.max - 2);
  const say = f => f ? `${f.left}/${f.max} scrolled, faded ${f.l ? 'left' : '—'} ${f.r ? 'right' : '—'}`
                     : 'no map on screen';

  const centred = await edgeState();
  check(centred && centred.max > 0,
    `the graph runs past the phone (${centred ? centred.max : '?'}px beyond the screen)`);
  check(edgesAgree(centred), `opened centred, the fade marks the side with more on it (${say(centred)})`);

  await page.evaluate(() => { document.querySelector('.map-scroll').scrollLeft = 0; });
  await page.waitForTimeout(160);
  const hardLeft = await edgeState();
  check(edgesAgree(hardLeft), `at the left end nothing is faded leftwards (${say(hardLeft)})`);

  await page.evaluate(() => { const sc = document.querySelector('.map-scroll'); sc.scrollLeft = sc.scrollWidth; });
  await page.waitForTimeout(160);
  const hardRight = await edgeState();
  check(edgesAgree(hardRight), `at the right end nothing is faded rightwards (${say(hardRight)})`);

  // And a graph with room to spare is not dimmed at all. The fade is a
  // statement about content, so with nothing beyond the edge it must not show.
  await page.setViewportSize({ width: 700, height: 900 });
  await page.waitForTimeout(300);
  const roomy = await edgeState();
  check(roomy && roomy.max === 0 && !roomy.l && !roomy.r,
    `a graph that fits its screen is not faded (${say(roomy)})`);
  await page.setViewportSize(PHONE);
  await page.waitForTimeout(200);
  /* Re-open rather than scroll back. The checks further down measure the map
     as it OPENS - that it lands centred on where you are - and a view this
     block has dragged to both ends and resized twice is not a view that has
     just opened. Closing and opening it is the only honest reset. */
  await page.locator('.mapview [data-act="closemap"]').click();
  await page.waitForTimeout(160);
  await page.locator('[data-act="openmap"]').first().click();
  await page.waitForTimeout(450);

  // ── A speculative step may never look like a selection ──────────────────
  const ghostArt = await page.evaluate(() =>
    [...document.querySelectorAll('.map-node.ghost')].some(g => g.querySelector('image')));
  check(!ghostArt, 'an unexplored step wears no poster — the map cannot imply a pick');
  check(await page.locator('.map-node.ghost .map-plus').count() > 0,
    'it carries a + where the artwork would be, so the difference survives greyscale');
  check(await page.locator('.map-node.focus .map-here').count() === 1,
    '"you are here" is a marker above the plate, not only a coloured ring');
  check(await page.locator('.map-node.picked .map-tick').count() > 0,
    'a pick carries a tick, not only a gold ring');
  // The invariant behind the whole bug: artwork means "this is on your path".
  const honest = await page.evaluate(() => [...document.querySelectorAll('.map-node')].every(g => {
    if (!g.querySelector('image')) return true;
    const id = +g.dataset.mapnode;
    return Number.isFinite(id) && !!window.S.graph.nodes[id];
  }));
  check(honest, 'every node drawn with artwork is a film actually on your path');

  // Both themes, because the vault is where a colour-only key would collapse:
  // there --accent and --accent-bright are the same gold. Every marker that
  // carries a state must still be drawn.
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForTimeout(120);
  check(await page.locator('.map-key li').count() === keyCount, 'the key survives the vault theme');
  check(await page.locator('.map-node.ghost .map-plus').count() > 0, 'the + is drawn in the vault theme too');
  check(await page.locator('.map-node.focus .map-here').count() === 1, 'and so is the "you are here" caret');
  const darkSigs = await page.evaluate(() => [...document.querySelectorAll('.map-key li')].map(li =>
    [...li.querySelectorAll('svg *')].map(el => {
      const cs = getComputedStyle(el);
      return el.tagName
        + (cs.strokeDasharray && cs.strokeDasharray !== 'none' ? ':dashed' : '')
        + (cs.fill && cs.fill !== 'none' ? ':filled' : '');
    }).join(',')));
  check(new Set(darkSigs).size === darkSigs.length, 'the keys stay shape-distinct in the vault theme');
  await page.screenshot({ path: SHOTS + '/18-map-legend-dark.png' });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.waitForTimeout(120);

  // The map must open where you are, not at its corner.
  await page.waitForTimeout(120);
  const fv = await page.evaluate(() => {
    const el = document.querySelector('.map-node.focus');
    const sc = document.querySelector('.map-scroll');
    if (!el || !sc) return { ok: false, why: 'no focus node rendered' };
    const a = el.getBoundingClientRect(), b = sc.getBoundingClientRect();
    return { ok: a.left >= b.left - 1 && a.right <= b.right + 1 && a.top >= b.top - 1 && a.bottom <= b.bottom + 1,
      why: `el ${Math.round(a.left)}-${Math.round(a.right)}; view ${Math.round(b.left)}-${Math.round(b.right)}; ` +
           `scrollLeft ${sc.scrollLeft}, scrollWidth ${sc.scrollWidth}, clientWidth ${sc.clientWidth}` };
  });
  check(fv.ok, `the map opens centred on where you are (${fv.why})`);
  const ghostId = await page.locator('.map-node.ghost').first().getAttribute('data-mapnode');
  const beforeWalk = await page.evaluate(() => Object.keys(window.S.graph.nodes).length);
  await page.locator(`.map-node[data-mapnode="${ghostId}"]`).click();
  await page.waitForTimeout(250);
  check(await page.locator('.mapview').count() === 1, 'following a step from the map keeps you in the map');
  check(await page.evaluate(() => Object.keys(window.S.graph.nodes).length) === beforeWalk + 1,
    'the followed step joins the graph');
  check(await page.evaluate(() => window.S.graph.focus) === +ghostId, 'and becomes the focus');
  await page.screenshot({ path: SHOTS + '/7-map.png' });

  // Re-entering the deep node from the map is how you get forward again.
  await page.locator(`.map-node[data-mapnode="${deepFocus}"]`).click();
  await page.waitForTimeout(200);
  await page.locator('[data-act="openmap"]').click();
  await page.waitForTimeout(200);
  await page.locator(`.map-node[data-mapnode="${deepFocus}"]`).click();
  await page.waitForTimeout(200);
  check(await page.evaluate(() => window.S.graph.focus) === deepFocus, 'tapping a followed node re-enters the path there');
  check(await page.locator('.mapview').count() === 0, 'the map closes when you pick a node');

  // ── Round 4: the reason differs per film, and a rail is not one filmography
  const toy = await page.evaluate(() => {
    const seed = [...window.byId.values()].find(f => f.t === 'Toy Story');
    if (!seed) return null;
    window.S.graph.nodes = {}; window.S.graph.roots = []; window.S.graph.focus = null;
    window.S.filters = { services: [], genre: null, director: null, actor: null };
    window.S.q = '';
    return seed.id;
  });
  if (toy) {
    await page.evaluate(id => { window.S.graph.nodes[id] = { id, parent: null, kids: [], kind: 'followed' };
      window.S.graph.roots = [id]; window.S.graph.focus = id; }, toy);
    await page.locator('.chip[data-sheet="genre"]').click();
    await page.waitForTimeout(150);
    await page.locator('.sheet [data-act="closesheet"]').click();
    await page.waitForTimeout(350);
    const first = await page.locator('.rail .card').first().locator('.t').innerText();
    check(/^Toy Story \d/.test(first), `a series leads its own rail ("${first}" tops more-like-Toy-Story)`);
    const firstWhy = (await page.locator('.rail .card').first().locator('.why').innerText()).trim();
    check(/^More Toy Story/.test(firstWhy), `and says which claim it is making ("${firstWhy}")`);

    // No rail may be dominated by one director.
    const worst = await page.evaluate(() => {
      let worst = 0;
      for (const rail of document.querySelectorAll('.rail')) {
        const counts = {};
        for (const c of rail.querySelectorAll('.card')) {
          const d = window.byId.get(+c.dataset.card)?.d || '-';
          counts[d] = (counts[d] || 0) + 1;
          worst = Math.max(worst, counts[d]);
        }
      }
      return worst;
    });
    check(worst <= 4, `no rail is one person's filmography (most by a single director: ${worst})`);
  }

  // ── Services filter: the top-priority refinement ─────────────────────────
  await page.locator('.chip[data-sheet="services"]').click();
  await page.waitForTimeout(250);
  check(await page.locator('.sheet [data-toggle-service]').count() > 0, 'the subscriptions sheet lists real services');
  const svcId = await page.locator('.sheet [data-toggle-service]').first().getAttribute('data-toggle-service');
  await page.locator(`[data-toggle-service="${svcId}"]`).click();
  await page.waitForTimeout(150);
  await page.locator('.sheet [data-act="closesheet"]').click();
  await page.waitForTimeout(300);
  const onlyOnService = await page.evaluate(svc => {
    const region = window.S.region;
    return [...document.querySelectorAll('.rail .card')].every(c => {
      const f = window.byId.get(+c.dataset.card);
      return ((f.sv || {})[region] || []).includes(svc);
    });
  }, svcId);
  check(onlyOnService, `with a service filter on, every suggested film is actually on ${svcId}`);
  const heads = await page.locator('.section-h').allInnerTexts();
  check(heads.some(h => /^ON /i.test(h)), `a rail is headed by the service itself (${heads.join(' | ')})`);
  await page.screenshot({ path: SHOTS + '/3-services.png' });

  // The map must say what is shaping what it offers, or it looks like it lost
  // your context (round 3). It must still say so after the round-4 rewrite.
  const svcName = await page.evaluate(id => (SERVICES.find(x => x[0] === id) || [, id])[1], svcId);
  await page.locator('.showing [data-act="openmap"]').click();
  await page.waitForTimeout(200);
  const mapCtx = await page.locator('.map-context').innerText();
  check(mapCtx.includes(svcName), `the map states the active filter ("${mapCtx.replace(/\s+/g, ' ').trim()}")`);
  await page.locator('.mapview [data-act="closemap"]').click();
  await page.waitForTimeout(150);

  // Clearing the filter returns the screen to its own home.
  await page.locator('.chip[data-sheet="services"] [data-clear]').click();
  await page.waitForTimeout(150);
  check(await page.evaluate(() => window.S.filters.services.length) === 0, 'the filter chip clears in place');

  // ── Dead ends must hand you the way out (round 3) ───────────────────────
  await page.evaluate(() => {
    // Force a query that cannot match: a director filter that contradicts the
    // genre filter is the shape of dead end a real user stumbles into.
    window.S.filters.genre = 'Horror';
    window.S.filters.director = 'Christopher Nolan';
    window.S.filters.services = [];
    window.dispatchEvent(new Event('resize'));
  });
  await page.locator('.chip[data-sheet="genre"]').click();
  await page.waitForTimeout(200);
  await page.locator('.sheet [data-act="closesheet"]').click();
  await page.waitForTimeout(350);
  const zero = await page.evaluate(() => window.S ? document.querySelector('.showing').innerText : '');
  check(/0 movies/.test(zero), `the dead end is reported honestly (${zero.split('\n').pop()})`);
  const escapes = await page.locator('.escape').count();
  check(escapes >= 2, `it offers ${escapes} ways out rather than just a wall`);
  const escapeText = await page.locator('.escape').first().innerText();
  check(/\d+ movies?$/.test(escapeText.trim()), `each way out says what it would get you ("${escapeText}")`);
  await page.screenshot({ path: SHOTS + '/8-deadend.png' });
  await page.locator('.escape').first().click();
  await page.waitForTimeout(250);
  check(await page.locator('.rail .card').count() > 0, 'taking a way out actually produces films');
  await page.evaluate(() => { window.S.filters.genre = null; window.S.filters.director = null; });
  await page.locator('.chip[data-sheet="genre"]').click();
  await page.waitForTimeout(200);
  await page.locator('.sheet [data-act="closesheet"]').click();
  await page.waitForTimeout(350);

  // ── Search: live, debounced, clearable ──────────────────────────────────
  await page.fill('#q', 'godfather');
  await page.waitForTimeout(400);
  check(await page.locator('.row').count() > 0, 'search returns results as you type, with no submit step');
  await page.locator('.row .add').first().click();
  check(await page.locator('.row').count() > 0, 'adding from a search result leaves the results in place');
  // Two controls legitimately clear the query now: the in-field ⊗ and the
  // query's own chip in Now showing. Both must work.
  await page.locator('.showing [data-act="clearq"]').click();
  await page.waitForTimeout(200);
  check(await page.locator('.rail .card').count() > 0, 'dropping the query chip returns to the suggestions');
  await page.fill('#q', 'batman');
  await page.waitForTimeout(400);
  check(await page.locator('.row').count() > 0, 'search works again after clearing');
  await page.locator('.search [data-act="clearq"]').click();
  await page.waitForTimeout(200);
  check(await page.locator('.rail .card').count() > 0, 'the in-field clear returns to the suggestions too');

  // ── Fill to ten, then reorder in one place ──────────────────────────────
  while (await page.evaluate(() => window.S.tray.length) < 10) {
    const free = page.locator('.rail .card[data-in="0"]').first();
    if (!(await free.count())) break;
    await free.locator('.pin').click();
    await page.waitForTimeout(30);
  }
  check(await page.evaluate(() => window.S.tray.length) === 10, 'the Ten fills to ten');

  await page.locator('[data-act="arrange"]').click();
  await page.waitForTimeout(300);
  check(await page.locator('.tenrow').count() === 10, 'the Ten opens as one reorderable list');
  const before = await page.evaluate(() => window.S.tray.slice(0, 2));
  await page.locator('.tenrow').nth(1).locator('[data-dir="-1"]').click();
  await page.waitForTimeout(80);
  const after = await page.evaluate(() => window.S.tray.slice(0, 2));
  check(after[0] === before[1] && after[1] === before[0], 'moving a row up reorders the Ten in place');
  check(await page.locator('.tenrow').first().locator('.num').innerText() === '1', 'the numerals renumber');
  await page.screenshot({ path: SHOTS + '/4-arrange.png' });

  // ── Finish → reveal ─────────────────────────────────────────────────────
  await page.locator('[data-act="finish"]').click();
  await page.waitForSelector('.vault', { timeout: 5000 });
  await page.waitForTimeout(900);
  check(await page.locator('.skip.on').count() === 1, 'the reveal becomes skippable after 0.8s, not before');
  await page.waitForTimeout(2600);
  const insc = await badgeInscription(page);
  check(insc.split(/\s+/).length <= 6, `inscription is at most six words: "${insc}"`);
  // And it is struck onto the badge, not printed beside it.
  const struck = await page.evaluate(() => {
    const on = document.querySelectorAll('.vault #l-ribbon .ich.on').length;
    const all = document.querySelectorAll('.vault #l-ribbon .ich').length;
    const ribbon = document.querySelector('.vault #l-ribbon');
    return { on, all, ribbonOn: !!ribbon && ribbon.classList.contains('on') };
  });
  check(struck.all > 0 && struck.on === struck.all && struck.ribbonOn,
    `every letter lands on the badge's ribbon (${struck.on}/${struck.all}, ribbon shown: ${struck.ribbonOn})`);
  check(await page.locator('.vault .revealed-name').count() === 1,
    'and the line under it names the list you just finished');
  await page.screenshot({ path: SHOTS + '/5-reveal.png' });
  await page.waitForSelector('.after.on', { timeout: 5000 });
  await page.locator('[data-act="done"]').click();

  // ── After a finished Ten: closer in, or a different kind of list ────────
  await page.waitForSelector('.sug-topic', { timeout: 5000 });
  const finishedText = await page.locator('body').innerText();
  check(/or a different kind of list/i.test(finishedText), 'finishing offers other kinds of list, not just more films');
  check(/Top 10 Shows of All Time/i.test(finishedText), 'TV shows is offered as the next domain');

  // ── Sharing: the app produces the link its own web page reads ───────────
  // M5. The two directions live in one module (share.js) precisely so they
  // cannot drift; this proves the app end actually calls it.
  const shareable = await page.evaluate(() => {
    const url = Share.link({
      title: window.S.topic.title, author: 'you', topicId: window.S.topic.id,
      items: window.S.ranked, badge: window.S.badge, unlocked: true,
    }, 'https://example.test');
    const parsed = Share.fromLocation(new URL(url));
    return {
      url,
      title: parsed.title === window.S.topic.title,
      items: parsed.items.map(f => f.id).join() === window.S.ranked.join(),
      unlocked: parsed.unlocked === true,
      // The reader's own picks are the comparison, not the sender's.
      noSenderPicks: parsed.mine.length === 0,
    };
  });
  check(await page.locator('[data-act="share"]').count() === 1,
    'the finished screen offers a share action');
  check(/\/ten\?/.test(shareable.url), `and it builds a link to the public page (${shareable.url.slice(0, 60)}…)`);
  check(shareable.title && shareable.items && shareable.unlocked,
    'that round-trips the list, its name and its badge state');
  check(shareable.noSenderPicks,
    'and does not carry the sender\'s own ten — the comparison is the reader\'s');
  check(/coming next/i.test(finishedText), 'and the unbuilt domains are named rather than hidden');
  check(!/see other people/i.test(finishedText), 'discovery is NOT offered after the first list');

  // ── Rabbit hole ─────────────────────────────────────────────────────────
  check((await page.locator('.sug-topic').count()) >= 5, 'at least five topic suggestions after completion');
  const picks = await page.evaluate(() => window.S.ranked.map(id => window.byId.get(id)));
  const genres = new Set(picks.flatMap(f => f.g));
  for (const why of await page.locator('.sug-topic .why').allInnerTexts()) {
    const m = why.match(/^Not one (.+?) movie made your ten/);
    if (m) check(![...genres].some(g => g.toLowerCase() === m[1].toLowerCase()), `"${why}" is true of these ten`);
  }
  const levels = new Set(await page.locator('.sug-topic .lvl').allInnerTexts());
  check(levels.size >= 3, `suggestions span three specificity levels (${[...levels].join(', ')})`);
  check(/Your 10 favorite/.test(finishedText) || (await page.locator('.sug-topic').count()) > 0,
    'the finished screen is written in the new voice');
  await noBritishSpelling('the finished screen');
  await page.screenshot({ path: SHOTS + '/6-finished.png', fullPage: true });

  const topicName = await page.locator('.sug-topic .t').first().innerText();
  await page.locator('.sug-topic').first().click();
  await page.waitForTimeout(150);
  check(await page.locator('h1').innerText() === topicName, `a suggestion lands in a scoped build screen for "${topicName}"`);
  check(await page.locator('.rail .card').count() > 0, 'the scoped topic still has films to offer');

  // ── Draft persistence ───────────────────────────────────────────────────
  await page.locator('.rail .card').first().locator('.pin').click();
  await page.reload({ waitUntil: 'networkidle' });
  check((await page.locator('.dock-top .n').innerText()) === '1 of 10', 'the draft survives a reload');

  // ── A second list unlocks discovery, and TV is a real shelf ─────────────
  await page.evaluate(() => {
    const tv = window.makeTopic({ domain: 'tv' });
    window.S.topic = tv; window.S.tray = []; window.S.q = '';
    window.S.graph = { nodes: {}, roots: [], focus: null };
    window.S.filters = { services: [], genre: null, director: null, actor: null };
  });
  await page.locator('.chip[data-sheet="genre"]').click();
  await page.waitForTimeout(150);
  await page.locator('.sheet [data-act="closesheet"]').click();
  await page.waitForTimeout(350);
  const tvOnly = await page.evaluate(() => [...document.querySelectorAll('.rail .card')]
    .every(c => (window.byId.get(+c.dataset.card) || {}).dm === 'tv'));
  check(tvOnly, 'the TV topic offers only shows — a Ten never mixes domains');
  check(await page.locator('.rail .card').count() > 0, 'and the TV collection is populated');
  // The domain noun follows the domain: a TV Ten must never say "movies".
  const tvText = await page.locator('body').innerText();
  check(/All [\d,]+\+ shows\b/.test(tvText),
    'a TV Ten counts shows, not movies, in the Now showing bar');
  check(!/\bmovies?\b/i.test(await page.locator('#q').getAttribute('placeholder')),
    'and searches "shows", not "movies"');
  await noBritishSpelling('a TV Ten');

  while (await page.evaluate(() => window.S.tray.length) < 10) {
    const free = page.locator('.rail .card[data-in="0"]').first();
    if (!(await free.count())) break;
    await free.locator('.pin').click();
    await page.waitForTimeout(25);
  }
  await page.locator('[data-act="arrange"]').click();
  await page.waitForTimeout(300);
  await page.locator('[data-act="finish"]').click();
  await page.waitForSelector('.vault', { timeout: 5000 });
  await page.locator('[data-act="skip"]').click();
  await page.waitForSelector('.after.on', { timeout: 5000 });
  await page.locator('[data-act="done"]').click();
  await page.waitForTimeout(200);
  check(await page.evaluate(() => window.S.done.length) === 2, 'two finished Tens are remembered');
  check(/See other people/i.test(await page.locator('body').innerText()),
    'discovery IS offered after the second list');

  // ── Books: the third shelf, entered the way a user would enter it ──────
  // The books catalog is a separate file (books.js) with its own artwork that
  // is not on TMDB, so this block proves three things the other domains
  // cannot: that a domain can bring its own pictures, that the shelf is
  // really only books, and that none of the film vocabulary leaked in.
  const booksOffer = page.locator('.sug-topic', { hasText: 'Top 10 Books of All Time' }).first();
  check(await booksOffer.count() === 1, 'books is offered as a real list to make, not a "coming next" row');
  await booksOffer.click();
  await page.waitForTimeout(300);
  check(await page.locator('h1').innerText() === 'Top 10 Books of All Time',
    'and it lands on the Books build screen, under the name the list will carry');
  check(await page.locator('.rail .card').count() > 0, 'the books shelf is populated');

  const booksOnly = await page.evaluate(() => [...document.querySelectorAll('.rail .card')]
    .every(c => (window.byId.get(+c.dataset.card) || {}).dm === 'book'));
  check(booksOnly, 'the books topic offers only books — a Ten never mixes domains');

  // Artwork is the whole screen, so a cover that does not load is not a
  // cosmetic problem. Only the cards actually on screen are judged: the rest
  // are loading="lazy" and have deliberately not started.
  await page.waitForTimeout(400);
  const covers = await page.evaluate(() => {
    const seen = [...document.querySelectorAll('.rail .card .art img')].filter(i => {
      const r = i.getBoundingClientRect();
      return r.top < innerHeight && r.bottom > 0 && r.left < innerWidth && r.right > 0;
    });
    return { n: seen.length, loaded: seen.filter(i => i.complete && i.naturalWidth > 0).length,
             own: seen.every(i => /\/covers\//.test(i.src)), sample: (seen[0] || {}).src };
  });
  check(covers.own, `book cards ask for the book's own cover rather than a TMDB path (${covers.sample})`);
  check(covers.n >= 3 && covers.loaded === covers.n, `every book cover on screen renders (${covers.loaded}/${covers.n})`);

  // The axes a book has, and none of the ones it does not.
  const bookChips = (await page.locator('.chip').allInnerTexts()).map(t => t.trim());
  check(bookChips.some(c => /^Author/.test(c)) && bookChips.some(c => /^Subject/.test(c)),
    `the refinements are named for books (${bookChips.join(', ')})`);
  check(!bookChips.some(c => /Services|Actor|Director|Genre/.test(c)),
    'and a book is not offered a Director, an Actor, or a streaming service');

  // Two things at once: the noun is the books shelf's noun, and the NUMBER is
  // the books shelf's number. The bar used to count the whole catalog — all
  // 2,932 movies, shows and books — and call the total "books".
  const bodyBooks = await page.locator('body').innerText();
  const bookCount = await page.evaluate(() => window.CAT.filter(f => f.dm === 'book').length);
  const wholeCatalog = await page.evaluate(() => window.CAT.length);
  const bookClaim = bodyBooks.match(/All ([\d,]+)\+ books\b/);
  const bookN = bookClaim ? Number(bookClaim[1].replace(/,/g, '')) : Infinity;
  check(bookN <= bookCount && bookN >= bookCount * 0.9,
    `the Now showing bar counts this shelf's books (${bookN}+ of ${bookCount}), not the whole ` +
    `catalog (${wholeCatalog}) — and rounding never costs more than a tenth of the shelf`);
  check(!/\bfilms?\b/i.test(bodyBooks), 'nothing on the books screen calls a book a film');
  check(!/\bnovels?\b/i.test(bodyBooks), 'and nothing calls it a novel');

  // "More like this" has to make a claim a reader would make. Reached the way
  // a reader reaches it on a browse row: pick the book, then See similar.
  await page.locator('.rail .card.browse .pin').first().click();
  await page.waitForTimeout(420);
  await page.locator('.rail .card.browse .do-similar').first().click();
  await page.waitForTimeout(250);
  const bookHead = await page.locator('.section-h').first().innerText();
  check(/^MORE LIKE /i.test(bookHead), `drilling into a book opens a "${bookHead}" section`);
  const whys = await page.locator('.rail .card .why').allInnerTexts();
  check(whys.length > 0, `the branch says why each book is there (${whys.length} reasons)`);
  check(!whys.some(w => /watched/i.test(w)), 'no books rail claims two books are "watched" together');
  check(whys.some(w => /^(More |Also |Often read)/.test(w.trim())),
    `the claims are the book axes — series, author, subject, read-together (${whys.slice(0, 3).join(' | ')})`);

  /* A domain brings its own word for its artwork, too.

     The dock said "Tap a poster to start" in front of a wall of book covers
     — the same class of mistake as calling a TV network a studio, which this
     file already fixed. A books shelf has covers. */
  const bookDockHint = await page.evaluate(() => {
    const t = { ...window.S.topic };
    window.S.topic = window.makeTopic({ domain: 'book' });
    window.S.tray = [];
    window.renderDock();
    const h = document.querySelector('.dock-top .hint').innerText.trim();
    window.S.topic = t;
    return h;
  });
  check(/cover/i.test(bookDockHint) && !/poster/i.test(bookDockHint),
    `a books shelf is tapped by its covers, not its posters ("${bookDockHint}")`);

  while (await page.evaluate(() => window.S.tray.length) < 10) {
    const free = page.locator('.rail .card[data-in="0"]').first();
    if (!(await free.count())) break;
    await free.locator('.pin').click();
    await page.waitForTimeout(25);
  }
  check(await page.evaluate(() => window.S.tray.length) === 10, 'a books Ten fills to ten');
  const trayAllBooks = await page.evaluate(() =>
    window.S.tray.every(id => (window.byId.get(id) || {}).dm === 'book'));
  check(trayAllBooks, 'and every one of the ten is a book');
  await page.screenshot({ path: SHOTS + '/12-books.png' });

  await page.locator('[data-act="arrange"]').click();
  await page.waitForTimeout(300);
  check(await page.locator('.tenrow').count() === 10, 'the books Ten opens as one reorderable list');
  await page.locator('[data-act="finish"]').click();
  await page.waitForSelector('.vault', { timeout: 5000 });
  await page.locator('[data-act="skip"]').click();
  await page.waitForSelector('.after.on', { timeout: 5000 });
  const bookInsc = await badgeInscription(page);
  check(!/film/i.test(bookInsc), `a book badge is inscribed about books ("${bookInsc}")`);
  await page.locator('[data-act="done"]').click();
  await page.waitForTimeout(250);
  const afterBooks = await page.locator('body').innerText();
  check(/More books, closer in/i.test(afterBooks), 'finishing a books Ten offers more books, closer in');
  // Split case-insensitively: section headings are uppercased by CSS, and
  // innerText returns what is rendered, not what is in the markup.
  check(!/\bfilms\b/i.test(afterBooks.split(/or a different kind of list/i)[0]),
    'and its own suggestions are phrased in books');

  // ── Discovery, and the reveal gate ──────────────────────────────────────

  // ── Discovery: other people's Top 10 lists, and the reveal gate ─────────
  await page.locator('[data-act="discover"]').click();
  await page.waitForTimeout(250);
  const cardCount = await page.locator('.other-ten').count();
  check(cardCount >= 5, `other people have Top 10 lists to look at (${cardCount})`);
  check((await page.locator('h1').innerText()) === 'Other Top 10 Lists',
    'the screen is called Other Top 10 Lists');
  // Round 5: the blurb under the title described what the cards below it were
  // already showing, so it only pushed the first card down the screen.
  check(await page.locator('.prompt').count() === 0, 'and carries no blurb under the title');

  // ── The LIST NAME leads, the line under it is subordinate (round 5) ─────
  const type = await page.evaluate(() => [...document.querySelectorAll('.other-ten')].map(c => {
    const px = sel => parseFloat(getComputedStyle(c.querySelector(sel)).fontSize);
    return { name: c.querySelector('.listname').innerText.trim(), nameSize: px('.listname'),
             claim: c.querySelector('.claim').innerText.trim(), claimSize: px('.claim') };
  }));
  check(type.length === cardCount && type.every(t => t.nameSize > t.claimSize),
    `the list name is the biggest type on every card (${type[0].nameSize}px name vs ` +
    `${type[0].claimSize}px claim)`);
  check(type.every(t => t.nameSize >= t.claimSize * 1.5),
    'and dominant, not merely larger — at least half again the line under it');
  // Since the correction of 2026-08-15 the name IS the topic, so it appears
  // once. Two people on the same topic share a name and are told apart by the
  // line beneath — which is the point of Sam and Theo both being on Crime.
  check(await page.locator('.other-ten .topic').count() === 0,
    'the name is not repeated as a separate topic line above itself');

  /* ── Every card makes an argument, not an introduction ──────────────────
     Mischa, 2026-11-17: "Who is Sam, why do I care about his top 10, why
     would that make me want to make my own?" The card used to answer none of
     those — it said "A Top 10 by Sam" and left the rest to the reader. Now
     it leads with a claim drawn from the list itself. */
  check(type.every(t => /\S/.test(t.claim)), 'every card leads with a claim');
  check(!/A Top 10 by/i.test(await page.locator('body').innerText()),
    'and none of them leads with a stranger\'s name instead');
  // The claim has to be ABOUT something — it names the person and a title,
  // so it cannot collapse to a label.
  check(type.every(t => t.claim.split(/\s+/).length >= 5),
    `each claim is a sentence, not a label (shortest: "${type.map(t => t.claim).sort((a, b) => a.length - b.length)[0]}")`);
  check(new Set(type.map(t => t.claim)).size === type.length,
    'and no two cards make the same claim');
  // Two people on the same topic must still be told apart, now that the line
  // under the name is the only thing distinguishing them.
  const sameTopic = type.filter(t => /Crime Movies of the 90s/.test(t.name));
  check(sameTopic.length === 2 && sameTopic[0].claim !== sameTopic[1].claim,
    `two takes on one topic read differently (${sameTopic.length} found)`);

  // ── A NAME IS A RULE, TRUE OF ALL TEN ───────────────────────────────────
  // The correction Mischa made on 2026-08-15: a list called "Top 10 Crime
  // Movies of the 90s" holds ten crime movies from the 90s, not four. The name
  // comes from the criteria, the criteria filter the shelf, so the only way
  // this can fail is if the two ever come apart.
  const named = await page.evaluate(() => window.SOURCES.map(p => {
    const ten = window.theirTen(p);
    return { who: p.label, name: window.listName(ten.ranked, p.topic), title: p.topic.title,
      crit: p.crit, supply: window.supply(p.topic),
      hold: ten.ranked.filter(f => window.inTopic(f, p.topic)).length, n: ten.ranked.length };
  }));
  check(named.length === cardCount, 'every card on screen is a generated name');
  for (const l of named) {
    check(/^Top 10 /.test(l.name), `"${l.name}" is named for its criteria, not for its contents`);
    check(l.name === l.title, `and the name shown is the topic's own name, nothing derived`);
    check(l.n === 10 && l.hold === 10,
      `"${l.name}" is true of ${l.who}'s list ${l.hold} times out of ${l.n} — all ten, by construction`);
    check(l.supply >= 10,
      `and the collection can supply it (${l.supply} candidates match ${JSON.stringify(l.crit)})`);
  }
  // Two cards may share a name only by sharing a topic; two topics may never
  // produce the same name, or the badge gate would be unreadable.
  const byName = await page.evaluate(() => {
    const m = {};
    for (const p of window.SOURCES) (m[p.topic.title] = m[p.topic.title] || new Set()).add(p.topic.id);
    return Object.entries(m).map(([title, ids]) => [title, ids.size]);
  });
  check(byName.every(([, n]) => n === 1),
    `no two different topics answer to the same name (${byName.length} names, ` +
    `${byName.filter(([, n]) => n > 1).length} collisions)`);

  // ── A list nobody can fill is never offered ─────────────────────────────
  // "Top 10 Hitchcock Thrillers" is a perfectly good name for a list this
  // collection cannot fill — it holds eight. The gate is what keeps a criteria
  // name from becoming a promise the next screen breaks.
  const fillable = await page.evaluate(() => {
    const cases = [{ director: 'Alfred Hitchcock', genre: 'Thriller' },
                   { actor: 'Eddie Murphy', genre: 'Comedy' },
                   { genre: 'Crime', decade: 1990 }];
    return cases.map(c => { const t = window.makeTopic(c);
      return { title: t.title, supply: window.supply(t), offerable: window.offerable(t) }; });
  });
  for (const g of fillable) check(g.offerable === (g.supply >= 10),
    `"${g.title}" is ${g.offerable ? 'offerable' : 'refused'} on ${g.supply} candidates`);
  check(fillable.some(g => !g.offerable) && fillable.some(g => g.offerable),
    'the gate is live in both directions — it refuses some lists and passes others');

  // A decade arrived from `facts()` as an object key, so it was the STRING
  // "1990", and `inTopic` compares decades with !==. Every decade-scoped list
  // was silently empty and the gate refused all of them. Both halves are
  // asserted: the type, and the effect the wrong type had.
  const decades = await page.evaluate(() => {
    const t = window.makeTopic({ genre: 'Crime', decade: 1990 });
    const strT = window.makeTopic({ genre: 'Crime', decade: '1990' });
    const ten = window.CAT.filter(f => (f.dm || 'movie') === 'movie' && f.g.includes('Crime'))
      .sort((a, c) => c.v - a.v).slice(0, 10).map(f => f.id);
    // The topic matters as much as the ten: rabbitHole builds criteria in the
    // CURRENT domain, and by this point in the run the app is on books.
    window.S.topic = window.makeTopic({ domain: 'movie' });
    window.S.scene = 'done'; window.S.ranked = ten; window.S.tray = ten; window.S.badge = null;
    const offered = window.rabbitHole();
    return { supply: window.supply(t), strSupply: window.supply(strT),
      decType: typeof offered.map(o => o.decade).find(d => d != null),
      hasDecade: offered.some(o => o.decade != null), titles: offered.map(o => o.title) };
  });
  check(decades.supply >= 10, `a decade-scoped list finds its candidates (${decades.supply})`);
  check(decades.strSupply === 0, 'and a string decade finds none — the bug, kept as the falsification');
  check(decades.decType === 'number', `so a generated topic carries a real number (${decades.decType})`);
  check(decades.hasDecade, `and a decade list is actually offered (${decades.titles.join(' | ')})`);

  // "Robert De Niro" shortens to De Niro or not at all. It shortened to "Niro".
  const people = await page.evaluate(() => ({
    deNiro: window.makeTopic({ actor: 'Robert De Niro' }).title,
    // Two Scotts on the shelf — Ridley (16 films) and Tony (8) — so neither
    // may claim the surname alone. This used to be the two Miyazakis, until
    // the English-language rule left only Hayao (via Spirited Away, a pinned
    // Oscar winner) and the surname stopped being ambiguous. The rule the
    // test is about did not change; its fixture expired.
    scott: window.makeTopic({ director: 'Ridley Scott' }).title,
    hitchcock: window.makeTopic({ director: 'Alfred Hitchcock' }).title,
  }));
  check(!/\bNiro\b/.test(people.deNiro) || /De Niro/.test(people.deNiro),
    `a name particle stays with its name ("${people.deNiro}")`);
  check(people.scott === 'Top 10 Ridley Scott Movies',
    `an ambiguous surname stays whole ("${people.scott}") — Ridley and Tony are both on the shelf`);
  check(people.hitchcock === 'Top 10 Hitchcock Movies',
    `an unambiguous one shortens the way people say it ("${people.hitchcock}")`);

  // Every reason on the completion screen is a FRACTION of the user's own ten,
  // and never the name of the list it is offering. This is the whole of
  // Mischa's correction, stated once as a test.
  const reasons = await page.evaluate(() => window.rabbitHole().map(t => ({ title: t.title, why: t.why })));
  check(reasons.length >= 3, `the completion screen offers ${reasons.length} criteria lists`);
  check(reasons.every(r => /^Top 10 /.test(r.title)), 'each named for its criteria');
  const counted = reasons.filter(r => /\b(\d+|All 10) of your 10\b/.test(r.why));
  check(counted.length >= reasons.length - 1,
    `and each gives the count off your own ten as the reason ("${counted[0].why}")`);
  check(reasons.every(r => !r.why.includes(r.title)),
    'the reason is never the name — a fraction names nothing');

  /* ── No user-entered text: every word on a card is derived ──────────────
     The rule is that nobody types anything onto a social surface (PRD Req 12
     amendment) — free text here is a moderation surface this product does
     not need. The old check enforced it by counting `p` elements, which was
     a proxy for the rule and not the rule: the claim line beneath each name
     is a `p`, and it is generated from the list, not written by anyone.

     So assert the rule itself. Every claim must match one of the shapes
     `claimFor` can produce, which is a stronger statement than "there is no
     paragraph" — a hand-written sentence would fail it.

     Widened 2026-11-18, and the proxy failed a second time: cards now carry a
     BYLINE, and the proxy counted it as free text because it is a `p`. It is
     not free text — its two halves are the label and role of a source in
     `SOURCES`, a closed set shipped with the app, no more user-entered than a
     button label. The rule has never been "no paragraphs", it is "nobody
     types anything onto this surface". So a byline is allowed only when both
     halves match a source we ship, character for character; anything else,
     including a byline with a word added to it, still counts as a stray. */
  const strays = await page.evaluate(() => {
    const shipped = new Set(window.SOURCES.map(s => `${s.label}\u0000${s.role}`));
    return [...document.querySelectorAll('.other-ten')].reduce((n, c) => n +
      [...c.querySelectorAll('p:not(.claim), .ln, .desc, .blurb')].filter(el => {
        if (!el.classList.contains('byline')) return true;
        const who = el.querySelector('.src'), role = el.querySelector('.role');
        return !who || !role
          || !shipped.has(`${who.textContent.trim()}\u0000${role.textContent.trim()}`);
      }).length, 0);
  });
  check(strays === 0, 'every line on a card is either the claim or the source it came from');
  /* The shapes `claimFor` can produce. Widened 2026-11-18: a derived list
     states what the derivation found rather than speaking as a person, so
     each ranking rule has its own sentence. "You and ..." takes a multi-word
     subject now ("you and the crowd"), which the old \S+ could not match. */
  const SHAPES = [
    /^You and (\S+|the \S+) agree on (\d+ of 10|nothing at all)\.$/,
    /^.+ puts .+ above .+\.$/,                       // a person, departing
    /^.+\u2019s number one is .+\.$/,                 // a person, agreeing
    /^More people have rated .+ than .+\.$/,         // Best known
    /^.+ is the one most people have rated\.$/,
    /^By score alone, .+ comes (above .+|first)\.$/, // Rated highest
    /^.+ scores (above .+|highest), on a fraction of the ratings\.$/, // Less obvious
  ];
  const generated = type.filter(t => SHAPES.some(re => re.test(t.claim)));
  check(generated.length === type.length,
    `every claim is one the app generated, not one anybody typed `
    + `(${generated.length}/${type.length}${generated.length === type.length ? '' : ' — odd one: "' + type.find(t => !SHAPES.some(re => re.test(t.claim))).claim + '"'})`);
  const discoverText = await page.locator('body').innerText();
  check(!/Argues about endings|practical effects|Cries at Pixar|Watches everything twice|Quotes films at you|Reads the credits/i.test(discoverText),
    'and the hand-written character blurbs are gone from the app entirely');

  // ── One CTA per card: 44pt, inside the card, saying what it does ─────────
  const ctas = await page.evaluate(() => [...document.querySelectorAll('.other-ten')].map(card => {
    const b = card.querySelector('.cta');
    const r = b && b.getBoundingClientRect(), c = card.getBoundingClientRect();
    return { buttons: card.querySelectorAll('button').length,
      label: b ? b.innerText.replace(/\s+/g, ' ').trim() : '',
      h: r ? r.height : 0, w: r ? r.width : 0,
      inside: !!r && r.left >= c.left - 1 && r.right <= c.right + 1
                  && r.top >= c.top - 1 && r.bottom <= c.bottom + 1 };
  }));
  check(ctas.every(c => c.buttons === 1), 'each card offers exactly one action');
  check(ctas.every(c => c.h >= 44 && c.w >= 44),
    `every CTA meets the 44pt minimum (smallest ${Math.round(Math.min(...ctas.map(c => c.h)))}pt tall)`);
  check(ctas.every(c => c.inside), 'and sits fully inside its card');
  check(ctas.every(c => /^Read .+Top 10$/.test(c.label)),
    `and says what it does ("${ctas[0].label}")`);

  // A CTA that only just fits at the default size is a CTA that breaks at the
  // accessibility sizes this app must pass (AGENTS.md quality gate).
  for (const root of [14, 24]) {
    const dt = await page.evaluate(px => {
      document.documentElement.style.fontSize = px + 'px';
      const out = [...document.querySelectorAll('.other-ten')].map(card => {
        const c = card.getBoundingClientRect(), cta = card.querySelector('.cta').getBoundingClientRect();
        const spill = [...card.querySelectorAll('.topic, .listname, .creator, .strip, .badgecell, .cta')]
          .some(e => { const b = e.getBoundingClientRect();
            return b.left < c.left - 1 || b.right > c.right + 1 || b.bottom > c.bottom + 1; });
        return { spill, h: cta.height };
      });
      document.documentElement.style.fontSize = '';
      return out;
    }, root);
    check(dt.every(d => !d.spill && d.h >= 44),
      `the card holds together at ${root}px root text (nothing spills, CTA still ` +
      `${Math.round(Math.min(...dt.map(d => d.h)))}pt)`);
  }

  // ── Locked, and saying what unlocks it ──────────────────────────────────
  const lockedOnList = await page.locator('.lockedbadge').count();
  check(lockedOnList === cardCount, `every badge starts locked (${lockedOnList} of ${cardCount})`);
  const gate = (await page.locator('.other-ten .badgecell').first().innerText()).replace(/\s+/g, ' ').trim();
  check(/locked/i.test(gate) && /make your/i.test(gate),
    `a locked card reads as locked and says what opens it ("${gate}")`);
  // Both agents' checks survive: the gate's own assertions, and the copy
  // sweep that must also hold on this screen.
  await noBritishSpelling('other people\'s Top 10 lists');
  await page.screenshot({ path: SHOTS + '/14-discover.png', fullPage: true });

  await page.locator('.other-ten .cta').first().click();
  await page.waitForTimeout(250);
  check((await page.locator('h1').innerText()) === type[0].name,
    'the card opens the list it named — the page leads with the same name');
  check(/locked/i.test(await page.locator('body').innerText()), 'their Ten is fully readable, only the badge is gated');
  check(await page.locator('.tenrow').count() === 10, 'and the list itself is never hidden');

  // ── The gate: per topic, and retroactive across every list on it ─────────
  const shared = await page.evaluate(() => {
    const byTopic = {};
    /* Identify a card by its source ID, never by its label. Since the seed
       sources became kinds rather than people (2026-11-18) a label is shared
       - "Best known" heads a crime list and an animation list - so matching
       on labels would mark the wrong cards as opened and still, by luck of
       the count, sometimes pass. The id is what the card carries in the DOM. */
    for (const p of window.SOURCES) (byTopic[p.topic.id] = byTopic[p.topic.id] || []).push(p.id);
    const id = Object.keys(byTopic).sort((a, b) => byTopic[b].length - byTopic[a].length)[0];
    const on = window.SOURCES.filter(p => p.topic.id === id);
    return { topic: on[0].topic, ids: byTopic[id], labels: on.map(p => p.label) };
  });
  check(shared.ids.length >= 2,
    `more than one source has taken on the same topic (${shared.labels.join(' and ')} on ${shared.topic.title})`);
  await page.evaluate(t => {
    window.S.done.push({ topicId: t.id, title: t.title, domain: t.domain,
      ranked: window.S.done[0].ranked, badge: window.S.done[0].badge });
  }, shared.topic);
  // We are on a person's page; its Back returns to Discover and re-renders.
  await page.locator('[data-act="discover"]').click();
  await page.waitForTimeout(300);
  const lockedAfter = await page.locator('.lockedbadge').count();
  check(lockedAfter === lockedOnList - shared.ids.length,
    `one take opens every badge on that topic at once, and no others ` +
    `(${lockedOnList} locked → ${lockedAfter}, ${shared.ids.length} opened)`);
  const opened = await page.evaluate(() => [...document.querySelectorAll('.other-ten')]
    .filter(c => c.querySelector('.badgecell.open')).map(c => c.dataset.who));
  check(opened.slice().sort().join(',') === shared.ids.slice().sort().join(','),
    `and exactly the lists on that topic opened, retroactively, without visiting them (${opened.join(', ')})`);
  check(await page.locator('.other-ten .badgecell.open svg').count() === shared.ids.length,
    'each opened card shows the real badge where the lock was');
  const openGate = (await page.locator('.other-ten .badgecell.open').first().innerText()).replace(/\s+/g, ' ').trim();
  check(/unlocked/i.test(openGate), `and says so ("${openGate}")`);
  const stillLocked = await page.evaluate(() => [...document.querySelectorAll('.other-ten')]
    .filter(c => c.querySelector('.badgecell.locked')).map(c => c.dataset.who));
  check(stillLocked.length === cardCount - shared.ids.length,
    `every other topic stays shut (${stillLocked.join(', ')})`);
  await page.screenshot({ path: SHOTS + '/15-discover-unlocked.png', fullPage: true });

  // ── A draft saved by an earlier build must survive a rebuilt shelf ──────
  // The catalog is regenerated from TMDB, so ids can vanish between builds.
  // This exact state blanked the map and threw on 'reading t'.
  // The key is read from the app, not written down here. It was written down
  // here once, the app bumped it, and this whole regression quietly stopped
  // testing anything — a test that cannot fail is worse than no test.
  await page.evaluate(() => {
    localStorage.setItem(window.KEY, JSON.stringify({
      scene: 'build', topic: { id: 'movie', title: 'Top 10 Movies of All Time', prompt: 'p' },
      tray: [999999001, 999999002], q: '',
      graph: { nodes: { '999999001': { id: 999999001, parent: null, kids: [999999002], kind: 'followed' },
                        '999999002': { id: 999999002, parent: 999999001, kids: [], kind: 'picked' } },
               roots: [999999001], focus: 999999001 },
      filters: { services: [], genre: null, director: null, actor: null },
      region: 'GB', keep: [], ranked: [], rank: null, comparisons: 0, badge: null
    }));
  });
  const beforeStale = errors.length;
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  check((await page.locator('.dock-top .n').innerText()) === '0 of 10',
    'movies the collection no longer holds are dropped from the draft, not counted');
  check(await page.evaluate(() => Object.keys(window.S.graph.nodes).length) === 0,
    'and from the map graph');
  check(await page.locator('.rail .card').count() > 0, 'the screen still builds');
  check(errors.length === beforeStale, 'a stale draft raises no errors: ' + JSON.stringify(errors.slice(beforeStale)));

  // badge.js is a classic script loaded beside four different pages, so a
  // top-level `const` in it shares one global lexical scope with each of
  // them. `const MOTIFS` in both files is a SyntaxError that stops the page
  // parsing, and the symptom shows up four layers away — the app boots to a
  // blank screen and the first failure is "a new user lands on the intro".
  // Assert the surface instead of trusting it.
  console.log('\n\u2500\u2500 The badge renderer keeps itself to itself \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
  // Read the BARE identifiers, not window.X: a top-level `const` in a
  // classic script creates a global *lexical* binding and never a property
  // of window, so `window.MOTIFS` is undefined even on the page that
  // declares it. Checking window.X would have passed whatever badge.js did.
  const leaked = await page.evaluate(() => ({
    missing: ['badgeSVG', 'lockedBadge', 'fieldTones', 'badgeHash']
      .filter(k => typeof window[k] !== 'function'),
    // MOTIFS belongs to index.html here, and it is the genre map, not the
    // renderer's glyph kit.
    ownsMotifs: typeof MOTIFS === 'object' && !!MOTIFS.Crime,
    kit: ['PLATES', 'ENAMELS', 'MATERIALS', 'SHAPE_KEYS', 'escBadge', 'nearestEnamel']
      .filter(k => eval('typeof ' + k) !== 'undefined'),
  }));
  check(leaked.missing.length === 0, 'the renderer exports what the pages call: ' + JSON.stringify(leaked.missing));
  check(leaked.ownsMotifs, "index.html's own MOTIFS survives loading the renderer");
  check(leaked.kit.length === 0, 'and the renderer leaks none of its kit: ' + JSON.stringify(leaked.kit));

  /* The thing you came to a title page to do is reachable without scrolling.

     Giving the cast and genre links real 44px targets put each one on its
     own line in the 203px column beside the poster, the facts block grew to
     428px, and "+ Add to my Top 10" landed at y=528 with the dock at 541 -
     the primary action on the page, behind the dock. An accessibility fix
     that buries the button is not a fix. The metadata moved below the
     button and full-width, where it is also what it always was: navigation,
     not facts to read. */
  /* ── The first screen fits on every phone ───────────────────────────────
     "A splash whose button is below the fold has failed at the only job it
     has" - the comment already in index.html, written when a breakpoint set
     at 741px tipped a Pro Max (which gives 745) over its own viewport. That
     was fixed by measuring six viewports by hand, once. A measurement taken
     by hand protects nothing, so it is a test now.

     These are BROWSER heights, not device heights: a phone's spec sheet
     counts the ~190px Safari spends on its own chrome. */
  console.log('\n\u2500\u2500 The splash fits on every phone \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
  const PHONES = [
    ['iPhone SE', 375, 553],
    // The three that actually broke, kept as regression cases: a 20px band
    // where the strip was shown but there was no room for it, and a narrow
    // Android width where the hero grid's own height did the overflowing.
    ['narrow, just under the strip', 360, 610],
    ['narrow, just over it', 360, 630],
    ['iPhone 13 mini', 375, 629],
    ['iPhone 15 Pro', 393, 659],
    ['iPhone 15 Pro Max', 430, 745],
    ['short and wide', 430, 610],
    ['iPad mini', 744, 954],
  ];
  for (const [label, w, h] of PHONES) {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate(() => {
      localStorage.clear();
      S.scene = 'intro'; S.seen = false; S.introSeen = 0; save(); render();
    });
    await page.waitForTimeout(260);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(80);
    const fit = await page.evaluate(() => {
      const q = sel => document.querySelector(sel);
      const box = el => { const r = el.getBoundingClientRect();
        return { top: Math.round(r.top), bottom: Math.round(r.bottom), w: Math.round(r.width) }; };
      const cta = q('.intro [data-act="begin"]'), promise = q('.intro .promise'), h1 = q('.intro h1');
      if (!cta || !promise || !h1) return null;
      return {
        cta: box(cta), promise: box(promise), h1: box(h1),
        vh: window.innerHeight, vw: window.innerWidth,
        spill: Math.round(document.documentElement.scrollWidth - document.documentElement.clientWidth),
        // How far the page could scroll, which is the honest "does it fit".
        // A pixel or two is sub-pixel rounding on a 100svh box, not a
        // layout that overflows.
        over: Math.round(document.documentElement.scrollHeight - document.documentElement.clientHeight),
      };
    });
    const ok = fit && fit.over <= 2 && fit.spill <= 1
      && fit.cta.bottom <= fit.vh && fit.promise.bottom <= fit.vh
      && fit.h1.top >= 0 && fit.cta.top >= 0;
    check(ok,
      `${label} (${w}x${h}): the headline, the button and the promise are all on screen `
      + `without scrolling` + (fit ? ` \u2014 headline ${fit.h1.top}..${fit.h1.bottom}, button ${fit.cta.top}..${fit.cta.bottom}, `
                                   + `promise ends ${fit.promise.bottom}, of ${fit.vh}; scrollable ${fit.over}px; spill ${fit.spill}`
                                   : ' \u2014 splash did not render'));
  }
  await page.setViewportSize(PHONE);
  await page.waitForTimeout(150);

  console.log('\n\u2500\u2500 The title page leads with its action \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
  await page.setViewportSize(PHONE);
  await page.evaluate(() => { S.title = 680; S.back = 'build'; S.scene = 'title'; save(); render(); });
  await page.waitForTimeout(350);
  const cta = await page.evaluate(() => {
    const btn = document.querySelector('.title-cta .btn'), dock = document.querySelector('.dock');
    if (!btn || !dock) return null;
    const b = btn.getBoundingClientRect(), d = dock.getBoundingClientRect();
    return { top: Math.round(b.top), bottom: Math.round(b.bottom), dockTop: Math.round(d.top),
             label: btn.innerText.trim(), scrolled: Math.round(window.scrollY) };
  });
  check(cta && cta.scrolled === 0 && cta.bottom <= cta.dockTop,
    `"${cta && cta.label}" is reachable without scrolling `
    + `(ends at ${cta && cta.bottom}px, dock starts at ${cta && cta.dockTop}px)`);

  console.log('\n\u2500\u2500 Touch targets, hit-tested at 44x44 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
  // Same reasoning as the contrast canary below: "nothing is too small" is
  // green when the sweep works and the screen is clean, and equally green
  // when it is quietly not running.
  await page.evaluate(() => {
    // Clear anything left open by an earlier block: the sweep skips controls
    // behind an overlay, and a stray sheet would make the canary itself get
    // skipped rather than caught.
    document.querySelectorAll('.sheet, .scrim, .vault, .coach, .coachscrim').forEach(n => n.remove());
    const b = document.createElement('button');
    b.id = 'tap-canary';
    b.textContent = 'x';
    b.style.cssText = 'position:fixed;top:120px;left:120px;width:20px;height:20px;z-index:99999';
    document.body.appendChild(b);
  });
  await page.waitForTimeout(100);
  const tapCanary = await page.evaluate(TAP_SWEEP);
  check(tapCanary.bad.some(o => o.label === 'x' || /tap-canary/.test(o.sel)),
    `the 44x44 sweep catches a planted 20x20 button before it is trusted `
    + `(${tapCanary.bad.length} reported)`);
  await page.evaluate(() => { const b = document.getElementById('tap-canary'); if (b) b.remove(); });
  await page.waitForTimeout(80);
  const TAP_SCREENS = [
    ['the splash', () => { localStorage.clear(); S.scene = 'intro'; S.seen = false; S.introSeen = 0; save(); render(); }],
    ['the browse screen', () => { S.scene = 'build'; S.seen = true; S.tipDone = true; S.tray = []; save(); render(); }],
    ['a title page', () => { S.title = 680; S.back = 'build'; S.scene = 'title'; save(); render(); }],
    ['discovery', () => { S.done = []; S.scene = 'discover'; save(); render(); }],
  ];
  for (const [where, fn] of TAP_SCREENS) {
    await page.evaluate(fn);
    await page.waitForTimeout(350);
    await page.evaluate(() => { const c = document.querySelector('.coachscrim'); if (c) c.click(); });
    await page.waitForTimeout(150);
    await sweepTaps(page, where, check);
  }
  // The ten sheet carries the reorder arrows, which are the accessible
  // ranking path and were the worst offenders at 44x32.
  await page.evaluate(ids => { S.scene = 'build'; S.tray = ids.slice(); save(); render(); },
    [680, 155, 13, 550, 27205, 278, 238, 424, 129, 603]);
  await page.waitForTimeout(300);
  const sheetOpener = page.locator('[data-act="openten"]');
  if (await sheetOpener.count()) { await sheetOpener.first().click(); await page.waitForTimeout(400); }
  await sweepTaps(page, 'the Ten sheet', check);

  console.log('\n\u2500\u2500 Dynamic Type, XS to accessibility sizes \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
  // And the same for this one.
  await page.evaluate(() => {
    document.querySelectorAll('.sheet, .scrim, .vault, .coach, .coachscrim').forEach(n => n.remove());
    const d = document.createElement('div');
    d.id = 'dt-canary';
    d.style.cssText = 'position:fixed;top:160px;left:0;width:60px;height:20px;overflow:hidden;white-space:nowrap;z-index:99999;background:#fff';
    d.textContent = 'a line far too long for the box it is in';
    document.body.appendChild(d);
  });
  await page.waitForTimeout(100);
  const dtCanary = await page.evaluate(DT_CHECK);
  check(dtCanary.clipped.some(o => /dt-canary/.test(o.sel) || /far too long/.test(o.text)),
    `the Dynamic Type sweep catches planted clipped text before it is trusted `
    + `(${dtCanary.clipped.length} clipped, ${dtCanary.offscreen.length} off-screen reported)`);
  await page.evaluate(() => { const d = document.getElementById('dt-canary'); if (d) d.remove(); });
  await page.waitForTimeout(80);
  // The block above leaves the Ten sheet open, and a sheet outlives a
  // re-render of the screen behind it — the first run of this sweep reported
  // the finished list's rows as faults on the splash.
  await page.evaluate(() => { document.querySelectorAll('.sheet, .scrim, .vault').forEach(n => n.remove()); });
  await page.waitForTimeout(150);
  const DT_SIZES = [12, 16, 20, 24, 28, 32];
  const DT_SCREENS = [
    ['the splash', () => { localStorage.clear(); S.scene = 'intro'; S.seen = false; S.introSeen = 0; save(); render(); }],
    ['the browse screen', () => { S.scene = 'build'; S.seen = true; S.tipDone = true; S.tray = []; save(); render(); }],
    ['a title page', () => { S.title = 680; S.back = 'build'; S.scene = 'title'; save(); render(); }],
    ['discovery', () => { S.done = []; S.scene = 'discover'; save(); render(); }],
    ['a finished Ten', () => { S.ranked = [680, 155, 13, 550, 27205, 278, 238, 424, 129, 603];
                               S.scene = 'done'; save(); render(); }],
  ];
  /* In more than one font.

     The first run of this sweep went green here and red on CI, because the
     runner has none of this machine's fonts and falls back to something
     wider: the splash's call to action fitted at 28px here and overflowed
     by 7px there. I had already written that lesson down for a different
     check this morning and then not applied it to this one. Any assertion
     about WIDTH is a statement about the font that rendered it.

     DejaVu Serif is on the runner and is the widest of these, so it is the
     one that reproduces CI locally. */
  /* The fallback fonts are swept only at the LARGE sizes.

     Every width failure found this way appeared at a 28px or 32px root,
     because that is where a label outgrows its control; at ordinary sizes
     the three fonts agree. Sweeping all three at all six sizes is 90 renders
     per screen-set for two extra findings, and this suite has a CI timeout
     to live within. */
  const DT_FONTS = ['', '"DejaVu Serif", serif', '"Liberation Sans", sans-serif'];
  const WIDE_ONLY = DT_SIZES.filter(px => px >= 28);
  for (const [where, fn] of DT_SCREENS) {
    const bad = [];
    for (const font of DT_FONTS) {
      for (const px of (font ? WIDE_ONLY : DT_SIZES)) {
        await page.evaluate(f => { document.body.style.fontFamily = f; }, font);
        await page.evaluate(v => { document.documentElement.style.fontSize = v + 'px'; }, px);
      await page.evaluate(fn);
      await page.waitForTimeout(220);
      await page.evaluate(() => {
        const c = document.querySelector('.coachscrim'); if (c) c.click();
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(100);
      const r = await page.evaluate(DT_CHECK);
      const f = font ? ` in ${font.split(',')[0]}` : '';
      if (r.pageSpill > 1) bad.push(`${px}px${f}: page spills ${r.pageSpill}px sideways`);
      for (const c of r.clipped) bad.push(`${px}px${f}: ${c.sel} clipped by ${c.over}px ("${c.text}")`);
      for (const o of r.offscreen) bad.push(`${px}px${f}: ${o.sel} off-screen ("${o.text}")`);
    }
    }
    await page.evaluate(() => { document.body.style.fontFamily = ''; });
    check(bad.length === 0,
      `${where} holds from ${DT_SIZES[0]}px to ${DT_SIZES[DT_SIZES.length - 1]}px root text`
      + (bad.length ? ` — ${bad.length} problems: ${bad.slice(0, 3).join('; ')}` : ''));
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
  await page.waitForTimeout(150);

  /* A canary, because this is an ABSENCE assertion.

     "No element fails AA" is green when the function works and the page is
     clean, and equally green when the function is silently not running - a
     screen that did not render, a selector that stopped matching, a
     measurement taken against the wrong state. I have shipped one vacuous
     check today already (a budget assertion measured at 852px, which passed
     no matter what the header did), so this one proves itself first: plant
     an element that MUST fail, confirm it is caught, remove it, then run for
     real. If the canary is not caught, the suite says so instead of
     reporting a clean sweep it did not perform. */
  console.log('\n\u2500\u2500 Contrast at WCAG AA, light and dark \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.evaluate(() => {
    const c = document.createElement('p');
    c.id = 'contrast-canary';
    c.textContent = 'canary';
    // #BFBFBF on white is 2.1:1 — well under the 4.5 a 16px body needs.
    c.style.cssText = 'color:#BFBFBF;background:#FFFFFF;font-size:16px;padding:4px;position:fixed;top:4px;left:4px;z-index:99999';
    document.body.appendChild(c);
  });
  await page.waitForTimeout(100);
  const caught = await page.evaluate(CONTRAST);
  const sawCanary = caught.bad.some(o => o.text === 'canary');
  check(sawCanary,
    `the contrast check catches a planted 2.1:1 element before it is trusted `
    + `(examined ${caught.seen}, reported ${JSON.stringify(caught.bad.map(o => o.sel + ' ' + o.ratio))})`);
  await page.evaluate(() => { const c = document.getElementById('contrast-canary'); if (c) c.remove(); });

  for (const scheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.waitForTimeout(120);
    const bad = [];
    for (const [where, fn] of DT_SCREENS) {
      await page.evaluate(fn);
      await page.waitForTimeout(250);
      await page.evaluate(() => {
        const c = document.querySelector('.coachscrim'); if (c) c.click();
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(120);
      const res = await page.evaluate(CONTRAST);
      if (res.seen < 6) bad.push(`${where}: only ${res.seen} text elements on screen — did it render?`);
      for (const o of res.bad) {
        bad.push(`${where}: ${o.sel} ${o.ratio}:1 needs ${o.need} ("${o.text}")`);
      }
    }
    check(bad.length === 0,
      `every text colour clears AA in ${scheme}`
      + (bad.length ? ` \u2014 ${bad.length} do not: ${bad.slice(0, 3).join('; ')}` : ''));
  }
  await page.emulateMedia({ colorScheme: null });

  /* ── Reduce Motion lands on the identical end state ─────────────────────
     design.md calls this non-optional and "tested per milestone". The reveal
     ceremony was rewritten today - the inscription moved onto the badge's
     ribbon and types letter by letter - so the claim needs re-checking
     against the thing that changed. */
  console.log('\n\u2500\u2500 Reduce Motion lands on the same end state \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
  const END = `(() => {
    const v = document.querySelector('.vault');
    if (!v) return { none: true };
    const t = v.querySelector('#l-ribbon text');
    const cls = (sel, c) => { const e = v.querySelector(sel); return !!e && e.classList.contains(c); };
    return {
      layers: [...v.querySelectorAll('.layer')].map(l => l.id + ':' + (l.classList.contains('on') ? 1 : 0)).join(','),
      letters: [...v.querySelectorAll('#l-ribbon .ich')].filter(e => e.classList.contains('on')).length
        + '/' + v.querySelectorAll('#l-ribbon .ich').length,
      inscription: t ? t.textContent.trim() : '',
      name: (v.querySelector('.revealed-name') || {}).textContent || '',
      nameOn: cls('.revealed-name', 'on'), afterOn: cls('.after', 'on'),
    };
  })()`;
  const endStates = {};
  for (const mode of ['no-preference', 'reduce']) {
    await page.emulateMedia({ reducedMotion: mode });
    await page.evaluate(ids => {
      document.querySelectorAll('.vault, .sheet, .scrim').forEach(n => n.remove());
      S.topic = makeTopic({}); S.tray = ids.slice(); S.ranked = ids.slice();
      S.rank = null; S.scene = 'reveal'; save(); render();
    }, [680, 155, 13, 550, 27205, 278, 238, 424, 129, 603]);
    await page.waitForFunction(() => {
      const a = document.querySelector('.vault .after');
      return a && a.classList.contains('on');
    }, null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(250);
    endStates[mode] = await page.evaluate(END);
  }
  await page.emulateMedia({ reducedMotion: null });
  const differing = Object.keys(endStates['no-preference'])
    .filter(k => JSON.stringify(endStates['no-preference'][k]) !== JSON.stringify(endStates.reduce[k]));
  check(!endStates['no-preference'].none && differing.length === 0,
    `the reveal's end state is identical with Reduce Motion `
    + `(badge ${endStates['no-preference'].layers}, letters ${endStates['no-preference'].letters})`
    + (differing.length ? ` \u2014 differs on: ${differing.join(', ')}` : ''));
  await page.evaluate(() => { document.querySelectorAll('.vault').forEach(n => n.remove()); });

  console.log('\n\u2500\u2500 VoiceOver: names and spoken ranks \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
  await page.evaluate(() => {
    document.querySelectorAll('.sheet, .scrim, .vault, .coach, .coachscrim').forEach(n => n.remove());
    const b = document.createElement('button');
    b.id = 'vo-canary';
    b.style.cssText = 'position:fixed;top:200px;left:4px;width:50px;height:50px;z-index:99999';
    document.body.appendChild(b);                       // no label, no text
    const holder = document.createElement('div');
    holder.id = 'vo-canary2';
    const n = document.createElement('span');
    n.className = 'num'; n.textContent = '7';
    n.style.cssText = 'position:fixed;top:260px;left:4px;z-index:99999';
    holder.appendChild(n);                              // no li, no aria
    document.body.appendChild(holder);
  });
  await page.waitForTimeout(120);
  const voCanary = await page.evaluate(VO_SWEEP);
  check(voCanary.unnamed.some(u => /vo-canary/.test(u.html)) && voCanary.bareNumerals.some(x => x.txt === '7'),
    `the VoiceOver sweep catches an unlabelled button and a bare numeral before it is trusted `
    + `(${voCanary.unnamed.length} unnamed, ${voCanary.bareNumerals.length} bare)`);
  await page.evaluate(() => {
    ['vo-canary', 'vo-canary2'].forEach(id => { const e = document.getElementById(id); if (e) e.remove(); });
  });

  for (const [where, fn] of DT_SCREENS) {
    await page.evaluate(fn);
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      document.querySelectorAll('.coach, .coachscrim').forEach(n => n.remove());
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(100);
    const r = await page.evaluate(VO_SWEEP);
    const faults = [
      ...r.unnamed.map(u => `unnamed ${u.sel} ${u.w}x${u.h}`),
      ...r.bareNumerals.map(x => `bare numeral "${x.txt}" in ${x.parent}`),
      ...r.imgsNoAlt.map(i => `img with no alt attribute`),
    ];
    check(faults.length === 0,
      `${where}: every control named and every rank spoken`
      + (faults.length ? ` \u2014 ${faults.length}: ${faults.slice(0, 3).join('; ')}` : ''));
  }

  /* ── The splash's other categories read in full, and are tappable ───────
     Mischa, 2026-11-18: "the other categories below should never have text
     cut off, it should be clear those are tappable to expand them into the
     space above."

     The label used to be `-webkit-line-clamp: 2` in a 63px tile, which is
     about eight characters a line, so "Animated Movies of the 2000s" came
     out "Animated Movies o…" - on the one part of the splash whose job is to
     say what else is in here.

     Every topic is put in the hero in turn, so every label is measured in a
     tile at least once; a rule that happens to fit five of six is not a rule.
     Clipping is measured on the element, not inferred from the string: a
     clamp, an ellipsis and a plain overflow all read the same to a reader
     and only `scrollHeight` catches all three. */
  console.log('\n── The splash says what else is in here ──────────────');
  const stripAt = i => page.evaluate(n => {
    localStorage.clear();
    window.setIntroAt(null);
    S.scene = 'intro'; S.seen = false; S.introSeen = n; save(); render();
  }, i);
  const stripState = () => page.evaluate(() => {
    const hero = document.querySelector('.hero-ten .what');
    return {
      hero: hero ? hero.textContent.trim() : null,
      over: Math.round(document.documentElement.scrollHeight - window.innerHeight),
      tiles: [...document.querySelectorAll('.mini-ten')].map(b => {
        const w = b.querySelector('.what'), r = b.getBoundingClientRect();
        return { label: w ? w.textContent.trim() : '', aria: b.getAttribute('aria-label') || '',
          tag: b.tagName, at: b.dataset.intro,
          clippedLabels: !!w && w.scrollHeight > w.clientHeight + 1,
          w: Math.round(r.width), h: Math.round(r.height) };
      }),
    };
  });

  let seenLabels = 0, clippedLabels = [], smallTiles = [], unnamedTiles = [];
  for (let i = 0; i < 6; i++) {
    await stripAt(i);
    await page.waitForTimeout(220);
    const st = await stripState();
    for (const t of st.tiles) {
      seenLabels++;
      if (t.clippedLabels) clippedLabels.push(t.label);
      if (t.w < 44 || t.h < 44) smallTiles.push(`${t.label} ${t.w}x${t.h}`);
      // The tile is a button, and its accessible name is the FULL list name -
      // the shortening is for the eye, and a reader loses nothing to it.
      if (t.tag !== 'BUTTON' || !/^Show Top 10 /.test(t.aria)) unnamedTiles.push(t.label + ' / ' + t.aria);
    }
  }
  check(seenLabels >= 12, `every intro topic was shown as a tile (${seenLabels} measured)`);
  check(clippedLabels.length === 0,
    'no category label is cut off' + (clippedLabels.length ? ` — ${clippedLabels.join(', ')}` : ''));
  check(smallTiles.length === 0,
    'every category tile is at least 44x44' + (smallTiles.length ? ` — ${smallTiles.join(', ')}` : ''));
  check(unnamedTiles.length === 0,
    'every tile is a button carrying the full list name'
    + (unnamedTiles.length ? ` — ${unnamedTiles.slice(0, 2).join('; ')}` : ''));

  // Tapping one swaps it into the hero and the old hero rejoins the strip,
  // which is how the set cycles without moving on its own.
  await stripAt(0);
  await page.waitForTimeout(220);
  const stripWas = await stripState();
  const pickAria = stripWas.tiles[1].aria.replace(/^Show /, '');
  await page.locator('.mini-ten').nth(1).click();
  await page.waitForTimeout(300);
  const stripNow = await stripState();
  check(stripNow.hero === pickAria,
    `tapping a category puts it in the hero above ("${stripNow.hero}" wanted "${pickAria}")`);
  // A SWAP, not a rotation: the list that was in the hero lands in the slot
  // just tapped. Rotating put it in fourth place, off the end of a strip
  // three tiles wide, so tapping away from a topic made it vanish.
  check(stripNow.tiles[1] && stripNow.tiles[1].aria === 'Show ' + stripWas.hero,
    `and the list it replaced takes the slot just tapped (${stripNow.tiles.map(t => t.label).join(', ')})`);
  check(stripNow.tiles.every(t => t.aria !== 'Show ' + stripNow.hero),
    'the hero is never also offered as a tile below itself');

  /* ── Hold a poster to reorder, tap to open the list ─────────────────────
     Mischa, 2026-11-18: "rearranging your order should be done by holding and
     dragging the mini posters around... need a persistent 'drag to
     rearrange' tip while also having an easy way to enter a vertical
     arranging mode."

     Three separate promises, so three separate checks: the tip is there and
     says the domain's own word, the drag moves the thing it was given, and
     the two gestures do not collide - a drag must not also open the sheet,
     and a tap must still open it. The collision is the one that actually
     broke in development: the first implementation armed a one-shot click
     suppressor at the end of a drag, and because a drag that ends on another
     slot fires no click at all, the suppressor stayed armed and ate the next
     tap instead. */
  console.log('\n── Hold a poster to reorder ────────────────────');
  const dockSetup = async () => {
    await page.evaluate(() => {
      localStorage.clear();
      document.querySelectorAll('.sheet, .scrim, .coach, .coachscrim, .vault').forEach(n => n.remove());
      S.scene = 'build'; S.seen = true; S.tipDone = true;
      S.tray = [680, 155, 13, 550, 27205]; save(); render();
    });
    await page.waitForTimeout(350);
    await page.evaluate(() => document.querySelectorAll('.coach, .coachscrim').forEach(n => n.remove()));
  };
  const trayNames = () => page.evaluate(() => window.S.tray.map(id => window.byId.get(id).t));
  const holdDrag = async (from, slots) => {
    const box = await page.locator(`.slotmini[data-slot="${from}"]`).boundingBox();
    const step = await page.evaluate(() => window.dockStep());
    const y = box.y + box.height / 2, x0 = box.x + box.width / 2;
    await page.mouse.move(x0, y);
    await page.mouse.down();
    await page.waitForTimeout(300);                  // past the hold threshold
    for (let k = 1; k <= 10; k++) { await page.mouse.move(x0 + step * slots * k / 10, y); await page.waitForTimeout(16); }
    await page.mouse.up();
    await page.waitForTimeout(260);
  };

  await dockSetup();
  check(/hold a poster to reorder/i.test(await page.locator('.dock-top .hint').innerText()),
    `the drag tip is on screen and stays there ("${await page.locator('.dock-top .hint').innerText()}")`);
  check(!(await page.locator('.dock-top .btn').isDisabled()),
    'Arrange opens from two picks, not only from ten');

  const dragWas = await trayNames();
  await holdDrag(0, 2);
  const dragNow = await trayNames();
  check(dragNow[2] === dragWas[0] && dragNow[0] === dragWas[1],
    `holding the first poster and dragging it two along moves it there `
    + `(${dragWas[0]} → position ${dragNow.indexOf(dragWas[0]) + 1})`);
  check(await page.locator('#tenlist').count() === 0,
    'and a drag does not also open the vertical list on top of it');

  await holdDrag(4, -3);
  const dragBack = await trayNames();
  check(dragBack[1] === dragNow[4],
    `and it drags the other way too (${dragNow[4]} → position ${dragBack.indexOf(dragNow[4]) + 1})`);

  await dockSetup();
  // Read the order BEFORE the tap. Reading it twice afterwards and comparing
  // the two compares a value with itself, which is a check that cannot fail.
  const tapWas = await trayNames();
  await page.locator('.slotmini[data-slot="1"]').click();
  await page.waitForTimeout(350);
  check(await page.locator('#tenlist').count() === 1,
    'a tap on a poster still opens the vertical list');
  check((await trayNames()).join('|') === tapWas.join('|'),
    'and a tap never reorders anything by itself');
  await page.evaluate(() => document.querySelectorAll('.sheet, .scrim').forEach(n => n.remove()));

  await dockSetup();
  await page.locator('.dock-top .btn').click();
  await page.waitForTimeout(350);
  check(await page.locator('#tenlist').count() === 1,
    'the Arrange button opens the same vertical list — the non-drag way to reorder');
  await page.evaluate(() => document.querySelectorAll('.sheet, .scrim').forEach(n => n.remove()));

  console.log('\n\u2500\u2500 A books shelf speaks like one \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
  const BOOK_SCREENS = [
    ['browsing', () => { S.scene = 'build'; S.seen = true; S.tipDone = true; S.tray = []; save(); render(); }],
    ['a title page', () => {
      const f = CAT.filter(x => inTopic(x, S.topic)).sort((a, b) => (b.vc || 0) - (a.vc || 0))[0];
      S.title = f.id; S.back = 'build'; S.scene = 'title'; save(); render();
    }],
  ];
  for (const [where, fn] of BOOK_SCREENS) {
    await page.evaluate(() => {
      localStorage.clear();
      document.querySelectorAll('.sheet, .scrim, .vault, .coach, .coachscrim').forEach(n => n.remove());
      S.topic = makeTopic({ domain: 'book' }); save();
    });
    await page.evaluate(fn);
    await page.waitForTimeout(350);
    await page.evaluate(() => {
      document.querySelectorAll('.coach, .coachscrim').forEach(n => n.remove());
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(100);
    const { said, own } = await page.evaluate(DOMAIN_SPEECH);
    const ownSet = new Set(own);
    const bad = said.filter(t => {
      if (!FILM_WORDS.test(t)) return false;
      const low = t.toLowerCase();
      if (ownSet.has(low)) return false;            // a real title or author
      return !own.some(o => o.length > 3 && low.includes(o));
    });
    check(bad.length === 0,
      `${where} a books shelf says nothing only a film shelf would`
      + (bad.length ? ` \u2014 ${bad.length}: ${bad.slice(0, 3).map(t => JSON.stringify(t.slice(0, 40))).join(', ')}` : ''));
  }

  check(errors.length === 0, 'no page errors: ' + JSON.stringify(errors));
  console.log('\nALL CHECKS PASSED');
  await browser.close();
/* A crash is a FAILURE and has to look like one. This read `console.error`
   of the bare message, so a run that died two checks from the end printed
   no line matching FAILED, no line matching ALL CHECKS PASSED, and - piped
   through a filter, where the exit status is the filter's - looked exactly
   like a clean run. It cost a round trip. The prefix makes any grep that
   looks for failures find it, and the stack names the line. */
})().catch(e => {
  console.error('\nFAILED: the suite crashed before reaching the end \u2014 ' + e.message);
  if (e.stack) console.error(e.stack.split('\n').slice(1, 4).join('\n'));
  process.exit(1);
});
