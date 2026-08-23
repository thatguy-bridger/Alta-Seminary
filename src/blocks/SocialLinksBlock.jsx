import React from 'react';
import { TEXT_COLOR_TOKENS } from '../lib/richTextTokens.js';

// Simple, recognizable line-art glyphs -- consistent with the rest of the
// design system's hand-drawn icon style (see ThemeToggle.jsx) rather than
// pulling in a whole brand-icon library for five icons.
const ICONS = {
  facebook: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  ),
  youtube: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
      <path d="M22 8.5s-.2-1.6-.8-2.3c-.8-.9-1.7-.9-2.1-1C16.3 5 12 5 12 5s-4.3 0-7.1.2c-.4 0-1.3.1-2.1 1C2.2 6.9 2 8.5 2 8.5S1.8 10.4 1.8 12.3v1.8c0 1.9.2 3.8.2 3.8s.2 1.6.8 2.3c.8.9 1.9.9 2.4 1 1.7.2 7.3.2 7.3.2s4.3 0 7.1-.2c.4 0 1.3-.1 2.1-1 .6-.7.8-2.3.8-2.3s.2-1.9.2-3.8v-1.8c0-1.9-.2-3.8-.2-3.8z" />
      <polygon points="10 15 15 12 10 9" fill="currentColor" stroke="none" />
    </svg>
  ),
  x: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
      <line x1="4" y1="4" x2="20" y2="20" /><line x1="20" y1="4" x2="4" y2="20" />
    </svg>
  ),
  tiktok: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
      <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
    </svg>
  ),
};

// Circle diameter, icon glyph size (scaled down via cloneElement below since
// each SVG above has its own fixed width/height="20" baked in), handle font
// size, and the gap between icons -- all four move together per step so
// "Large" doesn't end up with a huge icon crammed against tiny handle text.
const SIZES = {
  small: { circle: 32, icon: 16, font: 'var(--fs-caption)', gap: 'var(--space-3)' },
  medium: { circle: 40, icon: 20, font: 'var(--fs-small)', gap: 'var(--space-4)' },
  large: { circle: 52, icon: 26, font: 'var(--fs-body)', gap: 'var(--space-5)' },
  xl: { circle: 64, icon: 32, font: 'var(--fs-body-lg)', gap: 'var(--space-6)' },
};

// Each platform's own real brand color(s) -- a plain CSS `background` value,
// so a single hex works for the ones with one, and a gradient string works
// unchanged for Instagram/TikTok, which don't really have just one.
const BRANDS = {
  facebook: '#1877F2',
  instagram: 'linear-gradient(45deg,#405DE6,#5851DB,#833AB4,#C13584,#E1306C,#FD1D1D,#F77737,#FCAF45)',
  youtube: '#FF0000',
  x: '#000000',
  tiktok: 'linear-gradient(135deg,#25F4EE,#000000 50%,#FE2C55)',
};

// "Hover fill color" options besides each platform's own real colors -- the
// same 6 curated site tokens used everywhere else text/backgrounds get a
// color choice (see richTextTokens.js), so a flat option here still resolves
// to a real design-system variable (correct in both themes) instead of a
// raw hex.
const HOVER_TOKEN_COLOR = Object.fromEntries(TEXT_COLOR_TOKENS.map((t) => [t.key, `var(${t.var})`]));

const PLATFORMS = [
  { key: 'facebookUrl', handleKey: 'facebookHandle', icon: 'facebook', label: 'Facebook' },
  { key: 'instagramUrl', handleKey: 'instagramHandle', icon: 'instagram', label: 'Instagram' },
  { key: 'youtubeUrl', handleKey: 'youtubeHandle', icon: 'youtube', label: 'YouTube' },
  { key: 'xUrl', handleKey: 'xHandle', icon: 'x', label: 'X (Twitter)' },
  { key: 'tiktokUrl', handleKey: 'tiktokHandle', icon: 'tiktok', label: 'TikTok' },
];

// Pulls a displayable "@handle" out of a profile URL -- the first real path
// segment is the username/page-name on every one of these platforms (e.g.
// instagram.com/alta.seminary, tiktok.com/@alta.seminary, x.com/altaseminary),
// whether or not the admin already included TikTok's own leading "@" when
// pasting the link. Falls back to '' (icon-only, same as before this
// feature existed) for anything that doesn't parse as a URL at all.
function extractHandle(url) {
  if (!url) return '';
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    const segment = u.pathname.split('/').filter(Boolean)[0] || '';
    return segment ? `@${segment.replace(/^@/, '')}` : '';
  } catch {
    return '';
  }
}

