import React from 'react';
import { BlockIcon } from '../admin-app/builder/blockIcons.jsx';

// Every preset renders as one of a handful of particle "kinds" -- weather-app
// style layered/blurred/glowing shapes for the atmospheric ones (snow, rain,
// sparkle, bubbles, fireworks), small hand-drawn gradient vector shapes for
// the ones worth being genuinely pretty (leaves, petals, hearts, shamrocks,
// confetti), and real emoji for everything that already looks great as
// exactly what it is (a pumpkin, a ghost, a graduation cap, ...) -- redrawing
// those would just be more code for a worse result. `customGlyph` (the
// "Custom emoji…" option) always renders through the plain emoji kind, same
// as any of the built-in emoji presets.
export const SITE_EFFECT_PRESETS = {
  snow: { kind: 'snow', label: 'Snow' },
  rain: { kind: 'rain', label: 'Rain' },
  leaves: { kind: 'leaf', label: 'Autumn Leaves' },
  petals: { kind: 'petal', label: 'Spring Petals' },
  sparkle: { kind: 'sparkle', palette: ['#fff6cf', '#ffe9a8', '#ffffff'], label: 'Summer Sparkle' },
  bubbles: { kind: 'bubble', label: 'Bubbles' },
  butterflies: { kind: 'emoji', glyph: '🦋', label: 'Butterflies' },
  fireflies: { kind: 'sparkle', palette: ['#e8ff9e', '#c6f26a', '#fff9d0'], label: 'Fireflies', ambient: true },
  confetti: { kind: 'confetti', label: 'Confetti' },
  balloons: { kind: 'emoji', glyph: '🎈', label: 'Balloons', direction: 'up' },
  hearts: { kind: 'heart', label: "Hearts (Valentine's)" },
  shamrocks: { kind: 'shamrock', label: "Shamrocks (St. Patrick's)" },
  eggs: { kind: 'emoji', glyph: '🥚', label: 'Easter Eggs' },
  fireworks: { kind: 'firework', label: 'Fireworks (4th of July)' },
  stars: { kind: 'sparkle', palette: ['#ffffff', '#dfe7ff', '#c7d2ff'], label: 'Stars' },
  pumpkins: { kind: 'emoji', glyph: '🎃', label: 'Pumpkins (Halloween)' },
  bats: { kind: 'emoji', glyph: '🦇', label: 'Bats (Halloween)' },
  ghosts: { kind: 'emoji', glyph: '👻', label: 'Ghosts (Halloween)' },
  turkeys: { kind: 'emoji', glyph: '🦃', label: 'Turkeys (Thanksgiving)' },
  ornaments: { kind: 'emoji', glyph: '🎄', label: 'Christmas' },
  santa: { kind: 'emoji', glyph: '🎅', label: 'Santa' },
  hanukkah: { kind: 'emoji', glyph: '🕎', label: 'Hanukkah' },
  gradcaps: { kind: 'emoji', glyph: '🎓', label: 'Graduation' },
};

export const SITE_EFFECT_PRESET_OPTIONS = [
  ...Object.entries(SITE_EFFECT_PRESETS).map(([value, p]) => ({ value, label: p.label })),
  { value: 'custom', label: 'Custom emoji…' },
];

const PREVIEW_GLYPH = { snow: '❄️', rain: '🌧️', sparkle: '✨', bubble: '🫧', confetti: '🎊', firework: '🎆', leaf: '🍂', petal: '🌸', heart: '💕', shamrock: '☘️' };

