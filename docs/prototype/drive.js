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

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
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
  // Mischa, 2026-08-15: the splash "breaks our one-line rule twice" — the
  // headline and the sub-line were each wrapping. The rule covers all five
  // lines on this screen, not just the three bullets.
  const headLines = () => page.evaluate(() => ['h1', '.pitch'].map(sel => {
    const el = document.querySelector('.intro ' + sel);
    const lh = parseFloat(getComputedStyle(el).lineHeight);
    return { sel, text: el.innerText.trim(), lines: Math.round(el.getBoundingClientRect().height / lh),
      fs: Math.round(parseFloat(getComputedStyle(el).fontSize) * 10) / 10,
      spill: Math.round(el.scrollWidth - el.clientWidth) };
  }));
  const headOneLineAt = async label => {
    for (const h of await headLines()) {
      check(h.lines === 1 && h.spill <= 1,
        `the ${h.sel === 'h1' ? 'headline' : 'sub-line'} is one line at ${label} — ` +
        `${h.lines} line at ${h.fs}px, ${h.spill}px spill: "${h.text}"`);
    }
  };
  await headOneLineAt('iPhone 15 Pro width (393px)');
  await oneLineAt('iPhone 15 Pro width (393px)');
  /* And at the narrowest iPhone iOS 26 runs on — the SE 3rd gen and 13 mini at
     375pt. That is where the rule is actually load-bearing: bullet 1 clears it
     by single-digit pixels, so a longer word in a future edit breaks here long
     before it breaks on the Pro this suite otherwise drives. */
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(120);
  await headOneLineAt('the narrowest supported iPhone (375px)');
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

  // ── The splash is three bands: 40% artwork, 40% pitch, 20% CTA ───────────
  // Mischa, 2026-08-15. Measured as a share of the viewport rather than in
  // pixels, because the whole point of the change is that the ratio holds on
  // any phone. Tolerance is +/-5 points: the gaps between bands are real
  // pixels and come out of the three shares.
  for (const [w, h, label] of [[393, 852, 'iPhone 15 Pro'], [375, 667, 'SE'], [430, 932, 'Pro Max']]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(150);
    const band = await page.evaluate(() => {
      const vh = window.innerHeight, R = sel => document.querySelector(sel).getBoundingClientRect();
      const art = R('.intro .art'), copy = R('.intro-copy'), cta = R('.intro .cta');
      // The 40/40/20 is a share of the space the three bands DIVIDE, not of the
      // raw viewport — the frame and the gaps between bands sit outside it.
      // Measuring against the viewport would be measuring the frame too, and
      // would move every time the frame did.
      const split = art.height + copy.height + cta.height;
      const pct = h => Math.round(h / split * 100);
      return { art: pct(art.height), copy: pct(copy.height), cta: pct(cta.height),
        ofScreen: Math.round(art.height / vh * 100),
        topGap: Math.round(R('.marquee .tile').top),
        bottomGap: Math.round(vh - R('.intro .cta .btn').bottom),
        tile: Math.round(R('.marquee .tile').height),
        clip: Math.round(R('.marquee .tile').height - R('.marquee').height),
        over: document.querySelector('.intro').scrollHeight > vh + 2 };
    });
    const near = (got, want) => Math.abs(got - want) <= 2;
    check(near(band.art, 40) && near(band.copy, 40) && near(band.cta, 20),
      `the splash holds 40/40/20 on the ${label} (${band.art}/${band.copy}/${band.cta}; ` +
      `artwork is ${band.ofScreen}% of the raw screen once the frame is taken out)`);
    check(!band.over, `and nothing overflows the screen on the ${label}`);
    // Sized to its row, not merely large: `.marquee` clips what overflows, so a
    // poster that is 26px too tall looks fine and is silently cropped.
    check(band.tile >= 104 && band.clip === 0,
      `the artwork fills its band on the ${label} without being cropped ` +
      `(${band.tile}px posters in a ${band.tile - band.clip}px row)`);
    // Mischa, 2026-08-15: the posters come down so their inset matches the one
    // under the CTA. Equal on every screen, or the frame is not a frame.
    check(band.topGap === band.bottomGap,
      `the frame is even on the ${label} — ${band.topGap}px above the posters, ` +
      `${band.bottomGap}px under the CTA`);
  }
  await page.setViewportSize({ width: 393, height: 852 });
  await page.waitForTimeout(150);
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
  for (const w of [375, 393]) {
    await page.setViewportSize({ width: w, height: 852 });
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
  // have gone missing in the move.
  check(await page.locator('.subrow [data-act="restart"]').count() === 1,
    'and "Start over" moved to the line below rather than competing for the title\'s width');
  await page.setViewportSize({ width: 393, height: 852 });
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

  // The query must be stated, not inferred.
  check(await page.locator('.showing').count() === 1, 'a Now showing bar states what is on screen');

  // ── The first screen is a place to browse, not a page with one shelf ─────
  // Mischa, 2026-08-15: "the first screen doesn't have nearly enough
  // browsing". The collection holds two thousand movies and the screen used to
  // offer sixteen of them under a single heading.
  const headings = await page.evaluate(() =>
    [...document.querySelectorAll('.section-h')].map(h => h.innerText.trim()));
  check(headings.length >= 8, `the first screen offers ${headings.length} rows to browse, not one`);
  check(headings[0] === 'RECENT RELEASES', `and it opens on "${headings[0]}"`);
  check(headings[1] === 'POPULAR', `then "${headings[1]}"`);
  // "Popular" survives only on the row actually called Popular (Mischa,
  // 2026-08-16). A row named Comedies is a shelf; "Popular comedies" is an
  // argument nobody asked for.
  const genreRows = headings.slice(2);
  check(genreRows.length >= 5, `then a row per genre (${genreRows.length}: ${genreRows.slice(0, 4).join(', ')}…)`);
  check(!genreRows.some(h => /^POPULAR\b/.test(h)),
    'none of which says "Popular" a second time');

  // Every film in a genre row is really OF that genre: TMDB lists genres
  // primary-first, and membership-by-includes filed Pulp Fiction
  // ([Thriller, Crime, Comedy]) under Comedies.
  const fit = await page.evaluate(() => {
    const rows = window.browseRows(new Set()).filter(r => r.id.startsWith('g:'));
    const bad = [];
    for (const r of rows) {
      const g = r.id.slice(2);
      for (const c of r.cards) if (c.f.g[0] !== g) bad.push(`${c.f.t} [${c.f.g.join(', ')}] in ${g}`);
    }
    return { rows: rows.length, bad: bad.slice(0, 3), n: bad.length };
  });
  check(fit.n === 0,
    `and every film in a genre row leads with that genre (${fit.rows} rows, ${fit.n} mismatches${fit.n ? ': ' + fit.bad.join('; ') : ''})`);

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
  const stickyBefore = await page.evaluate(() =>
    Math.round(document.querySelector('.stickybar').getBoundingClientRect().top));
  await page.evaluate(() => window.scrollTo(0, 1600));
  await page.waitForTimeout(250);
  const stuck = await page.evaluate(() => {
    const r = document.querySelector('.stickybar').getBoundingClientRect();
    const q = document.querySelector('#q').getBoundingClientRect();
    return { top: Math.round(r.top), qTop: Math.round(q.top), qBottom: Math.round(q.bottom),
      chips: document.querySelectorAll('.stickybar .chip').length, y: Math.round(window.scrollY) };
  });
  check(stuck.y > 800, `scrolled ${stuck.y}px down the browse screen`);
  check(stuck.top <= 1, 'the search bar and filters are still pinned to the top');
  check(stuck.qTop >= 0 && stuck.qBottom <= 852, 'the search field itself is on screen, not just its container');
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
  const shelfClaim = bodyText.match(/All ([\d,]+)\+ movies in our collection/);
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
  const insc = (await page.locator('.vault .inscription').innerText()).trim();
  check(insc.split(/\s+/).length <= 6, `inscription is at most six words: "${insc}"`);
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
  check(/All [\d,]+\+ shows in our collection/.test(tvText),
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
  const bookClaim = bodyBooks.match(/All ([\d,]+)\+ books in our collection/);
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
  const bookInsc = (await page.locator('.vault .inscription').innerText()).trim();
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

  // ── The LIST NAME leads, the creator is subordinate (Mischa, round 5) ────
  const type = await page.evaluate(() => [...document.querySelectorAll('.other-ten')].map(c => {
    const px = sel => parseFloat(getComputedStyle(c.querySelector(sel)).fontSize);
    return { name: c.querySelector('.listname').innerText.trim(), nameSize: px('.listname'),
             creator: c.querySelector('.creator').innerText.trim(), creatorSize: px('.creator') };
  }));
  check(type.length === cardCount && type.every(t => t.nameSize > t.creatorSize),
    `the list name is the biggest type on every card (${type[0].nameSize}px name vs ` +
    `${type[0].creatorSize}px creator)`);
  check(type.every(t => t.nameSize >= t.creatorSize * 1.5),
    'and dominant, not merely larger — at least half again the creator\'s size');
  // Since the correction of 2026-08-15 the name IS the topic, so it appears
  // once. Two people on the same topic share a name and are told apart by the
  // creator line — which is the point of Sam and Theo both being on Crime.
  check(await page.locator('.other-ten .topic').count() === 0,
    'the name is not repeated as a separate topic line above itself');

  // ── A NAME IS A RULE, TRUE OF ALL TEN ───────────────────────────────────
  // The correction Mischa made on 2026-08-15: a list called "Top 10 Crime
  // Movies of the 90s" holds ten crime movies from the 90s, not four. The name
  // comes from the criteria, the criteria filter the shelf, so the only way
  // this can fail is if the two ever come apart.
  const named = await page.evaluate(() => window.PEOPLE.map(p => {
    const ten = window.theirTen(p);
    return { who: p.name, name: window.listName(ten.ranked, p.topic), title: p.topic.title,
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
    for (const p of window.PEOPLE) (m[p.topic.title] = m[p.topic.title] || new Set()).add(p.topic.id);
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
    // Two Miyazakis on the shelf, so neither may claim the surname alone.
    miyazaki: window.makeTopic({ director: 'Hayao Miyazaki' }).title,
    hitchcock: window.makeTopic({ director: 'Alfred Hitchcock' }).title,
  }));
  check(!/\bNiro\b/.test(people.deNiro) || /De Niro/.test(people.deNiro),
    `a name particle stays with its name ("${people.deNiro}")`);
  check(people.miyazaki === 'Top 10 Hayao Miyazaki Movies',
    `an ambiguous surname stays whole ("${people.miyazaki}") — Hayao and Goro are both on the shelf`);
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

  check(errors.length === 0, 'no page errors: ' + JSON.stringify(errors));
  console.log('\nALL CHECKS PASSED');
  await browser.close();
})().catch(e => { console.error('\n' + e.message); process.exit(1); });
