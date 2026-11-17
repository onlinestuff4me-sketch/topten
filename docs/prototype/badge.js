/* The badge renderer — five layers, per specs/badges.md.
 *
 * Backplate, field, motif, metals, inscription. The first version drew the
 * first three and a half: a flat gradient between two raw poster colours, a
 * glyph, some rivets, and an inscription that existed only in the aria-label.
 * With real artwork it came out as a red-to-blue hexagon with a mustard
 * shield, which is not a thing anybody screenshots (2026-11-17).
 *
 * ── Why the colours were wrong ───────────────────────────────────────────
 * `compose()` passed the dominant colours of the top two posters straight
 * through — Pulp Fiction's red and The Dark Knight's blue — at whatever
 * chroma the artwork happened to have. badges.md has always said the palette
 * is "snapped into Laurel-safe LCH ranges: L 25-75, C <= 60", and
 * TopTenKit/Palette.swift implements exactly that. The web renderer never
 * got it.
 *
 * The snapping happens HERE, at the door, rather than in `compose()`, because
 * a composition also arrives from a share URL and from an OG card — fixing it
 * upstream would fix one surface out of four.
 *
 * And two unrelated hues are not a palette however well snapped. A real
 * enamel badge is one colour in two tones with the metal carrying the
 * contrast, so the field is built from the artwork's dominant HUE and the
 * second tone is derived from it rather than borrowed from another poster.
 * Hue is what carries the list's identity; lightness and chroma are what
 * carry the family resemblance, so those are what give way — the same rule
 * Palette.swift states.
 */

/* Everything below is closed over. badge.js is a classic script loaded
   beside index.html, ten.html, topic.html and card.html, and a top-level
   `const` in a classic script goes into the SHARED global lexical scope —
   so `const MOTIFS` here and `const MOTIFS` in index.html is not shadowing,
   it is a SyntaxError that stops the whole page parsing. Which is exactly
   what happened: the app booted to a blank screen and the first assertion
   to fail was "a new user lands on the intro", four layers away from the
   cause. The module states its surface at the bottom and keeps the rest. */