// A manually-typed handle (with or without its own leading "@") always wins
// over whatever extractHandle() would have read out of the URL -- the URL's
// first path segment isn't always the actual handle worth showing (a
// vanity/shortened URL, a YouTube /channel/UC... ID instead of a @name, a
// URL that still points at the right profile but under an old username).
function formatHandle(raw) {
  const trimmed = (raw || '').trim();
  return trimmed ? `@${trimmed.replace(/^@/, '')}` : '';
}

// A slow radial "fill" that grows outward from wherever the cursor entered,
// in that platform's own real brand color -- purely decorative (the user
// asked for it "for the fun of it"), so it's skipped entirely for a
// not-yet-filled-in field in the editor (nothing to link to yet, no reason
// to invite a hover). clip-path (not a CSS custom property driving a
// gradient's position) is what actually animates smoothly here -- browsers
// interpolate a `circle(r% at x% y%)` you hand them directly just fine, but
// won't smoothly tween a plain custom property feeding into one without
// registering it via @property first, which is extra ceremony a purely-fun
// hover effect doesn't need.
function SocialIconLink({ platform, href, handle, disabled, s, fillEnabled, fillColor, style }) {
  const ref = React.useRef(null);
  const [pos, setPos] = React.useState({ x: 50, y: 50 });
  const [hovered, setHovered] = React.useState(false);
  const showFill = fillEnabled && !disabled;
  // 'platform' keeps each icon's own real brand color/gradient (the
  // original version of this feature); any other choice is one of the
  // site's own curated color tokens instead, resolved to a flat fill.
  const fill = fillColor === 'platform' ? BRANDS[platform.icon] : (HOVER_TOKEN_COLOR[fillColor] || BRANDS[platform.icon]);

  function updatePos(e) {
    const rect = ref.current.getBoundingClientRect();
    setPos({ x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 });
  }

  return (
    <a
      ref={ref}
      href={href}
      aria-label={platform.label}
      title={platform.label}
      onMouseEnter={(e) => { if (!showFill) return; updatePos(e); setHovered(true); }}
      onMouseMove={(e) => { if (!showFill) return; updatePos(e); }}
      onMouseLeave={() => setHovered(false)}
      style={{ ...style, position: 'relative', overflow: 'hidden' }}
    >
      {showFill && (
        <span
          aria-hidden
          style={{
            position: 'absolute', inset: 0,
            background: fill,
            clipPath: `circle(${hovered ? 150 : 0}% at ${pos.x}% ${pos.y}%)`,
            transition: 'clip-path 0.6s ease',
          }}
        />
      )}
      <span style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: showFill && hovered ? '#fff' : 'inherit', transition: 'color 0.3s ease' }}>
        {React.cloneElement(ICONS[platform.icon], { width: s.icon, height: s.icon })}
        {handle && <span>{handle}</span>}
      </span>
    </a>
  );
}

export function SocialLinksBlock({ align = 'center', showHandles = false, size = 'medium', hoverFill = true, hoverColor = 'platform', editable, ...props }) {
  const active = PLATFORMS.filter((p) => props[p.key]);
  if (!editable && active.length === 0) return null;
  const s = SIZES[size] || SIZES.medium;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center', gap: s.gap }}>
      {(editable ? PLATFORMS : active).map((p) => {
        const handle = showHandles ? (formatHandle(props[p.handleKey]) || extractHandle(props[p.key])) : '';
        const disabled = editable && !props[p.key];
        return (
          <SocialIconLink
            key={p.key}
            platform={p}
            href={editable ? undefined : props[p.key]}
            handle={handle}
            disabled={disabled}
            fillEnabled={hoverFill}
            fillColor={hoverColor}
            s={s}
            style={{
              height: s.circle, borderRadius: handle ? 'var(--radius-pill)' : '50%',
              width: handle ? undefined : s.circle, padding: handle ? `0 ${s.gap} 0 var(--space-3)` : 0,
              border: '1px solid var(--border-default)', textDecoration: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: disabled ? 'var(--text-muted)' : 'var(--text-primary)',
              opacity: disabled ? 0.4 : 1,
              fontFamily: 'var(--font-sans)', fontSize: s.font, fontWeight: 'var(--fw-bold)',
            }}
          />
        );
      })}
    </div>
  );
}
