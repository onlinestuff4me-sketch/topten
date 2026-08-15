/* The badge, drawn from its composition — shared by the app screen and the
   public share page.
 *
 * Extracted so the two cannot draw different badges from the same data. A
 * badge is data rendered live (specs/badges.md), and the whole point of that
 * decision is lost the moment a second renderer exists: the phone and the web
 * page would agree only for as long as somebody kept them in step.
 *
 * Pure functions over a composition object. No app state, no catalog, no DOM.
 */

/* Its own escaper, deliberately. `badge.js` loads before the app's script and
   is also loaded by pages that have no app script at all, so borrowing one
   from a caller would make the file work in one place and throw in the other
   — which is exactly what it did on the first run of the share page. Declared
   with `var` so a page that defines its own `esc` afterwards simply wins,
   rather than dying on a redeclaration. */
var escBadge = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const lockedBadge = (big) => `<svg class="lockedbadge${big ? ' big' : ''}" viewBox="0 0 44 44"
  role="img" aria-label="Badge, locked">
  <rect class="plate" x="1" y="1" width="42" height="42" rx="11"/>
  <path class="shackle" d="M16.5 21v-4a5.5 5.5 0 0 1 11 0v4"/>
  <rect class="body" x="13" y="20.5" width="18" height="13.5" rx="3.5"/>
</svg>`;

