import React from 'react';
import { BlockIcon } from '../admin-app/builder/blockIcons.jsx';

// Every preset renders as one of a few particle "kinds" -- a literal falling
// emoji reads fine for a leaf or a pumpkin, but looks cheap for things like
// rain or snow (a static teardrop/snowflake glyph just doesn't move or look
// like the real thing). Those get a dedicated CSS-drawn shape instead (see
// KIND_RENDERERS below); everything else still uses its emoji, which is
// exactly what it looks like anyway.
export const SITE_EFFECT_PRESETS = {
  snow: { kind: 'snow', label: 'Snow' },
  rain: { kind: 'rain', label: 'Rain' },
  leaves: { kind: 'emoji', glyph: '🍂', label: 'Autumn Leaves' },
  petals: { kind: 'emoji', glyph: '🌸', label: 'Spring Petals' },
  sparkle: { kind: 'sparkle', color: '#fff3b0', label: 'Summer Sparkle' },
  bubbles: { kind: 'bubble', label: 'Bubbles' },
  butterflies: { kind: 'emoji', glyph: '🦋', label: 'Butterflies' },
  fireflies: { kind: 'sparkle', color: '#d4ff7a', label: 'Fireflies' },
  confetti: { kind: 'confetti', label: 'Confetti' },
  balloons: { kind: 'emoji', glyph: '🎈', label: 'Balloons' },
  hearts: { kind: 'emoji', glyph: '💕', label: "Hearts (Valentine's)" },
  shamrocks: { kind: 'emoji', glyph: '☘️', label: "Shamrocks (St. Patrick's)" },
  eggs: { kind: 'emoji', glyph: '🥚', label: 'Easter Eggs' },
  fireworks: { kind: 'firework', label: 'Fireworks (4th of July)' },
  stars: { kind: 'sparkle', color: '#e8e8ff', label: 'Stars' },
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

// Chromeless (registry.js) -- a purely decorative animated overlay across
// the whole site. Deliberately built so an admin CAN'T turn this into a
// full-bleed background image/video sitting on top of the page, which was
// an explicit ask, not an oversight:
//   - No image/video/file field exists on this block at all -- every preset
//     is either an emoji glyph or one of a handful of small CSS shapes.
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
  const previewGlyph = def.kind === 'emoji' ? def.glyph : { snow: '❄️', rain: '🌧️', sparkle: '✨', bubble: '🫧', confetti: '🎊', firework: '🎆' }[def.kind];

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

const KEYFRAMES = `
  @keyframes site-effect-fall {
    0% { transform: translateY(-10vh) translateX(0) rotate(0deg); opacity: 0; }
    8% { opacity: 0.9; }
    92% { opacity: 0.9; }
    100% { transform: translateY(110vh) translateX(var(--drift)) rotate(360deg); opacity: 0; }
  }
  @keyframes site-effect-rain {
    0% { transform: translateY(-10vh) translateX(0); opacity: 0; }
    5% { opacity: 0.7; }
    95% { opacity: 0.7; }
    100% { transform: translateY(110vh) translateX(var(--drift)); opacity: 0; }
  }
  @keyframes site-effect-confetti {
    0% { transform: translateY(-10vh) translateX(0) rotate(0deg); opacity: 0; }
    8% { opacity: 1; }
    92% { opacity: 1; }
    100% { transform: translateY(110vh) translateX(var(--drift)) rotate(720deg); opacity: 0; }
  }
  @keyframes site-effect-bubble {
    0% { transform: translateY(0) translateX(0) scale(0.7); opacity: 0; }
    10% { opacity: 0.85; }
    85% { opacity: 0.85; }
    100% { transform: translateY(-115vh) translateX(var(--drift)) scale(1.05); opacity: 0; }
  }
  @keyframes site-effect-sparkle {
    0%, 100% { opacity: 0.1; transform: scale(0.7); }
    50% { opacity: 1; transform: scale(1.2); }
  }
  @keyframes site-effect-burst {
    0% { transform: translate(0, 0) scale(1); opacity: 1; }
    100% { transform: translate(var(--tx), var(--ty)) scale(0.2); opacity: 0; }
  }
`;

// Falling emoji, rain streaks, snow, confetti, and bubbles all share the
// same "N particles, each with its own random left/delay/duration/drift"
// setup -- only the actual rendered shape (and which axis/direction it
// travels) differs per kind.
function fallingParticles(count, speed) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 10,
    duration: 16 - (speed / 100) * 10 + Math.random() * 4,
    drift: Math.round((Math.random() - 0.5) * 80),
  }));
}

