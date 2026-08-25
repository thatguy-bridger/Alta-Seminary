import React from 'react';

// Rendered on a single <canvas> (see SiteEffectLive below), not DOM+CSS
// spans -- this rewrite followed a look at how real particle-effect
// libraries actually do it (tsParticles' snow/fireworks presets,
// canvas-confetti): canvas is what lets hundreds of particles move smoothly
// with real glow/gradients, and -- the actual point of switching -- it's
// what makes an "instant, already-populated" scene possible. The old
// DOM/CSS-keyframe version always started every particle off-screen at one
// edge with a random animation-delay, which reads as a slow "things
// trickling in" loading moment before the effect looks full. Canvas
// particles are seeded across the ENTIRE height on the very first frame
// (see initParticles below) and just wrap around forever after that, so the
// effect is fully there the instant it mounts.
export const SITE_EFFECT_PRESETS = {
  snow: { kind: 'snow', label: 'Snow' },
  rain: { kind: 'rain', label: 'Rain' },
  leaves: { kind: 'leaf', label: 'Autumn Leaves' },
  petals: { kind: 'petal', label: 'Spring Petals' },
  sparkle: { kind: 'glint', palette: ['#fff6cf', '#ffe9a8', '#ffffff'], label: 'Summer Sparkle' },
  bubbles: { kind: 'bubble', label: 'Bubbles' },
  butterflies: { kind: 'emoji', glyph: '🦋', label: 'Butterflies' },
  fireflies: { kind: 'glint', palette: ['#e8ff9e', '#c6f26a', '#fff9d0'], label: 'Fireflies', ambient: true },
  confetti: { kind: 'confetti', label: 'Confetti' },
  balloons: { kind: 'emoji', glyph: '🎈', label: 'Balloons', direction: 'up' },
  hearts: { kind: 'heart', label: "Hearts (Valentine's)" },
  shamrocks: { kind: 'shamrock', label: "Shamrocks (St. Patrick's)" },
  eggs: { kind: 'emoji', glyph: '🥚', label: 'Easter Eggs' },
  fireworks: { kind: 'firework', label: 'Fireworks (4th of July)' },
  stars: { kind: 'glint', palette: ['#ffffff', '#dfe7ff', '#c7d2ff'], label: 'Stars', ambient: true },
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

const PREVIEW_GLYPH = { snow: '❄️', rain: '🌧️', glint: '✨', bubble: '🫧', confetti: '🎊', firework: '🎆', leaf: '🍂', petal: '🌸', heart: '💕', shamrock: '☘️' };

// Chromeless (registry.js) -- a purely decorative animated overlay across
// the whole site. Deliberately built so an admin CAN'T turn this into a
// full-bleed background image/video sitting on top of the page, which was
// an explicit ask, not an oversight:
//   - No image/video/file field exists on this block at all -- every preset
//     is either an emoji glyph or one of a handful of hand-drawn canvas shapes.
//   - The canvas is always `pointer-events: none`, so it can never block a
//     click or a tap regardless of any setting here.
//   - Density and size are both hard-capped (see the clamps below)
//     independent of whatever's actually stored, so a bad/stale value can't
//     produce enough coverage to read as a solid layer.
//   - Nothing here ever paints a background color/image across the canvas --
//     only small individual particles on an otherwise fully transparent one.
export function SiteEffectBlock({
  preset = 'snow', customGlyph = '', density = 40, speed = 50, size = 24,
  reverseDirection = false, wind = 0, opacity = 90, interactive = false,
  editable,
}) {
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
            Fills the whole screen on every page on the live site — a decorative overlay that never blocks clicking or reading. Doesn't take up space here in the block list.
          </div>
        </div>
      </div>
    );
  }

  if (def.kind === 'emoji' && !def.glyph) return null;
  const clampedDensity = Math.max(5, Math.min(120, density));
  const clampedSize = Math.max(10, Math.min(60, size));
  const clampedSpeed = Math.max(10, Math.min(100, speed));
  const clampedWind = Math.max(-100, Math.min(100, wind));
  const clampedOpacity = Math.max(0.2, Math.min(1, opacity / 100));
  return (
    <SiteEffectCanvas
      def={def} density={clampedDensity} speed={clampedSpeed} size={clampedSize}
      reverseDirection={!!reverseDirection} wind={clampedWind} opacity={clampedOpacity} interactive={!!interactive}
    />
  );
}

