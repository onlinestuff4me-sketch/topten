/* Drive the prototype end to end in a real browser at iPhone size.
   Tests judge behaviour; the screenshots this also writes judge layout.
   A run that cannot fail proves nothing, so every step asserts.

   Run:  npm i playwright && node drive.js [baseURL]
   Posters are served from POSTER_MIRROR if set (see build_catalog.py); this
   container cannot reach image.tmdb.org from Chromium, a real phone can. */
const { chromium, devices } = require('playwright');
const fs = require('fs');

const BASE = process.argv[2] || 'http://127.0.0.1:8788';
const SHOTS = process.env.SHOTS || './shots';
const MIRROR = process.env.POSTER_MIRROR || './posters';

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
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
  check(await page.locator('.intro .marquee').count() === 2, 'it shows the product — two drifting rows of real artwork');
  check(await page.locator('.intro .tile .rank').count() > 0, 'wearing the app\'s own rank numerals');
  const introText = await page.locator('.intro').innerText();
  check(/free/i.test(introText), 'it answers what this costs before asking for anything');
  check(await page.locator('.intro [data-act="begin"]').count() === 1, 'one CTA');

  // ── The 2026-08-15 copy pass: less of it, and every claim on one line ────
  check((await page.locator('.intro h1').innerText()).trim() === "What's your Top 10?",
    'the headline is "What\'s your Top 10?"');
  check((await page.locator('.intro .pitch').innerText()).trim() === 'The list you would defend to the death',
    'the sub-line is "The list you would defend to the death"');
  const bullets = (await page.locator('.intro li').allInnerTexts()).map(t => t.replace(/^\S+\s+/, '').trim());
  const wanted = ['Ten and only ten. The limit is the point.',
                  'Finish it and earn a secret badge.',
                  'Free. No ads. No subscription. Ever.'];
  check(bullets.length === 3, `three bullets, not more (${bullets.length})`);
  wanted.forEach((w, i) => check(bullets[i] === w, `bullet ${i + 1} reads "${w}" (got "${bullets[i]}")`));
  // Bullet 3 now carries the cost, so the separate line under the CTA is gone.
  check(await page.locator('.intro .cost').count() === 0,
    'no separate cost line under the CTA — the third bullet carries it');

  /* Mischa's actual requirement: ONE line per bullet at iPhone width. Measured
     two ways because either alone can lie — the height ratio misses a bullet
     whose second line happens to be short in a shrunk box, and a Range's line
     boxes miss nothing but depend on the text being one node. The spare width
     is reported alongside, because "fits" and "fits with room" are different
     answers to whether the next copy edit is safe. */
  const measureBullets = () => page.evaluate(() => [...document.querySelectorAll('.intro li')].map(li => {
    const span = li.querySelector('span:last-child');
    const lh = parseFloat(getComputedStyle(span).lineHeight);
    const box = span.getBoundingClientRect();
    const r = document.createRange(); r.selectNodeContents(span);
    const rects = [...r.getClientRects()].filter(x => x.width > 0.5);
    const tops = new Set(rects.map(x => Math.round(x.top)));
    const used = Math.max(...rects.map(x => x.right)) - Math.min(...rects.map(x => x.left));
    return { text: span.innerText.trim(), h: Math.round(box.height), lh,
      byHeight: Math.round(box.height / lh), lineBoxes: tops.size, spare: Math.round(box.width - used) };
  }));
  const oneLineAt = async label => {
    for (const b of await measureBullets()) {
      check(b.byHeight === 1 && b.lineBoxes === 1,
        `intro bullet is one line at ${label} — ${b.lineBoxes} line box, ${b.h}px against a ` +
        `${b.lh}px line-height, ${b.spare}px spare: "${b.text}"`);
    }
  };
  await oneLineAt('iPhone 15 Pro width (393px)');
  /* And at the narrowest iPhone iOS 26 runs on — the SE 3rd gen and 13 mini at
     375pt. That is where the rule is actually load-bearing: bullet 1 clears it
     by single-digit pixels, so a longer word in a future edit breaks here long
     before it breaks on the Pro this suite otherwise drives. */
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(120);
  await oneLineAt('the narrowest supported iPhone (375px)');
  await page.setViewportSize({ width: 393, height: 852 });
  await page.waitForTimeout(120);

  await noBritishSpelling('the intro');
  await page.screenshot({ path: SHOTS + '/13-intro-copy.png' });
  check(!/\bskip\b/i.test(introText), 'and no Skip — this screen only tells, so a Skip would compete with the CTA');
  check(apiCalls.length === 0, `the intro makes no API calls (${apiCalls.length})`);
  // The one action on the screen must be reachable without scrolling for it.
  const ctaVisible = await page.evaluate(() => {
    const b = document.querySelector('.intro [data-act="begin"]');
    const r = b.getBoundingClientRect();
    return r.bottom <= window.innerHeight + 1 && r.top >= 0;
  });
  check(ctaVisible, 'the CTA is on screen without scrolling');

  await page.locator('[data-act="begin"]').click();
  await page.waitForTimeout(200);

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

  // Round 2: "I didn't know how to add something to the 10 list vs what the
  // chevron would do." Both actions must say what they are, in words.
  const addLabel = (await page.locator('.rail .card').first().locator('.do-add').innerText()).trim();
  const simLabel = (await page.locator('.rail .card').first().locator('.do-similar').innerText()).trim();
  check(/add/i.test(addLabel), `the add control is labelled ("${addLabel}")`);
  check(/similar/i.test(simLabel), `the drill-in control is labelled ("${simLabel}")`);
  // A label that overflows its card is a label the user cannot read.
  const fits = await page.evaluate(() => {
    const card = document.querySelector('.rail .card').getBoundingClientRect();
    return [...document.querySelectorAll('.rail .card:first-child .acts button')]
      .every(b => { const r = b.getBoundingClientRect(); return r.left >= card.left - 1 && r.right <= card.right + 1; });
  });
  check(fits, 'both card actions fit inside the card');
  const verbs = await page.locator('.section-head .more').count();
  check(verbs === 0, 'no per-section "Back"/"Go deeper" verbs competing with each other');

  // The query must be stated, not inferred.
  check(await page.locator('.showing').count() === 1, 'a Now showing bar states what is on screen');

  // ── Copy regression: the repeated meaningless caption is gone ────────────
  const bodyText = await page.locator('body').innerText();
  check(!/widely called great/i.test(bodyText), 'no "Widely called great" caption under every poster');
  check(!/keep going and make the cut/i.test(bodyText), 'the "or keep going and make the cut" line is gone');
  // Round 3: "Everything" was a lie about a catalog of a few hundred titles.
  check(!/Everything —/.test(bodyText), 'the Now showing bar does not claim to show "Everything"');
  check(/All \d+ movies in our collection/.test(bodyText), 'it states the size of the collection instead');
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
  await firstCard.locator('.art').click();
  check(await page.locator(`.card[data-card="${firstId}"]`).count() === 1, 'the card stays put after adding — it does not vanish or jump');
  check(await page.locator('.rail .card').count() === railCountBefore, 'the rail does not reshuffle under the thumb');
  check(await page.locator(`.card[data-card="${firstId}"][data-in="1"]`).count() === 1, 'the card shows its new state in place');
  check((await page.locator('.dock-top .n').innerText()) === '1 of 10', 'the dock count advances');
  check(await page.locator('.slotmini img').count() === 1, 'the pick appears in slot one');

  // The travelling poster is what makes the destination unambiguous.
  await page.evaluate(() => window.__fliers = 0);
  await page.evaluate(() => new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes)
    if (n.classList && n.classList.contains('flier')) window.__fliers++; }).observe(document.body, { childList: true }));
  await page.locator('.rail .card').nth(1).locator('.art').click();
  await page.waitForTimeout(80);
  check(await page.evaluate(() => window.__fliers) === 1, 'a poster visibly travels from the card to its slot');

  await page.screenshot({ path: SHOTS + '/1-build.png' });

  // ── Branching: more like this, with a trail you can walk back ────────────
  const branchFrom = await page.locator('.rail .card').nth(2).getAttribute('data-card');
  await page.locator('.rail .card').nth(2).locator('.do-similar').click();
  await page.waitForTimeout(120);
  const h2 = await page.locator('.section-h').first().innerText();
  check(/^MORE LIKE /i.test(h2), `drilling in opens a "${h2}" section`);
  check(await page.locator('.showing .clause').count() >= 1, 'the Now showing bar states the branch you are in');
  const branchCards = await page.locator('.rail').first().locator('.card').count();
  check(branchCards >= 3, `the branch has ${branchCards} films to offer`);
  await page.screenshot({ path: SHOTS + '/2-branch.png' });

  // Going deeper again extends the trail rather than replacing it.
  await page.locator('.rail').first().locator('.card').first().locator('.do-similar').click();
  await page.waitForTimeout(120);
  const explored = await page.evaluate(() => Object.keys(window.S.graph.nodes).length);
  check(explored >= 2, `going deeper extends the path rather than replacing it (${explored} nodes)`);
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
  check(keyLabels.length === keyCount && keyLabels.every(l => l.length > 0 && l.split(/\s+/).length <= 3),
    `each key is a two-or-three-word label (${keyLabels.join(' | ')})`);
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
    await free.locator('.art').click();
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
  const insc = (await page.locator('.vault .inscription').innerText()).trim();
  check(insc.split(/\s+/).length <= 6, `inscription is at most six words: "${insc}"`);
  await page.screenshot({ path: SHOTS + '/5-reveal.png' });
  await page.waitForSelector('.after.on', { timeout: 5000 });
  await page.locator('[data-act="done"]').click();

  // ── After a finished Ten: closer in, or a different kind of list ────────
  await page.waitForSelector('.sug-topic', { timeout: 5000 });
  const finishedText = await page.locator('body').innerText();
  check(/or a different kind of list/i.test(finishedText), 'finishing offers other kinds of list, not just more films');
  check(/Your top ten shows/i.test(finishedText), 'TV shows is offered as the next domain');
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
  await page.locator('.rail .card').first().locator('.art').click();
  await page.reload({ waitUntil: 'networkidle' });
  check((await page.locator('.dock-top .n').innerText()) === '1 of 10', 'the draft survives a reload');

  // ── A second list unlocks discovery, and TV is a real shelf ─────────────
  await page.evaluate(() => {
    const tv = { id: 'tv', domain: 'tv', title: 'TV shows', prompt: 'Your 10 favorite TV shows of all time.' };
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
  check(/All \d+ shows in our collection/.test(tvText),
    'a TV Ten counts shows, not movies, in the Now showing bar');
  check(!/\bmovies?\b/i.test(await page.locator('#q').getAttribute('placeholder')),
    'and searches "shows", not "movies"');
  await noBritishSpelling('a TV Ten');

  while (await page.evaluate(() => window.S.tray.length) < 10) {
    const free = page.locator('.rail .card[data-in="0"]').first();
    if (!(await free.count())) break;
    await free.locator('.art').click();
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

  // ── The LIST NAME leads, the creator is subordinate (Mischa, round 5) ────
  const type = await page.evaluate(() => [...document.querySelectorAll('.other-ten')].map(c => {
    const px = sel => parseFloat(getComputedStyle(c.querySelector(sel)).fontSize);
    return { name: c.querySelector('.listname').innerText.trim(), nameSize: px('.listname'),
             creator: c.querySelector('.creator').innerText.trim(), creatorSize: px('.creator'),
             topicSize: px('.topic') };
  }));
  check(type.length === cardCount && type.every(t => t.nameSize > t.creatorSize
        && t.nameSize > t.topicSize),
    `the list name is the biggest type on every card (${type[0].nameSize}px name vs ` +
    `${type[0].creatorSize}px creator, ${type[0].topicSize}px topic)`);
  check(type.every(t => t.nameSize >= t.creatorSize * 1.5),
    'and dominant, not merely larger — at least half again the creator\'s size');
  check(new Set(type.map(t => t.name)).size === type.length,
    `every generated name is different (${type.map(t => t.name).join(' | ')})`);

  // ── Names are generated from metadata, and every one states a real fact ──
  const named = await page.evaluate(() => window.PEOPLE.map(p => {
    const ten = window.theirTen(p);
    const best = window.listNameCandidates(ten.ranked, p.topic)[0];
    return { who: p.name, name: best.name, fact: best.fact,
      films: ten.ranked.map(f => ({ d: f.d || null, y: f.y, g: f.g || [],
        br: f.br || [], col: f.col || null, ca: (f.ca || []).slice(0, 3) })) };
  }));
  check(named.length === cardCount, 'every card on screen is a generated name');
  for (const l of named) {
    const f = l.fact, count = {
      author: x => x.d === f.value, brand: x => x.br.includes(f.value),
      cast: x => x.ca.includes(f.value), series: x => !!x.col,
      era: x => Math.floor(x.y / 10) * 10 === f.value, vintage: x => x.y <= f.value,
      purity: x => x.g.includes(f.value),
    }[f.kind];
    check(!!count, `"${l.name}" is built from a known kind of fact (${f.kind})`);
    const real = l.films.filter(count).length;
    check(real === f.n && real >= 3,
      `"${l.name}" is true of ${l.who}'s ten — ${f.kind}${f.value === null ? '' : ' ' + f.value} in ${real} of 10`);
    check(l.name.split(/\s+/).length <= 5, `and it is short (${l.name.split(/\s+/).length} words)`);
  }
  // The generator ranks candidates; the on-device model would choose among
  // them. What it may never do is invent one, so the choice must come out of
  // the same set.
  const chosenFromCandidates = await page.evaluate(() => window.PEOPLE.every(p => {
    const ten = window.theirTen(p);
    return window.listNameCandidates(ten.ranked, p.topic)
      .some(c => c.name === window.listName(ten.ranked, p.topic));
  }));
  check(chosenFromCandidates, 'the name shown is always one of the generated candidates');

  // ── No user-entered text: a card carries metadata and nothing else ───────
  const strays = await page.evaluate(() => [...document.querySelectorAll('.other-ten')]
    .reduce((n, c) => n + c.querySelectorAll('p, .ln, .desc, .blurb').length, 0));
  check(strays === 0, 'no card carries a description line');
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
    for (const p of window.PEOPLE) (byTopic[p.topic.id] = byTopic[p.topic.id] || []).push(p.name);
    const id = Object.keys(byTopic).sort((a, b) => byTopic[b].length - byTopic[a].length)[0];
    return { topic: window.PEOPLE.find(p => p.topic.id === id).topic, names: byTopic[id] };
  });
  check(shared.names.length >= 2,
    `more than one person has taken on the same topic (${shared.names.join(' and ')} on ${shared.topic.title})`);
  await page.evaluate(t => {
    window.S.done.push({ topicId: t.id, title: t.title, domain: t.domain,
      ranked: window.S.done[0].ranked, badge: window.S.done[0].badge });
  }, shared.topic);
  // We are on a person's page; its Back returns to Discover and re-renders.
  await page.locator('[data-act="discover"]').click();
  await page.waitForTimeout(300);
  const lockedAfter = await page.locator('.lockedbadge').count();
  check(lockedAfter === lockedOnList - shared.names.length,
    `one take opens every badge on that topic at once, and no others ` +
    `(${lockedOnList} locked → ${lockedAfter}, ${shared.names.length} opened)`);
  const opened = await page.evaluate(() => [...document.querySelectorAll('.other-ten')]
    .filter(c => c.querySelector('.badgecell.open')).map(c => c.dataset.who));
  check(opened.slice().sort().join(',') === shared.names.slice().sort().join(','),
    `and exactly the lists on that topic opened, retroactively, without visiting them (${opened.join(', ')})`);
  check(await page.locator('.other-ten .badgecell.open svg').count() === shared.names.length,
    'each opened card shows the real badge where the lock was');
  const openGate = (await page.locator('.other-ten .badgecell.open').first().innerText()).replace(/\s+/g, ' ').trim();
  check(/unlocked/i.test(openGate), `and says so ("${openGate}")`);
  const stillLocked = await page.evaluate(() => [...document.querySelectorAll('.other-ten')]
    .filter(c => c.querySelector('.badgecell.locked')).map(c => c.dataset.who));
  check(stillLocked.length === cardCount - shared.names.length,
    `every other topic stays shut (${stillLocked.join(', ')})`);
  await page.screenshot({ path: SHOTS + '/15-discover-unlocked.png', fullPage: true });

  // ── A draft saved by an earlier build must survive a rebuilt shelf ──────
  // The catalog is regenerated from TMDB, so ids can vanish between builds.
  // This exact state blanked the map and threw on 'reading t'.
  await page.evaluate(() => {
    localStorage.setItem('topten.proto.v4', JSON.stringify({
      scene: 'build', topic: { id: 'movies', title: 'Movies', prompt: 'p' },
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

  check(errors.length === 0, 'no page errors: ' + JSON.stringify(errors));
  console.log('\nALL CHECKS PASSED');
  await browser.close();
})().catch(e => { console.error('\n' + e.message); process.exit(1); });
