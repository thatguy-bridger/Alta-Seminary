import React from 'react';
import { EditableText } from '../admin-app/builder/EditableText.jsx';
import { textStyleToCss } from '../admin-app/builder/textStyle.js';
import { Card } from '../design-system/components/core/Card.jsx';
import { withBase } from '../lib/url.js';
import { linkify } from '../lib/linkify.jsx';
import { DirectoryPersonDialog } from './DirectoryPersonDialog.jsx';

const KIND_PATH = { staff: 'staff', council: 'council', missionary: 'missionaries' };

// Bio + any extra fields (phone/email/title/whatever the admin filled in),
// flattened into one snippet -- the card only has room for a preview, the
// full text lives behind the "larger preview" dialog (DirectoryPersonDialog).
function cardSnippet(person) {
  const parts = [];
  if (person.bio) parts.push(person.bio);
  if (person.extra_fields) {
    for (const value of Object.values(person.extra_fields)) {
      if (value) parts.push(String(value));
    }
  }
  return parts.join(' · ');
}

// Clips to ~3 lines and fades the last line to transparent instead of a hard
// cutoff or "…" -- reads as "there's more, go open it" rather than a truncated dead end.
const snippetStyle = {
  margin: 'var(--space-2) 0 0',
  fontFamily: 'var(--font-sans)',
  fontSize: 'var(--fs-small)',
  color: 'var(--text-secondary)',
  textAlign: 'center',
  maxHeight: '4.5em',
  lineHeight: '1.5em',
  overflow: 'hidden',
  WebkitMaskImage: 'linear-gradient(to bottom, black 55%, transparent 100%)',
  maskImage: 'linear-gradient(to bottom, black 55%, transparent 100%)',
};

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
            const snippet = cardSnippet(person);
            const header = (
              <>
                {person.photo_url && (
                  <img src={person.photo_url} alt={person.name} loading="lazy" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-3)', flexShrink: uniformCardSize ? 0 : undefined }} />
                )}
                <div
                  style={uniformCardSize
                    ? { fontFamily: 'var(--font-sans)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)', textAlign: 'center', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }
                    : { fontFamily: 'var(--font-sans)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)', textAlign: 'center' }}
                >
                  {person.name}
                </div>
              </>
            );

            // Editable (admin canvas): never a real link -- href was
            // previously always set to the live URL regardless of editable,
            // so clicking a card in the page editor actually navigated to
            // the public site instead of just selecting the block.
            //
            // The snippet below (bio/extra fields) can itself contain real
            // <a> links (email/phone/url, via linkify) -- those must NOT end
            // up nested inside this card-opening link, so only the photo+name
            // header is wrapped in the anchor; the snippet is a sibling.
            const onOwnPage = path && typeof window !== 'undefined'
              && window.location.pathname.endsWith(withBase(`/directory/${path}`));
            const headerEl = (!path || editable) ? header : (
              <a
                href={withBase(`/directory/${path}?person=${person.id}`)}
                style={{ textDecoration: 'none', display: 'block' }}
                onClick={(e) => {
                  if (!onOwnPage) return;
                  e.preventDefault();
                  setOpenPersonId(person.id);
                  const url = new URL(window.location.href);
                  url.searchParams.set('person', person.id);
                  window.history.replaceState({}, '', url);
                }}
              >
                {header}
              </a>
            );

            if (uniformCardSize) {
              return (
                <div key={person.id} style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-6)' }}>
                  {headerEl}
                  {snippet && <p style={{ ...snippetStyle, flex: 1 }}>{linkify(snippet)}</p>}
                </div>
              );
            }
            return (
              <Card key={person.id}>
                {headerEl}
                {snippet && <p style={snippetStyle}>{linkify(snippet)}</p>}
              </Card>
            );
          })}
        </div>
      )}
      {path && <DirectoryPersonDialog personId={openPersonId} sourceType={sourceType} onClose={closeDialog} />}
    </div>
  );
}
