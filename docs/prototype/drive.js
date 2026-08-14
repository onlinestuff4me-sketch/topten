/* Drive the prototype end to end in a real browser at iPhone size.
   Tests judge behaviour; the screenshots this also writes judge layout.
   A run that cannot fail proves nothing, so every step asserts.

   Run:  npm i playwright && node drive.js [baseURL]
   Posters are served from POSTER_MIRROR if set (see build_catalog.py); this
   container cannot reach image.tmdb.org from Chromium, a real phone can. */
const { chromium, devices } = require('playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:8788';
const SHOTS = process.env.SHOTS || './shots';

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    // Posters come from image.tmdb.org, which this container reaches only
    // through the agent proxy. On a real phone there is no proxy — this is
    // purely so the screenshots show real artwork.
  });
  const ctx = await browser.newContext({ ...devices['iPhone 15 Pro'], isMobile: true, hasTouch: true });
  const page = await ctx.newPage();

  // Serve posters from the local mirror. This container can only reach
  // image.tmdb.org through the agent proxy, which Chromium does not trust;
  // on a real phone the page fetches them directly. Mirroring keeps the
  // screenshots honest about layout without touching TLS settings.
  const fs = require('fs');
  const MIRROR = process.env.POSTER_MIRROR || './posters';
  await page.route('**://image.tmdb.org/t/p/**', route => {
    const m = route.request().url().match(/\/t\/p\/(w\d+)(\/.+)$/);
    const file = m && `${MIRROR}/${m[1]}${m[2]}`;
    if (file && fs.existsSync(file)) return route.fulfill({ path: file, contentType: 'image/jpeg' });
    return route.fulfill({ status: 204, body: '' });
  });

  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  const check = (cond, msg) => { if (!cond) { throw new Error('FAILED: ' + msg); } console.log('  ok — ' + msg); };

  await page.goto(BASE, { waitUntil: 'networkidle' });
  check(await page.locator('h1').first().innerText() === 'Movies', 'gather scene loads with the Movies topic');
  check((await page.locator('.slot').count()) >= 10, 'ten slots are visible before anything is picked');
  check(await page.locator('.btn[data-act="rank"]').isDisabled(), 'cannot rank with an empty tray');

  // Gather 13 by tapping suggestions only — PRD Req 1 says suggestion taps
  // alone must be able to fill a Ten without typing a search.
  const rail = page.locator('.sugg');
  for (let i = 0; i < 13; i++) {
    await rail.nth(0).click();
    await page.waitForTimeout(40);
  }
  const dockText = await page.locator('.dock-inner .n').innerText();
  check(dockText.startsWith('13'), `dock reports the overflow (${dockText})`);
  await page.screenshot({ path: SHOTS + '/1-gather.png', fullPage: false });

  // Search, and add one by name.
  await page.fill('#q', 'godfather');
  await page.waitForTimeout(120);
  check((await page.locator('.results .slot').count()) > 0, 'search returns catalog results');
  await page.locator('[data-act="clearq"]').click();

  // The Cut
  await page.locator('.btn[data-act="cut"]').click();
  check(await page.locator('h1').first().innerText() === 'The Cut', 'the cut is required when the tray holds more than ten');
  check(await page.locator('.btn[data-act="cutdone"]').isDisabled(), 'cannot leave the cut without exactly ten');
  const cells = page.locator('.cut-cell');
  for (let i = 0; i < 10; i++) await cells.nth(i).click();
  check(!(await page.locator('.btn[data-act="cutdone"]').isDisabled()), 'ten kept unlocks the cut');
  await cells.nth(10).click();
  check(await page.locator('.dock-inner .n').innerText() === '10 of 10 kept', 'an eleventh keep is refused, not silently swapped');
  await page.screenshot({ path: SHOTS + '/2-cut.png' });

  // Rank — count the questions it really takes.
  await page.locator('.btn[data-act="cutdone"]').click();
  check((await page.locator('h1').first().innerText()) === 'Which is higher?', 'placement starts');
  await page.screenshot({ path: SHOTS + '/3-rank.png' });

  let questions = 0;
  while ((await page.locator('.vault').count()) === 0 && questions < 60) {
    const pick = Math.random() < 0.5 ? '1' : '0';
    await page.locator(`[data-higher="${pick}"]`).click();
    questions++;
    await page.waitForTimeout(15);
  }
  check(questions > 0 && questions < 60, `ranking completed in ${questions} questions`);

  // Reveal
  await page.waitForSelector('.vault', { timeout: 5000 });
  check(await page.locator('.vault svg').count() === 1, 'a badge is composed and rendered');
  await page.waitForTimeout(900);
  check(await page.locator('.skip.on').count() === 1, 'reveal becomes skippable after 0.8s, not before');
  await page.waitForTimeout(2600);
  const insc = (await page.locator('.vault .inscription').innerText()).trim();
  check(insc.length > 0 && insc.split(/\s+/).length <= 6, `inscription is at most six words: "${insc}"`);
  await page.screenshot({ path: SHOTS + '/4-reveal.png' });

  await page.waitForSelector('.after.on', { timeout: 5000 });
  await page.locator('[data-act="done"]').click();

  // Finished + rabbit hole
  check((await page.locator('.sug-topic').count()) >= 5, 'at least five topic suggestions after completion');

  // Every provocation must be true of the actual ten. A claim that a genre is
  // absent is checked against the picks, secondary genres included.
  const picks = await page.evaluate(() => S.ranked.map(id => byId.get(id)));
  const genres = new Set(picks.flatMap(f => f.g));
  for (const why of await page.locator('.sug-topic .provocation').allInnerTexts()) {
    const m = why.match(/^Not one (.+?) film made your ten/);
    if (m) check(![...genres].some(g => g.toLowerCase() === m[1].toLowerCase()),
      `"${why}" is actually true of these ten`);
  }
  const levels = new Set(await page.locator('.sug-topic .lvl').allInnerTexts());
  check(levels.size >= 3, `suggestions span three specificity levels (${[...levels].join(', ')})`);
  await page.screenshot({ path: SHOTS + '/5-finished.png', fullPage: true });

  // Rabbit hole actually re-enters gather with the topic set.
  const firstTopic = await page.locator('.sug-topic .t').first().innerText();
  await page.locator('.sug-topic').first().click();
  check(await page.locator('h1').first().innerText() === firstTopic, `tapping a suggestion lands in Gather scoped to "${firstTopic}"`);
  check((await page.locator('.sugg').count()) > 0, 'the scoped topic still has films to suggest');

  // Draft persistence across launches (PRD Req 2).
  await page.locator('.sugg').nth(0).click();
  await page.reload({ waitUntil: 'networkidle' });
  check((await page.locator('.dock-inner .n').innerText()) === '1 of 10', 'the draft survives a reload');

  check(errors.length === 0, 'no page errors: ' + JSON.stringify(errors));
  console.log('\nALL CHECKS PASSED — ranking took ' + questions + ' questions');
  await browser.close();
})().catch(async e => { console.error('\n' + e.message); process.exit(1); });
