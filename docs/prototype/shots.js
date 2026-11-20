/* shots.js — the one way to get a picture of this app.
 *
 *   node shots.js                 list the screens it knows
 *   node shots.js case            one still, Vault, real artwork
 *   node shots.js case --light    the same screen in Gallery
 *   node shots.js wall            an animated GIF (screens that move default to one)
 *   node shots.js review          every image the review page uses
 *
 * WHY THIS IS COMMITTED AND NOT A THROWAWAY.
 *
 * Before this file, every request for a screenshot produced a new one-off
 * script in the scratchpad. On 2026-11-18 there were 65 of them, 28 of which
 * captured stills or video, and they did not agree with each other:
 *
 *     mapshot.js, shot2.js          routed the poster mirror
 *     wallgif.js, caseshot.js,      did NOT — so they photographed an app
 *     picksshot.js                  with no artwork, and nothing said so
 *
 * Which means some of the images Mischa reviewed were of a different app than
 * the others. One of those throwaways, with an unset variable, is also what
 * committed 3.8MB of PNGs to a directory called `undefined`.
 *
 * So: one file, committed, with the setup written down once. It REFUSES to
 * run without the poster mirror rather than quietly producing artless images,
 * because an artless review image is worse than no review image — it looks
 * like a design decision.
 *
 * WHAT IT IS NOT. It asserts nothing. `drive.js` proves the app works;
 * this shows what it looks like. They were tangled together, which is why the
 * suite was slow AND why the review images were inconsistent. A screenshot is
 * not verification (AGENTS.md) — it proves one state of one screen with one
 * fixture, which is exactly what it is for.
 */
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME = process.env.CHROMIUM
  || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const BASE = process.env.BASE || 'http://127.0.0.1:8788';
const MIRROR = process.env.POSTER_MIRROR || path.join(__dirname, 'posters');
const OUT = process.env.OUT || path.join(__dirname, 'review');

/* The phone. 393x659 is an iPhone 15 Pro's PAGE box — the device is 393x852
   and the browser keeps the rest. Stills are full-page from here, so a long
   screen gives a tall image rather than a cropped one. deviceScaleFactor 2
   because a person looks at these. */
const PHONE = { width: 393, height: 659 };
const DSF = 2;

/* GIF defaults. A screen can override any of them.

   SIZE IS THE WHOLE PROBLEM, and it is driven by how much of the frame
   CHANGES, not by the length. Measured on the splash wall, which is the worst
   case because every pixel is moving artwork:

     340px, 12fps, 9s, 256 colours   11,783KB   unusable
     260px, 10fps, 6s, 128 colours    2,600KB   the size the old one landed on

   Fewer colours and a coarser dither both help twice over: less palette, and
   fewer speckles for the LZW to encode. An artifact page is capped at 16MB in
   total, so a single GIF has to stay in single-digit MB however good it looks. */
const GIF = { fps: 12, width: 340, colors: 160, dither: 3 };

// ── Reaching a screen ───────────────────────────────────────────────────────
/* Seeding `S` and calling render() rather than clicking through the app. A
   walk through the UI is what drive.js does, and it takes two minutes; this
   has to be quick enough to run for every change. The cost is that a seeded
   screen can differ from a walked one — which is why drive.js exists and why
   a screenshot is never the proof. */
const PREP = () => {
  localStorage.clear();
  document.querySelectorAll('.sheet, .scrim, .coach, .coachscrim, .vault').forEach(x => x.remove());
  S.seen = true;
  S.tipDone = true;
};

/* A finished Ten, built the way the app builds one: the topic's own shelf,
   most-voted first. */
const MAKE_DONE = (crit) => {
  const t = window.makeTopic(crit);
  const ten = CAT.filter(f => window.inTopic(f, t))
    .sort((a, b) => (b.vc || 0) - (a.vc || 0)).slice(0, 10);
  // No badge: finishing a list stopped producing one on 2026-11-18. A done
  // entry is the list and its name, which is what the app now stores.
  return { topicId: t.id, title: window.listName(ten, t), domain: t.domain,
    ranked: ten.map(f => f.id) };
};