function rand(min, max) { return min + Math.random() * (max - min); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// --- Per-kind particle factories -------------------------------------
// Each returns { init(w,h,spawnFull), step(p,dt,w,h), draw(ctx,p) }.
// `init`'s spawnFull=true (only used the very first time, and again after a
// resize) seeds `p.y` (or `p.top`, for ambient kinds) anywhere across the
// FULL height/viewport instead of just above it -- that's the whole fix for
// "instant effects, no loading wait". Every subsequent respawn (wrapping
// after leaving the screen) uses spawnFull=false, which puts it back at the
// proper off-screen edge, exactly like real snow/rain/confetti continuously
// replenishing itself.

// `dt` throughout this file is in SECONDS (the RAF loops below convert once
// per frame), so every velocity here is a plain px/second or radians/second
// -- no ad-hoc per-frame fudge factors. Horizontal sway is computed fresh
// each frame as `baseX + sin(...)`, an OFFSET from a fixed anchor, not
// accumulated by `+=` every frame -- accumulating it would have compounded
// forever into runaway horizontal drift instead of a bounded side-to-side sway.
// `wind` is a constant horizontal bias (px/second) on top of the sway --
// tracked as its own accumulator (`windOffset`) separate from the sway
// term, added together in the final x each frame, so it stacks cleanly
// instead of fighting the sway's own oscillation.
//
// `held`/`repelX`/`repelY` are the interactive layer's doing (see
// SiteEffectCanvas) -- grabbing a particle freezes its normal x/y formula
// and lets the pointer drive it directly; repelX/Y is a decaying offset
// added on release (a little "toss") or from ambient cursor avoidance.
// Every factory below leaves room for both without needing to know
// anything about interactivity itself.
function fallFactory({ speed, size, sway = 40, spin = true, wind = 0 }) {
  return {
    make(w, h, spawnFull) {
      const duration = rand(9, 16) * (1 - (speed / 100) * 0.55); // seconds to cross the full height
      const baseX = rand(0, w);
      return {
        baseX, x: baseX, windOffset: 0,
        y: spawnFull ? rand(-size, h) : -rand(size, size * 2),
        vy: h / duration,
        swayAmp: rand(sway * 0.4, sway),
        swayFreq: rand(0.3, 0.8),
        phase: rand(0, Math.PI * 2),
        rot: rand(0, Math.PI * 2),
        rotSpeed: spin ? rand(-1.4, 1.4) : 0,
        scale: rand(0.7, 1.3),
        t: 0, held: false, repelX: 0, repelY: 0,
      };
    },
    step(p, dt, w, h) {
      if (p.held) return false; // pointer is driving x/y directly this frame
      p.t += dt;
      p.y += p.vy * dt;
      p.windOffset += wind * dt;
      p.x = p.baseX + p.windOffset + Math.sin(p.t * p.swayFreq + p.phase) * p.swayAmp;
      p.rot += p.rotSpeed * dt;
      if (p.y > h + size * 2) return true; // needs respawn
      return false;
    },
  };
}

function riseFactory({ speed, size, sway = 30, wind = 0 }) {
  return {
    make(w, h, spawnFull) {
      const duration = rand(10, 16) * (1 - (speed / 100) * 0.5);
      const baseX = rand(0, w);
      return {
        baseX, x: baseX, windOffset: 0,
        y: spawnFull ? rand(0, h + size) : h + rand(size, size * 2),
        vy: -h / duration,
        swayAmp: rand(sway * 0.4, sway),
        swayFreq: rand(0.2, 0.6),
        phase: rand(0, Math.PI * 2),
        scale: rand(0.6, 1.3),
        rot: rand(-0.3, 0.3), // a fixed gentle tilt (a rising balloon doesn't spin like a falling leaf)
        t: 0, held: false, repelX: 0, repelY: 0,
      };
    },
    step(p, dt, w, h) {
      if (p.held) return false;
      p.t += dt;
      p.y += p.vy * dt;
      p.windOffset += wind * dt;
      p.x = p.baseX + p.windOffset + Math.sin(p.t * p.swayFreq + p.phase) * p.swayAmp;
      if (p.y < -size * 2) return true;
      return false;
    },
  };
}

function ambientFactory({ drift = 0 }) {
  return {
    make(w, h) {
      return {
        x: rand(0, w),
        y: rand(0, h),
        vx: rand(-drift, drift),
        vy: rand(-drift, drift),
        twinklePhase: rand(0, Math.PI * 2),
        twinkleSpeed: rand(0.6, 1.4),
        scale: rand(0.6, 1.3),
        t: rand(0, 10),
      };
    },
    step(p, dt, w, h) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x < -10) p.x = w + 10;
      if (p.x > w + 10) p.x = -10;
      if (p.y < -10) p.y = h + 10;
      if (p.y > h + 10) p.y = -10;
      return false;
    },
  };
}

