import React from 'react';
import { EditableText } from '../admin-app/builder/EditableText.jsx';
import { textStyleToCss } from '../admin-app/builder/textStyle.js';
import { Card } from '../design-system/components/core/Card.jsx';
import { withBase } from '../lib/url.js';

const KIND_PATH = { staff: 'staff', council: 'council', missionary: 'missionaries' };

// `items` is pre-fetched and passed in by the Astro public page (see
// teaserData.js + src/lib/pages.js) since that context has no client JS to
// fetch with. When `items` isn't supplied (admin canvas/preview, both
// client-rendered), this fetches it directly via the browser Supabase client.
export function DirectoryTeaserBlock({ heading, sourceType = 'staff', count = '3', items, headingStyle, editable, onFieldChange }) {
  const [fetched, setFetched] = React.useState(null);

  React.useEffect(() => {
    if (items !== undefined) return; // pre-fetched by the caller
    let active = true;
    import('../lib/supabase/browser-client').then(({ supabaseBrowser }) =>
      import('./teaserData.js').then(({ fetchDirectoryTeaserItems }) =>
        fetchDirectoryTeaserItems(supabaseBrowser, sourceType, count).then((data) => active && setFetched(data))
      )
    );
    return () => { active = false; };
  }, [items, sourceType, count]);

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
        editable ? <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No published {sourceType} entries yet.</p> : null
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(160px, 1fr))`, gap: 'var(--space-5)' }}>
          {list.map((person) => {
            // Only the 3 original directories have a dedicated public page to
            // link to (see KIND_PATH) -- custom directories an admin creates
            // may be shown on multiple pages via multiple teaser blocks, so
            // there's no single "view all" page to send them to.
            const path = KIND_PATH[sourceType];
            const card = (
              <Card>
                {person.photo_url && (
                  <img src={person.photo_url} alt="" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-3)' }} />
                )}
                <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)', textAlign: 'center' }}>{person.name}</div>
              </Card>
            );
            return path ? (
              <a key={person.id} href={withBase(`/directory/${path}`)} style={{ textDecoration: 'none' }}>{card}</a>
            ) : (
              <div key={person.id}>{card}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