const THREE = [{ genre: 'Crime', decade: 1990 }, { genre: 'Animation', decade: 2000 },
                { domain: 'tv', genre: 'Drama' }];

const SCREENS = {
  splash: {
    what: 'the first screen — the wall of other people\'s lists',
    dark: true,
    seed: (h) => { eval(h.prep); S.scene = 'intro'; save(); render(); },
  },

  wall: {
    what: 'the splash wall drifting (GIF)',
    dark: true, motion: true,
    // Every pixel is moving artwork, so this is the most expensive thing the
    // app can record. Six seconds is two full poster-widths of travel, which
    // is enough to read the motion as a wall rather than a glitch.
    gif: { width: 260, fps: 10, colors: 128, dither: 5 },
    seed: (h) => { eval(h.prep); S.scene = 'intro'; save(); render(); },
    act: async (page) => { await page.waitForTimeout(6000); },
  },

  browse: {
    what: 'the main screen — gathering films into a Ten',
    seed: (h) => { eval(h.prep); S.scene = 'build'; save(); render(); },
  },

  discover: {
    what: 'other people\'s Top 10 lists',
    seed: (h) => {
      eval(h.prep); const makeDone = eval(h.makeDone);
      S.done = h.three.slice(0, 2).map(makeDone);
      S.scene = 'discover'; save(); render();
    },
  },

  case: {
    what: 'You, in Vault — the same screen dark, for the contrast gate',
    dark: true,
    seed: (h) => {
      eval(h.prep); const makeDone = eval(h.makeDone);
      S.done = h.three.map(makeDone);
      S.scene = 'you'; save(); render();
    },
  },

  you: {
    what: 'You — the achievement set and your finished lists',
    seed: (h) => {
      eval(h.prep); const makeDone = eval(h.makeDone);
      S.done = h.three.map(makeDone);
      S.scene = 'you'; save(); render();
    },
  },

  mine: {
    what: 'one of your own lists, opened from the case',
    dark: true,
    seed: (h) => {
      eval(h.prep); const makeDone = eval(h.makeDone);
      S.done = h.three.map(makeDone);
      S.mine = S.done[0].topicId; S.scene = 'mine'; save(); render();
    },
  },

  topic: {
    what: 'a topic page, before you have made one',
    seed: (h) => {
      eval(h.prep);
      S.topicPage = { genre: 'Crime', decade: 1990 };
      S.scene = 'topic'; save(); render();
    },
  },

  'topic-mine': {
    what: 'the same topic page, once you have your own take on it',
    seed: (h) => {
      eval(h.prep); const makeDone = eval(h.makeDone);
      S.done = [makeDone({ genre: 'Crime', decade: 1990 })];
      S.topicPage = { genre: 'Crime', decade: 1990 };
      S.scene = 'topic'; save(); render();
    },
  },

  done: {
    what: 'the finished screen — the list is the reward',
    dark: true,
    seed: (h) => {
      eval(h.prep); const makeDone = eval(h.makeDone);
      const d = makeDone({ genre: 'Crime', decade: 1990 });
      S.done = [d]; S.topic = window.makeTopic({ genre: 'Crime', decade: 1990 });
      S.ranked = d.ranked;
      S.scene = 'done'; save(); render();
    },
  },

  picker: {
    what: 'Start a list — the empty state, what it offers cold',
    seed: (h) => {
      eval(h.prep); const makeDone = eval(h.makeDone);
      S.done = [makeDone({ domain: 'movie' })];
      S.pick = { q: '', tags: [], film: null };
      S.scene = 'pick'; save(); render();
    },
  },

  'picker-typed': {
    what: 'Start a list — a phrase that cannot fill, and the answer',
    seed: (h) => {
      eval(h.prep); const makeDone = eval(h.makeDone);
      S.done = [makeDone({ domain: 'movie' })];
      S.pick = { q: 'disney animated movies of the 2000s', tags: [], film: null };
      S.scene = 'pick'; save(); render();
    },
  },

  fromtitle: {
    what: 'Start a list from a film you love',
    seed: (h) => {
      eval(h.prep); const makeDone = eval(h.makeDone);
      S.done = [makeDone({ domain: 'movie' })];
      const god = CAT.find(f => f.t === 'The Godfather');
      S.pick = { q: 'godfather', tags: [], film: god ? god.id : null };
      S.scene = 'pick'; save(); render();
    },
  },

  draft: {
    what: 'the draft in reach — the tab bar carrying an unfinished Ten',
    viewport: true,
    seed: (h) => {
      eval(h.prep); const makeDone = eval(h.makeDone);
      S.done = h.three.slice(0, 2).map(makeDone);
      /* Six of ten on a topic not yet finished: the state that had no home
         before 2026-11-20, when the only way off the build screen threw it
         away. */
      S.topic = window.makeTopic({ genre: 'Western' });
      S.tray = CAT.filter(f => window.inTopic(f, S.topic)).slice(0, 6).map(f => f.id);
      S.tab = 'browse'; S.scene = 'discover'; save(); render();
    },
  },

  badges: {
    what: 'the ten achievements, earned and not, with every condition stated',
    seed: (h) => {
      /* The real set, drawn by the app's own `achMark()` from the app's own
         `achievements()` — not a hand-built sheet. The previous version of
         this screen called `compose()`, which was deleted with the
         badge-per-list on 2026-11-18, so it had been throwing since: proof
         that a review image nobody asked for is a review image nobody runs.

         Seeded with eleven lists across both categories and five decades, so
         some are earned, some carry a progress bar and some are bare — which
         is the whole point of showing them unlocked-visible. */
      eval(h.prep); const makeDone = eval(h.makeDone);
      S.done = [
        { genre: 'Crime', decade: 1990 }, { genre: 'Animation', decade: 2000 },
        { genre: 'Western', decade: 1960 }, { genre: 'Horror', decade: 1980 },
        { genre: 'Science Fiction', decade: 1970 }, { genre: 'Thriller' },
        { genre: 'Documentary' }, { genre: 'Comedy' },
        { domain: 'tv', genre: 'Drama' }, { domain: 'tv', genre: 'Comedy' },
        { director: 'Alfred Hitchcock' },
      ].map(makeDone).filter(d => d.ranked.length === 10);
      S.scene = 'you'; save(); render();
      /* The ten fit in one frame only without the list of lists under them.
         This screen is about the set; `you` is about a person's own page. */
      const lists = document.querySelector('.mylists');
      if (lists) lists.closest('section').remove();
    },
  },

  noart: {
    what: 'every screen\'s fallback when artwork will not load',
    dark: true, artless: true,
    seed: (h) => { eval(h.prep); S.scene = 'intro'; save(); render(); },
  },
};