// Chromeless (registry.js) -- a purely decorative animated overlay across
// the whole site. Deliberately built so an admin CAN'T turn this into a
// full-bleed background image/video sitting on top of the page, which was
// an explicit ask, not an oversight:
//   - No image/video/file field exists on this block at all -- every preset
//     is either an emoji glyph or one of a handful of small CSS/SVG shapes.
//   - The overlay container is always `pointer-events: none`, so it can
//     never block a click or a tap regardless of any setting here.
//   - Density and size are both hard-capped (see the clamps below)
//     independent of whatever's actually stored, so a bad/stale value can't
//     produce enough coverage to read as a solid layer.
//   - The container itself never gets a background color/image of its own --
//     only small individual particles move across a fully transparent field.
export function SiteEffectBlock({ preset = 'snow', customGlyph = '', density = 40, speed = 50, size = 24, editable }) {
  const isCustom = preset === 'custom';
  const def = isCustom ? { kind: 'emoji', glyph: customGlyph || '✨', label: 'Custom' } : (SITE_EFFECT_PRESETS[preset] || SITE_EFFECT_PRESETS.snow);
  const previewGlyph = def.kind === 'emoji' ? def.glyph : PREVIEW_GLYPH[def.kind];

  if (editable) {
    return (
      <div style={{ display: 'flex', gap: 'var(--space-3)', padding: 'var(--space-3)', border: '1px dashed var(--border-default)', borderRadius: 'var(--radius-md)', background: 'var(--surface-sunken)' }}>
        <span style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', background: 'var(--tint-info-bg)', color: 'var(--brand-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18 }}>
          {previewGlyph}
        </span>
        <div>
          <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 'var(--fw-bold)', fontSize: 'var(--fs-small)', color: 'var(--text-primary)' }}>
            Site Effect — {def.label}
          </div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)' }}>
            Drifts across every page on the live site — a decorative overlay that never blocks clicking or reading. Doesn't take up space here in the block list.
          </div>
        </div>
      </div>
    );
  }

  if (def.kind === 'emoji' && !def.glyph) return null;
  const clampedDensity = Math.max(5, Math.min(120, density));
  const clampedSize = Math.max(10, Math.min(60, size));
  const clampedSpeed = Math.max(10, Math.min(100, speed));
  return <SiteEffectLive def={def} density={clampedDensity} speed={clampedSpeed} size={clampedSize} />;
}

// The falling kinds sway gently side to side on the way down (four waypoints,
// not just a straight start->end line) instead of a flat linear drift --
// real snow/leaves/petals never fall in a perfectly straight diagonal, and
// the wobble is most of what makes this read as "designed" instead of "css
// demo". Rotation direction is randomized per particle (--spin) so a batch
// never all spins the same way. Rain intentionally does NOT use this --
// real rain falls fast and essentially straight, see its own keyframe.
const KEYFRAMES = `
  @keyframes site-effect-sway {
    0%   { transform: translate(0, -10vh) rotate(0deg); opacity: 0; }
    8%   { opacity: var(--peak, 0.9); }
    28%  { transform: translate(calc(var(--drift) * 0.35), 22vh) rotate(calc(var(--spin) * 90deg)); }
    52%  { transform: translate(calc(var(--drift) * -0.25), 52vh) rotate(calc(var(--spin) * 190deg)); }
    76%  { transform: translate(calc(var(--drift) * 0.6), 82vh) rotate(calc(var(--spin) * 300deg)); }
    92%  { opacity: var(--peak, 0.9); }
    100% { transform: translate(var(--drift), 110vh) rotate(calc(var(--spin) * 360deg)); opacity: 0; }
  }
  @keyframes site-effect-rain {
    0% { transform: translateY(-10vh) translateX(0); opacity: 0; }
    5% { opacity: var(--peak, 0.75); }
    92% { opacity: var(--peak, 0.75); }
    100% { transform: translateY(108vh) translateX(var(--drift)); opacity: 0; }
  }
  @keyframes site-effect-bubble {
    0%   { transform: translate(0, 0) scale(0.7); opacity: 0; }
    10%  { opacity: var(--peak, 0.85); }
    40%  { transform: translate(calc(var(--drift) * 0.4), -45vh) scale(0.95); }
    75%  { transform: translate(calc(var(--drift) * -0.3), -85vh) scale(1.05); }
    88%  { opacity: var(--peak, 0.85); }
    100% { transform: translate(var(--drift), -115vh) scale(1.05); opacity: 0; }
  }
  @keyframes site-effect-twinkle {
    0%, 100% { opacity: 0.12; transform: scale(0.6) rotate(0deg); }
    50%      { opacity: 1; transform: scale(1.15) rotate(45deg); }
  }
  @keyframes site-effect-drift {
    0%   { transform: translate(0, 0); }
    50%  { transform: translate(var(--driftx), var(--drifty)); }
    100% { transform: translate(0, 0); }
  }
  @keyframes site-effect-burst-core {
    0% { transform: scale(0.2); opacity: 1; }
    40% { transform: scale(1.6); opacity: 0.6; }
    100% { transform: scale(2.2); opacity: 0; }
  }
  @keyframes site-effect-burst-ray {
    0% { transform: translate(0, 0) scale(1); opacity: 1; }
    70% { opacity: 0.9; }
    100% { transform: translate(var(--tx), calc(var(--ty) + 18px)) scale(0.15); opacity: 0; }
  }
`;

