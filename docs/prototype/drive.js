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
  // Round 3: "Everything" was a lie about a shelf of a few hundred films.
  check(!/Everything —/.test(bodyText), 'the Now showing bar does not claim to show "Everything"');
  check(/All \d+ films on the shelf/.test(bodyText), 'it states the size of the shelf instead');

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
  check(/0 films/.test(zero), `the dead end is reported honestly (${zero.split('\n').pop()})`);
  const escapes = await page.locator('.escape').count();
  check(escapes >= 2, `it offers ${escapes} ways out rather than just a wall`);
  const escapeText = await page.locator('.escape').first().innerText();
  check(/\d+ films?$/.test(escapeText.trim()), `each way out says what it would get you ("${escapeText}")`);
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
    const m = why.match(/^Not one (.+?) film made your ten/);
    if (m) check(![...genres].some(g => g.toLowerCase() === m[1].toLowerCase()), `"${why}" is true of these ten`);
  }
  const levels = new Set(await page.locator('.sug-topic .lvl').allInnerTexts());
  check(levels.size >= 3, `suggestions span three specificity levels (${[...levels].join(', ')})`);
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
    const tv = { id: 'tv', domain: 'tv', title: 'TV shows', prompt: 'Your ten favourite TV shows of all time.' };
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
  check(await page.locator('.rail .card').count() > 0, 'and the TV shelf is populated');

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

  // ── Discovery, and the reveal gate ──────────────────────────────────────
  await page.locator('[data-act="discover"]').click();
  await page.waitForTimeout(250);
  check(await page.locator('.other-ten').count() >= 5, 'other people have Tens to look at');
  // Each of them has their own TOPIC, so a Movies take does not open a Crime
  // badge — the gate is per topic, which is what makes it worth crossing.
  const lockedOnList = await page.locator('.lockedbadge').count();
  check(lockedOnList > 0, `their badges are locked until you take on their topic (${lockedOnList} locked)`);
  await page.screenshot({ path: SHOTS + '/9-discover.png', fullPage: true });
  await page.locator('.other-ten').first().click();
  await page.waitForTimeout(250);
  check(/locked/i.test(await page.locator('body').innerText()), 'their Ten is fully readable, only the badge is gated');
  check(await page.locator('.tenrow').count() === 10, 'and the list itself is never hidden');

  // A take on ONE topic opens every badge on that topic and no others.
  const firstTopic = await page.evaluate(() => window.PEOPLE[0].topic);
  await page.evaluate(t => {
    window.S.done.push({ topicId: t.id, title: t.title, domain: t.domain,
      ranked: window.S.done[0].ranked, badge: window.S.done[0].badge });
  }, firstTopic);
  // We are on a person's page; its Back returns to Discover and re-renders.
  await page.locator('[data-act="discover"]').click();
  await page.waitForTimeout(300);
  const lockedAfter = await page.locator('.lockedbadge').count();
  check(lockedAfter === lockedOnList - 1,
    `a take unlocks its own topic and only that one (${lockedOnList} locked → ${lockedAfter})`);
  await page.screenshot({ path: SHOTS + '/10-unlocked.png', fullPage: true });

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
    'films the shelf no longer holds are dropped from the draft, not counted');
  check(await page.evaluate(() => Object.keys(window.S.graph.nodes).length) === 0,
    'and from the map graph');
  check(await page.locator('.rail .card').count() > 0, 'the screen still builds');
  check(errors.length === beforeStale, 'a stale draft raises no errors: ' + JSON.stringify(errors.slice(beforeStale)));

  check(errors.length === 0, 'no page errors: ' + JSON.stringify(errors));
  console.log('\nALL CHECKS PASSED');
  await browser.close();
})().catch(e => { console.error('\n' + e.message); process.exit(1); });
