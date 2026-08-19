import React from 'react';
import { AdminGuard } from '../AdminGuard.jsx';
import { AdminShell } from '../AdminShell.jsx';
import { PageBuilderScreen } from '../builder/PageBuilderScreen.jsx';

// Reads ?slug= client-side rather than using an Astro dynamic route --
// this is a single static shell (GitHub Pages has no server to route
// arbitrary slugs at request time), so any page's editor works without
// a rebuild, unlike a pre-rendered [slug].astro would require.
export function PageEditorPage() {
  const [slug, setSlug] = React.useState(null);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSlug(params.get('slug'));
  }, []);

  return (
    <AdminGuard>
      <AdminShell activePath="/admin">
        {slug ? <PageBuilderScreen slug={slug} /> : <p style={{ color: 'var(--text-secondary)' }}>No page specified.</p>}
      </AdminShell>
    </AdminGuard>
  );
}