(function () {
/* ── sRGB <-> CIE L*C*h, through XYZ under D65 ──────────────────────────────
   Ported from TopTenKit/Sources/TopTenKit/Palette.swift so the two renderers
   cannot drift. The Swift side has the tests; this is the same arithmetic. */
const _D65 = { x: 0.95047, y: 1.0, z: 1.08883 };
const _lin = v => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
const _delin = v => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
const _clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function _hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}
const _rgbToHex = ({ r, g, b }) => '#' + [r, g, b]
  .map(v => Math.round(_clamp(v, 0, 1) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();

function _rgbToLch(c) {
  const r = _lin(c.r), g = _lin(c.g), b = _lin(c.b);
  const x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
  const y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750;
  const z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041;
  const f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x / _D65.x), fy = f(y / _D65.y), fz = f(z / _D65.z);
  const L = 116 * fy - 16, A = 500 * (fx - fy), B = 200 * (fy - fz);
  let h = Math.atan2(B, A) * 180 / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c: Math.sqrt(A * A + B * B), h };
}

function _lchToRgb({ l, c, h }) {
  const rad = h * Math.PI / 180, A = c * Math.cos(rad), B = c * Math.sin(rad);
  const fy = (l + 16) / 116, fx = fy + A / 500, fz = fy - B / 200;
  const inv = t => (t * t * t > 0.008856 ? t * t * t : (t - 16 / 116) / 7.787);
  const x = inv(fx) * _D65.x, y = inv(fy) * _D65.y, z = inv(fz) * _D65.z;
  return {
    r: _delin(x * 3.2404542 + y * -1.5371385 + z * -0.4985314),
    g: _delin(x * -0.9692660 + y * 1.8760108 + z * 0.0415560),
    b: _delin(x * 0.0556434 + y * -0.2040259 + z * 1.0572252),
  };
}

/* Laurel-safe: L 25-75, C <= 60 (badges.md, and Palette.swift's own constants). */
const SAFE_L = [25, 75], MAX_C = 60;
const _tone = (lch, l, c) => _rgbToHex(_lchToRgb({
  l: _clamp(l, SAFE_L[0], SAFE_L[1]), c: _clamp(c, 0, MAX_C), h: lch.h,
}));

/* ── The enamel hues ────────────────────────────────────────────────────────
   Eight, and the yellow band is deliberately not among them.

   ## Why the hue stopped coming from the artwork (2026-11-17)

   badges.md said the palette is "derived from the Ten's artwork (dominant
   hues of the top 3 items) ... so the badge visibly belongs to *this* list".
   Measured against the real catalogue, that signal does the opposite of what
   it promises. The dominant hue of all 3,469 posters:

       20-120 deg (amber/olive/yellow)   66%
       220-300 deg (blue/violet)         25%
       everything else                    9%

   Two thirds of all artwork is in one 100-degree band, because that is the
   band the whole industry grades to. A badge whose hue is read off it is not
   a badge that belongs to this list — it is the same badge as everyone
   else's, and eleven of the first twenty test badges came out the same
   olive. "Derived from artwork" was deriving from noise.

   So the hue comes from the TOPIC and the tone comes from the artwork.
   Beyond fixing the distribution (a hash is flat where poster hues are not),
   this is the better product rule: every take on "Top 10 Crime Movies of the
   90s" is oxblood, so a topic's badges read as a set on a shelf. The remix
   graph is the engine of this app — people make their own take on somebody
   else's topic — and giving a topic a recognisable colour makes that visible
   at a glance. The artwork still does visible work: a list of dark posters
   gets a deeper, quieter enamel than a list of bright ones, so two takes on
   the same topic are the same colour and not the same badge.

   The yellow gap is kept for the original reason: anything in 62-128 at
   these lightnesses is olive, and olive beside a gold rim is mud. */
const ENAMELS = [
  { h: 12,  name: 'oxblood' },
  { h: 38,  name: 'terracotta' },
  { h: 148, name: 'forest' },
  { h: 176, name: 'verdigris' },
  { h: 205, name: 'teal' },
  { h: 248, name: 'navy' },
  { h: 288, name: 'aubergine' },
  { h: 330, name: 'plum' },
];

/* FNV-1a. Lives here rather than in the caller so that the app, the share
   page, the topic page and the OG card cannot disagree about what colour a
   topic is — which is the whole point of hanging the hue on the topic. */
function badgeHash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < String(str).length; i++) {
    h ^= String(str).charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

/* One hue from the topic, two tones from the artwork, and the metal carries
   the contrast. */
function fieldTones(primaryHex, seed = 0, topic = '') {
  // A composition can arrive from an old share URL with no topic on it. The
  // seed is the next best flat source — it already mixes the topic in.
  const key = String(topic || '').trim();
  const enamel = ENAMELS[(key ? badgeHash(key) : Math.abs(Number(seed) || 0)) % ENAMELS.length];

  const rgb = _hexToRgb(primaryHex);
  const base = rgb ? _rgbToLch(rgb) : { l: 45, c: 30 };
  const lch = { h: enamel.h };

  // The artwork sets how deep the enamel is fired. Bounded at both ends: a
  // list of black posters must not produce a badge that reads as a hole, and
  // a list of white ones must not produce one that reads as unfilled.
  const t = _clamp((base.l - 18) / 54, 0, 1);
  const chroma = _clamp(base.c, 30, 58);
  return {
    name: enamel.name,
    shadow: _tone(lch, 25, Math.min(chroma, 34)),
    deep: _tone(lch, 22 + t * 12, Math.min(chroma, 46)),
    lit: _tone(lch, 46 + t * 16, Math.min(chroma, 54)),
    rim: _tone(lch, 68 + t * 6, Math.min(chroma, 30)),
  };
}

const escBadge = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const lockedBadge = (big) => `<svg class="lockedbadge${big ? ' big' : ''}" viewBox="0 0 44 44"
  role="img" aria-label="Badge, locked">
  <rect class="plate" x="1" y="1" width="42" height="42" rx="11"/>
  <path class="shackle" d="M16.5 21v-4a5.5 5.5 0 0 1 11 0v4"/>
  <rect class="body" x="13" y="20.5" width="18" height="13.5" rx="3.5"/>
</svg>`;

/* ── The kit ────────────────────────────────────────────────────────────────
   Drawn on a 200x200 field and scaled, so every shape shares one coordinate
   system and the metals, motif and inscription can be positioned once. */
const PLATES = {
  seal:    'M100 8 A92 92 0 1 1 99.9 8 Z',
  shield:  'M100 10 L178 40 V104 Q178 158 100 190 Q22 158 22 104 V40 Z',
  oval:    'M100 8 A72 92 0 1 1 99.9 8 Z',
  stub:    'M24 32 H176 V86 A14 14 0 0 0 176 114 V168 H24 V114 A14 14 0 0 0 24 86 Z',
  hex:     'M100 8 L182 54 V146 L100 192 L18 146 V54 Z',
  lozenge: 'M10 100 L48 24 H152 L190 100 L152 176 H48 Z',
  keystone:'M46 20 H154 L178 180 H22 Z',
  rosette: (() => {
    let d = '';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2, r = i % 2 ? 72 : 92;
      const x = 100 + Math.cos(a) * r, y = 100 + Math.sin(a) * r;
      d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
    }
    return d + 'Z';
  })(),
};
const SHAPE_KEYS = Object.keys(PLATES);

