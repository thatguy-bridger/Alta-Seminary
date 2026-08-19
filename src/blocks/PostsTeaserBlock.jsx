import React from 'react';
import { EditableText } from '../admin-app/builder/EditableText.jsx';
import { textStyleToCss } from '../admin-app/builder/textStyle.js';
import { Card } from '../design-system/components/core/Card.jsx';

// See DirectoryTeaserBlock.jsx for the `items` pre-fetch-vs-client-fetch pattern.
export function PostsTeaserBlock({ heading, count = '6', items, headingStyle, editable, onFieldChange }) {
  const [fetched, setFetched] = React.useState(null);

  React.useEffect(() => {
    if (items !== undefined) return;
    let active = true;
    import('../lib/supabase/browser-client').then(({ supabaseBrowser }) =>
      import('./teaserData.js').then(({ fetchPostsTeaserItems }) =>
        fetchPostsTeaserItems(supabaseBrowser, count).then((data) => active && setFetched(data))
      )
    );
    return () => { active = false; };
  }, [items, count]);

  const list = items !== undefined ? items : fetched;

  return (
    <div>
      {(editable || heading) && (
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-heading)', margin: '0 0 var(--space-5)', textAlign: 'center', color: 'var(--text-primary)', ...textStyleToCss(headingStyle) }}>
          {editable ? (
            <EditableText value={heading} onCommit={(v) => onFieldChange('heading', v)} placeholder="Heading" styleValue={headingStyle} onStyleChange={(s) => onFieldChange('headingStyle', s)} />
          ) : heading}
        </h2>
      )}
      {list === null ? (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</p>
      ) : list.length === 0 ? (
        editable ? <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No published announcements yet.</p> : null
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {list.map((post) => (
            <Card key={post.id}>
              <a href={editable ? undefined : `/announcements/${post.slug}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--space-3)' }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)' }}>{post.title}</span>
                  {post.published_at && (
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {new Date(post.published_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  )}
                </div>
                {post.excerpt && (
                  <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)', color: 'var(--text-secondary)', margin: 'var(--space-2) 0 0' }}>
                    {post.excerpt}
                  </p>
                )}
              </a>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
