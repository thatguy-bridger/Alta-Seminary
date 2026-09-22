import React from 'react';
import { supabaseBrowser } from '../lib/supabase/browser-client';
import { ThemeToggle } from '../design-system/components/core/ThemeToggle.jsx';
import { TextSizeToggle } from '../design-system/components/core/TextSizeToggle.jsx';
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
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

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
    <div className="admin-shell">
      {/* Only visible below the 900px breakpoint (components.css) -- the
          sidebar itself is always in the DOM, just off-screen (transform)
          until this opens it, same off-canvas pattern as the page builder's
          own mobile Style panel. */}
      <button
        className="admin-sidebar-toggle"
        onClick={() => setMobileNavOpen(true)}
        aria-label="Open admin menu"
        style={{
          position: 'fixed', top: 'var(--space-3)', left: 'var(--space-3)', zIndex: 501,
          width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
          border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
          background: 'var(--surface-card)', color: 'var(--text-primary)', cursor: 'pointer',
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="20" height="20">
          <line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" />
        </svg>
      </button>
      <div className={`admin-sidebar-backdrop${mobileNavOpen ? ' is-open' : ''}`} onClick={() => setMobileNavOpen(false)} />

      <aside className={`admin-sidebar${mobileNavOpen ? ' is-open' : ''}`}>
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
        <nav className="admin-sidebar__nav" onClick={() => setMobileNavOpen(false)}>
          {NAV_ITEMS.map((item) => (
            <a key={item.href} href={withBase(item.href)} aria-current={activePath === item.href ? 'page' : undefined}>
              {item.label}
            </a>
          ))}
        </nav>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-around', gap: 'var(--space-2)' }}>
            <TextSizeToggle />
            <ThemeToggle />
          </div>
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
              width: '100%',
            }}
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="admin-main-col">
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
    </div>
  );
}
