import React from 'react';
import { supabaseBrowser } from '../lib/supabase/browser-client';

// Wraps any authenticated admin screen. Redirects to /admin/login if there's no session.
// Note: this is a client-side gate only (GitHub Pages can't check auth server-side) —
// the actual protection is Supabase RLS on every table/bucket, not this redirect.
export function AdminGuard({ children }) {
  const [status, setStatus] = React.useState('checking'); // checking | authed | anon

  React.useEffect(() => {
    let active = true;
    supabaseBrowser.auth.getSession().then(({ data }) => {
      if (!active) return;
      setStatus(data.session ? 'authed' : 'anon');
    });
    const { data: subscription } = supabaseBrowser.auth.onAuthStateChange((_event, session) => {
      setStatus(session ? 'authed' : 'anon');
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  React.useEffect(() => {
    if (status === 'anon') {
      window.location.href = '/admin/login';
    }
  }, [status]);

  if (status !== 'authed') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>
        Loading…
      </div>
    );
  }

  return children;
}