// ── Plumbing ────────────────────────────────────────────────────────────────

function mirrorFileCount(dir) {
  let n = 0;
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true }))
    e.isDirectory() ? walk(path.join(d, e.name)) : n++; };
  try { walk(dir); } catch { return 0; }
  return n;
}

/* Serve posters from the mirror. A file the mirror does not hold answers 404
   rather than 204: both are a missing image, but 404 is the honest one and it
   is what the app's `.no-art` fallback is measured against. */
function routeArtwork(page, { artless }) {
  return page.route('**://image.tmdb.org/t/p/**', (route) => {
    if (artless) return route.fulfill({ status: 404, body: '' });
    const m = route.request().url().match(/\/t\/p\/(w\d+)(\/.+)$/);
    const file = m && path.join(MIRROR, m[1] + m[2]);
    if (file && fs.existsSync(file)) return route.fulfill({ path: file, contentType: 'image/jpeg' });
    return route.fulfill({ status: 404, body: '' });
  });
}

/* LAZY IMAGES AND FULL-PAGE SCREENSHOTS DO NOT MIX, and this is almost
   certainly what made the old one-off scripts disagree with each other.

   The browse rows carry `loading="lazy"`, so an image below the fold never
   starts loading. `fullPage: true` then photographs the whole document
   including rows whose posters never arrived - they come out as the empty
   `.no-art` plate, which looks like a design decision rather than a capture
   bug. Measured on the browse screen: five rows with artwork, five without.

   The fix is NOT to simulate scrolling. That was the first attempt and it left
   118 of 220 posters unloaded, because `window.scrollTo` moves the document
   and this app scrolls an inner element - so the viewport never passed over
   the rows and the browser never started their fetches. Chasing the right
   scroll container would make this file care about the app's layout, which is
   exactly the coupling that keeps breaking these scripts.

   Turning lazy OFF is deterministic and layout-independent: assigning
   `loading = 'eager'` to an image that has not started yet begins its fetch
   immediately, wherever it sits. Then wait for all of them. */