function badgeSVG(c, s = 200) {
  /* A composition can arrive from a URL, from a database row written by an
     older build, or from a badge whose palette derivation found no artwork.
     Any of those can be missing a field, and a missing colour renders as a
     black void rather than as an error — the worst kind of failure, because it
     looks deliberate. Defend once here, at the door, rather than at six
     `${c.x}` interpolations below. */
  c = Object.assign({
    shape: 'seal', motif: 'laurel', metal: '#C9A227',
    primary: '#6E675D', secondary: '#3A311A', inscription: '',
  }, c || {});
  const half = s / 2;
  const plate = {
    seal: `<circle cx="${half}" cy="${half}" r="${half - 10}"/>`,
    shield: `<path d="M${half} 12 L${s - 18} 42 V${half + 10} Q${s - 18} ${s - 22} ${half} ${s - 10} Q18 ${s - 22} 18 ${half + 10} V42 Z"/>`,
    oval: `<ellipse cx="${half}" cy="${half}" rx="${half - 26}" ry="${half - 10}"/>`,
    stub: `<path d="M22 34 H${s - 22} V${half - 14} A14 14 0 0 0 ${s - 22} ${half + 14} V${s - 34} H22 V${half + 14} A14 14 0 0 0 22 ${half - 14} Z"/>`,
    hex: `<path d="M${half} 10 L${s - 16} ${half / 2 + 8} V${s - half / 2 - 8} L${half} ${s - 10} L16 ${s - half / 2 - 8} V${half / 2 + 8} Z"/>`,
    lozenge: `<path d="M14 ${half} L46 26 H${s - 46} L${s - 14} ${half} L${s - 46} ${s - 26} H46 Z"/>`
  }[c.shape] || `<circle cx="${half}" cy="${half}" r="${half - 10}"/>`;
  const M = {
    briefcase: `<rect x="66" y="86" width="68" height="46" rx="5"/><path d="M86 86 V76 a6 6 0 0 1 6-6h16a6 6 0 0 1 6 6v10" fill="none" stroke-width="7"/>`,
    eye: `<path d="M56 100 Q100 66 144 100 Q100 134 56 100 Z" fill="none" stroke-width="7"/><circle cx="100" cy="100" r="13"/>`,
    planet: `<circle cx="100" cy="98" r="26"/><ellipse cx="100" cy="98" rx="46" ry="15" fill="none" stroke-width="6" transform="rotate(-18 100 98)"/>`,
    skull: `<path d="M100 66 c-24 0-40 17-40 38 0 12 6 19 12 24 v10 h56 v-10 c6-5 12-12 12-24 0-21-16-38-40-38z"/>`,
    rose: `<circle cx="100" cy="94" r="12"/><path d="M100 70 a24 24 0 0 1 24 24 24 24 0 0 1-24 24 24 24 0 0 1-24-24" fill="none" stroke-width="7"/><path d="M100 118 v22" stroke-width="6" fill="none"/>`,
    star: `<path d="M100 62 L112 92 L145 94 L119 114 L128 146 L100 128 L72 146 L81 114 L55 94 L88 92 Z"/>`,
    mask: `<path d="M62 72 h76 v34 c0 26-17 42-38 42s-38-16-38-42z"/>`,
    grin: `<circle cx="100" cy="100" r="38" fill="none" stroke-width="7"/><path d="M78 106 q22 22 44 0" fill="none" stroke-width="7"/><circle cx="86" cy="88" r="5"/><circle cx="114" cy="88" r="5"/>`,
    helm: `<path d="M62 104 a38 38 0 0 1 76 0 v22 h-76z"/>`,
    compass: `<circle cx="100" cy="100" r="38" fill="none" stroke-width="7"/><path d="M100 74 L112 100 L100 126 L88 100 Z"/>`,
    flame: `<path d="M100 60 c16 22 30 30 30 50 a30 30 0 0 1-60 0c0-14 10-20 16-30 4 10 10 12 14 6 4-8-2-16 0-26z"/>`,
    sword: `<rect x="94" y="58" width="12" height="70"/><rect x="74" y="126" width="52" height="10" rx="4"/><rect x="94" y="136" width="12" height="16"/>`,
    note: `<circle cx="84" cy="128" r="15"/><rect x="96" y="62" width="9" height="66"/><path d="M105 62 q22 6 22 22" fill="none" stroke-width="8"/>`,
    column: `<rect x="76" y="76" width="48" height="8"/><rect x="82" y="84" width="10" height="46"/><rect x="108" y="84" width="10" height="46"/><rect x="72" y="130" width="56" height="9"/>`,
    sun: `<circle cx="100" cy="100" r="22"/>` + Array.from({ length: 8 }, (_, i) => `<rect x="97" y="52" width="6" height="16" transform="rotate(${i * 45} 100 100)"/>`).join(''),
    laurel: `<path d="M100 60 v78" stroke-width="6" fill="none"/>`
  }[c.motif] || '';
  const rivets = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2, R = half - 22;
    return `<circle cx="${(half + Math.cos(a) * R).toFixed(1)}" cy="${(half + Math.sin(a) * R).toFixed(1)}" r="3" fill="${c.metal}" opacity=".85"/>`;
  }).join('');
  return `<svg viewBox="0 0 ${s} ${s}" role="img" aria-label="Badge: ${escBadge(c.inscription)}">
    <defs><linearGradient id="f${c.seed}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${c.primary}"/><stop offset="100%" stop-color="${c.secondary}"/></linearGradient></defs>
    <g class="layer" id="l-plate" fill="url(#f${c.seed})">${plate}</g>
    <g class="layer" id="l-motif" fill="${c.metal}" stroke="${c.metal}" opacity=".95">${M}</g>
    <g class="layer" id="l-metal" fill="none">
      <g stroke="${c.metal}" stroke-width="3" opacity=".9">${plate.replace('<path', '<path fill="none"').replace('<circle', '<circle fill="none"').replace('<ellipse', '<ellipse fill="none"')}</g>
      ${rivets}</g></svg>`;
}


/* Explicit exports. A top-level `function` declaration attaches itself to
   `window` in a classic script and a top-level `const` does not — so
   `badgeSVG` was reachable from the share page and `lockedBadge` was not, and
   only the locked half of the gate broke. Naming both here means the file's
   surface is stated rather than inferred from each declaration's keyword. */
if (typeof window !== 'undefined') {
  window.badgeSVG = badgeSVG;
  window.lockedBadge = lockedBadge;
}
if (typeof module !== 'undefined') module.exports = { badgeSVG, lockedBadge };