// --- Drawing routines ---------------------------------------------------
// Real vector shapes drawn with actual bezier curves + gradients + glow,
// not font glyphs -- this is what makes Leaves/Petals/Hearts/Shamrocks look
// like a designed graphic instead of a repeated emoji.

function drawLeaf(ctx, p, size, opacity) {
  ctx.globalAlpha = opacity;
  const s = size * p.scale;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  const g = ctx.createLinearGradient(-s / 2, -s / 2, s / 2, s / 2);
  g.addColorStop(0, p.c1);
  g.addColorStop(1, p.c2);
  ctx.fillStyle = g;
  ctx.shadowColor = p.c2;
  ctx.shadowBlur = s * 0.35;
  ctx.beginPath();
  ctx.moveTo(0, -s / 2);
  ctx.bezierCurveTo(s / 2, -s / 3, s / 2, s / 4, 0, s / 2);
  ctx.bezierCurveTo(-s / 2, s / 4, -s / 2, -s / 3, 0, -s / 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = Math.max(0.6, s * 0.03);
  ctx.beginPath();
  ctx.moveTo(0, -s / 2.1);
  ctx.lineTo(0, s / 2.1);
  ctx.stroke();
  ctx.restore();
}

function drawPetal(ctx, p, size, opacity) {
  ctx.globalAlpha = opacity;
  const s = size * p.scale;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  const g = ctx.createRadialGradient(0, -s * 0.15, s * 0.05, 0, 0, s * 0.6);
  g.addColorStop(0, p.c1);
  g.addColorStop(1, p.c2);
  ctx.fillStyle = g;
  ctx.shadowColor = p.c2;
  ctx.shadowBlur = s * 0.3;
  ctx.beginPath();
  ctx.moveTo(0, -s / 2);
  ctx.quadraticCurveTo(s / 2.2, -s / 6, 0, s / 2);
  ctx.quadraticCurveTo(-s / 2.2, -s / 6, 0, -s / 2);
  ctx.fill();
  ctx.restore();
}

function drawHeart(ctx, p, size, opacity) {
  ctx.globalAlpha = opacity;
  const s = size * p.scale * (1 + Math.sin(p.t * 3) * 0.06);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot * 0.3);
  const g = ctx.createLinearGradient(0, -s / 2, 0, s / 2);
  g.addColorStop(0, p.c1);
  g.addColorStop(1, p.c2);
  ctx.fillStyle = g;
  ctx.shadowColor = p.c2;
  ctx.shadowBlur = s * 0.4;
  ctx.beginPath();
  ctx.moveTo(0, s * 0.35);
  ctx.bezierCurveTo(-s * 0.55, -s * 0.15, -s * 0.3, -s * 0.55, 0, -s * 0.18);
  ctx.bezierCurveTo(s * 0.3, -s * 0.55, s * 0.55, -s * 0.15, 0, s * 0.35);
  ctx.fill();
  ctx.restore();
}

function drawShamrock(ctx, p, size, opacity) {
  ctx.globalAlpha = opacity;
  const s = size * p.scale;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  const g = ctx.createLinearGradient(-s / 2, -s / 2, s / 2, s / 2);
  g.addColorStop(0, p.c1);
  g.addColorStop(1, p.c2);
  ctx.fillStyle = g;
  ctx.shadowColor = p.c2;
  ctx.shadowBlur = s * 0.3;
  const leafR = s * 0.28;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * leafR * 0.9, Math.sin(a) * leafR * 0.9, leafR, leafR * 0.75, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.strokeStyle = p.c2;
  ctx.lineWidth = Math.max(1, s * 0.06);
  ctx.beginPath();
  ctx.moveTo(0, leafR * 0.6);
  ctx.lineTo(0, s * 0.55);
  ctx.stroke();
  ctx.restore();
}

