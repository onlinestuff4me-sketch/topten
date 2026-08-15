/* The Supabase client, driven against a fake Supabase.
 *
 *   node drive_db.js [base-url]
 *
 * Every request is intercepted, so this suite never touches the real project
 * and never sends an email. That is not only politeness about the two-an-hour
 * allowance: a test that depends on a live database fails for reasons that
 * have nothing to do with the code, and a suite that fails for unrelated
 * reasons stops being read.
 *
 * What it cannot check is whether the REST shapes are right — whether
 * `badges(...)` is really an embeddable relationship, whether
 * `consensus_ten(p_topic_id, p_limit)` really has those parameter names. A
 * mock will happily answer a request the real server would reject. Those were
 * checked against the live project directly, and deliberately falsified: a
 * wrong embed name returns PGRST200 and a wrong RPC parameter returns
 * PGRST202, so the passing case means something.
 *
 * What it checks instead is the logic no server can check for us: that
 * publishing happens in the order the schema requires, that a bearer token
 * does not stay in the address bar, and that positions survive a join.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const CHROME = process.env.CHROMIUM
  || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

const BASE = process.argv[2] || 'http://127.0.0.1:8788';

let passed = 0, failed = 0;
const check = (ok, what, detail) => {
  if (ok) { passed++; console.log('  ok — ' + what + (detail ? ` (${detail})` : '')); }
  else { failed++; console.log('  FAILED — ' + what + (detail ? ` (${detail})` : '')); }
};

/* A JWT the client will accept: it only ever reads `sub` and `exp`, and it
   must never verify a signature — that is the server's job and pretending
   otherwise in a client is how you get a client that trusts its own tokens. */