function fallingParticles(count, speed, driftRange = 90) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 10,
    duration: 17 - (speed / 100) * 10 + Math.random() * 5,
    drift: Math.round((Math.random() - 0.5) * driftRange),
    spin: Math.random() > 0.5 ? 1 : -1,
    peak: 0.7 + Math.random() * 0.25,
  }));
}

function SiteEffectLive({ def, density, speed, size }) {
  return (
    <div aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 400, overflow: 'hidden', pointerEvents: 'none' }}>
      <style>{KEYFRAMES}</style>
      {def.kind === 'emoji' && <EmojiLayer glyph={def.glyph} density={density} speed={speed} size={size} up={def.direction === 'up'} />}
      {def.kind === 'snow' && <SnowLayer density={density} speed={speed} size={size} />}
      {def.kind === 'rain' && <RainLayer density={density} speed={speed} size={size} />}
      {def.kind === 'leaf' && <LeafLayer density={density} speed={speed} size={size} />}
      {def.kind === 'petal' && <PetalLayer density={density} speed={speed} size={size} />}
      {def.kind === 'heart' && <HeartLayer density={density} speed={speed} size={size} />}
      {def.kind === 'shamrock' && <ShamrockLayer density={density} speed={speed} size={size} />}
      {def.kind === 'confetti' && <ConfettiLayer density={density} speed={speed} size={size} />}
      {def.kind === 'bubble' && <BubbleLayer density={density} speed={speed} size={size} />}
      {def.kind === 'sparkle' && <SparkleLayer density={density} size={size} palette={def.palette} ambient={def.ambient} />}
      {def.kind === 'firework' && <FireworkLayer density={density} speed={speed} size={size} />}
    </div>
  );
}

function EmojiLayer({ glyph, density, speed, size, up }) {
  const particles = React.useMemo(() => fallingParticles(density, speed), [density, speed]);
  return particles.map((p) => (
    <span
      key={p.id}
      style={{
        position: 'absolute', [up ? 'bottom' : 'top']: 0, left: `${p.left}%`, fontSize: size, lineHeight: 1,
        '--drift': `${p.drift}px`, '--spin': p.spin, '--peak': p.peak,
        animation: `site-effect-sway ${p.duration}s ease-in-out ${p.delay}s infinite${up ? ' reverse' : ''}`,
        willChange: 'transform, opacity', userSelect: 'none',
      }}
    >
      {glyph}
    </span>
  ));
}