// Two depth layers: crisp 6-branch crystal flakes up close, soft round
// bokeh circles farther back -- the actual "designed" snow look, rather
// than one repeated shape.
function drawSnow(ctx, p, size, opacity) {
  ctx.globalAlpha = opacity;
  const s = size * p.scale;
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.far) {
    ctx.filter = `blur(${s * 0.12}px)`;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 0.5);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.rotate(p.rot);
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = Math.max(0.8, s * 0.06);
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = s * 0.3;
    for (let i = 0; i < 6; i++) {
      ctx.save();
      ctx.rotate((i / 6) * Math.PI * 2);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, s * 0.5);
      ctx.moveTo(0, s * 0.28);
      ctx.lineTo(s * 0.12, s * 0.4);
      ctx.moveTo(0, s * 0.28);
      ctx.lineTo(-s * 0.12, s * 0.4);
      ctx.stroke();
      ctx.restore();
    }
  }
  ctx.restore();
}

function drawRain(ctx, p, size, opacity) {
  ctx.globalAlpha = opacity;
  ctx.save();
  ctx.strokeStyle = p.far ? 'rgba(170,205,255,0.35)' : 'rgba(190,220,255,0.85)';
  ctx.lineWidth = p.far ? 1 : 1.8;
  ctx.lineCap = 'round';
  const len = size * (p.far ? 1.1 : 1.9);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + len * 0.18, p.y + len);
  ctx.stroke();
  ctx.restore();
}

function drawBubble(ctx, p, size, opacity) {
  ctx.globalAlpha = opacity;
  const s = size * p.scale;
  ctx.save();
  ctx.translate(p.x, p.y);
  const g = ctx.createRadialGradient(-s * 0.15, -s * 0.2, s * 0.05, 0, 0, s * 0.5);
  g.addColorStop(0, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.7, 'rgba(160,220,255,0.15)');
  g.addColorStop(1, 'rgba(160,220,255,0.03)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.arc(-s * 0.18, -s * 0.2, s * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawConfetti(ctx, p, size, opacity) {
  ctx.globalAlpha = opacity;
  const s = size * p.scale;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  ctx.scale(Math.cos(p.rot * 2) || 0.05, 1); // simulated paper-flip tumble
  ctx.fillStyle = p.color;
  if (p.shape === 'circle') {
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.22, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.shape === 'triangle') {
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.25);
    ctx.lineTo(s * 0.22, s * 0.2);
    ctx.lineTo(-s * 0.22, s * 0.2);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillRect(-s * 0.18, -s * 0.32, s * 0.36, s * 0.64);
  }
  ctx.restore();
}

// A 4-point glint star drawn as two crossed diamonds -- used for Summer
// Sparkle/Fireflies/Stars, distinguished by palette + whether they drift.
function drawGlint(ctx, p, opacity) {
  const alpha = 0.15 + Math.abs(Math.sin(p.t * p.twinkleSpeed + p.twinklePhase)) * 0.85;
  const s = 10 * p.scale * (0.6 + alpha * 0.5);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.globalAlpha = alpha * opacity;
  ctx.fillStyle = p.color;
  ctx.shadowColor = p.color;
  ctx.shadowBlur = s * 1.4;
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.quadraticCurveTo(s * 0.15, -s * 0.15, s, 0);
  ctx.quadraticCurveTo(s * 0.15, s * 0.15, 0, s);
  ctx.quadraticCurveTo(-s * 0.15, s * 0.15, -s, 0);
  ctx.quadraticCurveTo(-s * 0.15, -s * 0.15, 0, -s);
  ctx.fill();
  ctx.restore();
}

