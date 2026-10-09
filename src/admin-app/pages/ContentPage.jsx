import React from 'react';
import { AdminGuard } from '../AdminGuard.jsx';
import { AdminShell } from '../AdminShell.jsx';
import { ContentScreen } from '../screens/ContentScreen.jsx';

// The one admin home for announcements, events and photo albums. The old
// /admin/posts and /admin/events URLs (PostsListPage/EventsPage) render this
// too, just opened on their own tab, so existing links and bookmarks work.
export function ContentPage({ initialKind = 'all' }) {
  return (
    <AdminGuard>
      <AdminShell activePath="/admin/content">
        <ContentScreen initialKind={initialKind} />
      </AdminShell>
    </AdminGuard>
  );
}