// Two depth layers -- a crisp, small, slower-falling "near" layer and a
// larger, softer-blurred, faster "far" layer underneath it -- is the actual
// trick behind that Apple-Weather-style snow look: real falling snow reads
// as depth because flakes at different distances are different sizes and
// different amounts in focus, not because any single flake looks special.
function SnowLayer({ density, speed, size }) {
  const near = React.useMemo(() => (
    fallingParticles(Math.round(density * 0.4), speed * 0.7, 60).map((p) => ({ ...p, dotSize: size * (0.5 + Math.random() * 0.3), blur: 0 }))
  ), [density, speed, size]);
  const far = React.useMemo(() => (
    fallingParticles(Math.round(density * 0.6), speed * 1.3, 100).map((p) => ({ ...p, dotSize: size * (0.7 + Math.random() * 0.6), blur: 1 + Math.random() }))
  ), [density, speed, size]);
  const flake = (p) => (
    <span
      key={p.id}
      style={{
        position: 'absolute', top: 0, left: `${p.left}%`, width: p.dotSize, height: p.dotSize, borderRadius: '50%',
        background: 'radial-gradient(circle at 35% 35%, #fff, rgba(255,255,255,0.6) 55%, transparent 75%)',
        filter: p.blur ? `blur(${p.blur}px)` : undefined,
        '--drift': `${p.drift}px`, '--spin': p.spin, '--peak': p.peak,
        animation: `site-effect-sway ${p.duration}s ease-in-out ${p.delay}s infinite`,
        willChange: 'transform, opacity',
      }}
    />
  );
  return <>{far.map(flake)}{near.map(flake)}</>;
}

// A short, thin, tilted gradient streak falling fast and almost straight
// down, in two depth layers (thin/dim "far" rain behind thicker/brighter
// "near" rain) for the same weather-app depth effect as snow above -- a
// static droplet emoji never looked like rain because rain isn't a droplet
// shape, it's a fast blurred line, and real rain is many different
// distances/intensities at once, not one repeating streak.
function RainLayer({ density, speed, size }) {
  const makeLayer = (count, opacity, widthMul, heightMul, speedMul) => Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 2,
    duration: (0.45 + (1 - speed / 100) * 0.55 + Math.random() * 0.25) / speedMul,
    drift: Math.round((Math.random() - 0.5) * 12),
    peak: opacity,
    width: 1.5 * widthMul,
    height: size * heightMul,
  }));
  const far = React.useMemo(() => makeLayer(Math.round(density * 0.55), 0.4, 0.8, 1.3, 1.15), [density, speed, size]);
  const near = React.useMemo(() => makeLayer(Math.round(density * 0.45), 0.85, 1.2, 2.1, 1), [density, speed, size]);
  const streak = (p) => (
    <span
      key={p.id}
      style={{
        position: 'absolute', top: 0, left: `${p.left}%`, width: p.width, height: p.height,
        background: 'linear-gradient(to bottom, transparent, rgba(180,210,255,0.95))',
        borderRadius: 2, transform: 'rotate(9deg)',
        '--drift': `${p.drift}px`, '--peak': p.peak,
        animation: `site-effect-rain ${p.duration}s linear ${p.delay}s infinite`,
        willChange: 'transform, opacity',
      }}
    />
  );
  return <>{far.map(streak)}{near.map(streak)}</>;
}

// Hand-drawn gradient vector shapes (leaf/petal/heart/shamrock), each with a
// soft drop-shadow glow and a small curated color palette so a batch of them
// looks naturally varied instead of one flat icon repeated. Rendered as
// inline SVG rather than emoji -- full control over color and finish, and
// noticeably crisper/richer than a font glyph at these sizes.
function svgParticle({ id, path, viewBox, gradientStops, glow, p, size }) {
  const gradId = `sfx-grad-${id}`;
  return (
    <span
      key={p.id}
      style={{
        position: 'absolute', top: 0, left: `${p.left}%`, width: size * (0.7 + (p.scale || 0)), height: size * (0.7 + (p.scale || 0)),
        '--drift': `${p.drift}px`, '--spin': p.spin, '--peak': p.peak,
        animation: `site-effect-sway ${p.duration}s ease-in-out ${p.delay}s infinite`,
        willChange: 'transform, opacity', filter: `drop-shadow(0 0 ${size * 0.15}px ${glow})`,
      }}
    >
      <svg viewBox={viewBox} width="100%" height="100%">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            {gradientStops.map((s, i) => <stop key={i} offset={s.offset} stopColor={s.color} />)}
          </linearGradient>
        </defs>
        <path d={path} fill={`url(#${gradId})`} />
      </svg>
    </span>
  );
}

