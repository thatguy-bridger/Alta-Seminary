import React from 'react';
import { EditableText } from '../admin-app/builder/EditableText.jsx';
import { textStyleToCss } from '../admin-app/builder/textStyle.js';
import { Card } from '../design-system/components/core/Card.jsx';
import { withBase } from '../lib/url.js';
import { DirectoryPersonDialog } from './DirectoryPersonDialog.jsx';

const KIND_PATH = { staff: 'staff', council: 'council', missionary: 'missionaries' };

// `items` is pre-fetched and passed in by the Astro public page (see
// teaserData.js + src/lib/pages.js) since that context has no client JS to
// fetch with. When `items` isn't supplied (admin canvas/preview, both
// client-rendered), this fetches it directly via the browser Supabase client.
export function DirectoryTeaserBlock({ heading, sourceType = 'staff', count = '3', uniformCardSize = false, items, headingStyle, editable, onFieldChange }) {
  const [fetched, setFetched] = React.useState(null);
  const [openPersonId, setOpenPersonId] = React.useState(null);
  const path = KIND_PATH[sourceType];

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

  // Auto-opens the "larger preview" on load when this is the directory page
  // a person link sent the visitor to (?person=<id>) -- see the card links
  // below. Guarded to this block's own canonical page so a teaser elsewhere
  // (e.g. the homepage) never mistakenly opens it.
  React.useEffect(() => {
    if (editable || !path || typeof window === 'undefined') return;
    if (!window.location.pathname.endsWith(withBase(`/directory/${path}`))) return;
    const personId = new URLSearchParams(window.location.search).get('person');
    if (personId) setOpenPersonId(personId);
  }, [editable, path]);

  function closeDialog() {
    setOpenPersonId(null);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('person');
      window.history.replaceState({}, '', url);
    }
  }

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
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(160px, 1fr))`, gap: 'var(--space-5)', gridAutoRows: uniformCardSize ? '1fr' : undefined }}>
          {list.map((person) => {
            // Only the 3 original directories have a dedicated public page to
            // link to (see KIND_PATH) -- custom directories an admin creates
            // may be shown on multiple pages via multiple teaser blocks, so
            // there's no single "view all" page to send them to.
            //
            // uniformCardSize: gridAutoRows:'1fr' above stretches every card
            // to the tallest row's height, but the card itself needs
            // height:100% to actually fill that instead of leaving blank
            // space -- Card.jsx has no style passthrough for that, so this
            // reimplements its look inline rather than wrapping it. Content
            // that doesn't fit the resulting fixed height (a longer name)
            // clips via line-clamp rather than growing the card back out.
            const card = uniformCardSize ? (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-6)' }}>
                {person.photo_url && (
                  <img src={person.photo_url} alt={person.name} loading="lazy" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-3)', flexShrink: 0 }} />
                )}
                <div
                  style={{
                    fontFamily: 'var(--font-sans)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)', textAlign: 'center',
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}
                >
                  {person.name}
                </div>
              </div>
            ) : (
              <Card>
                {person.photo_url && (
                  <img src={person.photo_url} alt={person.name} loading="lazy" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-3)' }} />
                )}
                <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)', textAlign: 'center' }}>{person.name}</div>
              </Card>
            );
            // Editable (admin canvas): never a real link -- href was
            // previously always set to the live URL regardless of editable,
            // so clicking a card in the page editor actually navigated to
            // the public site instead of just selecting the block.
            if (!path || editable) return <div key={person.id} style={{ height: uniformCardSize ? '100%' : undefined }}>{card}</div>;
            // Already on this directory's own page -- open the larger
            // preview in place instead of a pointless self-navigation.
            const onOwnPage = typeof window !== 'undefined'
              && window.location.pathname.endsWith(withBase(`/directory/${path}`));
            return (
              <a
                key={person.id}
                href={withBase(`/directory/${path}?person=${person.id}`)}
                style={{ textDecoration: 'none', display: uniformCardSize ? 'block' : undefined, height: uniformCardSize ? '100%' : undefined }}
                onClick={(e) => {
                  if (!onOwnPage) return;
                  e.preventDefault();
                  setOpenPersonId(person.id);
                  const url = new URL(window.location.href);
                  url.searchParams.set('person', person.id);
                  window.history.replaceState({}, '', url);
                }}
              >
                {card}
              </a>
            );
          })}
        </div>
      )}
      {path && <DirectoryPersonDialog personId={openPersonId} sourceType={sourceType} onClose={closeDialog} />}
    </div>
  );
}