function SiteEffectLive({ def, density, speed, size }) {
  return (
    <div aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 400, overflow: 'hidden', pointerEvents: 'none' }}>
      <style>{KEYFRAMES}</style>
      {def.kind === 'emoji' && <EmojiLayer glyph={def.glyph} density={density} speed={speed} size={size} />}
      {def.kind === 'snow' && <SnowLayer density={density} speed={speed} size={size} />}
      {def.kind === 'rain' && <RainLayer density={density} speed={speed} size={size} />}
      {def.kind === 'confetti' && <ConfettiLayer density={density} speed={speed} size={size} />}
      {def.kind === 'bubble' && <BubbleLayer density={density} speed={speed} size={size} />}
      {def.kind === 'sparkle' && <SparkleLayer density={density} size={size} color={def.color} />}
      {def.kind === 'firework' && <FireworkLayer density={density} speed={speed} size={size} />}
    </div>
  );
}

function EmojiLayer({ glyph, density, speed, size }) {
  const particles = React.useMemo(() => fallingParticles(density, speed), [density, speed]);
  return particles.map((p) => (
    <span
      key={p.id}
      style={{
        position: 'absolute', top: 0, left: `${p.left}%`, fontSize: size, lineHeight: 1,
        '--drift': `${p.drift}px`,
        animation: `site-effect-fall ${p.duration}s linear ${p.delay}s infinite`,
        willChange: 'transform, opacity', userSelect: 'none',
      }}
    >
      {glyph}
    </span>
  ));
}

// A soft, blurred, off-white circle instead of a static ❄️ glyph -- reads as
// an out-of-focus snowflake at a distance, which is closer to how falling
// snow actually looks than one crisp repeating icon ever could.
function SnowLayer({ density, speed, size }) {
  const particles = React.useMemo(() => (
    fallingParticles(density, speed).map((p) => ({ ...p, dotSize: size * (0.4 + Math.random() * 0.6), blur: Math.random() * 1.2 }))
  ), [density, speed, size]);
  return particles.map((p) => (
    <span
      key={p.id}
      style={{
        position: 'absolute', top: 0, left: `${p.left}%`, width: p.dotSize, height: p.dotSize, borderRadius: '50%',
        background: 'radial-gradient(circle at 35% 35%, #fff, rgba(255,255,255,0.55) 60%, transparent 75%)',
        filter: `blur(${p.blur}px)`,
        '--drift': `${p.drift}px`,
        animation: `site-effect-fall ${p.duration}s linear ${p.delay}s infinite`,
        willChange: 'transform, opacity',
      }}
    />
  ));
}

// A short, thin, tilted gradient streak falling fast and nearly straight
// down -- this is the fix for "the rain looks stupid": a static droplet
// emoji never looked like rain because rain isn't a droplet shape, it's a
// fast-moving line. Faster/near-vertical (a slight drift only) and much
// shorter cycle time than the other kinds, on purpose.
function RainLayer({ density, speed, size }) {
  const particles = React.useMemo(() => (
    Array.from({ length: density }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 2,
      duration: 0.5 + (1 - speed / 100) * 0.6 + Math.random() * 0.3,
      drift: Math.round((Math.random() - 0.5) * 15),
    }))
  ), [density, speed]);
  const streakHeight = size * 1.8;
  return particles.map((p) => (
    <span
      key={p.id}
      style={{
        position: 'absolute', top: 0, left: `${p.left}%`, width: 2, height: streakHeight,
        background: 'linear-gradient(to bottom, transparent, rgba(170,205,255,0.9))',
        borderRadius: 2, transform: 'rotate(8deg)',
        '--drift': `${p.drift}px`,
        animation: `site-effect-rain ${p.duration}s linear ${p.delay}s infinite`,
        willChange: 'transform, opacity',
      }}
    />
  ));
}

// Small rotating rectangles in random bright hues, instead of a single
// repeating 🎉 emoji -- real confetti is many different colored pieces, not
// one icon falling over and over.
function ConfettiLayer({ density, speed, size }) {
  const particles = React.useMemo(() => (
    fallingParticles(density, speed).map((p) => ({ ...p, hue: Math.round(Math.random() * 360) }))
  ), [density, speed]);
  return particles.map((p) => (
    <span
      key={p.id}
      style={{
        position: 'absolute', top: 0, left: `${p.left}%`, width: size * 0.4, height: size * 0.7,
        background: `hsl(${p.hue} 85% 60%)`, borderRadius: 2,
        '--drift': `${p.drift}px`,
        animation: `site-effect-confetti ${p.duration}s linear ${p.delay}s infinite`,
        willChange: 'transform, opacity',
      }}
    />
  ));
}

