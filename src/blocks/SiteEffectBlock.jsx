import React from 'react';
import { BlockIcon } from '../admin-app/builder/blockIcons.jsx';

// Every preset is just one emoji glyph -- see registry.js's PRESET options
// (kept in sync there) and the safety note on SiteEffectBlock below for why
// that's a deliberate limit, not a missing feature.
export const SITE_EFFECT_PRESETS = {
  snow: { glyph: '❄️', label: 'Snow' },
  rain: { glyph: '💧', label: 'Rain' },
  leaves: { glyph: '🍂', label: 'Autumn Leaves' },
  petals: { glyph: '🌸', label: 'Spring Petals' },
  sunshine: { glyph: '✨', label: 'Summer Sparkle' },
  bubbles: { glyph: '🫧', label: 'Bubbles' },
  butterflies: { glyph: '🦋', label: 'Butterflies' },
  fireflies: { glyph: '🌟', label: 'Fireflies' },
  confetti: { glyph: '🎉', label: 'Confetti' },
  balloons: { glyph: '🎈', label: 'Balloons' },
  hearts: { glyph: '💕', label: "Hearts (Valentine's)" },
  shamrocks: { glyph: '☘️', label: "Shamrocks (St. Patrick's)" },
  eggs: { glyph: '🥚', label: 'Easter Eggs' },
  fireworks: { glyph: '🎆', label: 'Fireworks (4th of July)' },
  stars: { glyph: '⭐', label: 'Stars' },
  pumpkins: { glyph: '🎃', label: 'Pumpkins (Halloween)' },
  bats: { glyph: '🦇', label: 'Bats (Halloween)' },
  ghosts: { glyph: '👻', label: 'Ghosts (Halloween)' },
  turkeys: { glyph: '🦃', label: 'Turkeys (Thanksgiving)' },
  ornaments: { glyph: '🎄', label: 'Christmas' },
  santa: { glyph: '🎅', label: 'Santa' },
  hanukkah: { glyph: '🕎', label: 'Hanukkah' },
  gradcaps: { glyph: '🎓', label: 'Graduation' },
};

export const SITE_EFFECT_PRESET_OPTIONS = [
  ...Object.entries(SITE_EFFECT_PRESETS).map(([value, p]) => ({ value, label: p.label })),
  { value: 'custom', label: 'Custom emoji…' },
];

// Chromeless (registry.js) -- a purely decorative animated overlay across
// the whole site. Deliberately built so an admin CAN'T turn this into a
// full-bleed background image/video sitting on top of the page, which was
// an explicit ask, not an oversight:
//   - No image/video/file field exists on this block at all -- the only
//     visual input is a single emoji/character glyph.
//   - The overlay container is always `pointer-events: none`, so it can
//     never block a click or a tap regardless of any setting here.
//   - Density and size are both hard-capped (see the clamps in
//     SiteEffectLive below) independent of whatever's actually stored, so a
//     bad/stale value can't produce enough coverage to read as a solid layer.
//   - The container itself never gets a background color/image of its own --
//     only small individual glyphs move across a fully transparent field.
export function SiteEffectBlock({ preset = 'snow', customGlyph = '', density = 40, speed = 50, size = 24, editable, onFieldChange }) {
  const preview = preset === 'custom' ? (customGlyph || '✨') : (SITE_EFFECT_PRESETS[preset]?.glyph || SITE_EFFECT_PRESETS.snow.glyph);

  if (editable) {
    return (
      <div style={{ display: 'flex', gap: 'var(--space-3)', padding: 'var(--space-3)', border: '1px dashed var(--border-default)', borderRadius: 'var(--radius-md)', background: 'var(--surface-sunken)' }}>
        <span style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', background: 'var(--tint-info-bg)', color: 'var(--brand-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18 }}>
          {preview}
        </span>
        <div>
          <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 'var(--fw-bold)', fontSize: 'var(--fs-small)', color: 'var(--text-primary)' }}>
            Site Effect
          </div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)' }}>
            {preview} drifts across every page on the live site — a decorative overlay that never blocks clicking or reading. Doesn't take up space here in the block list.
          </div>
        </div>
      </div>
    );
  }

  if (!preview) return null;
  const clampedDensity = Math.max(5, Math.min(120, density));
  const clampedSize = Math.max(10, Math.min(60, size));
  const clampedSpeed = Math.max(10, Math.min(100, speed));
  return <SiteEffectLive glyph={preview} density={clampedDensity} speed={clampedSpeed} size={clampedSize} />;
}

function SiteEffectLive({ glyph, density, speed, size }) {
  const particles = React.useMemo(() => (
    Array.from({ length: density }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 10,
      duration: 16 - (speed / 100) * 10 + Math.random() * 4,
      drift: Math.round((Math.random() - 0.5) * 80),
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- regenerated only when the count/speed actually change, not on every render
  ), [density, speed]);

  return (
    <div aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 400, overflow: 'hidden', pointerEvents: 'none' }}>
      <style>{`
        @keyframes site-effect-fall {
          0% { transform: translateY(-10vh) translateX(0) rotate(0deg); opacity: 0; }
          8% { opacity: 0.9; }
          92% { opacity: 0.9; }
          100% { transform: translateY(110vh) translateX(var(--drift)) rotate(360deg); opacity: 0; }
        }
      `}</style>
      {particles.map((p) => (
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
      ))}
    </div>
  );
}
