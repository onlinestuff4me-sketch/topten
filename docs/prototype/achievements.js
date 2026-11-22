/* achievements.js — the badge system, after 2026-11-18.
 *
 * Mischa, 2026-11-18: "The badge system seems complicated and confusing. We
 * could have a standard set of badges that reward you for making lists (e.g.
 * made 10 lists, made a list in each category). But not a badge for each
 * list." And: "Badges is a new system, like achievements, just one set of
 * achievements you unlock for taking actions in the app."
 *
 * WHAT THIS REPLACES. A per-list composition engine: 8 plate shapes x 4
 * materials x 8 enamels x 16 motifs = 4,096 combinations, plus a generated
 * inscription. Audited over 103 real topics (docs/badge-mechanics-audit.md)
 * it produced the same line on one badge in five, put a compass on Drama and
 * an eye on Hitchcock, and varied two dimensions that were derived from a
 * hash and signalled nothing. All of that is gone.
 *
 * THE SHAPE OF THE NEW ONE, and why it is a different kind of object:
 *
 *   - ONE FIXED SET. Ten of them, hand-drawn, identical for everybody. There
 *     is nothing to generate, so there is nothing to audit and no way for the
 *     system to produce something embarrassing.
 *   - ABOUT YOU, NOT ABOUT A LIST. They reward what you have done across the
 *     app, which is what makes them worth collecting. A badge per list was a
 *     participation trophy: you got one for finishing, so it said nothing.
 *   - LOCKED ONES ARE VISIBLE. This is the exact opposite of the old reveal
 *     gate, and deliberately so. A locked achievement has to state its
 *     condition or it cannot motivate anything; the old badge was hidden
 *     because the point was to make you create to see it. That gate is gone
 *     (see specs/prd.md) - the engine is now remix: you see a Top 10
 *     Westerns and you make yours.
 *
 * The glyphs are the ones `badge.js` already carries. They were drawn as
 * decoration that meant nothing in particular; here each one means exactly
 * one thing, which is the job they were always better suited to.
 */
(function () {
  'use strict';

  /* Every achievement is a pure predicate over a STATS object, so the set can
     be tested without a browser and without a rendered screen. `stats` is
     assembled by `achievementStats` below from whatever the app knows. */
  const ACHIEVEMENTS = [
    { id: 'first', glyph: 'star', name: 'First Top 10',
      note: 'Make your first Top 10.',
      test: s => s.lists >= 1, of: s => [Math.min(s.lists, 1), 1] },

    { id: 'ten', glyph: 'laurel', name: 'Double Figures',
      note: 'Make ten Top 10s.',
      test: s => s.lists >= 10, of: s => [Math.min(s.lists, 10), 10] },

    { id: 'fifty', glyph: 'column', name: 'Fifty',
      note: 'Make fifty Top 10s.',
      test: s => s.lists >= 50, of: s => [Math.min(s.lists, 50), 50] },

    { id: 'rounder', glyph: 'compass', name: 'All-Rounder',
      note: 'Make a Top 10 in every category.',
      test: s => s.domains >= s.domainsPossible,
      of: s => [s.domains, s.domainsPossible] },

    { id: 'decades', glyph: 'planet', name: 'Time Served',
      note: 'Make Top 10s for lists from five different decades.',
      test: s => s.decades >= 5, of: s => [Math.min(s.decades, 5), 5] },

    { id: 'pioneer', glyph: 'flame', name: 'First Here',
      note: 'Be the first to make a Top 10 for a list.',
      test: s => s.pioneered >= 1, of: s => [Math.min(s.pioneered, 1), 1] },

    { id: 'answer', glyph: 'sword', name: 'Answered',
      note: "Make your Top 10 for a list somebody else made one for first.",
      test: s => s.answered >= 1, of: s => [Math.min(s.answered, 1), 1] },

    { id: 'started', glyph: 'sun', name: 'Started Something',
      note: 'Be first on a list that ten other people then make a Top 10 for.',
      test: s => s.drew >= 10, of: s => [Math.min(s.drew, 10), 10] },

    { id: 'contrarian', glyph: 'skull', name: 'Nobody Agrees',
      note: 'Make a Top 10 with nothing in common with what everyone picked.',
      test: s => s.loneliest === 0 && s.comparable > 0,
      of: s => [s.loneliest === 0 && s.comparable > 0 ? 1 : 0, 1] },

    { id: 'consensus', glyph: 'eye', name: 'Exactly Right',
      note: 'Make a Top 10 that matches what everyone picked.',
      test: s => s.closest === 10, of: s => [s.closest, 10] },
  ];

  /* Reading the stats off the app's own state rather than keeping a parallel
     counter. A counter drifts the first time a list is deleted; a derivation
     cannot. The cost is recomputing on render, which is ten lists of ten. */
  function achievementStats(state, world) {
    const done = (state && state.done) || [];
    const w = world || {};
    const domainsPossible = (w.domains || ['movie']).length;

    const decades = new Set();
    for (const d of done) {
      const m = /\b((?:19|20)\d0)s\b/.exec(d.title || '');
      if (m) decades.add(m[1]);
    }

    // How far each finished Ten sat from the crowd, where a crowd exists.
    const overlaps = done
      .map(d => (w.consensusOverlap ? w.consensusOverlap(d) : null))
      .filter(n => typeof n === 'number');

    return {
      lists: done.length,
      domains: new Set(done.map(d => d.domain || 'movie')).size,
      domainsPossible,
      decades: decades.size,
      pioneered: done.filter(d => w.isFirstTake && w.isFirstTake(d)).length,
      answered: done.filter(d => w.isAnswerTo && w.isAnswerTo(d)).length,
      drew: w.takesOnMyTopics ? w.takesOnMyTopics() : 0,
      comparable: overlaps.length,
      loneliest: overlaps.length ? Math.min(...overlaps) : null,
      closest: overlaps.length ? Math.max(...overlaps) : 0,
    };
  }

  /* Returns every achievement with its state, ALWAYS all of them and always
     in the same order - a locked one is as much a part of the screen as an
     unlocked one, because its condition is the thing that motivates. */
  function achievements(state, world) {
    const s = achievementStats(state, world);
    return ACHIEVEMENTS.map(a => {
      const [have, need] = a.of(s);
      return { id: a.id, glyph: a.glyph, name: a.name, note: a.note,
               unlocked: !!a.test(s), have, need };
    });
  }

  /* What changed between two states, so the app can celebrate exactly the
     thing that just happened rather than re-announcing a shelf. */
  function newlyUnlocked(before, after, world) {
    const was = new Set(achievements(before, world).filter(a => a.unlocked).map(a => a.id));
    return achievements(after, world).filter(a => a.unlocked && !was.has(a.id));
  }

  const api = { ACHIEVEMENTS, achievements, achievementStats, newlyUnlocked };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') Object.assign(window, api, { Achievements: api });
})();
