import React from 'react';
import { supabaseBrowser } from '../lib/supabase/browser-client';
import { ThemeToggle } from '../design-system/components/core/ThemeToggle.jsx';
import { ConfirmProvider } from './ConfirmProvider.jsx';
import { withBase } from '../lib/url.js';
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
  { href: '/admin/diagnostics', label: 'Diagnostics' },
];

const DISMISSED_KEY = 'alta-dismissed-deploy-error';

export function AdminShell({ children, activePath }) {
  const [deployError, setDeployError] = React.useState(null);

  async function signOut() {
    await supabaseBrowser.auth.signOut();
    window.location.href = withBase('/admin/login');
  }

  React.useEffect(() => {
    let active = true;
    supabaseBrowser
      .from('change_log')
      .select('id, created_at, after_data')
      .eq('table_name', 'deploy')
      .eq('action', 'error')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!active || !data) return;
        if (localStorage.getItem(DISMISSED_KEY) === data.id) return;
        setDeployError(data);
      });
    return () => { active = false; };
  }, []);

  function dismissDeployError() {
    if (deployError) localStorage.setItem(DISMISSED_KEY, deployError.id);
    setDeployError(null);
  }

  return (
    // minWidth: 0 on this flex chain (here and <main> below) -- a flex
    // container's default min-width is `auto`, not 0, so any wide content
    // deep inside (a long unbroken row, a wide grid) would otherwise force
    // this whole column wider than the viewport instead of being allowed to
    // shrink/wrap, which is what actually causes a page-wide horizontal
    // scrollbar (not fixable by clipping overflow at this level -- that
    // breaks position:sticky, see the Style panel sidebar).
    <div style={{ minHeight: '100vh', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
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
                href={withBase(item.href)}
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
      {deployError && (
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)',
            padding: 'var(--space-3) var(--space-6)', background: 'var(--tint-error-bg)', color: 'var(--color-error)',
            fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)', flexWrap: 'wrap',
          }}
        >
          <span>
            The site failed to deploy after your last publish.{' '}
            <a href={withBase('/admin/history')} style={{ color: 'inherit', textDecoration: 'underline' }}>See details in History</a>.
          </span>
          <button
            onClick={dismissDeployError}
            style={{ border: 'none', background: 'transparent', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', padding: 0 }}
          >
            Dismiss
          </button>
        </div>
      )}
      <main style={{ flex: 1, minWidth: 0, padding: 'var(--space-6)', background: 'var(--surface-page)' }}>
        <ConfirmProvider>{children}</ConfirmProvider>
      </main>
    </div>
  );
}