const LEAF_PALETTES = [
  [{ offset: '0%', color: '#f4a534' }, { offset: '100%', color: '#c1440e' }],
  [{ offset: '0%', color: '#e8c547' }, { offset: '100%', color: '#a6631a' }],
  [{ offset: '0%', color: '#d9713c' }, { offset: '100%', color: '#7a2e12' }],
];
function LeafLayer({ density, speed, size }) {
  const particles = React.useMemo(() => (
    fallingParticles(density, speed).map((p, i) => ({ ...p, palette: LEAF_PALETTES[i % LEAF_PALETTES.length], scale: Math.random() * 0.4 }))
  ), [density, speed]);
  return particles.map((p, i) => svgParticle({
    id: `leaf-${i}`, p, size,
    viewBox: '0 0 24 24', glow: 'rgba(193,68,14,0.35)', gradientStops: p.palette,
    path: 'M12 2c5 3 9 7 9 12a9 9 0 0 1-9 9 9 9 0 0 1-9-9c0-5 4-9 9-12z M12 4v18',
  }));
}

const PETAL_PALETTES = [
  [{ offset: '0%', color: '#ffe3ee' }, { offset: '100%', color: '#f582b0' }],
  [{ offset: '0%', color: '#fff0f5' }, { offset: '100%', color: '#e69bc4' }],
  [{ offset: '0%', color: '#ffe9f2' }, { offset: '100%', color: '#d873a8' }],
];
function PetalLayer({ density, speed, size }) {
  const particles = React.useMemo(() => (
    fallingParticles(density, speed).map((p, i) => ({ ...p, palette: PETAL_PALETTES[i % PETAL_PALETTES.length], scale: Math.random() * 0.3 }))
  ), [density, speed]);
  return particles.map((p, i) => svgParticle({
    id: `petal-${i}`, p, size,
    viewBox: '0 0 24 24', glow: 'rgba(245,130,176,0.35)', gradientStops: p.palette,
    path: 'M12 2c4 2 6 6 4 10-2 4-6 4-8 0-2 4-6 4-8 0-2-4 0-8 4-10 2-1 6-1 8 0z',
  }));
}

const HEART_PALETTES = [
  [{ offset: '0%', color: '#ff9bb3' }, { offset: '100%', color: '#e8385c' }],
  [{ offset: '0%', color: '#ffc2d1' }, { offset: '100%', color: '#c81e4a' }],
  [{ offset: '0%', color: '#ff7a99' }, { offset: '100%', color: '#a01238' }],
];
function HeartLayer({ density, speed, size }) {
  const particles = React.useMemo(() => (
    fallingParticles(density, speed, 60).map((p, i) => ({ ...p, palette: HEART_PALETTES[i % HEART_PALETTES.length], scale: Math.random() * 0.35 }))
  ), [density, speed]);
  return particles.map((p, i) => svgParticle({
    id: `heart-${i}`, p, size,
    viewBox: '0 0 24 24', glow: 'rgba(232,56,92,0.4)', gradientStops: p.palette,
    path: 'M12 21s-7.5-4.9-10.2-9.3C.2 8.7 1.6 5 5.2 5c2 0 3.4 1.1 4.1 2.3C10 6.1 11.4 5 13.4 5c3.6 0 5 3.7 3.4 6.7C19.5 16.1 12 21 12 21z',
  }));
}

const SHAMROCK_PALETTES = [
  [{ offset: '0%', color: '#8fe08f' }, { offset: '100%', color: '#1c7a3c' }],
  [{ offset: '0%', color: '#b6f0a8' }, { offset: '100%', color: '#2e8b46' }],
];
function ShamrockLayer({ density, speed, size }) {
  const particles = React.useMemo(() => (
    fallingParticles(density, speed).map((p, i) => ({ ...p, palette: SHAMROCK_PALETTES[i % SHAMROCK_PALETTES.length], scale: Math.random() * 0.3 }))
  ), [density, speed]);
  return particles.map((p, i) => svgParticle({
    id: `shamrock-${i}`, p, size,
    viewBox: '0 0 24 24', glow: 'rgba(46,139,70,0.35)', gradientStops: p.palette,
    path: 'M12 12c-2-3-2-6 0-8 2 2 2 5 0 8zm0 0c-3-2-6-2-8 0 2 2 5 2 8 0zm0 0c2-3 2-6 0-8-2 2-2 5 0 8zm0 0c3-2 6-2 8 0-2 2-5 2-8 0zm0 2v6',
  }));
}