const MOTIFS = {
  briefcase: '<rect x="66" y="86" width="68" height="46" rx="5"/><path d="M86 86 V76 a6 6 0 0 1 6-6h16a6 6 0 0 1 6 6v10" fill="none" stroke-width="7"/>',
  eye: '<path d="M56 100 Q100 66 144 100 Q100 134 56 100 Z" fill="none" stroke-width="7"/><circle cx="100" cy="100" r="13"/>',
  planet: '<circle cx="100" cy="98" r="26"/><ellipse cx="100" cy="98" rx="46" ry="15" fill="none" stroke-width="6" transform="rotate(-18 100 98)"/>',
  skull: '<path d="M100 66 c-24 0-40 17-40 38 0 12 6 19 12 24 v10 h56 v-10 c6-5 12-12 12-24 0-21-16-38-40-38z"/>',
  rose: '<circle cx="100" cy="94" r="12"/><path d="M100 70 a24 24 0 0 1 24 24 24 24 0 0 1-24 24 24 24 0 0 1-24-24" fill="none" stroke-width="7"/><path d="M100 118 v22" stroke-width="6" fill="none"/>',
  star: '<path d="M100 62 L112 92 L145 94 L119 114 L128 146 L100 128 L72 146 L81 114 L55 94 L88 92 Z"/>',
  mask: '<path d="M62 72 h76 v34 c0 26-17 42-38 42s-38-16-38-42z"/>',
  grin: '<circle cx="100" cy="100" r="38" fill="none" stroke-width="7"/><path d="M78 106 q22 22 44 0" fill="none" stroke-width="7"/><circle cx="86" cy="88" r="5"/><circle cx="114" cy="88" r="5"/>',
  helm: '<path d="M62 104 a38 38 0 0 1 76 0 v22 h-76z"/>',
  compass: '<circle cx="100" cy="100" r="38" fill="none" stroke-width="7"/><path d="M100 74 L112 100 L100 126 L88 100 Z"/>',
  flame: '<path d="M100 60 c16 22 30 30 30 50 a30 30 0 0 1-60 0c0-14 10-20 16-30 4 10 10 12 14 6 4-8-2-16 0-26z"/>',
  sword: '<rect x="94" y="58" width="12" height="70"/><rect x="74" y="126" width="52" height="10" rx="4"/><rect x="94" y="136" width="12" height="16"/>',
  note: '<circle cx="84" cy="128" r="15"/><rect x="96" y="62" width="9" height="66"/><path d="M105 62 q22 6 22 22" fill="none" stroke-width="8"/>',
  column: '<rect x="76" y="76" width="48" height="8"/><rect x="82" y="84" width="10" height="46"/><rect x="108" y="84" width="10" height="46"/><rect x="72" y="130" width="56" height="9"/>',
  sun: '<circle cx="100" cy="100" r="22"/>' + Array.from({ length: 8 }, (_, i) =>
    `<rect x="97" y="52" width="6" height="16" transform="rotate(${i * 45} 100 100)"/>`).join(''),
  laurel: '<path d="M78 134 Q66 100 100 62 Q134 100 122 134" fill="none" stroke-width="7"/>'
    + '<path d="M100 62 v76" stroke-width="5" fill="none"/>',
};

