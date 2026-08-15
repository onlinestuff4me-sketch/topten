/* The public share surfaces, driven end to end.
 *
 * Separate from drive.js because it exercises a different product: drive.js
 * drives the app a person builds a Ten in, this drives the pages a stranger
 * lands on. They share a catalog, a token file and a badge renderer, and the
 * last of those is the reason this suite exists at all — a share page drawing
 * its own badge would be a second renderer, and the one people see first.
 *
 *   node drive_share.js [base-url]
 *
 * Needs a static server on the prototype directory (default port 8788) and
 * Chromium at /opt/pw-browsers/chromium (override with CHROMIUM).
 */
const { chromium } = require('playwright');
const fs = require('fs');
/* Chromium: an explicit CHROMIUM wins, then this machine's pre-installed
   browser, then Playwright's own. The path was hard-coded once and worked
   only on the box it was written on. */
const CHROME = process.env.CHROMIUM
  || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const path = require('path');

const BASE = process.argv[2] || 'http://127.0.0.1:8788';
const SHOTS = process.env.SHOTS || path.join(__dirname, 'shots');

let passed = 0, failed = 0;
const check = (ok, what) => {
  if (ok) { passed++; console.log('  ok — ' + what); }
  else { failed++; console.log('  FAILED — ' + what); }
};

// Built from the real catalog so the pages are exercised against the data they
// will actually hold — a fixture of invented ids would not catch a poster path
// that no longer resolves.
function fixtures(CAT) {
  const movies = CAT.filter(f => (f.dm || 'movie') === 'movie');
  const crime90s = movies
    .filter(f => f.g.includes('Crime') && Math.floor(f.y / 10) * 10 === 1990)
    .sort((a, b) => b.v - a.v).slice(0, 10);
  const crimeAny = movies.filter(f => f.g.includes('Crime'))
    .sort((a, b) => b.v - a.v).slice(0, 10);
  const badge = {
    shape: 'stub', motif: 'briefcase', metal: '#C9A227',
    primary: crime90s[0].c || '#8C2B1F', secondary: crime90s[1].c || '#3B2A1A',
    inscription: 'Crime, all ten',
  };
  return { crime90s, crimeAny, badge };
}

