import React from 'react';

// Rendered on a single <canvas>, not DOM+CSS spans -- canvas is what lets
// real glow/gradients/hundreds of particles move smoothly, and what makes an
// "instant, already-populated" scene possible (every particle is seeded
// across the FULL screen on the first frame, not spawned one edge at a time).
//
// Every preset is its own distinct mechanic, not a shared shape recolored --
// that was a real complaint about an earlier version (Summer Sparkle,
// Fireflies, and Stars all used the same twinkling-dot shape with just a
// different palette, which reads as "one effect wearing three skins," not
// three effects). Now: Stars twinkle in place, Fireflies wander with a
// fading light trail, and Summer Sparkle is a rising warm shimmer with
// occasional bright flares -- three actually different behaviors.
//
// Most presets also have a rare "signature moment": a bigger, more dramatic
// full-screen burst that fires every 20-40s on top of the normal ambient
// loop (a lightning flash + downpour for Rain, a confetti cannon, a
// shooting star, a balloon release, ...) -- inspired by how FaceTime's
// reaction effects work, and the direct answer to "I don't want them all to
// seem the same with just a new skin": the ambient loop is quiet and
// continuous, the signature moment is the one-off spectacle.
export const SITE_EFFECT_PRESETS = {
  snow: { kind: 'snow', label: 'Snow' },
  rain: { kind: 'rain', label: 'Rain' },
  leaves: { kind: 'leaf', label: 'Autumn Leaves' },
  petals: { kind: 'petal', label: 'Spring Petals' },
  sparkle: { kind: 'shimmer', label: 'Summer Sparkle' },
  bubbles: { kind: 'bubble', label: 'Bubbles' },
  butterflies: { kind: 'butterfly', label: 'Butterflies' },
  fireflies: { kind: 'firefly', label: 'Fireflies' },
  confetti: { kind: 'confetti', label: 'Confetti' },
  balloons: { kind: 'balloon', label: 'Balloons', direction: 'up' },
  hearts: { kind: 'heart', label: "Hearts (Valentine's)" },
  shamrocks: { kind: 'shamrock', label: "Shamrocks (St. Patrick's)" },
  fireworks: { kind: 'firework', label: 'Fireworks (4th of July)' },
  stars: { kind: 'glint', label: 'Stars' },
  pumpkins: { kind: 'emoji', glyph: '🎃', label: 'Pumpkins (Halloween)' },
  bats: { kind: 'bat', label: 'Bats (Halloween)' },
  ghosts: { kind: 'ghost', label: 'Ghosts (Halloween)' },
  turkeys: { kind: 'emoji', glyph: '🦃', label: 'Turkeys (Thanksgiving)' },
  ornaments: { kind: 'emoji', glyph: '🎄', label: 'Christmas' },
  gradcaps: { kind: 'emoji', glyph: '🎓', label: 'Graduation' },
};

export const SITE_EFFECT_PRESET_OPTIONS = [
  ...Object.entries(SITE_EFFECT_PRESETS).map(([value, p]) => ({ value, label: p.label })),
  { value: 'custom', label: 'Custom emoji…' },
];

const PREVIEW_GLYPH = {
  snow: '❄️', rain: '🌧️', glint: '✨', bubble: '🫧', confetti: '🎊', firework: '🎆',
  leaf: '🍂', petal: '🌸', heart: '💕', shamrock: '☘️', shimmer: '☀️', butterfly: '🦋',
  firefly: '🌟', balloon: '🎈', ghost: '👻', bat: '🦇',
};

