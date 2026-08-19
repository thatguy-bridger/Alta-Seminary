import React from 'react';
import { AdminGuard } from '../AdminGuard.jsx';
import { AdminShell } from '../AdminShell.jsx';
import { PageBuilderScreen } from '../builder/PageBuilderScreen.jsx';

// Same query-param pattern as PageEditorPage.jsx -- see that file's comment.
export function PostEditorPage() {
  const [slug, setSlug] = React.useState(null);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSlug(params.get('slug'));
  }, []);

  return (
    <AdminGuard>
      <AdminShell activePath="/admin/posts">
        {slug ? <PageBuilderScreen slug={slug} table="blog_posts" backHref="/admin/posts" /> : <p style={{ color: 'var(--text-secondary)' }}>No post specified.</p>}
      </AdminShell>
    </AdminGuard>
  );
}