async function settleImages(page) {
  await page.evaluate(async () => {
    [...document.images].forEach(i => { i.loading = 'eager'; });
    await new Promise(r => setTimeout(r, 100));
    await Promise.all([...document.images].map(i => i.complete ? null : new Promise(done => {
      i.addEventListener('load', done, { once: true });
      i.addEventListener('error', done, { once: true });
      setTimeout(done, 5000);                       // never hang on one bad file
    })));
  });
  await page.waitForTimeout(250);
}

/* And then SAY whether it worked. The point of this file is that a review
   image is never quietly artless; counting after the fact is the only way to
   know, because a missing poster renders as a plate that looks deliberate. */
async function artworkReport(page) {
  return page.evaluate(() => {
    const imgs = [...document.images];
    const d = document.documentElement;
    return { total: imgs.length,
             missing: imgs.filter(i => !i.complete || i.naturalWidth === 0).length,
             // drive.js now runs with no artwork at all, on purpose, so a
             // layout fault that only appears WHEN IMAGES LOAD has nowhere
             // else to be caught. One number, measured on every capture.
             wide: Math.round(d.scrollWidth - d.clientWidth) };
  });
}

const helpers = {
  prep: `(${PREP.toString()})()`,
  makeDone: `(${MAKE_DONE.toString()})`,
  three: THREE,
};

async function capture(browser, name, { light, motion }) {
  const S = SCREENS[name];
  if (!S) throw new Error(`no screen called "${name}" — run \`node shots.js\` for the list`);

  const scheme = light ? 'light' : (S.dark ? 'dark' : 'light');
  const wantGif = motion !== undefined ? motion : !!S.motion;
  const suffix = light && S.dark ? '-light' : '';
  const stem = path.join(OUT, name + suffix);

  const ctx = await browser.newContext({
    viewport: PHONE, deviceScaleFactor: wantGif ? 1 : DSF, colorScheme: scheme,
    isMobile: true, hasTouch: true,
    ...(wantGif ? { recordVideo: { dir: path.join(OUT, '.vid'), size: PHONE } } : {}),
  });
  const page = await ctx.newPage();
  await routeArtwork(page, S);
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await page.evaluate(S.seed, helpers);
  await page.waitForTimeout(500);

  if (!wantGif) {
    await settleImages(page);
    const art = await artworkReport(page);
    const out = `${stem}.jpg`;
    /* `viewport: true` for a screen whose point is chrome fixed to the bottom
       of the window. A full-page shot of a fixed element photographs it at
       whatever scroll position it occupied, which puts the tab bar in the
       MIDDLE of a tall image — technically correct and useless to review. */
    await page.screenshot({ path: out, type: 'jpeg', quality: 86,
      fullPage: !S.viewport });
    await ctx.close();
    return { out, art };
  }

  const art = await artworkReport(page);
  if (S.act) await S.act(page);
  const video = page.video();
  await ctx.close();                       // the webm is only finished here
  const webm = await video.path();
  const out = `${stem}.gif`;
  const g = { ...GIF, ...(S.gif || {}) };
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', webm, '-vf',
    `fps=${g.fps},scale=${g.width}:-1:flags=lanczos,split[a][b];`
    + `[a]palettegen=max_colors=${g.colors}:stats_mode=diff[p];`
    + `[b][p]paletteuse=dither=bayer:bayer_scale=${g.dither}`,
    out]);
  fs.rmSync(webm, { force: true });
  return { out, art };
}

