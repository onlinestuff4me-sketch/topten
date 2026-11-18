/* mirror.js — put the real poster art on this machine.
 *
 *   node mirror.js                 w185 + w342 for the whole catalog
 *   node mirror.js --sizes w500    the title page's hero size, as well
 *
 * WHY THIS IS COMMITTED.
 *
 * "The screenshots contain real poster art. We need to maintain that moving
 * forward." (Mischa, 2026-11-18.)
 *
 * `shots.js` refuses to take a review image without this mirror, which is
 * right — an artless screenshot reads as a design decision rather than a
 * missing file. But on 2026-11-18 the only thing that could BUILD the mirror
 * was a throwaway script in a session scratchpad, which is wiped. So the
 * guarantee was one container restart away from "shots.js refuses to run and
 * nobody remembers why". This closes that.
 *
 * `posters/` stays gitignored: 228MB of TMDB's artwork does not belong in our
 * history, and this rebuilds it in a few minutes.
 *
 * SIZES. The app asks for exactly three, and only two of them matter here:
 *
 *   w185   the default in `art()` - eight call sites, most of the app
 *   w342   browse cards, the splash wall
 *   w500   the title page hero, ONE film at a time - so partial coverage is
 *          fine and full coverage is ~350MB for screens nobody photographs
 *          in bulk. Ask for it with --sizes when you need it.
 *
 * If a screen does ask for a size that is not here, you will not have to
 * guess: `shots.js` reports poster coverage on every capture and says which
 * images came out artless.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const DEST = process.env.POSTER_MIRROR || path.join(__dirname, 'posters');
const DEFAULT_SIZES = ['w185', 'w342'];

const sizeArg = process.argv.indexOf('--sizes');
const SIZES = sizeArg === -1 ? DEFAULT_SIZES
  : [...new Set([...DEFAULT_SIZES, ...process.argv[sizeArg + 1].split(',')])];

/* The catalog is a generated file that assigns to `window`, so give it one.
   Books live in their own file and carry committed covers in `covers/`, so
   they need no mirror - this is films and shows only. */
global.window = {};
eval(fs.readFileSync(path.join(__dirname, 'catalog.js'), 'utf8'));
const CATALOG = global.window.CATALOG || [];

const jobs = [];
for (const f of CATALOG) {
  if (!f.p) continue;
  for (const size of SIZES) {
    const dest = path.join(DEST, size, f.p.replace(/^\//, ''));
    if (!fs.existsSync(dest)) jobs.push({ url: `https://image.tmdb.org/t/p/${size}${f.p}`, dest });
  }
}

if (!jobs.length) {
  console.log(`poster mirror already complete for ${SIZES.join(', ')} — nothing to fetch`);
  process.exit(0);
}
console.log(`${CATALOG.length} titles, ${SIZES.join(' + ')} — ${jobs.length} files to fetch`);

let done = 0, failed = 0;
const FAILURES = [];

/* Written to a .part file and renamed, so an interrupted run leaves no
   half-poster that `fs.existsSync` would later call done. This script is
   resumable precisely because of that rename. */
function fetchOne(job, tries = 0) {
  return new Promise((resolve) => {
    fs.mkdirSync(path.dirname(job.dest), { recursive: true });
    const req = https.get(job.url, { timeout: 20000 }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return resolve(retry(job, tries, 'HTTP ' + res.statusCode)); }
      const tmp = job.dest + '.part';
      const out = fs.createWriteStream(tmp);
      res.pipe(out);
      out.on('finish', () => out.close(() => {
        fs.renameSync(tmp, job.dest);
        if (++done % 250 === 0) process.stdout.write(`  ${done}/${jobs.length}\r`);
        resolve();
      }));
      out.on('error', (e) => resolve(retry(job, tries, e.message)));
    });
    req.on('timeout', () => { req.destroy(); resolve(retry(job, tries, 'timeout')); });
    req.on('error', (e) => resolve(retry(job, tries, e.message)));
  });
}

function retry(job, tries, why) {
  if (tries >= 3) { failed++; FAILURES.push(`${path.basename(job.dest)} — ${why}`); return; }
  return new Promise(r => setTimeout(r, 400 * (tries + 1))).then(() => fetchOne(job, tries + 1));
}

/* Eight at a time. TMDB serves images from a CDN and does not rate-limit them
   the way it does the API, but a thousand parallel sockets is rude and gets
   slower, not faster. */
const LANES = 8;

(async () => {
  const queue = jobs.slice();
  await Promise.all(Array.from({ length: LANES }, async () => {
    while (queue.length) await fetchOne(queue.pop());
  }));

  console.log(`\n${done} fetched, ${failed} failed`);
  if (FAILURES.length) {
    console.log('\nfailed:');
    for (const f of FAILURES.slice(0, 10)) console.log('  ' + f);
    if (FAILURES.length > 10) console.log(`  …and ${FAILURES.length - 10} more`);
  }
  // A poster TMDB no longer serves is not a reason to fail the run: it shows
  // as the designed `.no-art` plate, and shots.js will report the coverage.
  const have = SIZES.map(s => {
    let n = 0;
    const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true }))
      e.isDirectory() ? walk(path.join(d, e.name)) : n++; };
    try { walk(path.join(DEST, s)); } catch {}
    return `${s}: ${n}`;
  });
  console.log(`\n${DEST}\n  ${have.join('   ')}   of ${CATALOG.length} titles`);
})();
