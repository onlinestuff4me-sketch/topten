/* The public share surfaces: a Ten page, a topic page, and the card that goes
 * in a link preview. One module, because all three render the same few things
 * and the whole point of M5 is that a stranger sees what the phone saw.
 *
 * Data comes from the URL here. In the shipping product it comes from
 * Supabase — `supabase/migrations/0001_init.sql` is the other half of this
 * shape, and the field names below are that schema's field names on purpose,
 * so swapping the source is a change of one function.
 *
 * `Share.fromLocation` is the only place that knows about the URL. Everything
 * below it takes plain objects, which is what makes the OG card able to reuse
 * the same rendering without pretending to be a page.
 */
const Share = (() => {
  const IMG = 'https://image.tmdb.org/t/p/';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const CAT = (typeof window !== 'undefined' && window.CATALOG) || [];
  const BOOKS = (typeof window !== 'undefined' && window.CATALOG_BOOKS) || [];
  const byId = new Map([...CAT, ...BOOKS].map(f => [f.id, f]));

  /* Artwork, with the same fallback the app uses: a book brings its own cover,
     everything else is a TMDB path. A missing poster is a grey plate, never a
     broken image icon — this page is somebody's first impression. */
  const art = (f, size = 'w185') =>
    !f ? '' : (f.img ? f.img : (f.p ? IMG + size + f.p : ''));

  /* ── Reading a shared link ─────────────────────────────────────────────────
     `?t=<title>&by=<handle>&items=1,2,3…&badge=<json>&mine=4,7`

     `mine` is what makes the comparison overlay work without an account: your
     own picks travel in the link you followed, from your own device's draft.
     In the product this is your row in the database; here it is the same data
     arriving by a different road, which is enough to judge the design. */
  function fromLocation(loc) {
    const q = new URLSearchParams(loc.search);
    const ids = (q.get('items') || '').split(',').map(Number).filter(Boolean);
    if (!ids.length) return null;
    const mine = (q.get('mine') || '').split(',').map(Number).filter(Boolean);
    let badge = null;
    try { badge = q.get('badge') ? JSON.parse(atob(q.get('badge'))) : null; } catch (e) { badge = null; }
    return {
      title: q.get('t') || 'A Top 10',
      author: q.get('by') || 'someone',
      topicId: q.get('topic') || '',
      items: ids.map(id => byId.get(id) || { id, t: 'Unavailable', y: null }),
      badge,
      unlocked: q.get('unlocked') === '1',
      mine,
    };
  }

  /* The reverse: build a link for a Ten. Used by the app screen's share
     action, and by the tests, so the two directions are proven to agree. */
  function link(ten, origin = '') {
    const q = new URLSearchParams();
    q.set('t', ten.title);
    q.set('by', ten.author);
    if (ten.topicId) q.set('topic', ten.topicId);
    q.set('items', ten.items.map(f => f.id ?? f).join(','));
    if (ten.badge) q.set('badge', btoa(JSON.stringify(ten.badge)));
    if (ten.unlocked) q.set('unlocked', '1');
    if (ten.mine && ten.mine.length) q.set('mine', ten.mine.join(','));
    return `${origin}/ten?${q.toString()}`;
  }

  /* ── The badge block ──────────────────────────────────────────────────────
     The gate, drawn rather than enforced. The list above it is fully visible;
     this is the only thing withheld, and it says exactly what opens it — a
     lock with no key on it is just a wall. */
  function badgeBlock(ten) {
    const open = ten.unlocked && ten.badge;
    const inner = open
      ? window.badgeSVG(ten.badge, 200).replace(/class="layer"/g, 'class="layer on"')
      : window.lockedBadge(true);
    return `<aside class="badgecol">
      ${inner}
      <span class="state">${open ? 'Badge unlocked' : 'Badge locked'}</span>
      ${open && ten.badge.inscription
        ? `<p class="insc">${esc(ten.badge.inscription)}</p>`
        : `<p class="how">Make your own ${esc(ten.title)} and this badge opens —
             along with every other badge on the same list.</p>`}
      <a class="cta" href="./?topic=${encodeURIComponent(ten.topicId || '')}">Make your ${esc(ten.title)}</a>
    </aside>`;
  }

  /* ── The Ten itself ───────────────────────────────────────────────────────
     Annotated with your own picks where they overlap. The comparison is not a
     separate screen: making it one would mean reading the list twice to find
     out where you disagree, which is the interesting part. */
  function tenList(ten) {
    const mine = new Map(ten.mine.map((id, i) => [id, i + 1]));
    return `<ol class="ten">${ten.items.map((f, i) => {
      const rank = mine.get(f.id);
      return `<li><div class="row ${i === 0 ? 'one' : ''} ${rank ? 'shared' : ''}">
        <span class="num">${i + 1}</span>
        <span class="thumb">${art(f) ? `<img src="${esc(art(f))}" alt="" loading="lazy">` : ''}</span>
        <span class="meta"><span class="t">${esc(f.t)}</span>
          <span class="s">${f.y || ''}${f.d ? ' · ' + esc(f.d) : ''}</span></span>
        ${rank ? `<span class="mine">your #${rank}</span>` : '<span></span>'}
      </div></li>`;
    }).join('')}</ol>`;
  }

  function compareBlock(ten) {
    if (!ten.mine.length) return '';
    const shared = ten.items.filter(f => ten.mine.includes(f.id)).length;
    // Zero shared is the most interesting outcome on the page, so it gets the
    // better sentence rather than an empty state.
    const line = shared === 0
      ? `Not one pick in common. Someone is wrong.`
      : shared === 10
        ? `The same ten. Different order, maybe.`
        : `You agree on ${shared}, and disagree on ${10 - shared}.`;
    return `<section><div class="compare">
      <span class="n">${shared}<span style="font-size:.6em">/10</span></span>
      <span>${esc(line)}</span>
    </div></section>`;
  }

  /* ── Consensus ────────────────────────────────────────────────────────────
     Borda, the same arithmetic as `consensus_ten()` in the migration and
     `ConsensusTally` in TopTenKit: position 1 scores 10, position 10 scores 1,
     so every complete Ten contributes exactly 55 whatever its picks are.
     Three implementations is two too many, and the tests hold them level. */
  function consensus(tens, limit = 10) {
    const points = new Map(), appearances = new Map();
    for (const t of tens) {
      t.items.forEach((f, i) => {
        const id = f.id ?? f;
        points.set(id, (points.get(id) || 0) + (10 - i));
        appearances.set(id, (appearances.get(id) || 0) + 1);
      });
    }
    return [...points.entries()]
      .map(([id, pts]) => ({ id, points: pts, appearances: appearances.get(id), item: byId.get(id) }))
      // Ties break on appearances then id — for determinism, not fairness. A
      // cached page that reorders itself between two renders of identical data
      // is a bug that only shows up in production.
      .sort((a, b) => b.points - a.points || b.appearances - a.appearances || a.id - b.id)
      .slice(0, limit);
  }

  function tenPage(ten) {
    return `${masthead()}
      <div class="hero">
        <div>
          <h1>${esc(ten.title)}</h1>
          <p class="byline">A Top 10 by <b>${esc(ten.author)}</b></p>
          ${tenList(ten)}
        </div>
        ${badgeBlock(ten)}
      </div>
      ${compareBlock(ten)}
      ${footer()}`;
  }

  function topicPage(topic, tens) {
    const rows = consensus(tens);
    return `${masthead()}
      <h1>${esc(topic.title)}</h1>
      <p class="byline">${tens.length} ${tens.length === 1 ? 'person has' : 'people have'} taken this on.</p>
      <section>
        <h2 class="section-h">The consensus</h2>
        ${rows.length ? `<ol class="consensus">${rows.map((r, i) => `<li>
          <span class="num">${i + 1}</span>
          <span class="t">${esc(r.item ? r.item.t : r.id)}</span>
          <span class="pts">${r.points} pts · ${r.appearances} of ${tens.length}</span>
        </li>`).join('')}</ol>`
        : `<p class="empty">Nobody has published one of these yet.</p>`}
      </section>
      <section>
        <h2 class="section-h">Everyone's take</h2>
        <ol class="ten">${tens.map(t => `<li><div class="row">
          <span class="num"></span>
          <span class="thumb">${art(t.items[0]) ? `<img src="${esc(art(t.items[0]))}" alt="">` : ''}</span>
          <span class="meta"><span class="t">${esc(t.author)}</span>
            <span class="s">#1 ${esc(t.items[0] ? t.items[0].t : '')}</span></span>
          <span></span>
        </div></li>`).join('')}</ol>
      </section>
      ${footer()}`;
  }

  /* ── The share card ───────────────────────────────────────────────────────
     1200x630, the image a pasted link becomes. Same data, same badge renderer,
     a different amount of room — so it shows five picks rather than ten and
     lets the badge take a third of the frame, because at thumbnail size the
     badge is the only thing legible and it is the thing being sold. */
  function card(ten) {
    const open = ten.unlocked && ten.badge;
    const picks = ten.items.slice(0, 5).map((f, i) => `<div class="pick">
      <div class="art">${art(f, 'w342') ? `<img src="${esc(art(f, 'w342'))}" alt="">` : ''}
        <span class="n">${i + 1}</span></div>
      <div class="t">${esc(f.t)}</div>
    </div>`).join('');
    return `<div class="card">
      <div>
        <div class="masthead"><span class="dot"></span><span>Top Ten</span></div>
        <h1>${esc(ten.title)}</h1>
        <p class="byline">A Top 10 by <b>${esc(ten.author)}</b></p>
        <div class="picks">${picks}</div>
      </div>
      <div class="right">
        ${open ? window.badgeSVG(ten.badge, 230).replace(/class="layer"/g, 'class="layer on"')
               : window.lockedBadge(true)}
        <span class="state">${open ? 'Badge earned' : 'Badge locked'}</span>
        ${open && ten.badge.inscription ? `<p class="insc">${esc(ten.badge.inscription)}</p>` : ''}
      </div>
    </div>`;
  }

  const cardFallback = () => `<div class="card"><div>
    <div class="masthead"><span class="dot"></span><span>Top Ten</span></div>
    <h1>Ten and only ten.</h1>
    <p class="byline">The list you would defend to the death.</p>
  </div><div class="right"></div></div>`;

  /* The link preview. The card is a page at `/card`, rendered at 1200x630 and
     screenshotted — so the image in a message is drawn by the same code as the
     page it links to, and cannot show a badge the page does not.

     The description names the top three rather than describing the product:
     somebody deciding whether to tap wants to know what is in the list, and
     "Ten and only ten" is on the card already. */
  function previewTags(ten, origin = '') {
    const top = ten.items.slice(0, 3).map(f => f.t).filter(Boolean).join(' · ');
    return {
      'og:title': `${ten.title} — a Top 10 by ${ten.author}`,
      'og:description': top || 'Ten and only ten. The limit is the point.',
      'og:image': `${origin}/card?${link(ten).split('?')[1]}`,
    };
  }

  function applyPreviewTags(ten, doc, loc) {
    const tags = previewTags(ten, loc ? loc.origin : '');
    const set = (id, v) => { const el = doc.getElementById(id); if (el) el.setAttribute('content', v); };
    set('og-title', tags['og:title']);
    set('og-desc', tags['og:description']);
    set('og-image', tags['og:image']);
  }

  const masthead = () =>
    `<div class="masthead"><span class="dot"></span><span>Top Ten</span></div>`;

  const footer = () => `<footer>
    Structure prototype. Data travels in the link rather than from a database,
    so this page is real and shareable without a backend to stand up.
    Artwork and metadata from TMDB.
  </footer>`;

  const missing = () => `${masthead()}
    <h1>No list in this link</h1>
    <p class="byline">A Top 10 link carries the list inside it. This one arrived empty.</p>
    <section><a class="cta" href="./">Make your own Top 10</a></section>
    ${footer()}`;

  return { fromLocation, link, tenPage, topicPage, card, cardFallback, consensus,
           previewTags, applyPreviewTags, missing, esc, art, byId };
})();

if (typeof module !== 'undefined') module.exports = Share;
