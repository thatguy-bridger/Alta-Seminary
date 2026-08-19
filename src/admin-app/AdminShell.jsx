import React from 'react';
import { supabaseBrowser } from '../lib/supabase/browser-client';
import { ThemeToggle } from '../design-system/components/core/ThemeToggle.jsx';
import logo from '../assets/alta-seminary-logo.png';

const NAV_ITEMS = [
  { href: '/admin', label: 'Pages' },
  { href: '/admin/posts', label: 'Announcements' },
  { href: '/admin/directory', label: 'Directories' },
  { href: '/admin/gallery', label: 'Gallery' },
  { href: '/admin/events', label: 'Events' },
  { href: '/admin/contact', label: 'Contact' },
  { href: '/admin/team', label: 'Team' },
  { href: '/admin/history', label: 'History' },
];

export function AdminShell({ children, activePath }) {
  async function signOut() {
    await supabaseBrowser.auth.signOut();
    window.location.href = '/admin/login';
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-6)',
          padding: 'var(--space-4) var(--space-6)',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--surface-card)',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)', flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <img src={logo.src} alt="Alta Seminary" height={32} style={{ display: 'block', width: 'auto' }} />
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--fs-caption)',
                fontWeight: 'var(--fw-bold)',
                letterSpacing: 'var(--ls-caption)',
                textTransform: 'uppercase',
                color: 'var(--text-on-secondary)',
                background: 'var(--brand-secondary)',
                borderRadius: 'var(--radius-sm)',
                padding: '3px 8px',
              }}
            >
              Admin
            </span>
          </span>
          <nav style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
            {NAV_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--fs-small)',
                  fontWeight: 'var(--fw-bold)',
                  color: activePath === item.href ? 'var(--text-primary)' : 'var(--text-secondary)',
                  textDecoration: 'none',
                  borderBottom: activePath === item.href ? '2px solid var(--brand-secondary)' : '2px solid transparent',
                  paddingBottom: 2,
                }}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <ThemeToggle />
          <button
            onClick={signOut}
            style={{
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--fs-small)',
              padding: '6px 14px',
              cursor: 'pointer',
            }}
          >
            Sign out
          </button>
        </div>
      </header>
      <main style={{ flex: 1, padding: 'var(--space-6)', background: 'var(--surface-page)' }}>{children}</main>
    </div>
  );
}
