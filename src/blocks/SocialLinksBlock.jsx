import React from 'react';

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

const PLATFORMS = [
  { key: 'facebookUrl', icon: 'facebook', label: 'Facebook' },
  { key: 'instagramUrl', icon: 'instagram', label: 'Instagram' },
  { key: 'youtubeUrl', icon: 'youtube', label: 'YouTube' },
  { key: 'xUrl', icon: 'x', label: 'X (Twitter)' },
  { key: 'tiktokUrl', icon: 'tiktok', label: 'TikTok' },
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

export function SocialLinksBlock({ align = 'center', showHandles = false, editable, ...props }) {
  const active = PLATFORMS.filter((p) => props[p.key]);
  if (!editable && active.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center', gap: 'var(--space-4)' }}>
      {(editable ? PLATFORMS : active).map((p) => {
        const handle = showHandles ? extractHandle(props[p.key]) : '';
        const disabled = editable && !props[p.key];
        return (
          <a
            key={p.key}
            href={editable ? undefined : props[p.key]}
            aria-label={p.label}
            title={p.label}
            style={{
              height: 40, borderRadius: handle ? 'var(--radius-pill)' : '50%',
              width: handle ? undefined : 40, padding: handle ? '0 var(--space-4) 0 var(--space-3)' : 0,
              border: '1px solid var(--border-default)', textDecoration: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)',
              color: disabled ? 'var(--text-muted)' : 'var(--text-primary)',
              opacity: disabled ? 0.4 : 1,
              fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)', fontWeight: 'var(--fw-bold)',
            }}
          >
            {ICONS[p.icon]}
            {handle && <span>{handle}</span>}
          </a>
        );
      })}
    </div>
  );
}
