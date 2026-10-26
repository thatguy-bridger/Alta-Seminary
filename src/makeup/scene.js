// Colors and layout for the mountain scene behind the journey. The mountains
// are the site's own artwork (public/makeup/mountains-*.webp, cut from the
// page banners above the lettering and mirrored so each tile repeats without a
// seam), recolored per time of day so they move from night to morning.
export const TILE_URLS = { A: '/makeup/mountains-a.webp', B: '/makeup/mountains-b.webp' };

// flat colors per step: background, far, middle, near
export const PALETTES = [
  ['#141416', '#202127', '#1a1b20', '#131418'], ['#161a20', '#252d38', '#1e2630', '#171d26'], ['#1b2430', '#30405a', '#26334a', '#1d273a'],
  ['#2a3b4f', '#486482', '#3a536e', '#2d4259'], ['#587b97', '#86a9c4', '#6f93ae', '#587b97'], ['#b7cad6', '#c9d6df', '#aebfcd', '#93a8ba'],
  ['#ece6da', '#dcdcd6', '#c8cdcc', '#b0b9bb'],
];
export const SUN_TOP = [88, 84, 76, 60, 42, 30, 20]; // percent from the top
export const LAYER_CFG = [{ h: 190, bottom: 260, par: 0.12 }, { h: 240, bottom: 140, par: 0.3 }, { h: 300, bottom: 30, par: 0.6 }];

export const lerp = (a, b, t) => a + (b - a) * t;
export const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export function mixc(a, b, t) {
  const A = hex(a), B = hex(b);
  return '#' + A.map((v, i) => Math.round(lerp(v, B[i], t)).toString(16).padStart(2, '0')).join('');
}

// Palette at a fractional step (the sky moves a little during a multi-part learn step).
export function paletteAt(stepRaw) {
  const i0 = Math.min(PALETTES.length - 2, Math.max(0, Math.floor(stepRaw)));
  const f = Math.min(1, Math.max(0, stepRaw - i0));
  return { i0, f, colors: PALETTES[i0].map((c, k) => mixc(c, PALETTES[i0 + 1][k], f)) };
}

// shadow and light color for each layer's duotone
export function duotoneFor(colors, stepRaw) {
  const day = Math.min(1, stepRaw / 6);
  return [1, 2, 3].map((i) => [mixc(colors[i], '#000000', lerp(0.62, 0.45, day)), mixc(colors[i], '#ffffff', lerp(0.3, 0.52, day))]);
}

// The nearest mountains are a flat grey fill that goes through that layer's duotone, so the very bottom edge of the
// stage is always this one color. On a phone the browser's own toolbar sits under that edge; painting the page with
// this color keeps the strip behind the toolbar from showing as a black bar.
export const FILL_GRAY = 76;
export const stageBottomColor = ([dark, light]) => mixc(dark, light, FILL_GRAY / 255);

// Random tile, direction, size and start for each of the three layers.
export function rollScene(rand = Math.random) {
  const keys = Object.keys(TILE_URLS);
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const layers = LAYER_CFG.map((c) => ({ ...c, key: pick(keys), flip: rand() < 0.5, off: Math.floor(rand() * 1800), scale: 0.9 + rand() * 0.25 }));
  for (let i = 1; i < layers.length; i++) {
    if (layers[i].key === layers[i - 1].key && layers[i].flip === layers[i - 1].flip) layers[i].flip = !layers[i].flip;
  }
  return layers;
}