(async () => {
  const args = process.argv.slice(2);
  const light = args.includes('--light');
  const motion = args.includes('--gif') ? true : (args.includes('--still') ? false : undefined);
  const names = args.filter(a => !a.startsWith('--'));

  if (!names.length) {
    console.log('\nScreens this knows:\n');
    for (const [k, v] of Object.entries(SCREENS)) {
      console.log(`  ${k.padEnd(12)} ${v.what}${v.motion ? '   [GIF]' : ''}`);
    }
    console.log('\n  review       every one of the above, stills and GIFs\n');
    console.log(`Flags: --light  --gif  --still      Output: ${OUT}\n`);
    return;
  }

  /* REFUSE TO PRODUCE AN ARTLESS IMAGE BY ACCIDENT. This is the whole reason
     the file exists: three of the five one-off scripts it replaces silently
     photographed an app with no posters. `noart` asks for that on purpose. */
  const wantsArt = names.some(n => n === 'review' || !(SCREENS[n] || {}).artless);
  const have = mirrorFileCount(MIRROR);
  if (wantsArt && have === 0) {
    console.error(`\nNo poster mirror at ${MIRROR} — refusing to take review images of an\n`
      + `app with no artwork, because an artless screenshot reads as a design\n`
      + `decision rather than a missing file. Build it:\n\n`
      + `    node mirror.js\n\n`
      + `(\`node shots.js noart\` is how you ask for the artless screen on purpose.)\n`);
    process.exit(1);
  }
  console.log(`poster mirror: ${have} files`);

  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME });
  const wanted = names[0] === 'review' ? Object.keys(SCREENS) : names;

  let artless = 0;
  const show = ({ out, art }, ms) => {
    const kb = Math.round(fs.statSync(out).size / 1024);
    // `noart` asks for missing artwork; everything else reporting it is a bug.
    const bad = art.missing && !SCREENS[path.basename(out).split(/[-.]/)[0]]?.artless;
    if (bad) artless++;
    if (art.wide > 1) artless++;
    console.log(`  ${path.basename(out).padEnd(20)} ${String(kb).padStart(5)}KB`
      + (ms ? `  ${String(ms).padStart(5)}ms` : '        ')
      + `  ${art.total - art.missing}/${art.total} posters`
      + (bad ? '   ← ARTLESS, do not ship this one' : '')
      + (art.wide > 1 ? `   ← SPILLS ${art.wide}px SIDEWAYS with artwork in` : ''));
  };

  for (const name of wanted) {
    const t = Date.now();
    show(await capture(browser, name, { light, motion }), Date.now() - t);
  }
  // The light counterparts, when asking for the whole set.
  if (names[0] === 'review') {
    for (const name of Object.keys(SCREENS).filter(k => SCREENS[k].dark && !SCREENS[k].motion)) {
      show(await capture(browser, name, { light: true, motion: false }), 0);
    }
  }

  await browser.close();
  fs.rmSync(path.join(OUT, '.vid'), { recursive: true, force: true });
  console.log(`\nin ${OUT}`);
  if (artless) {
    console.log(`\n${artless} image(s) came out with missing artwork. That is a capture`);
    console.log(`fault, not a design: check the poster mirror covers the size the screen`);
    console.log(`asks for, and that settleImages() reached the bottom of the page.\n`);
    process.exitCode = 1;
  } else console.log('');
})().catch(e => { console.error('\nshots.js failed — ' + e.message); console.error(e.stack); process.exit(1); });