// Small mixed shapes (rectangle ribbon + circle + diamond) in random bright
// hues, instead of a single repeating 🎉 emoji -- real confetti is many
// different colored pieces of different shapes, not one icon falling
// over and over.
function ConfettiLayer({ density, speed, size }) {
  const shapes = ['rect', 'circle', 'diamond'];
  const particles = React.useMemo(() => (
    fallingParticles(density, speed).map((p, i) => ({ ...p, hue: Math.round(Math.random() * 360), shape: shapes[i % shapes.length] }))
  ), [density, speed]);
  return particles.map((p) => {
    const base = {
      position: 'absolute', top: 0, left: `${p.left}%`,
      background: `hsl(${p.hue} 85% 62%)`,
      '--drift': `${p.drift}px`, '--spin': p.spin, '--peak': p.peak,
      animation: `site-effect-sway ${p.duration * 0.7}s ease-in-out ${p.delay}s infinite`,
      willChange: 'transform, opacity',
    };
    if (p.shape === 'circle') return <span key={p.id} style={{ ...base, width: size * 0.4, height: size * 0.4, borderRadius: '50%' }} />;
    if (p.shape === 'diamond') return <span key={p.id} style={{ ...base, width: size * 0.35, height: size * 0.35, transform: 'rotate(45deg)' }} />;
    return <span key={p.id} style={{ ...base, width: size * 0.35, height: size * 0.75, borderRadius: 2 }} />;
  });
}

// Floats upward with a soft rim-lit circle and a small secondary highlight
// dot (the second highlight is what makes a bubble read as glassy/round
// instead of a flat gradient blob), plus a gentle S-curve wobble on the way
// up instead of a straight vertical rise.
function BubbleLayer({ density, speed, size }) {
  const particles = React.useMemo(() => (
    Array.from({ length: density }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 10,
      duration: 15 - (speed / 100) * 8 + Math.random() * 4,
      drift: Math.round((Math.random() - 0.5) * 70),
      peak: 0.7 + Math.random() * 0.2,
      dotSize: size * (0.5 + Math.random() * 0.7),
    }))
  ), [density, speed, size]);
  return particles.map((p) => (
    <span
      key={p.id}
      style={{
        position: 'absolute', bottom: 0, left: `${p.left}%`, width: p.dotSize, height: p.dotSize, borderRadius: '50%',
        background: `
          radial-gradient(circle at 25% 22%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.95) 8%, transparent 12%),
          radial-gradient(circle at 32% 30%, rgba(255,255,255,0.7), rgba(150,220,255,0.18) 65%, rgba(150,220,255,0.05) 100%)
        `,
        border: '1px solid rgba(255,255,255,0.45)',
        '--drift': `${p.drift}px`, '--peak': p.peak,
        animation: `site-effect-bubble ${p.duration}s ease-in-out ${p.delay}s infinite`,
        willChange: 'transform, opacity',
      }}
    />
  ));
}