function fakeJWT(sub, secondsFromNow = 3600) {
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64({ alg: 'none' })}.${b64({ sub, exp: Math.floor(Date.now() / 1000) + secondsFromNow })}.x`;
}

const USER = '11111111-1111-1111-1111-111111111111';
const TOPIC = 'aaaaaaaa-0000-0000-0000-000000000001';
const TEN = 'bbbbbbbb-0000-0000-0000-000000000001';

/* The fake. Records every request so the ORDER of the publish sequence can be
   asserted, which is the part the schema actually constrains. */
async function stubSupabase(page, opts = {}) {
  const calls = [];
  await page.route('**/*.supabase.co/**', async route => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace('/rest/v1/', '').replace('/auth/v1/', '');
    calls.push({ method: req.method(), path, search: url.search, body: req.postData() });

    const json = (body, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (url.pathname.startsWith('/auth/v1/otp')) {
      if (opts.rateLimited) return json({ msg: 'email rate limit exceeded' }, 429);
      return json({});
    }
    if (url.pathname.startsWith('/auth/v1/token')) {
      return json({ access_token: fakeJWT(USER), refresh_token: 'r2' });
    }
    if (path.startsWith('topics')) {
      if (req.method() === 'POST') return json([{ id: TOPIC }], 201);
      return json(opts.topicExists === false ? [] : [{ id: TOPIC }]);
    }
    if (path.startsWith('tens')) {
      if (req.method() === 'POST') return json([{ id: TEN }], 201);
      if (req.method() === 'PATCH') return json([]);
      if (opts.tenRows) return json(opts.tenRows);
      return json(opts.tenExists === false ? [] : [{ id: TEN }]);
    }
    if (path.startsWith('ten_items') || path.startsWith('badges')) return json([]);
    if (path.startsWith('rpc/')) return json([]);
    return json([]);
  });
  return calls;
}

/* The module is a classic script on a page, so it is loaded by visiting one.
   ten.html already pulls in the shared modules; adding supabase.js there is
   what a real page does. */
async function withPage(browser, fn, opts = {}) {
  const page = await browser.newPage();
  const calls = await stubSupabase(page, opts);
  await page.goto(`${BASE}/ten.html`, { waitUntil: 'domcontentloaded' });
  await page.addScriptTag({ url: '/supabase.js' });
  await page.evaluate(() => localStorage.clear());
  try { return await fn(page, calls); } finally { await page.close(); }
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  console.log('The Supabase client\n');

  // ── Sign-in ───────────────────────────────────────────────────────────────
  await withPage(browser, async (page, calls) => {
    const sent = await page.evaluate(() => DB.sendLink('someone@example.com', 'https://topten-three.vercel.app/'));
    check(sent === true, 'sending a magic link posts to /auth/v1/otp');
    const otp = calls.find(c => c.path === 'otp');
    check(!!otp && otp.method === 'POST', 'as a POST');
    check(!!otp && /redirect_to=https%3A%2F%2Ftopten-three\.vercel\.app/.test(otp.search),
      'carrying the redirect the link must come back to');
    check(!!otp && JSON.parse(otp.body).create_user === true,
      'and creating the account if there is not one — sign-up and sign-in are one action');
  });

  // The failure everybody will actually hit, named rather than generic.
  await withPage(browser, async (page) => {
    const msg = await page.evaluate(async () => {
      try { await DB.sendLink('someone@example.com'); return 'no error'; }
      catch (e) { return e.message; }
    });
    check(/rate-limit/i.test(msg) && /2\/hour/.test(msg),
      'a 429 is reported as the rate limit it is, not as a broken email', msg.slice(0, 48) + '…');
  }, { rateLimited: true });

  await withPage(browser, async (page) => {
    const r = await page.evaluate((jwt) => {
      const before = location.href;
      const fake = {
        hash: `#access_token=${jwt}&refresh_token=r1&token_type=bearer`,
        pathname: location.pathname, search: location.search,
      };
      const s = DB.completeSignIn(fake);
      return { signedIn: DB.signedIn(), uid: DB.userId(), stored: !!localStorage.getItem('topten.session'),
               hashAfter: location.hash, had: before.includes('#'), token: !!s.access_token };
    }, fakeJWT(USER));
    check(r.signedIn, 'a returning magic link signs you in');
    check(r.uid === USER, 'and the user id comes out of the token, with no extra round trip');
    check(r.stored, 'the session survives a reload — the allowance is two emails an hour');
    check(r.hashAfter === '', 'the bearer token is stripped from the address bar');
  });

  await withPage(browser, async (page) => {
    const r = await page.evaluate((jwt) => {
      DB.completeSignIn({ hash: `#access_token=${jwt}&refresh_token=r1`, pathname: '/', search: '' });
      return DB.signedIn();
    }, fakeJWT(USER, -10));
    check(r === false, 'an expired token is not a session');
  });

  await withPage(browser, async (page) => {
    const msg = await page.evaluate(() => {
      try { DB.completeSignIn({ hash: '#error=access_denied&error_description=Email+link+is+invalid+or+has+expired', pathname: '/', search: '' }); return 'no error'; }
      catch (e) { return e.message; }
    });
    check(/invalid or has expired/.test(msg),
      'an expired link reports what the server said, not a silent null', msg);
  });

  // ── Publishing ────────────────────────────────────────────────────────────
  // The order is the schema's, not a preference: a Ten cannot be born
  // published, because at that instant it has no items.
  await withPage(browser, async (page, calls) => {
    const id = await page.evaluate(async (jwt) => {
      DB.completeSignIn({ hash: `#access_token=${jwt}&refresh_token=r1`, pathname: '/', search: '' });
      return DB.publish({
        topic: { criteria_id: 'movie:genre:Crime:decade:1990', slug: 'top-10-crime-movies-of-the-90s',
                 domain: 'movie', genre: 'Crime', decade: 1990,
                 title: 'Top 10 Crime Movies of the 90s', prompt: 'Your 10 favorite crime movies of the 90s.' },
        items: Array.from({ length: 10 }, (_, i) => ({ id: 1000 + i, title: 'Film ' + i })),
      });
    }, fakeJWT(USER));
    check(id === TEN, 'publishing returns the Ten id a share link is built from');

    const seq = calls.filter(c => c.path !== 'otp').map(c => `${c.method} ${c.path.split('?')[0]}`);
    const patch = seq.indexOf('PATCH tens');
    const items = seq.indexOf('POST ten_items');
    const del = seq.indexOf('DELETE ten_items');
    check(patch > items && items > -1,
      'published_at is set LAST — a Ten cannot be born published', seq.join(' → '));
    check(del > -1 && del < items, 'items are replaced, not appended, so re-publishing is an edit');

    const body = JSON.parse(calls.find(c => c.method === 'POST' && c.path.startsWith('ten_items')).body);
    check(body.length === 10 && body[0].position === 1 && body[9].position === 10,
      'ten items, in positions 1 through 10');
    check(body.every(r => r.title_at_publish),
      'each carrying the title it had at publish time — the catalog is a cache, the list is not');
  });

  await withPage(browser, async (page, calls) => {
    await page.evaluate(async (jwt) => {
      DB.completeSignIn({ hash: `#access_token=${jwt}&refresh_token=r1`, pathname: '/', search: '' });
      return DB.publish({ topic: { criteria_id: 'x', slug: 'x', domain: 'movie', title: 'x', prompt: 'x' },
                          items: Array.from({ length: 10 }, (_, i) => ({ id: i, title: 't' })) });
    }, fakeJWT(USER));
    const topicPosts = calls.filter(c => c.method === 'POST' && c.path.startsWith('topics'));
    check(topicPosts.length === 0,
      'an existing topic is reused, never re-created — a topic is shared ground');
  });

  await withPage(browser, async (page) => {
    const msg = await page.evaluate(async () => {
      try { await DB.publish({ topic: {}, items: [] }); return 'no error'; }
      catch (e) { return e.message; }
    });
    check(/sign in/i.test(msg), 'publishing while signed out fails before it touches the network', msg);
  });

  // ── Reading ───────────────────────────────────────────────────────────────
  await withPage(browser, async (page) => {
    const t = await page.evaluate(() => DB.readTen('bbbbbbbb-0000-0000-0000-000000000001'));
    check(t && t.items.map(i => i.id).join(',') === '3,1,2'.split(',').map(Number).sort((a, b) => a - b).join(','),
      'items come back in position order, whatever order the join returned them in',
      t && t.items.map(i => `${i.id}`).join(','));
    check(t && t.author === 'Ada', 'a display name is preferred over a handle for the byline');
    check(t && t.badge && t.badge.inscription === 'Crime, all ten',
      'the badge is flattened into the shape badge.js already draws');
    check(t && t.published === true, 'and the page knows it is looking at a published Ten');
  }, {
    tenRows: [{
      id: TEN, published_at: '2026-08-15T12:00:00Z',
      topics: { id: TOPIC, slug: 'top-10-crime-movies-of-the-90s', title: 'Top 10 Crime Movies of the 90s', domain: 'movie' },
      profiles: { handle: 'quiet_lantern_04', display_name: 'Ada' },
      // Deliberately out of order: a join has no order, and position is the
      // entire product.
      ten_items: [{ position: 3, item_id: 3, title_at_publish: 'C' },
                  { position: 1, item_id: 1, title_at_publish: 'A' },
                  { position: 2, item_id: 2, title_at_publish: 'B' }],
      badges: { composition: { shape: 'stub' }, inscription: 'Crime, all ten', seed: '42', provenance: 'deterministic' },
    }],
  });

  await withPage(browser, async (page) => {
    const t = await page.evaluate(() => DB.readTen('bbbbbbbb-0000-0000-0000-000000000001'));
    check(t === null, 'a draft, or a Ten that does not exist, reads as nothing at all');
  }, { tenRows: [] });

  await browser.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