function drawEmoji(ctx, p, glyph, size, opacity) {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot * 0.4);
  ctx.font = `${size * p.scale}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(glyph, 0, 0);
  ctx.restore();
}

const LEAF_PALETTES = [['#f4a534', '#c1440e'], ['#e8c547', '#a6631a'], ['#d9713c', '#7a2e12']];
const PETAL_PALETTES = [['#ffe3ee', '#f582b0'], ['#fff0f5', '#e69bc4'], ['#ffe9f2', '#d873a8']];
const HEART_PALETTES = [['#ff9bb3', '#e8385c'], ['#ffc2d1', '#c81e4a'], ['#ff7a99', '#a01238']];
const SHAMROCK_PALETTES = [['#8fe08f', '#1c7a3c'], ['#b6f0a8', '#2e8b46']];
const CONFETTI_SHAPES = ['rect', 'circle', 'triangle'];

// Sets up (and later restores) one particle system per canvas mount, based
// on `def.kind`. `resize` re-seeds every particle with spawnFull=true, so
// the "instant, already-populated" scene holds true even if the browser
// window is resized mid-effect, not just on first mount.
//
// `grabbable`/`pop`/`attract` describe how the interactive layer (see
// SiteEffectCanvas) should treat a hit on this kind's particles:
//   - grabbable: click-and-drag picks one up and tosses it back on release
//     (leaves, petals, hearts, shamrocks, confetti, snow, emoji all support
//     this -- "grab a leaf" was the explicit ask).
//   - pop: click removes it immediately with a little burst instead of
//     grabbing (bubbles -- dragging a bubble doesn't make sense, popping does).
//   - attract: ambient kinds (fireflies/sparkle/stars) are gently drawn
//     TOWARD the cursor instead of avoiding it, like real fireflies curious
//     about you, rather than skittish.
// Rain has none of these (real rain is too fast/thin to meaningfully grab).
function buildSystem(def, density, speed, size, reverseDirection, wind) {
  switch (def.kind) {
    case 'snow': {
      const factoryFor = (opts) => (reverseDirection ? riseFactory(opts) : fallFactory(opts));
      const near = factoryFor({ speed, size, sway: 30, wind });
      const far = factoryFor({ speed: speed * 1.4, size: size * 1.3, sway: 45, wind });
      const nearCount = Math.round(density * 0.4);
      return {
        grabbable: true,
        makeAll(w, h, spawnFull) {
          return [
            ...Array.from({ length: nearCount }, () => ({ ...near.make(w, h, spawnFull), far: false, factory: near })),
            ...Array.from({ length: density - nearCount }, () => ({ ...far.make(w, h, spawnFull), far: true, factory: far })),
          ];
        },
        step: (p, dt, w, h) => p.factory.step(p, dt, w, h),
        respawn: (p, w, h) => Object.assign(p, p.factory.make(w, h, false), { far: p.far, factory: p.factory }),
        draw: (ctx, p, opacity) => drawSnow(ctx, p, size, opacity),
      };
    }
    case 'rain': {
      const near = fallFactory({ speed: speed * 2.2, size, sway: 3, spin: false, wind: wind * 0.3 });
      const far = fallFactory({ speed: speed * 2.8, size: size * 0.8, sway: 2, spin: false, wind: wind * 0.3 });
      const nearCount = Math.round(density * 0.45);
      return {
        makeAll(w, h, spawnFull) {
          return [
            ...Array.from({ length: nearCount }, () => ({ ...near.make(w, h, spawnFull), far: false, factory: near })),
            ...Array.from({ length: density - nearCount }, () => ({ ...far.make(w, h, spawnFull), far: true, factory: far })),
          ];
        },
        step: (p, dt, w, h) => p.factory.step(p, dt, w, h),
        respawn: (p, w, h) => Object.assign(p, p.factory.make(w, h, false), { far: p.far, factory: p.factory }),
        draw: (ctx, p, opacity) => drawRain(ctx, p, size, opacity),
      };
    }
    case 'leaf':
    case 'petal':
    case 'heart':
    case 'shamrock': {
      const factory = (reverseDirection ? riseFactory : fallFactory)({ speed, size, sway: 50, wind });
      const palette = { leaf: LEAF_PALETTES, petal: PETAL_PALETTES, heart: HEART_PALETTES, shamrock: SHAMROCK_PALETTES }[def.kind];
      const drawFn = { leaf: drawLeaf, petal: drawPetal, heart: drawHeart, shamrock: drawShamrock }[def.kind];
      return {
        grabbable: true,
        makeAll: (w, h, spawnFull) => Array.from({ length: density }, () => {
          const [c1, c2] = pick(palette);
          return { ...factory.make(w, h, spawnFull), c1, c2 };
        }),
        step: (p, dt, w, h) => factory.step(p, dt, w, h),
        respawn: (p, w, h) => Object.assign(p, factory.make(w, h, false), { c1: p.c1, c2: p.c2 }),
        draw: (ctx, p, opacity) => drawFn(ctx, p, size, opacity),
      };
    }
    case 'confetti': {
      const factory = (reverseDirection ? riseFactory : fallFactory)({ speed, size, sway: 55, wind });
      return {
        grabbable: true,
        makeAll: (w, h, spawnFull) => Array.from({ length: density }, () => ({
          ...factory.make(w, h, spawnFull), color: `hsl(${Math.round(rand(0, 360))} 85% 62%)`, shape: pick(CONFETTI_SHAPES),
        })),
        step: (p, dt, w, h) => factory.step(p, dt, w, h),
        respawn: (p, w, h) => Object.assign(p, factory.make(w, h, false), { color: p.color, shape: p.shape }),
        draw: (ctx, p, opacity) => drawConfetti(ctx, p, size, opacity),
      };
    }
    case 'bubble': {
      const factory = (reverseDirection ? fallFactory : riseFactory)({ speed, size, sway: 40, wind });
      return {
        pop: true,
        makeAll: (w, h, spawnFull) => Array.from({ length: density }, () => factory.make(w, h, spawnFull)),
        step: (p, dt, w, h) => factory.step(p, dt, w, h),
        respawn: (p, w, h) => Object.assign(p, factory.make(w, h, false)),
        draw: (ctx, p, opacity) => drawBubble(ctx, p, size, opacity),
      };
    }
    case 'glint': {
      const factory = ambientFactory({ drift: def.ambient ? 12 : 0 });
      return {
        attract: true,
        makeAll: (w, h) => Array.from({ length: Math.round(density * 0.6) }, () => ({ ...factory.make(w, h), color: pick(def.palette) })),
        step: (p, dt, w, h) => factory.step(p, dt, w, h),
        respawn: () => {},
        draw: (ctx, p, opacity) => drawGlint(ctx, p, opacity),
      };
    }
    case 'emoji': {
      const naturallyUp = def.direction === 'up';
      const goesUp = naturallyUp !== reverseDirection; // reverseDirection flips whichever way it naturally goes
      const factory = (goesUp ? riseFactory : fallFactory)({ speed, size, sway: goesUp ? 35 : 45, wind });
      return {
        grabbable: true,
        makeAll: (w, h, spawnFull) => Array.from({ length: density }, () => factory.make(w, h, spawnFull)),
        step: (p, dt, w, h) => factory.step(p, dt, w, h),
        respawn: (p, w, h) => Object.assign(p, factory.make(w, h, false)),
        draw: (ctx, p, opacity) => drawEmoji(ctx, p, def.glyph, size, opacity),
      };
    }
    default:
      return null;
  }
}

// Fireworks are event-driven (periodic bursts), not a steady-state particle
// field like everything else, so they get their own standalone loop:
// a rocket streak rises from the bottom leaving a fading trail, then bursts
// at its apex into a ring of glowing, gravity-drooping sparks.
function useFireworks(canvasRef, density, speed, size, interactive, opacity) {
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf;
    let last = performance.now();
    let rockets = [];
    let sparks = [];
    const rays = Math.max(14, Math.min(36, Math.round(density / 2.5)));

    // The canvas element's CSS size follows `inset:0` just fine, but its
    // actual pixel buffer (canvas.width/height) defaults to a fixed
    // 300x150 regardless of that -- without setting it explicitly here,
    // every rocket/spark draws into that tiny buffer and gets stretched
    // blurry across the whole viewport by the browser.
    function resize() {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    function spawnRocket(atX) {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr, h = canvas.height / dpr;
      rockets.push({
        x: atX ?? rand(w * 0.15, w * 0.85), y: h, targetY: rand(h * 0.15, h * 0.55),
        vy: -rand(260, 380), hue: Math.round(rand(0, 360)), trail: [],
      });
    }

    // The charming interactive touch for fireworks: a click launches an
    // extra rocket right there, on top of the automatic periodic ones.
    function handleClick(e) {
      spawnRocket(e.clientX);
    }
    if (interactive) window.addEventListener('pointerdown', handleClick);

    // Spark speed/decay are all px/second or 1/second now -- see the
    // dt-in-seconds note on fallFactory above for why that matters.
    function burst(x, y, hue) {
      for (let i = 0; i < rays; i++) {
        const angle = (i / rays) * Math.PI * 2 + rand(-0.15, 0.15);
        const v = rand(size * 6, size * 11);
        sparks.push({ x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v, hue: hue + rand(-15, 15), life: 1 });
      }
    }

    const intervalMs = Math.max(700, 3000 - (speed / 100) * 2200);
    const spawnTimer = setInterval(spawnRocket, intervalMs);
    spawnRocket();

    function frame(now) {
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr, h = canvas.height / dpr;
      ctx.clearRect(0, 0, w, h);

      rockets = rockets.filter((r) => {
        r.trail.push({ x: r.x, y: r.y });
        if (r.trail.length > 8) r.trail.shift();
        r.y += r.vy * dt;
        ctx.globalAlpha = opacity;
        ctx.strokeStyle = `hsla(${r.hue}, 90%, 70%, 0.6)`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        r.trail.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
        ctx.stroke();
        if (r.y <= r.targetY) {
          burst(r.x, r.y, r.hue);
          return false;
        }
        return true;
      });

      sparks = sparks.filter((s) => {
        s.life -= dt / 0.9; // ~0.9s fade
        if (s.life <= 0) return false;
        s.x += s.vx * dt;
        s.y += s.vy * dt + (1 - s.life) * 45 * dt; // gentle gravity droop as it fades
        s.vx *= 1 - dt * 1.1; // air drag
        ctx.globalAlpha = Math.max(0, s.life) * opacity;
        ctx.fillStyle = `hsl(${s.hue}, 90%, 65%)`;
        ctx.shadowColor = `hsl(${s.hue}, 90%, 65%)`;
        ctx.shadowBlur = size * 0.35;
        ctx.beginPath();
        ctx.arc(s.x, s.y, size * 0.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        return true;
      });

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(spawnTimer);
      window.removeEventListener('resize', resize);
      if (interactive) window.removeEventListener('pointerdown', handleClick);
    };
  }, [canvasRef, density, speed, size, interactive, opacity]);
}

// How close the pointer needs to be, in px, for the ambient
// avoid/attract behavior or a click's grab/pop hit-test to notice a
// particle -- shared by every kind so "how easy is this to touch" feels
// consistent regardless of what's on screen.
const TOUCH_RADIUS = 55;
const AMBIENT_RADIUS = 90;

function SiteEffectCanvas({ def, density, speed, size, reverseDirection, wind, opacity, interactive }) {
  const canvasRef = React.useRef(null);
  const isFirework = def.kind === 'firework';

  useFireworks(isFirework ? canvasRef : { current: null }, density, speed, size, interactive, opacity);

  React.useEffect(() => {
    if (isFirework) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const system = buildSystem(def, density, speed, size, reverseDirection, wind);
    if (!system) return;
    let particles = [];
    let pops = []; // little fading rings left behind by a popped bubble
    let raf;
    let last = performance.now();
    const pointer = { x: -9999, y: -9999, active: false };
    let held = null;
    let heldOffsetX = 0, heldOffsetY = 0;
    let recentPointer = []; // last few {x,y,t} samples, for a release "toss"

    function resize(spawnFull) {
      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth, h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      particles = system.makeAll(w, h, spawnFull);
    }
    resize(true);
    const onResize = () => resize(true);
    window.addEventListener('resize', onResize);

    function popAt(x, y, color) {
      pops.push({ x, y, life: 1, color: color || 'rgba(200,230,255,0.9)' });
    }

    // These three (move/down/up) are only ever attached when `interactive`
    // is on, and always on `window` -- the canvas itself stays
    // pointer-events:none no matter what, so a click always still reaches
    // whatever's really underneath it; this just also lets the effect
    // notice where the pointer is.
    function onPointerMove(e) {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
      const now = performance.now();
      recentPointer.push({ x: e.clientX, y: e.clientY, t: now });
      if (recentPointer.length > 5) recentPointer.shift();
      if (held) {
        held.x = e.clientX + heldOffsetX;
        held.y = e.clientY + heldOffsetY;
        held.baseX = held.x;
        held.windOffset = 0;
      }
    }
    function onPointerLeave() {
      pointer.active = false;
    }
    function onPointerDown(e) {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
      let closest = null, closestDist = TOUCH_RADIUS;
      for (const p of particles) {
        if (p.held) continue;
        const d = Math.hypot(p.x - e.clientX, p.y - e.clientY);
        if (d < closestDist) { closest = p; closestDist = d; }
      }
      if (!closest) return;
      if (system.pop) {
        popAt(closest.x, closest.y);
        system.respawn(closest, window.innerWidth, window.innerHeight);
      } else if (system.grabbable) {
        held = closest;
        held.held = true;
        heldOffsetX = closest.x - e.clientX;
        heldOffsetY = closest.y - e.clientY;
        recentPointer = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
      }
    }
    function onPointerUp() {
      if (!held) return;
      // A little toss on release, based on how fast the pointer was moving
      // just before letting go -- picking something up and flicking it
      // is most of the charm; dropping it dead-still isn't.
      const a = recentPointer[0], b = recentPointer[recentPointer.length - 1];
      if (a && b && b.t > a.t) {
        const dtRelease = (b.t - a.t) / 1000;
        held.repelX = ((b.x - a.x) / dtRelease) * 0.12;
        held.repelY = ((b.y - a.y) / dtRelease) * 0.12;
      }
      held.held = false;
      held = null;
    }
    if (interactive) {
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerleave', onPointerLeave);
      window.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('pointerup', onPointerUp);
    }

    function frame(now) {
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      const w = window.innerWidth, h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);

      for (const p of particles) {
        const needsRespawn = system.step(p, dt, w, h);
        if (needsRespawn) system.respawn(p, w, h);

        if (interactive && !p.held) {
          // Ambient hover response: most kinds gently swerve away from the
          // cursor as it passes near (like wind, or a small creature
          // stepping aside); ambient glints (fireflies/sparkle/stars) do
          // the opposite and drift toward it, like they're curious.
          if (pointer.active) {
            const dx = p.x - pointer.x, dy = p.y - pointer.y;
            const dist = Math.hypot(dx, dy) || 1;
            if (dist < AMBIENT_RADIUS) {
              const push = (1 - dist / AMBIENT_RADIUS) * 70 * dt;
              const dirX = system.attract ? -dx / dist : dx / dist;
              const dirY = system.attract ? -dy / dist : dy / dist;
              p.repelX = (p.repelX || 0) + dirX * push;
              p.repelY = (p.repelY || 0) + dirY * push;
            }
          }
          // Spring the toss/avoidance offset back to zero over time, same
          // idea for every kind -- a temporary nudge, never a permanent
          // change to where the particle "belongs".
          p.repelX = (p.repelX || 0) * Math.max(0, 1 - dt * 2.2);
          p.repelY = (p.repelY || 0) * Math.max(0, 1 - dt * 2.2);
          p.x += p.repelX;
          p.y += p.repelY;
        }

        system.draw(ctx, p, opacity);
      }

      pops = pops.filter((pop) => {
        pop.life -= dt / 0.4;
        if (pop.life <= 0) return false;
        ctx.save();
        ctx.globalAlpha = Math.max(0, pop.life) * opacity;
        ctx.strokeStyle = pop.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pop.x, pop.y, (1 - pop.life) * size * 1.4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        return true;
      });

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      if (interactive) {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerleave', onPointerLeave);
        window.removeEventListener('pointerdown', onPointerDown);
        window.removeEventListener('pointerup', onPointerUp);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuilds the whole particle system on any of these changing, not per-frame
  }, [def, density, speed, size, isFirework, reverseDirection, wind, opacity, interactive]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ position: 'fixed', inset: 0, zIndex: 400, pointerEvents: 'none' }}
    />
  );
}