// Ambient twinkling 4-point "glint" stars scattered across the whole
// viewport (not falling in from an edge like everything else) -- used for
// Summer Sparkle, Fireflies, and Stars, distinguished by palette and by
// `ambient` (fireflies also drift slowly in place, since real fireflies
// wander rather than sitting still between twinkles).
function SparkleLayer({ density, size, palette, ambient }) {
  const particles = React.useMemo(() => (
    Array.from({ length: Math.round(density * 0.55) }, (_, i) => ({
      id: i,
      top: Math.random() * 100,
      left: Math.random() * 100,
      delay: Math.random() * 4,
      duration: 1.8 + Math.random() * 2.5,
      dotSize: size * (0.4 + Math.random() * 0.5),
      color: palette[i % palette.length],
      driftx: Math.round((Math.random() - 0.5) * 60),
      drifty: Math.round((Math.random() - 0.5) * 60),
      driftDuration: 6 + Math.random() * 6,
    }))
  ), [density, size, palette]);
  return particles.map((p) => (
    <span
      key={p.id}
      style={{
        position: 'absolute', top: `${p.top}%`, left: `${p.left}%`, width: p.dotSize, height: p.dotSize,
        animation: ambient
          ? `site-effect-drift ${p.driftDuration}s ease-in-out infinite, site-effect-twinkle ${p.duration}s ease-in-out ${p.delay}s infinite`
          : `site-effect-twinkle ${p.duration}s ease-in-out ${p.delay}s infinite`,
        '--driftx': `${p.driftx}px`, '--drifty': `${p.drifty}px`,
        willChange: 'opacity, transform',
      }}
    >
      <svg viewBox="0 0 24 24" width="100%" height="100%" style={{ filter: `drop-shadow(0 0 ${p.dotSize * 0.6}px ${p.color})` }}>
        <path d="M12 0c.6 4.8 2.4 8.4 5.4 10.6C14.4 12.6 12.6 16.2 12 21c-.6-4.8-2.4-8.4-5.4-10.4C9.6 8.4 11.4 4.8 12 0z" fill={p.color} />
      </svg>
    </span>
  ));
}

// Periodic radial bursts from random points -- a bright core flash that
// expands and fades, plus a ring of glowing sparks flying outward and
// drooping slightly as they fade (real fireworks trail off, they don't just
// vanish in a straight line) -- a proper "fireworks" look, instead of a
// single 🎆 emoji drifting down the screen like everything else. `density`
// controls how many rays each burst has; speed controls how often a new
// burst spawns (capped so this never gets so busy it reads as a solid
// flashing layer).
function FireworkLayer({ density, speed, size }) {
  const [bursts, setBursts] = React.useState([]);
  const rays = Math.max(10, Math.min(28, Math.round(density / 3.5)));

  React.useEffect(() => {
    const intervalMs = Math.max(500, 2600 - (speed / 100) * 2000);
    const id = setInterval(() => {
      const burst = {
        id: `${Date.now()}-${Math.random()}`,
        x: 12 + Math.random() * 76,
        y: 12 + Math.random() * 48,
        hue: Math.round(Math.random() * 360),
      };
      setBursts((prev) => [...prev.slice(-3), burst]);
      setTimeout(() => setBursts((prev) => prev.filter((b) => b.id !== burst.id)), 1300);
    }, intervalMs);
    return () => clearInterval(id);
  }, [speed]);

  return bursts.map((b) => (
    <div key={b.id} style={{ position: 'absolute', top: `${b.y}%`, left: `${b.x}%`, width: 0, height: 0 }}>
      <span
        style={{
          position: 'absolute', top: -size * 0.4, left: -size * 0.4, width: size * 0.8, height: size * 0.8, borderRadius: '50%',
          background: `radial-gradient(circle, hsl(${b.hue} 100% 85%), hsl(${b.hue} 90% 60%) 60%, transparent 75%)`,
          animation: 'site-effect-burst-core 0.6s ease-out forwards',
        }}
      />
      {Array.from({ length: rays }, (_, i) => {
        const angle = (i / rays) * Math.PI * 2 + Math.random() * 0.2;
        const radius = size * (2.2 + Math.random() * 1.2);
        return (
          <span
            key={i}
            style={{
              position: 'absolute', top: 0, left: 0, width: size * 0.16, height: size * 0.16, borderRadius: '50%',
              background: `hsl(${b.hue} 90% 68%)`, boxShadow: `0 0 ${size * 0.35}px hsl(${b.hue} 90% 65%)`,
              '--tx': `${Math.cos(angle) * radius}px`, '--ty': `${Math.sin(angle) * radius}px`,
              animation: 'site-effect-burst-ray 1.15s ease-out forwards',
            }}
          />
        );
      })}
    </div>
  ));
}