const q = (o) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null) p.set(k, v);
  return p.toString();
};

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const errors = [];

  // The catalog, read once in a throwaway page so the fixtures are the app's
  // own data rather than a copy of it.
  const boot = await browser.newPage();
  await boot.route('**image.tmdb.org/**', r => r.abort());
  await boot.goto(`${BASE}/ten.html`, { waitUntil: 'load' });
  const CAT = await boot.evaluate(() => window.CATALOG);
  await boot.close();
  const F = fixtures(CAT);

  const open = async (url, width = 393, height = 852) => {
    const page = await browser.newPage({ viewport: { width, height },
      deviceScaleFactor: width < 500 ? 2 : 1 });
    page.on('pageerror', e => errors.push(`${url.slice(0, 60)}… ${e}`));
    await page.route('**image.tmdb.org/**', r => r.abort());
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(250);
    return page;
  };

  const shared = q({
    t: 'Top 10 Crime Movies of the 90s', by: 'Sam',
    topic: 'movie:genre:Crime:decade:1990',
    items: F.crime90s.map(f => f.id).join(','),
    badge: Buffer.from(JSON.stringify(F.badge)).toString('base64'),
    unlocked: '1',
    mine: F.crimeAny.map(f => f.id).join(','),
  });

  console.log('\n── The public Ten page ──────────────────────────────────────');
  let p = await open(`${BASE}/ten.html?${shared}`);

  check(await p.locator('h1').innerText() === 'Top 10 Crime Movies of the 90s',
    'a shared link opens on the list\'s own name');
  check(/A Top 10 by Sam/.test(await p.locator('.byline').innerText()),
    'and says whose it is');
  check(await p.locator('.ten .row').count() === 10, 'all ten picks are on the page');

  // PRD Req 11: the whole point of this surface is that no account is needed.
  const noAuth = await p.evaluate(() => ({
    forms: document.querySelectorAll('form, input[type=email], input[type=password]').length,
    signIn: /sign in|log in|create an account/i.test(document.body.innerText),
  }));
  check(noAuth.forms === 0 && !noAuth.signIn,
    'nothing on it asks you to sign in — a browser arrives from a link');

  // PRD Req 12: the LIST is never gated, only the badge.
  check(await p.locator('.badgecol').count() === 1, 'the badge sits beside the list, not inside it');
  check((await p.locator('.badgecol .state').innerText()).trim() === 'BADGE UNLOCKED',
    'an unlocked badge says so');
  check(await p.locator('.badgecol svg').count() === 1, 'and is really drawn');
  check((await p.locator('.badgecol .insc').innerText()).trim() === 'Crime, all ten',
    'wearing its inscription');

  const titleTag = await p.title();
  check(/Top 10 Crime Movies of the 90s/.test(titleTag) && /Sam/.test(titleTag),
    `the document title carries both, for the tab and the link preview ("${titleTag}")`);

  // The comparison overlay is the list, annotated — not a second screen.
  const cmp = await p.evaluate(() => ({
    marks: document.querySelectorAll('.row .mine').length,
    highlighted: document.querySelectorAll('.row.shared').length,
    line: document.querySelector('.compare')?.innerText.replace(/\s+/g, ' ').trim(),
  }));
  check(cmp.marks > 0 && cmp.marks === cmp.highlighted,
    `every shared pick is both marked and highlighted (${cmp.marks})`);
  check(/agree on \d+/.test(cmp.line), `and the count is stated once ("${cmp.line}")`);

  // The link preview. The image is a page at /card rendered at 1200x630, so
  // the picture in a message is drawn by the same code as the page it links
  // to and cannot show a badge the page does not.
  const og = await p.evaluate(() => ({
    title: document.getElementById('og-title')?.content,
    desc: document.getElementById('og-desc')?.content,
    image: document.getElementById('og-image')?.content,
    w: document.querySelector('meta[property="og:image:width"]')?.content,
    card: document.querySelector('meta[name="twitter:card"]')?.content,
  }));
  check(/Top 10 Crime Movies of the 90s/.test(og.title) && /Sam/.test(og.title),
    `the preview title names the list and its author ("${og.title}")`);
  check(og.desc.split('·').length === 3,
    `the preview describes the list by its top three ("${og.desc}")`);
  check(/\/card\?/.test(og.image) && /items=/.test(og.image),
    'and points at a card carrying the same list');
  check(og.w === '1200' && og.card === 'summary_large_image',
    'declared at the size the card is actually rendered');

  await p.screenshot({ path: `${SHOTS}/20-ten-phone.png`, fullPage: true });
  await p.close();

  console.log('\n── The reveal gate ──────────────────────────────────────────');
  p = await open(`${BASE}/ten.html?${shared.replace('&unlocked=1', '')}`);
  const gate = await p.evaluate(() => ({
    state: document.querySelector('.badgecol .state')?.innerText.trim(),
    locked: document.querySelectorAll('.lockedbadge').length,
    how: document.querySelector('.badgecol .how')?.innerText.replace(/\s+/g, ' ').trim(),
    rows: document.querySelectorAll('.ten .row').length,
    titles: [...document.querySelectorAll('.ten .t')].map(e => e.innerText),
  }));
  check(gate.state === 'BADGE LOCKED', 'without the unlock the badge reads as locked');
  check(gate.locked === 1, 'and draws the lock, not an empty box');
  check(/Make your own/.test(gate.how) && /opens/.test(gate.how),
    `it names the key as well as the lock ("${gate.how}")`);
  // The one that matters: gating the badge must not gate the list.
  check(gate.rows === 10 && gate.titles.every(t => t && t !== 'Unavailable'),
    'and every one of the ten is still readable — the list is never gated');
  check(await p.locator('.cta').count() >= 1, 'with one way to earn it');
  await p.screenshot({ path: `${SHOTS}/21-ten-locked.png`, fullPage: true });
  await p.close();

  console.log('\n── A link with nothing in it ────────────────────────────────');
  p = await open(`${BASE}/ten.html`);
  check(/No list in this link/.test(await p.locator('h1').innerText()),
    'an empty link gets a designed page, not a blank one');
  check(await p.locator('.cta').count() === 1, 'and a way out of it');
  await p.close();

  // A page that renders whatever is in the URL has to survive a URL that is
  // wrong, because the URL is the one input a stranger controls.
  console.log('\n── Junk in the URL ──────────────────────────────────────────');
  // One id the catalog cannot have, and one it certainly has, so the check
  // measures the missing one rather than counting whatever happens to be
  // absent. The first version used a bare `1` for the good id — which is not a
  // film on this shelf either, so the count was 2 and the assertion failed for
  // a reason that had nothing to do with the behaviour under test.
  const junk = q({ t: '<script>alert(1)</script>', by: '"><img src=x>',
                   items: `99999999,${F.crime90s[0].id}`,
                   badge: 'not-base64', unlocked: '1' });
  p = await open(`${BASE}/ten.html?${junk}`);
  const safe = await p.evaluate(() => ({
    injected: document.querySelectorAll('img[src="x"]').length,
    scripts: [...document.querySelectorAll('script')].filter(s => /alert\(1\)/.test(s.textContent)).length,
    heading: document.querySelector('h1')?.innerText,
    unavailable: [...document.querySelectorAll('.ten .t')].filter(e => e.innerText === 'Unavailable').length,
    rows: document.querySelectorAll('.ten .row').length,
    badgeDrawn: !!document.querySelector('.badgecol svg'),
  }));
  check(safe.injected === 0 && safe.scripts === 0, 'markup in the URL is escaped, not executed');
  check(safe.heading.includes('<script>'), 'and shown as the text it is');
  check(safe.unavailable === 1 && safe.rows === 2,
    `an id the catalog no longer holds reads as Unavailable and the rest still renders ` +
    `(${safe.unavailable} of ${safe.rows})`);
  check(safe.badgeDrawn, 'an unreadable badge parameter still draws a badge rather than a void');
  await p.close();

  console.log('\n── The topic page ───────────────────────────────────────────');
  const tens = [
    `Sam:${F.crime90s.map(f => f.id).join(',')}`,
    `Theo:${F.crimeAny.map(f => f.id).join(',')}`,
  ].join('|');
  p = await open(`${BASE}/topic.html?${q({ t: 'Top 10 Crime Movies of the 90s', tens })}`, 900, 1200);
  const topic = await p.evaluate(() => ({
    h1: document.querySelector('h1')?.innerText,
    byline: document.querySelector('.byline')?.innerText,
    consensus: document.querySelectorAll('.consensus li').length,
    takes: document.querySelectorAll('.ten .row').length,
    points: [...document.querySelectorAll('.consensus .pts')].map(e => e.innerText),
  }));
  check(topic.h1 === 'Top 10 Crime Movies of the 90s', 'the topic page leads with the topic');
  check(/2 people have taken this on/.test(topic.byline), `and counts the takes ("${topic.byline}")`);
  check(topic.consensus === 10, 'the consensus is a Ten');
  check(topic.takes === 2, 'and every take is listed under it');

  // Borda's load-bearing property: every complete Ten contributes exactly 55,
  // so no Ten can buy influence by being unusual. Same arithmetic as
  // TopTenKit's ConsensusTally and the migration's consensus_ten().
  const total = await p.evaluate((ids) => {
    const tens = ids.map(list => ({ items: list.map(id => ({ id })) }));
    return Share.consensus(tens, 999).reduce((n, r) => n + r.points, 0);
  }, [F.crime90s.map(f => f.id), F.crimeAny.map(f => f.id)]);
  check(total === 110, `two published Tens contribute exactly 110 points (got ${total})`);
  const one = await p.evaluate((ids) =>
    Share.consensus([{ items: ids.map(id => ({ id })) }], 999).reduce((n, r) => n + r.points, 0),
    F.crime90s.map(f => f.id));
  check(one === 55, `and one contributes 55, whatever its picks (got ${one})`);

  // Determinism: a cached page that reorders itself between two renders of
  // identical data is a bug that only shows up in production.
  const twice = await p.evaluate((ids) => {
    const tens = ids.map(list => ({ items: list.map(id => ({ id })) }));
    const a = Share.consensus(tens).map(r => r.id).join(',');
    const b = Share.consensus([...tens].reverse()).map(r => r.id).join(',');
    return { a, b };
  }, [F.crime90s.map(f => f.id), F.crimeAny.map(f => f.id)]);
  check(twice.a === twice.b, 'the consensus does not depend on the order the takes arrive in');

  check(await p.evaluate(() => Share.consensus([]).length) === 0,
    'a topic nobody has taken on produces no consensus rather than a fake one');
  await p.screenshot({ path: `${SHOTS}/22-topic.png`, fullPage: true });
  await p.close();

  console.log('\n── The share card ───────────────────────────────────────────');
  p = await open(`${BASE}/card.html?${shared}`, 1200, 630);
  const card = await p.evaluate(() => {
    const r = document.querySelector('.card').getBoundingClientRect();
    return {
      w: Math.round(r.width), h: Math.round(r.height),
      picks: document.querySelectorAll('.pick').length,
      badge: document.querySelectorAll('.right svg').length,
      insc: document.querySelector('.right .insc')?.innerText.trim(),
      title: document.querySelector('h1')?.innerText,
      overflowX: document.documentElement.scrollWidth - 1200,
      overflowY: document.documentElement.scrollHeight - 630,
    };
  });
  check(card.w === 1200 && card.h === 630, `the card is exactly 1200x630 (${card.w}x${card.h})`);
  check(card.overflowX <= 0 && card.overflowY <= 0,
    `and nothing spills out of the frame (x ${card.overflowX}, y ${card.overflowY})`);
  check(card.picks === 5, 'it shows five picks — the frame is not the page');
  check(card.badge === 1 && card.insc === 'Crime, all ten', 'and the badge, wearing its line');
  check(card.title === 'Top 10 Crime Movies of the 90s', 'under the list\'s own name');
  await p.screenshot({ path: `${SHOTS}/23-card.png` });
  await p.close();

  // A locked badge on a card is the interesting case: the card is what makes
  // somebody click, so the lock has to look like an invitation.
  p = await open(`${BASE}/card.html?${shared.replace('&unlocked=1', '')}`, 1200, 630);
  check((await p.locator('.right .state').innerText()).trim() === 'BADGE LOCKED',
    'a card for a badge you have not earned says so');
  check(await p.locator('.lockedbadge').count() === 1, 'and draws the lock');
  await p.screenshot({ path: `${SHOTS}/24-card-locked.png` });
  await p.close();

  console.log('\n── The link, round-tripped ──────────────────────────────────');
  // Share.link builds what Share.fromLocation reads. If those two ever
  // disagree, every shared link in the wild breaks at once.
  p = await open(`${BASE}/ten.html?${shared}`);
  const round = await p.evaluate(() => {
    const original = Share.fromLocation(location);
    const rebuilt = Share.link(original);
    const parsed = Share.fromLocation(new URL(rebuilt, location.origin));
    return {
      title: parsed.title === original.title,
      author: parsed.author === original.author,
      items: parsed.items.map(f => f.id).join() === original.items.map(f => f.id).join(),
      badge: JSON.stringify(parsed.badge) === JSON.stringify(original.badge),
      unlocked: parsed.unlocked === original.unlocked,
      mine: parsed.mine.join() === original.mine.join(),
    };
  });
  check(Object.values(round).every(Boolean),
    `a link survives being rebuilt and re-read (${JSON.stringify(round)})`);
  await p.close();

  console.log('\n── One badge renderer, not three ────────────────────────────');
  // The reason badge.js was extracted. If the app screen and the share page
  // ever draw different badges from the same composition, the surface where it
  // shows is the one a stranger sees first.
  const appPage = await open(`${BASE}/index.html`);
  const sharePage = await open(`${BASE}/ten.html?${shared}`);
  const sameSVG = await Promise.all([appPage, sharePage].map(pg => pg.evaluate((b) =>
    window.badgeSVG(b, 200), F.badge)));
  check(sameSVG[0] === sameSVG[1],
    'the app and the share page draw byte-identical badges from one composition');
  check(await appPage.evaluate(() => typeof window.lockedBadge === 'function'),
    'and both pages expose the locked one too');
  await appPage.close();
  await sharePage.close();

  console.log('');
  check(errors.length === 0, 'no page errors: ' + JSON.stringify(errors));
  await browser.close();

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
  console.log('ALL SHARE CHECKS PASSED');
})().catch(e => { console.error('\n' + e.stack); process.exit(1); });
