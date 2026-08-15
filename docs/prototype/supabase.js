/* The real database, from the browser.
 *
 * `share.js` says its field names are the schema's field names on purpose, so
 * that swapping the source is a change of one function. This is that function,
 * plus the sign-in it turns out to require.
 *
 * No SDK. The prototype is classic scripts with no build step, and everything
 * below is four fetch calls against two documented REST APIs — PostgREST for
 * the tables, GoTrue for the magic link. A CDN dependency would buy token
 * refresh and cost a supply chain.
 *
 * ── On the key being in the file ──────────────────────────────────────────
 * `PUBLISHABLE` is meant to be public: it ships inside the page, it is what
 * Supabase calls a publishable key, and the dashboard says in as many words
 * that it can be shared. It grants the `anon` Postgres role and nothing more.
 * Every question of "what may this caller actually do" is answered by the
 * policies in supabase/migrations/0001_init.sql, which are executed as three
 * different callers by supabase/tests/rls_test.sql — and, since 2026-08-15,
 * proven against this very project: an anonymous write is refused with
 * `42501 new row violates row-level security policy`.
 *
 * The secret key is a different thing entirely and appears nowhere in this
 * repository. It bypasses every one of those policies.
 */
const DB = (() => {
  const URL_BASE = 'https://jkvfeculyhksqdsswqyw.supabase.co';
  const PUBLISHABLE = 'sb_publishable_K55cet8L0KO8Xp1KCFmn2Q_h7NIOAhj';
  const SESSION_KEY = 'topten.session';

  /* ── Session ───────────────────────────────────────────────────────────────
     Kept in localStorage because the alternative is asking for a magic link
     on every reload, and the allowance is two emails an hour. */
  let session = null;
  try { session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch (e) { session = null; }

  function store(s) {
    session = s;
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
    return s;
  }

  /* The user id, read out of the access token rather than fetched. It is the
     `sub` claim, it is needed on every insert, and a round trip to /auth/v1/user
     to learn something already in hand is a round trip on the publish path. */
  function claims(token) {
    try {
      const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(decodeURIComponent(escape(atob(part))));
    } catch (e) { return null; }
  }

  function userId() {
    if (!session?.access_token) return null;
    return claims(session.access_token)?.sub || null;
  }

  function expired() {
    if (!session?.access_token) return true;
    const exp = claims(session.access_token)?.exp;
    // Thirty seconds of slack: a token that expires mid-request is a failure
    // in the middle of publishing, which is the worst place to put one.
    return !exp || (exp * 1000) - Date.now() < 30_000;
  }

  const signedIn = () => !!session?.access_token && !expired();

  /* ── Requests ──────────────────────────────────────────────────────────── */
  function headers(extra = {}) {
    const h = { apikey: PUBLISHABLE, 'Content-Type': 'application/json', ...extra };
    if (session?.access_token) h.Authorization = `Bearer ${session.access_token}`;
    return h;
  }

  async function rest(path, opts = {}) {
    if (session?.refresh_token && expired()) await refresh();
    const res = await fetch(`${URL_BASE}/rest/v1/${path}`, { ...opts, headers: headers(opts.headers) });
    const text = await res.text();
    const body = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const err = new Error(body?.message || `request failed (${res.status})`);
      err.status = res.status; err.code = body?.code; err.details = body?.details;
      throw err;
    }
    return body;
  }

  /* ── Sign-in ───────────────────────────────────────────────────────────────
     Magic link, like Stack. No password exists anywhere in this product, so
     there is nothing to leak, reset, or reuse from another site. */
  async function sendLink(email, redirectTo = location.origin + location.pathname) {
    const res = await fetch(
      `${URL_BASE}/auth/v1/otp?redirect_to=${encodeURIComponent(redirectTo)}`,
      { method: 'POST', headers: { apikey: PUBLISHABLE, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, create_user: true }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      // The one everybody hits: the built-in sender allows two an hour, and
      // says so as a 429. Worth naming, because the alternative reading is
      // "the email is broken".
      if (res.status === 429) {
        throw new Error('Supabase is rate-limiting sign-in emails (2/hour on the built-in sender). Wait, or add custom SMTP.');
      }
      throw new Error(body?.msg || body?.error_description || `could not send the link (${res.status})`);
    }
    return true;
  }

  /* The other half: the link lands back here with the tokens in the URL
     fragment. A fragment never reaches a server, which is the reason GoTrue
     uses one — and the reason this has to run on the page rather than being
     handled by the host. */
  function completeSignIn(loc = location) {
    const hash = (loc.hash || '').replace(/^#/, '');
    if (!hash) return null;
    const q = new URLSearchParams(hash);
    const access_token = q.get('access_token');
    if (!access_token) {
      const error = q.get('error_description') || q.get('error');
      if (error) throw new Error(decodeURIComponent(error.replace(/\+/g, ' ')));
      return null;
    }
    const s = store({
      access_token,
      refresh_token: q.get('refresh_token'),
      token_type: q.get('token_type') || 'bearer',
    });
    // Leaving a bearer token in the address bar means it is in every screenshot
    // and every "share this page" from here on.
    if (typeof history !== 'undefined' && history.replaceState) {
      history.replaceState(null, '', loc.pathname + loc.search);
    }
    return s;
  }

  async function refresh() {
    if (!session?.refresh_token) return null;
    const res = await fetch(`${URL_BASE}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST', headers: { apikey: PUBLISHABLE, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    if (!res.ok) return store(null);   // refresh tokens expire too; sign in again
    return store(await res.json());
  }

  function signOut() { return store(null); }

  /* ── Publishing ────────────────────────────────────────────────────────────
     Four steps, in this order, because the schema requires it: a Ten cannot be
     born published (it has no items at that instant), so publishing is always
     an UPDATE that happens last. See supabase/README.md.  */

  /* A topic is materialised the first time anybody takes it on, and shared
     from then on. Select-then-insert rather than an upsert because `topics`
     has no UPDATE policy at all — an upsert would ask for a privilege nobody
     has, and fail on the happy path. The second select is for the race: two
     people can take the same topic on at the same moment, and the loser of
     that race wants the winner's row, not an error. */
  async function ensureTopic(topic) {
    const found = await rest(`topics?criteria_id=eq.${encodeURIComponent(topic.criteria_id)}&select=id&limit=1`);
    if (found?.length) return found[0].id;
    try {
      const made = await rest('topics', {
        method: 'POST', headers: { Prefer: 'return=representation' },
        body: JSON.stringify(topic),
      });
      return made[0].id;
    } catch (e) {
      if (e.status !== 409) throw e;
      const again = await rest(`topics?criteria_id=eq.${encodeURIComponent(topic.criteria_id)}&select=id&limit=1`);
      if (!again?.length) throw e;
      return again[0].id;
    }
  }

  /* One take per person per topic — a second take is an edit of the first,
     never a second row, or consensus counts one person twice. */
  async function ensureTen(topicId) {
    const me = userId();
    const found = await rest(`tens?author_id=eq.${me}&topic_id=eq.${topicId}&select=id&limit=1`);
    if (found?.length) return found[0].id;
    const made = await rest('tens', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ author_id: me, topic_id: topicId }),
    });
    return made[0].id;
  }

  async function replaceItems(tenId, items) {
    await rest(`ten_items?ten_id=eq.${tenId}`, { method: 'DELETE' });
    await rest('ten_items', {
      method: 'POST',
      body: JSON.stringify(items.slice(0, 10).map((it, i) => ({
        ten_id: tenId, position: i + 1, item_id: it.id, title_at_publish: it.title,
      }))),
    });
  }

  /* The whole sequence. Returns the Ten's id, which is the thing a share link
     is built from and the thing that has to survive re-ranking and re-badging
     (specs/tech-stack.md, the Stack lesson). */
  async function publish({ topic, items, badge }) {
    if (!signedIn()) throw new Error('sign in first');
    const topicId = await ensureTopic(topic);
    const tenId = await ensureTen(topicId);
    await replaceItems(tenId, items);
    await rest(`tens?id=eq.${tenId}`, {
      method: 'PATCH', body: JSON.stringify({ published_at: new Date().toISOString() }),
    });
    if (badge) {
      await rest('badges', {
        method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({ ten_id: tenId, ...badge }),
      });
    }
    return tenId;
  }

  /* ── Reading ───────────────────────────────────────────────────────────────
     One request, because PostgREST can follow the foreign keys the schema
     already declares, and because a share page that takes four round trips to
     draw is a share page somebody closes. RLS still applies to every embedded
     table, which is why a draft returns nothing here rather than returning a
     shell with its items missing. */
  const TEN_SELECT =
    'id,published_at,topics(id,slug,title,prompt,domain),profiles(handle,display_name),' +
    'ten_items(position,item_id,title_at_publish),badges(composition,inscription,seed,provenance)';

  async function readTen(id) {
    const rows = await rest(`tens?id=eq.${id}&select=${TEN_SELECT}&limit=1`);
    return rows?.length ? shapeTen(rows[0]) : null;
  }

  /* The shape `share.js` already renders, so the swap really is one function.
     Items arrive unordered from a join; position is the whole point. */
  function shapeTen(row) {
    const items = (row.ten_items || []).slice().sort((a, b) => a.position - b.position);
    return {
      id: row.id,
      published: !!row.published_at,
      title: row.topics?.title || 'A Top 10',
      topicId: row.topics?.id || '',
      slug: row.topics?.slug || '',
      author: row.profiles?.display_name || row.profiles?.handle || 'someone',
      handle: row.profiles?.handle || '',
      items: items.map(i => ({ id: i.item_id, t: i.title_at_publish })),
      badge: row.badges ? {
        ...(row.badges.composition || {}),
        inscription: row.badges.inscription,
        seed: Number(row.badges.seed),
        provenance: row.badges.provenance,
      } : null,
    };
  }

  async function readTopicBySlug(slug) {
    const rows = await rest(`topics?slug=eq.${encodeURIComponent(slug)}&select=*&limit=1`);
    return rows?.length ? rows[0] : null;
  }

  async function consensus(topicId, limit = 10) {
    return rest('rpc/consensus_ten', {
      method: 'POST', body: JSON.stringify({ p_topic_id: topicId, p_limit: limit }),
    });
  }

  async function sharedWithConsensus(tenId) {
    return rest('rpc/shared_with_consensus', {
      method: 'POST', body: JSON.stringify({ p_ten_id: tenId }),
    });
  }

  /* Published Tens for a topic, newest first — the topic page's list. */
  async function tensForTopic(topicId, limit = 20) {
    const rows = await rest(
      `tens?topic_id=eq.${topicId}&published_at=not.is.null&select=${TEN_SELECT}` +
      `&order=published_at.desc&limit=${limit}`);
    return (rows || []).map(shapeTen);
  }

  return {
    url: URL_BASE,
    signedIn, userId, session: () => session,
    sendLink, completeSignIn, refresh, signOut,
    publish, ensureTopic, ensureTen, replaceItems,
    readTen, readTopicBySlug, consensus, sharedWithConsensus, tensForTopic,
    shapeTen,
  };
})();

if (typeof window !== 'undefined') window.DB = DB;