// Chromeless (registry.js) -- a purely decorative animated overlay across
// the whole site. Deliberately built so an admin CAN'T turn this into a
// full-bleed background image/video sitting on top of the page, which was
// an explicit ask, not an oversight:
//   - No image/video/file field exists on this block at all -- every preset
//     is either an emoji glyph or a hand-drawn canvas shape.
//   - The canvas is always `pointer-events: none`, so it can never block a
//     click or a tap regardless of any setting here.
//   - Density and size are both hard-capped (see the clamps below)
//     independent of whatever's actually stored, so a bad/stale value can't
//     produce enough coverage to read as a solid layer. Signature moments
//     are temporary and self-limiting (a few seconds, then gone) for the
//     same reason -- never a permanent escalation.
//   - Nothing here ever paints an opaque background across the canvas --
//     only small individual particles (and brief, low-opacity flashes) on
//     an otherwise transparent one.
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
// `dt` throughout this file is in SECONDS, so every velocity is a plain
// px/second or radians/second -- no per-frame fudge factors. Horizontal
// sway is computed fresh each frame as `baseX + sin(...)`, an OFFSET from a
// fixed anchor, never accumulated by `+=` (that would compound into
// runaway drift instead of a bounded wobble). `wind` is a separate
// accumulator stacked on top of the sway. `held`/`repelX`/`repelY` are the
// interactive layer's doing (see SiteEffectCanvas) -- grabbing a particle
// freezes its normal x/y formula and lets the pointer drive it directly;
// repelX/Y is a decaying offset from a release "toss" or ambient cursor
// avoidance/attraction.
function fallFactory({ speed, size, sway = 40, spin = true, wind = 0 }) {
  return {
    make(w, h, spawnFull) {
      const duration = rand(9, 16) * (1 - (speed / 100) * 0.55);
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
      if (p.held) return false;
      p.t += dt;
      p.y += p.vy * dt;
      p.windOffset += wind * dt;
      p.x = p.baseX + p.windOffset + Math.sin(p.t * p.swayFreq + p.phase) * p.swayAmp;
      p.rot += p.rotSpeed * dt;
      if (p.y > h + size * 2) return true;
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
        rot: rand(-0.3, 0.3),
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

// Twinkles in place -- used only by Stars now (Fireflies/Summer Sparkle
// each got their own distinct mechanic instead, see wanderFactory/shimmer below).
function ambientFactory({ drift = 0 }) {
  return {
    make(w, h) {
      return {
        x: rand(0, w), y: rand(0, h),
        vx: rand(-drift, drift), vy: rand(-drift, drift),
        twinklePhase: rand(0, Math.PI * 2), twinkleSpeed: rand(0.6, 1.4),
        scale: rand(0.6, 1.3), t: rand(0, 10),
        held: false, repelX: 0, repelY: 0,
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

// Organic wandering flight -- picks a direction, holds it for a couple
// seconds, then smoothly retargets to a new one, bouncing gently off the
// edges of the screen instead of falling or rising in a straight line.
// This is what makes Butterflies/Fireflies/Bats/Ghosts feel alive rather
// than "an emoji falling with extra steps" -- they actually fly/float
// around. `wingSpeed` (unused by Ghosts) drives the wing-flap animation in
// their respective draw functions.
function wanderFactory({ speedPx = 40 }) {
  return {
    make(w, h) {
      const angle = rand(0, Math.PI * 2);
      return {
        x: rand(0, w), y: rand(0, h),
        vx: Math.cos(angle) * speedPx, vy: Math.sin(angle) * speedPx,
        turnT: rand(0.5, 2.5), turnEvery: rand(1.5, 3.5),
        wingPhase: rand(0, Math.PI * 2), wingSpeed: rand(7, 11),
        scale: rand(0.7, 1.3), t: rand(0, 10),
        held: false, repelX: 0, repelY: 0,
      };
    },
    step(p, dt, w, h) {
      if (p.held) return false;
      p.t += dt;
      p.wingPhase += p.wingSpeed * dt;
      p.turnT -= dt;
      if (p.turnT <= 0) {
        const currentAngle = Math.atan2(p.vy, p.vx);
        const nextAngle = currentAngle + rand(-1.3, 1.3);
        const spd = Math.hypot(p.vx, p.vy);
        p.vx = Math.cos(nextAngle) * spd;
        p.vy = Math.sin(nextAngle) * spd;
        p.turnT = p.turnEvery;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x < 20 || p.x > w - 20) p.vx *= -1;
      if (p.y < 20 || p.y > h - 20) p.vy *= -1;
      p.x = Math.max(0, Math.min(w, p.x));
      p.y = Math.max(0, Math.min(h, p.y));
      return false; // ambient -- never "leaves" the screen to respawn
    },
  };
}

// --- Drawing routines ---------------------------------------------------
// Real vector shapes drawn with actual bezier curves + gradients + glow,
// not font glyphs.

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
// bokeh circles farther back.
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

// Two depth layers of tilted gradient streaks, same idea as snow's depth
// trick. `p.splashAt` (set by SiteEffectCanvas the instant a near-layer drop
// respawns) draws one quick expanding ring at the point it "hit the ground" --
// the single biggest thing missing before that made rain look weightless.
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

function drawSplash(ctx, p, size, opacity) {
  const fade = Math.max(0, 1 - p.t / p.life);
  ctx.save();
  ctx.globalAlpha = fade * opacity * 0.8;
  ctx.strokeStyle = 'rgba(200,225,255,0.9)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, (1 - fade) * size * 0.9, (1 - fade) * size * 0.3, 0, 0, Math.PI * 2);
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

// Stars: the one preset left twinkling in place -- a 4-point glint drawn as
// a pinched diamond.
function drawGlint(ctx, p, opacity, color) {
  const alpha = 0.15 + Math.abs(Math.sin(p.t * p.twinkleSpeed + p.twinklePhase)) * 0.85;
  const s = 10 * p.scale * (0.6 + alpha * 0.5);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.globalAlpha = alpha * opacity;
  ctx.fillStyle = color;
  ctx.shadowColor = color;
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

// Fireflies: unlike Stars, these actually MOVE (wanderFactory) and leave a
// short fading trail of where they just were -- that's the whole
// distinction from a twinkling star, a real firefly is defined by its
// meandering flight path as much as its glow.
function drawFirefly(ctx, p, size, opacity) {
  const pulse = 0.4 + Math.abs(Math.sin(p.t * 1.8)) * 0.6;
  ctx.save();
  if (p.trail && p.trail.length > 1) {
    for (let i = 0; i < p.trail.length - 1; i++) {
      const t = p.trail[i];
      const age = i / p.trail.length;
      ctx.globalAlpha = age * 0.3 * opacity;
      ctx.fillStyle = '#d4ff7a';
      ctx.beginPath();
      ctx.arc(t.x, t.y, size * 0.12 * age, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = pulse * opacity;
  ctx.fillStyle = '#eaffb0';
  ctx.shadowColor = '#d4ff7a';
  ctx.shadowBlur = size * 0.9 * pulse;
  ctx.beginPath();
  ctx.arc(p.x, p.y, size * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Summer Sparkle: a warm haze rising slowly like heat shimmer, where each
// particle occasionally "flares" brighter/bigger for a moment -- distinct
// from both Stars (static twinkle) and Fireflies (moving glow + trail).
function drawShimmer(ctx, p, size, opacity) {
  const flare = p.flareT > 0 ? (p.flareT / p.flareDuration) : 0;
  const s = size * p.scale * (0.6 + flare * 0.8);
  const alpha = (0.25 + flare * 0.6) * opacity;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.globalAlpha = alpha;
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 0.6);
  g.addColorStop(0, '#fff8dd');
  g.addColorStop(0.5, 'rgba(255,224,150,0.5)');
  g.addColorStop(1, 'rgba(255,224,150,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Butterflies: two gradient wings that actually flap (scaleX oscillates
// with wingPhase), oriented to face the direction it's currently flying.
function drawButterfly(ctx, p, size, opacity) {
  const s = size * p.scale;
  const flap = Math.max(0.15, Math.abs(Math.sin(p.wingPhase)));
  const heading = Math.atan2(p.vy || 0, p.vx || 1);
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.translate(p.x, p.y);
  ctx.rotate(heading + Math.PI / 2);
  const g = ctx.createLinearGradient(-s / 2, 0, s / 2, 0);
  g.addColorStop(0, p.c1);
  g.addColorStop(1, p.c2);
  ctx.fillStyle = g;
  ctx.shadowColor = p.c2;
  ctx.shadowBlur = s * 0.3;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.scale(side * flap, 1);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(s * 0.6, -s * 0.5, s * 0.15, -s * 0.05);
    ctx.quadraticCurveTo(s * 0.55, s * 0.3, 0, 0);
    ctx.fill();
    ctx.restore();
  }
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(40,30,20,0.8)';
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.04, s * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Bats: angular dark wings that flap the same way butterflies' do, swooping
// along their wander path instead of a straight fall.
function drawBat(ctx, p, size, opacity) {
  const s = size * p.scale;
  const flap = Math.max(0.2, Math.abs(Math.sin(p.wingPhase)));
  const heading = Math.atan2(p.vy || 0, p.vx || 1);
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.translate(p.x, p.y);
  ctx.rotate(heading + Math.PI / 2);
  const g = ctx.createLinearGradient(0, -s / 2, 0, s / 2);
  g.addColorStop(0, '#2b1830');
  g.addColorStop(1, '#0c0710');
  ctx.fillStyle = g;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.scale(side * flap, 1);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(s * 0.65, -s * 0.35);
    ctx.lineTo(s * 0.45, -s * 0.05);
    ctx.lineTo(s * 0.6, s * 0.05);
    ctx.lineTo(s * 0.2, s * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.09, s * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c23b3b';
  ctx.shadowColor = '#c23b3b';
  ctx.shadowBlur = s * 0.3;
  ctx.beginPath();
  ctx.arc(-s * 0.03, -s * 0.05, s * 0.02, 0, Math.PI * 2);
  ctx.arc(s * 0.03, -s * 0.05, s * 0.02, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Ghosts: a rounded-top, scalloped-bottom silhouette (drawn, not an emoji),
// translucent, gently bobbing as it drifts -- floating, never falling.
function drawGhost(ctx, p, size, opacity) {
  const s = size * p.scale;
  const bob = Math.sin(p.t * 1.5) * s * 0.08;
  ctx.save();
  ctx.globalAlpha = 0.55 * opacity;
  ctx.translate(p.x, p.y + bob);
  const g = ctx.createLinearGradient(0, -s / 2, 0, s / 2);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, '#dfe6f2');
  ctx.fillStyle = g;
  ctx.shadowColor = '#fff';
  ctx.shadowBlur = s * 0.25;
  ctx.beginPath();
  ctx.arc(0, -s * 0.05, s * 0.4, Math.PI, 0);
  ctx.lineTo(s * 0.4, s * 0.3);
  const scallops = 4;
  for (let i = 0; i < scallops; i++) {
    const x0 = s * 0.4 - (i * (s * 0.8)) / scallops;
    const x1 = s * 0.4 - ((i + 1) * (s * 0.8)) / scallops;
    ctx.quadraticCurveTo((x0 + x1) / 2, s * 0.42, x1, s * 0.3);
  }
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(30,30,40,0.75)';
  ctx.beginPath();
  ctx.ellipse(-s * 0.13, -s * 0.05, s * 0.05, s * 0.07, 0, 0, Math.PI * 2);
  ctx.ellipse(s * 0.13, -s * 0.05, s * 0.05, s * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Balloons: a gradient oval body with a highlight and a thin dangling
// string, in a randomized bright color per particle -- the explicit ask
// was "just want color variation" (an emoji glyph is always one fixed color).
function drawBalloon(ctx, p, size, opacity) {
  ctx.globalAlpha = opacity;
  const s = size * p.scale;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  const g = ctx.createRadialGradient(-s * 0.15, -s * 0.25, s * 0.05, 0, 0, s * 0.55);
  g.addColorStop(0, p.c1);
  g.addColorStop(1, p.c2);
  ctx.fillStyle = g;
  ctx.shadowColor = p.c2;
  ctx.shadowBlur = s * 0.25;
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.38, s * 0.48, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-s * 0.06, s * 0.44);
  ctx.lineTo(s * 0.06, s * 0.44);
  ctx.lineTo(0, s * 0.54);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = Math.max(1, s * 0.035);
  ctx.beginPath();
  ctx.moveTo(0, s * 0.56);
  ctx.quadraticCurveTo(s * 0.08, s * 0.7, 0, s * 0.85);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(-s * 0.13, -s * 0.2, s * 0.08, s * 0.14, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawEmoji(ctx, p, glyph, size, opacity) {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.translate(p.x, p.y);
  ctx.rotate((p.rot || 0) * 0.4);
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
const BALLOON_PALETTES = [['#ff8fa3', '#d81159'], ['#8fd3ff', '#1976d2'], ['#ffe08f', '#e0930a'], ['#b39dff', '#6a3fd6'], ['#8fffb0', '#1f9e4a']];
const BUTTERFLY_PALETTES = [['#ffb3de', '#a83279'], ['#8fd9ff', '#2472b8'], ['#fff2a8', '#d69f1c'], ['#c9a8ff', '#7a3fd1']];
const CONFETTI_SHAPES = ['rect', 'circle', 'triangle'];

// A generic "temporary extra particle" for signature moments -- gravity,
// life, and fade are handled once here; each kind just supplies where it
// starts, how fast it moves, and which draw function to reuse. Rendered and
// stepped by SiteEffectCanvas's `extras` array alongside (not replacing)
// the steady-state particles, then discarded once its life runs out --
// self-limiting by construction, never a permanent escalation.
function makeBurstParticle({ x, y, vx, vy, gravity = 0, life, draw, ...extra }) {
  const p = { x, y, vx, vy, gravity, t: 0, life, ...extra };
  return {
    step(dt) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      if (p.rotSpeed) p.rot += p.rotSpeed * dt;
      return p.t < p.life;
    },
    draw(ctx, opacity) {
      const fade = Math.max(0, 1 - p.t / p.life);
      draw(ctx, p, fade * opacity);
    },
  };
}

// Sets up (and later restores) one particle system per canvas mount, based
// on `def.kind`. `resize` re-seeds every particle with spawnFull=true, so
// the "instant, already-populated" scene holds even after a resize.
//
// `grabbable`/`pop`/`attract` describe how the interactive layer treats a
// hit on this kind's particles (drag-and-toss, pop-instead-of-drag, or
// drawn-toward-cursor instead of avoiding it). `signature(w,h)` -- present
// on most kinds -- returns `{ extras, flash }` for that kind's one-off
// full-screen moment; SiteEffectCanvas calls it on its own random timer.
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
        // A sudden flurry gust: a burst of extra fast-falling flakes.
        signature: (w) => ({
          extras: Array.from({ length: 30 }, () => makeBurstParticle({
            x: rand(0, w), y: -20, vx: rand(60, 140), vy: rand(220, 340), life: rand(2, 3.5),
            rot: rand(0, 6), scale: rand(0.6, 1.2), far: Math.random() > 0.5,
            draw: (ctx, p, o) => drawSnow(ctx, p, size, o),
          })),
        }),
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
        // Every near-drop that lands gets a quick splash ring -- see
        // SiteEffectCanvas, which calls this right before respawning a
        // near-layer drop that just reached the bottom.
        splashOnRespawn: true,
        // Lightning: a bright flash, then a few seconds of much heavier rain.
        signature: (w, h) => ({
          flash: { color: 'rgba(230,240,255,0.85)', duration: 120 },
          extras: Array.from({ length: 40 }, () => makeBurstParticle({
            x: rand(0, w), y: -20, vx: rand(20, 40), vy: rand(900, 1200), life: rand(0.8, 1.3),
            far: Math.random() > 0.4,
            draw: (ctx, p, o) => drawRain(ctx, p, size * 1.1, o),
          })),
        }),
      };
    }
    case 'leaf':
    case 'petal':
    case 'shamrock': {
      const factory = (reverseDirection ? riseFactory : fallFactory)({ speed, size, sway: 50, wind });
      const palette = { leaf: LEAF_PALETTES, petal: PETAL_PALETTES, shamrock: SHAMROCK_PALETTES }[def.kind];
      const drawFn = { leaf: drawLeaf, petal: drawPetal, shamrock: drawShamrock }[def.kind];
      return {
        grabbable: true,
        makeAll: (w, h, spawnFull) => Array.from({ length: density }, () => {
          const [c1, c2] = pick(palette);
          return { ...factory.make(w, h, spawnFull), c1, c2 };
        }),
        step: (p, dt, w, h) => factory.step(p, dt, w, h),
        respawn: (p, w, h) => Object.assign(p, factory.make(w, h, false), { c1: p.c1, c2: p.c2 }),
        draw: (ctx, p, opacity) => drawFn(ctx, p, size, opacity),
        // A gust of wind: a wave of extra ones sweeping across at speed.
        signature: (w, h) => ({
          extras: Array.from({ length: 35 }, () => {
            const [c1, c2] = pick(palette);
            const fromLeft = Math.random() > 0.5;
            return makeBurstParticle({
              x: fromLeft ? -20 : w + 20, y: rand(0, h), vx: (fromLeft ? 1 : -1) * rand(180, 320), vy: rand(-30, 60),
              life: rand(2, 3), rot: rand(0, 6), rotSpeed: rand(-4, 4), scale: rand(0.7, 1.3), c1, c2,
              draw: (ctx, p, o) => drawFn(ctx, p, size, o),
            });
          }),
        }),
      };
    }
    case 'heart': {
      const factory = (reverseDirection ? fallFactory : riseFactory)({ speed, size, sway: 50, wind });
      return {
        grabbable: true,
        makeAll: (w, h, spawnFull) => Array.from({ length: density }, () => {
          const [c1, c2] = pick(HEART_PALETTES);
          return { ...factory.make(w, h, spawnFull), c1, c2 };
        }),
        step: (p, dt, w, h) => factory.step(p, dt, w, h),
        respawn: (p, w, h) => Object.assign(p, factory.make(w, h, false), { c1: p.c1, c2: p.c2 }),
        draw: (ctx, p, opacity) => drawHeart(ctx, p, size, opacity),
        // A heart burst rising together across the whole width -- the
        // classic FaceTime "hearts" reaction.
        signature: (w, h) => ({
          extras: Array.from({ length: 34 }, () => {
            const [c1, c2] = pick(HEART_PALETTES);
            return makeBurstParticle({
              x: rand(0, w), y: h + rand(0, 60), vx: rand(-25, 25), vy: -rand(140, 220), life: rand(2.5, 3.5),
              rot: rand(-0.3, 0.3), scale: rand(0.8, 1.4), c1, c2,
              draw: (ctx, p, o) => drawHeart(ctx, p, size, o),
            });
          }),
        }),
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
        // A confetti cannon from both bottom corners -- gravity pulls each
        // piece back down after it arcs up and out.
        signature: (w, h) => ({
          extras: [
            ...Array.from({ length: 30 }, () => makeBurstParticle({
              x: 0, y: h, vx: rand(160, 420), vy: -rand(420, 620), gravity: 700, life: rand(1.8, 2.6),
              rot: rand(0, 6), rotSpeed: rand(-6, 6), scale: rand(0.8, 1.3),
              color: `hsl(${Math.round(rand(0, 360))} 85% 62%)`, shape: pick(CONFETTI_SHAPES),
              draw: (ctx, p, o) => drawConfetti(ctx, p, size, o),
            })),
            ...Array.from({ length: 30 }, () => makeBurstParticle({
              x: w, y: h, vx: -rand(160, 420), vy: -rand(420, 620), gravity: 700, life: rand(1.8, 2.6),
              rot: rand(0, 6), rotSpeed: rand(-6, 6), scale: rand(0.8, 1.3),
              color: `hsl(${Math.round(rand(0, 360))} 85% 62%)`, shape: pick(CONFETTI_SHAPES),
              draw: (ctx, p, o) => drawConfetti(ctx, p, size, o),
            })),
          ],
        }),
      };
    }
    case 'balloon': {
      const naturallyUp = def.direction === 'up';
      const goesUp = naturallyUp !== reverseDirection;
      const factory = (goesUp ? riseFactory : fallFactory)({ speed, size, sway: 35, wind });
      return {
        grabbable: true,
        makeAll: (w, h, spawnFull) => Array.from({ length: density }, () => {
          const [c1, c2] = pick(BALLOON_PALETTES);
          return { ...factory.make(w, h, spawnFull), c1, c2 };
        }),
        step: (p, dt, w, h) => factory.step(p, dt, w, h),
        respawn: (p, w, h) => Object.assign(p, factory.make(w, h, false), { c1: p.c1, c2: p.c2 }),
        draw: (ctx, p, opacity) => drawBalloon(ctx, p, size, opacity),
        // A balloon release: a big cluster rising together.
        signature: (w, h) => ({
          extras: Array.from({ length: 26 }, () => {
            const [c1, c2] = pick(BALLOON_PALETTES);
            return makeBurstParticle({
              x: rand(w * 0.2, w * 0.8), y: h + rand(0, 100), vx: rand(-15, 15), vy: -rand(90, 150), life: rand(3, 4.5),
              rot: rand(-0.3, 0.3), scale: rand(0.9, 1.4), c1, c2,
              draw: (ctx, p, o) => drawBalloon(ctx, p, size, o),
            });
          }),
        }),
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
        // A dense stream from one spot, like blowing a lot of bubbles at once.
        signature: (w, h) => {
          const fromX = rand(w * 0.2, w * 0.8);
          return {
            extras: Array.from({ length: 26 }, (_, i) => makeBurstParticle({
              x: fromX + rand(-20, 20), y: h + rand(0, 20) + i * 4, vx: rand(-20, 20), vy: -rand(160, 260), life: rand(2.5, 3.5),
              scale: rand(0.6, 1.2),
              draw: (ctx, p, o) => drawBubble(ctx, p, size, o),
            })),
          };
        },
      };
    }
    case 'glint': {
      const factory = ambientFactory({});
      return {
        attract: true,
        makeAll: (w, h) => Array.from({ length: Math.round(density * 0.6) }, () => ({ ...factory.make(w, h), color: pick(['#ffffff', '#dfe7ff', '#c7d2ff']) })),
        step: (p, dt, w, h) => factory.step(p, dt, w, h),
        respawn: () => {},
        draw: (ctx, p, opacity) => drawGlint(ctx, p, opacity, p.color),
        // A shooting star: one bright streak flying diagonally with a
        // fading trail -- the single most "FaceTime moment" of any of these.
        signature: (w, h) => {
          const fromLeft = Math.random() > 0.5;
          const startX = fromLeft ? -40 : w + 40;
          const vx = (fromLeft ? 1 : -1) * rand(700, 950);
          const vy = rand(220, 340);
          const startY = rand(0, h * 0.4);
          const shooter = makeBurstParticle({
            x: startX, y: startY, vx, vy, life: 1.4, trail: [],
            draw: (ctx, p, o) => {
              p.trail = p.trail || [];
              p.trail.push({ x: p.x, y: p.y });
              if (p.trail.length > 14) p.trail.shift();
              ctx.save();
              for (let i = 0; i < p.trail.length - 1; i++) {
                const age = i / p.trail.length;
                ctx.globalAlpha = age * 0.7 * o;
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2 * age;
                ctx.beginPath();
                ctx.moveTo(p.trail[i].x, p.trail[i].y);
                ctx.lineTo(p.trail[i + 1].x, p.trail[i + 1].y);
                ctx.stroke();
              }
              ctx.globalAlpha = o;
              ctx.fillStyle = '#fff';
              ctx.shadowColor = '#dfe7ff';
              ctx.shadowBlur = 10;
              ctx.beginPath();
              ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            },
          });
          return { extras: [shooter] };
        },
      };
    }
    case 'firefly': {
      const factory = wanderFactory({ speedPx: 35 });
      return {
        attract: true,
        makeAll: (w, h) => Array.from({ length: Math.round(density * 0.5) }, () => ({ ...factory.make(w, h), trail: [] })),
        step: (p, dt, w, h) => {
          p.trail = p.trail || [];
          p.trail.push({ x: p.x, y: p.y });
          if (p.trail.length > 10) p.trail.shift();
          return factory.step(p, dt, w, h);
        },
        respawn: () => {},
        draw: (ctx, p, opacity) => drawFirefly(ctx, p, size, opacity),
        // A gathering: a burst of extra fireflies drifting in together.
        signature: (w, h) => ({
          extras: Array.from({ length: 24 }, () => {
            const angle = rand(0, Math.PI * 2);
            const radius = Math.max(w, h) * 0.6;
            const cx = w / 2 + Math.cos(angle) * radius, cy = h / 2 + Math.sin(angle) * radius;
            const vx = ((w / 2) - cx) / 3, vy = ((h / 2) - cy) / 3;
            return makeBurstParticle({
              x: cx, y: cy, vx, vy, life: 4, trail: [],
              draw: (ctx, p, o) => {
                p.trail = p.trail || [];
                p.trail.push({ x: p.x, y: p.y });
                if (p.trail.length > 10) p.trail.shift();
                drawFirefly(ctx, p, size, o);
              },
            });
          }),
        }),
      };
    }
    case 'shimmer': {
      return {
        makeAll: (w, h) => Array.from({ length: Math.round(density * 0.7) }, () => ({
          x: rand(0, w), y: rand(0, h), vy: -rand(6, 16), scale: rand(0.7, 1.4),
          flareT: rand(-8, 0), flareDuration: rand(0.8, 1.4), flareEvery: rand(4, 9),
        })),
        step(p, dt, w, h) {
          p.y += p.vy * dt;
          if (p.y < -40) { p.y = h + 20; p.x = rand(0, w); }
          p.flareT -= dt;
          if (p.flareT < -p.flareEvery) p.flareT = p.flareDuration;
          return false;
        },
        respawn: () => {},
        draw: (ctx, p, opacity) => drawShimmer(ctx, p, size, opacity),
        // A warm flare sweep across the whole screen.
        signature: () => ({ flash: { color: 'rgba(255,240,190,0.3)', duration: 500 } }),
      };
    }
    case 'butterfly': {
      const factory = wanderFactory({ speedPx: 45 });
      return {
        grabbable: true,
        makeAll: (w, h) => Array.from({ length: Math.round(density * 0.5) }, () => {
          const [c1, c2] = pick(BUTTERFLY_PALETTES);
          return { ...factory.make(w, h), c1, c2 };
        }),
        step: (p, dt, w, h) => factory.step(p, dt, w, h),
        respawn: () => {},
        draw: (ctx, p, opacity) => drawButterfly(ctx, p, size, opacity),
        // A swarm sweeping in from one edge.
        signature: (w, h) => {
          const fromLeft = Math.random() > 0.5;
          return {
            extras: Array.from({ length: 20 }, () => {
              const [c1, c2] = pick(BUTTERFLY_PALETTES);
              return makeBurstParticle({
                x: fromLeft ? -30 : w + 30, y: rand(0, h), vx: (fromLeft ? 1 : -1) * rand(60, 120), vy: rand(-40, 40),
                life: rand(3, 4.5), wingPhase: rand(0, 6), wingSpeed: rand(7, 11), scale: rand(0.8, 1.3), c1, c2,
                draw: (ctx, p, o) => { p.wingPhase += 0.15; drawButterfly(ctx, p, size, o); },
              });
            }),
          };
        },
      };
    }
    case 'bat': {
      const factory = wanderFactory({ speedPx: 70 });
      return {
        grabbable: true,
        makeAll: (w, h) => Array.from({ length: Math.round(density * 0.5) }, () => factory.make(w, h)),
        step: (p, dt, w, h) => factory.step(p, dt, w, h),
        respawn: () => {},
        draw: (ctx, p, opacity) => drawBat(ctx, p, size, opacity),
        // A bat swarm + a brief darkening flash, for a real "haunted" jolt.
        signature: (w, h) => {
          const fromLeft = Math.random() > 0.5;
          return {
            flash: { color: 'rgba(15,8,20,0.35)', duration: 300 },
            extras: Array.from({ length: 22 }, () => makeBurstParticle({
              x: fromLeft ? -30 : w + 30, y: rand(0, h), vx: (fromLeft ? 1 : -1) * rand(140, 240), vy: rand(-60, 60),
              life: rand(1.8, 2.6), wingPhase: rand(0, 6), wingSpeed: rand(9, 13), scale: rand(0.8, 1.3),
              draw: (ctx, p, o) => { p.wingPhase += 0.2; drawBat(ctx, p, size, o); },
            })),
          };
        },
      };
    }
    case 'ghost': {
      const factory = wanderFactory({ speedPx: 25 });
      return {
        grabbable: true,
        makeAll: (w, h) => Array.from({ length: Math.round(density * 0.4) }, () => factory.make(w, h)),
        step: (p, dt, w, h) => factory.step(p, dt, w, h),
        respawn: () => {},
        draw: (ctx, p, opacity) => drawGhost(ctx, p, size, opacity),
        // A haunting: several extra ghosts drifting through + a cold flash.
        signature: (w, h) => ({
          flash: { color: 'rgba(60,50,90,0.25)', duration: 400 },
          extras: Array.from({ length: 14 }, () => makeBurstParticle({
            x: rand(0, w), y: h + rand(20, 80), vx: rand(-20, 20), vy: -rand(30, 60), life: 5,
            draw: (ctx, p, o) => drawGhost(ctx, p, size, o),
          })),
        }),
      };
    }
    case 'emoji': {
      const naturallyUp = def.direction === 'up';
      const goesUp = naturallyUp !== reverseDirection;
      const factory = (goesUp ? riseFactory : fallFactory)({ speed, size, sway: goesUp ? 35 : 45, wind });
      return {
        grabbable: true,
        makeAll: (w, h, spawnFull) => Array.from({ length: density }, () => factory.make(w, h, spawnFull)),
        step: (p, dt, w, h) => factory.step(p, dt, w, h),
        respawn: (p, w, h) => Object.assign(p, factory.make(w, h, false)),
        draw: (ctx, p, opacity) => drawEmoji(ctx, p, def.glyph, size, opacity),
        // A generic shower -- extra ones sweeping in from the top.
        signature: (w) => ({
          extras: Array.from({ length: 24 }, () => makeBurstParticle({
            x: rand(0, w), y: -20, vx: rand(-30, 30), vy: rand(180, 280), life: rand(2, 3), rot: rand(0, 6), scale: rand(0.8, 1.3),
            draw: (ctx, p, o) => drawEmoji(ctx, p, def.glyph, size, o),
          })),
        }),
      };
    }
    default:
      return null;
  }
}

// Fireworks are event-driven (periodic bursts), not a steady-state particle
// field like everything else, so they get their own standalone loop: a
// rocket streak rises from the bottom leaving a fading trail, then bursts
// at its apex into a ring of glowing, gravity-drooping sparks. Three burst
// STYLES (classic ring / willow trails / double crackle) are picked at
// random per launch so consecutive fireworks don't all look identical --
// the specific "more variation" ask.
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

    function handleClick(e) { spawnRocket(e.clientX); }
    if (interactive) window.addEventListener('pointerdown', handleClick);

    function addSpark(x, y, vx, vy, hue, willow) {
      sparks.push({ x, y, vx, vy, hue, life: 1, willow });
    }

    // Classic: one even ring of sparks. Willow: fewer, slower, longer-lived
    // sparks that droop more (the trailing "weeping willow" firework look).
    // Crackle: a normal ring plus a tighter secondary burst a beat later.
    function burst(x, y, hue) {
      const style = pick(['classic', 'willow', 'crackle']);
      if (style === 'classic' || style === 'crackle') {
        for (let i = 0; i < rays; i++) {
          const angle = (i / rays) * Math.PI * 2 + rand(-0.15, 0.15);
          const v = rand(size * 6, size * 11);
          addSpark(x, y, Math.cos(angle) * v, Math.sin(angle) * v, hue + rand(-15, 15), false);
        }
        if (style === 'crackle') {
          setTimeout(() => {
            for (let i = 0; i < Math.round(rays * 0.6); i++) {
              const angle = (i / (rays * 0.6)) * Math.PI * 2 + rand(-0.2, 0.2);
              const v = rand(size * 3, size * 5);
              addSpark(x, y, Math.cos(angle) * v, Math.sin(angle) * v, hue + rand(-40, 40) + 180, false);
            }
          }, 220);
        }
      } else {
        const willowRays = Math.round(rays * 0.7);
        for (let i = 0; i < willowRays; i++) {
          const angle = (i / willowRays) * Math.PI * 2 + rand(-0.15, 0.15);
          const v = rand(size * 4, size * 7);
          addSpark(x, y, Math.cos(angle) * v, Math.sin(angle) * v, hue, true);
        }
      }
    }

    const intervalMs = Math.max(700, 3000 - (speed / 100) * 2200);
    const spawnTimer = setInterval(spawnRocket, intervalMs);
    spawnRocket();

    // Finale: several rockets launched in quick succession -- Fireworks'
    // own signature moment, on the same random timer every other kind uses
    // (see SiteEffectCanvas -- fireworks runs its own loop, so it schedules
    // this bit itself instead).
    const signatureTimer = setInterval(() => {
      let i = 0;
      const id = setInterval(() => {
        spawnRocket();
        if (++i >= 5) clearInterval(id);
      }, 180);
    }, rand(20000, 38000));

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
        const fadeRate = s.willow ? 1 / 1.6 : 1 / 0.9;
        s.life -= dt * fadeRate;
        if (s.life <= 0) return false;
        s.x += s.vx * dt;
        s.y += s.vy * dt + (1 - s.life) * (s.willow ? 90 : 45) * dt;
        s.vx *= 1 - dt * (s.willow ? 0.6 : 1.1);
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
      clearInterval(signatureTimer);
      window.removeEventListener('resize', resize);
      if (interactive) window.removeEventListener('pointerdown', handleClick);
    };
  }, [canvasRef, density, speed, size, interactive, opacity]);
}

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
    let extras = []; // temporary signature-moment particles (see makeBurstParticle)
    let pops = []; // little fading rings left behind by a popped bubble
    let flashAlpha = 0, flashColor = '', flashDuration = 1;
    let raf;
    let last = performance.now();
    const pointer = { x: -9999, y: -9999, active: false };
    let held = null;
    let heldOffsetX = 0, heldOffsetY = 0;
    let recentPointer = [];

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

    // The rare full-screen "signature moment" -- every kind that defines
    // one gets its own random 20-40s timer, independent of every other
    // instance of this block on the page.
    let signatureTimer;
    function scheduleSignature() {
      signatureTimer = setTimeout(() => {
        if (system.signature) {
          const { extras: newExtras, flash } = system.signature(window.innerWidth, window.innerHeight) || {};
          if (newExtras) extras.push(...newExtras);
          if (flash) { flashColor = flash.color; flashDuration = flash.duration; flashAlpha = 1; }
        }
        scheduleSignature();
      }, rand(20000, 40000));
    }
    scheduleSignature();

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
    function onPointerLeave() { pointer.active = false; }
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
        const wasAboveGround = p.y <= h;
        const needsRespawn = system.step(p, dt, w, h);
        if (needsRespawn) {
          if (system.splashOnRespawn && !p.far && wasAboveGround) {
            extras.push(makeBurstParticle({ x: p.x, y: h - 2, vx: 0, vy: 0, life: 0.35, draw: (ctx2, sp, o) => drawSplash(ctx2, sp, size, o) }));
          }
          system.respawn(p, w, h);
        }

        if (interactive && !p.held) {
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
          p.repelX = (p.repelX || 0) * Math.max(0, 1 - dt * 2.2);
          p.repelY = (p.repelY || 0) * Math.max(0, 1 - dt * 2.2);
          p.x += p.repelX;
          p.y += p.repelY;
        }

        system.draw(ctx, p, opacity);
      }

      extras = extras.filter((e) => {
        const alive = e.step(dt);
        if (alive) e.draw(ctx, opacity);
        return alive;
      });

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

      if (flashAlpha > 0) {
        flashAlpha = Math.max(0, flashAlpha - dt * (1000 / flashDuration));
        ctx.save();
        ctx.globalAlpha = flashAlpha * opacity;
        ctx.fillStyle = flashColor;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(signatureTimer);
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
