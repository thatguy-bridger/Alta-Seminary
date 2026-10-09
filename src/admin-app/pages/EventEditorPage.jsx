import React from 'react';
import { AdminGuard } from '../AdminGuard.jsx';
import { AdminShell } from '../AdminShell.jsx';
import { PageBuilderScreen } from '../builder/PageBuilderScreen.jsx';

// An event's own page, in the same editor as pages and announcements. Same
// query-param pattern as PostEditorPage.jsx / PageEditorPage.jsx.
export function EventEditorPage() {
  const [slug, setSlug] = React.useState(null);

  React.useEffect(() => {
    setSlug(new URLSearchParams(window.location.search).get('slug'));
  }, []);

  return (
    <AdminGuard>
      <AdminShell activePath="/admin/content">
        {slug
          ? <PageBuilderScreen slug={slug} table="calendar_events" backHref="/admin/content?kind=event" />
          : <p style={{ color: 'var(--text-secondary)' }}>No event specified.</p>}
      </AdminShell>
    </AdminGuard>
  );
}