/* Materials differ in how light sits on the field, not in colour — the
   palette is already doing the identity work, so the material is allowed to
   be the quiet layer. */
const MATERIALS = ['enamel', 'brass', 'velvet', 'lacquer'];

function badgeSVG(c, s = 200) {
  /* A composition can arrive from a URL, from a database row written by an
     older build, or from a badge whose palette derivation found no artwork.
     Any of those can be missing a field, and a missing colour renders as a
     black void rather than as an error — the worst kind of failure, because
     it looks deliberate. Defend once here, at the door. */
  c = Object.assign({
    shape: 'seal', motif: 'laurel', metal: '#C9A227',
    primary: '#6E675D', secondary: '#3A311A', inscription: '', seed: 0, topic: '',
  }, c || {});

  const seed = Math.abs(Number(c.seed) || 0);
  const uid = 'b' + seed.toString(36) + Math.round(s);
  const tones = fieldTones(c.primary, seed, c.topic);
  const material = MATERIALS[seed % MATERIALS.length];
  const plate = PLATES[c.shape] || PLATES[SHAPE_KEYS[seed % SHAPE_KEYS.length]];
  const motif = MOTIFS[c.motif] || MOTIFS.laurel;
  const metal = c.metal || '#C9A227';

  // Metal reads as metal when it has two values, not one: a dark seat under a
  // lit edge. A single stroke always looks like a drawn outline.
  const metalLo = _rgbToHex(_lchToRgb(Object.assign(_rgbToLch(_hexToRgb(metal) || { r: .79, g: .64, b: .15 }), { l: 34 })));
  const metalHi = _rgbToHex(_lchToRgb(Object.assign(_rgbToLch(_hexToRgb(metal) || { r: .79, g: .64, b: .15 }), { l: 78 })));

  const sheen = {
    enamel: `<ellipse cx="78" cy="62" rx="54" ry="30" fill="#fff" opacity=".20" transform="rotate(-18 78 62)"/>`,
    brass: Array.from({ length: 16 }, (_, i) =>
      `<rect x="${8 + i * 12}" y="0" width="4" height="200" fill="#fff" opacity=".045"/>`).join(''),
    velvet: `<radialGradient id="v${uid}" cx="50%" cy="38%" r="68%">
        <stop offset="0%" stop-color="#fff" stop-opacity=".16"/>
        <stop offset="100%" stop-color="#000" stop-opacity=".22"/></radialGradient>
      <rect width="200" height="200" fill="url(#v${uid})"/>`,
    lacquer: `<ellipse cx="100" cy="46" rx="74" ry="26" fill="#fff" opacity=".22"/>
      <ellipse cx="100" cy="168" rx="58" ry="18" fill="#fff" opacity=".07"/>`,
  }[material];

  // The inscription is the point of the badge and it is unreadable below
  // about 140px, where it would be three grey smudges on a rim. It is in the
  // label at every size; it is DRAWN only where it can be read.
  const words = String(c.inscription || '').trim();
  const showText = words && s >= 140;
  // Width first, then size. The band is 152 wide and the text is fitted to
  // 144 of it, but the fit is only an estimate until a font is chosen — and
  // the font differs on every surface this badge renders on (New York on
  // iOS, Georgia in most browsers, DejaVu Serif on the CI runner, which is
  // half again as wide). `textLength` makes the rendering font-independent:
  // the text occupies the width stated here or it is squeezed until it does.
  // A badge is an identity object that has to look the same in the app, on
  // the share page and in a link preview, so identical beats unconstrained.
  const AVG = 0.5, BAND = 144;
  const fit = Math.min(15, Math.max(8, BAND / Math.max(words.length * AVG, 1)));
  const wide = Math.min(BAND, words.length * AVG * fit);
  // A ribbon, not an arc, and it overhangs the plate on purpose.
  //
  // The arc it replaces was a circle, and five of the eight plates are not
  // circles — the inscription ran outside the shape on every one of them and
  // crossed the motif on the rest. Clipping it to the plate only moved the
  // problem: on `stub` and `keystone` the band then stopped dead at the edge,
  // which reads as a rendering fault rather than as a design.
  //
  // So the ribbon sits ON the badge rather than inside it, with swallowtail
  // ends that hang past the widest plate. That is how an award ribbon has
  // always been drawn, it is identical on all eight shapes, and it gives the
  // inscription a dark ground: the rim and the motif are already gold, and a
  // third gold mass turned the whole badge into one metal blob.
  const inscription = !showText ? '' : `
    <g class="layer" id="l-ribbon">
      <path d="M4 120 L30 128 L30 160 L4 168 L14 144 Z" fill="${tones.shadow}"/>
      <path d="M196 120 L170 128 L170 160 L196 168 L186 144 Z" fill="${tones.shadow}"/>
      <path d="M24 126 H176 V162 H24 Z" fill="${tones.deep}"/>
      <path d="M24 126 H176 M24 162 H176" stroke="url(#m${uid})" stroke-width="2.5" fill="none"/>
      <text x="100" y="${(144 + fit * 0.35).toFixed(1)}" text-anchor="middle"
        textLength="${wide.toFixed(1)}" lengthAdjust="spacingAndGlyphs"
        font-size="${fit.toFixed(1)}" fill="${metalHi}"
        font-family="'New York', ui-serif, Georgia, serif"
        font-weight="700">${escBadge(words)}</text>
    </g>`;

  return `<svg viewBox="0 0 ${s} ${s}" role="img" aria-label="Badge: ${escBadge(words || 'unnamed')}">
  <defs>
    <linearGradient id="f${uid}" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0%" stop-color="${tones.lit}"/>
      <stop offset="62%" stop-color="${tones.deep}"/>
      <stop offset="100%" stop-color="${tones.deep}"/>
    </linearGradient>
    <clipPath id="c${uid}"><path d="${plate}"/></clipPath>
    <linearGradient id="m${uid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${metalHi}"/>
      <stop offset="45%" stop-color="${metal}"/>
      <stop offset="100%" stop-color="${metalLo}"/>
    </linearGradient>
  </defs>
  <g transform="scale(${(s / 200).toFixed(4)})">
    <g class="layer" id="l-plate">
      <path d="${plate}" fill="url(#f${uid})"/>
      <g clip-path="url(#c${uid})">${sheen}</g>
    </g>
    <g class="layer" id="l-motif" fill="${metal}" stroke="${metal}"
       stroke-linejoin="round" stroke-linecap="round"
       transform="translate(100 ${showText ? 84 : 100}) scale(${showText ? 0.74 : 0.92}) translate(-100 -100)">
      <g opacity=".35" transform="translate(0,3)" fill="#000" stroke="#000">${motif}</g>
      ${motif}
    </g>
    <g class="layer" id="l-metal" fill="none" stroke-linejoin="round">
      <path d="${plate}" stroke="${metalLo}" stroke-width="9"/>
      <path d="${plate}" stroke="${metal}" stroke-width="5"/>
      <path d="${plate}" stroke="${metalHi}" stroke-width="1.5" opacity=".8"/>
    </g>
    ${inscription}
  </g>
</svg>`;
}

/* Explicit exports. A top-level `function` declaration attaches itself to
   `window` in a classic script and a top-level `const` does not — so
   `badgeSVG` was reachable from the share page and `lockedBadge` was not, and
   only the locked half of the gate broke. Naming both here means the file's
   surface is stated rather than inferred from each declaration's keyword. */
if (typeof window !== 'undefined') {
  window.badgeSVG = badgeSVG;
  window.lockedBadge = lockedBadge;
  window.fieldTones = fieldTones;
  window.badgeHash = badgeHash;
}
if (typeof module !== 'undefined') module.exports = { badgeSVG, lockedBadge, fieldTones, badgeHash, ENAMELS };
})();