// Floats upward from the bottom of the screen (the only "up" kind here)
// with a soft rim-lit circle instead of the 🫧 emoji, which mostly just
// looks like a gray blob at small sizes.
function BubbleLayer({ density, speed, size }) {
  const particles = React.useMemo(() => (
    Array.from({ length: density }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 10,
      duration: 14 - (speed / 100) * 8 + Math.random() * 4,
      drift: Math.round((Math.random() - 0.5) * 60),
      dotSize: size * (0.5 + Math.random() * 0.7),
    }))
  ), [density, speed, size]);
  return particles.map((p) => (
    <span
      key={p.id}
      style={{
        position: 'absolute', bottom: 0, left: `${p.left}%`, width: p.dotSize, height: p.dotSize, borderRadius: '50%',
        background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.9), rgba(150,220,255,0.2) 65%, rgba(150,220,255,0.05) 100%)',
        border: '1px solid rgba(255,255,255,0.4)',
        '--drift': `${p.drift}px`,
        animation: `site-effect-bubble ${p.duration}s linear ${p.delay}s infinite`,
        willChange: 'transform, opacity',
      }}
    />
  ));
}

// Ambient twinkling dots scattered across the whole viewport (not falling
// in from one edge like everything else) -- used for "Summer Sparkle",
// "Fireflies", and "Stars", distinguished only by color.
function SparkleLayer({ density, size, color }) {
  const particles = React.useMemo(() => (
    Array.from({ length: Math.round(density * 0.6) }, (_, i) => ({
      id: i,
      top: Math.random() * 100,
      left: Math.random() * 100,
      delay: Math.random() * 4,
      duration: 2 + Math.random() * 2.5,
      dotSize: size * (0.15 + Math.random() * 0.2),
    }))
  ), [density, size]);
  return particles.map((p) => (
    <span
      key={p.id}
      style={{
        position: 'absolute', top: `${p.top}%`, left: `${p.left}%`, width: p.dotSize, height: p.dotSize, borderRadius: '50%',
        background: color, boxShadow: `0 0 ${size * 0.5}px ${size * 0.2}px ${color}`,
        animation: `site-effect-sparkle ${p.duration}s ease-in-out ${p.delay}s infinite`,
        willChange: 'opacity, transform',
      }}
    />
  ));
}

// Periodic radial bursts from random points, each a ring of small dots
// animating outward and fading -- a real "fireworks" look, instead of a
// single 🎆 emoji just falling down the screen like everything else.
// `density` controls how many rays each burst has; speed controls how
// often a new burst spawns (capped so this never gets so busy it reads as
// a solid flashing layer).
function FireworkLayer({ density, speed, size }) {
  const [bursts, setBursts] = React.useState([]);
  const rays = Math.max(8, Math.min(24, Math.round(density / 4)));

  React.useEffect(() => {
    const intervalMs = Math.max(500, 2600 - (speed / 100) * 2000);
    const id = setInterval(() => {
      const burst = {
        id: `${Date.now()}-${Math.random()}`,
        x: 15 + Math.random() * 70,
        y: 15 + Math.random() * 50,
        hue: Math.round(Math.random() * 360),
      };
      setBursts((prev) => [...prev.slice(-3), burst]);
      setTimeout(() => {
        setBursts((prev) => prev.filter((b) => b.id !== burst.id));
      }, 1200);
    }, intervalMs);
    return () => clearInterval(id);
  }, [speed]);

  return bursts.map((b) => (
    <div key={b.id} style={{ position: 'absolute', top: `${b.y}%`, left: `${b.x}%`, width: 0, height: 0 }}>
      {Array.from({ length: rays }, (_, i) => {
        const angle = (i / rays) * Math.PI * 2;
        const radius = size * (2 + Math.random());
        return (
          <span
            key={i}
            style={{
              position: 'absolute', top: 0, left: 0, width: size * 0.18, height: size * 0.18, borderRadius: '50%',
              background: `hsl(${b.hue} 90% 65%)`, boxShadow: `0 0 ${size * 0.3}px hsl(${b.hue} 90% 65%)`,
              '--tx': `${Math.cos(angle) * radius}px`, '--ty': `${Math.sin(angle) * radius}px`,
              animation: 'site-effect-burst 1.1s ease-out forwards',
            }}
          />
        );
      })}
    </div>
  ));
}
