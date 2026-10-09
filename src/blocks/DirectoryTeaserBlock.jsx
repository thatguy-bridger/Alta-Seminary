import React from 'react';
import { EditableText } from '../admin-app/builder/EditableText.jsx';
import { RichText } from './richText.jsx';
import { textStyleToCss } from '../admin-app/builder/textStyle.js';
import { Card } from '../design-system/components/core/Card.jsx';
import { withBase } from '../lib/url.js';
import { linkify } from '../lib/linkify.jsx';
import { DirectoryPersonDialog } from './DirectoryPersonDialog.jsx';

const KIND_PATH = { staff: 'staff', council: 'council', missionary: 'missionaries' };

// The role/title gets its own line at the top of the card (see `header`), so
// it's left out of the snippet. "term" was removed as a directory field
// entirely; it's skipped here too in case a stray value ever lingers.
const NOT_IN_SNIPPET = ['role', 'term'];

// Bio + any other extra fields (phone/email/whatever the admin filled in),
// flattened into one snippet -- the card only has room for a preview, the
// full text lives behind the "larger preview" dialog (DirectoryPersonDialog).
export function cardSnippet(person) {
  const parts = [];
  if (person.bio) parts.push(person.bio);
  if (person.extra_fields) {
    for (const [key, value] of Object.entries(person.extra_fields)) {
      if (value && !NOT_IN_SNIPPET.includes(key)) parts.push(String(value));
    }
  }
  return parts.join(' · ');
}

// Clips to ~5 lines and fades the last line to transparent instead of a hard
// cutoff or "…" -- reads as "there's more, go open it" rather than a truncated dead end.
// (It used to be 3; the cards are taller now so more of the bio shows.)
const snippetStyle = {
  margin: 'var(--space-2) 0 0',
  fontFamily: 'var(--font-sans)',
  fontSize: 'var(--fs-small)',
  color: 'var(--text-secondary)',
  textAlign: 'center',
  maxHeight: '7.5em',
  lineHeight: '1.5em',
  overflow: 'hidden',
  WebkitMaskImage: 'linear-gradient(to bottom, black 65%, transparent 100%)',
  maskImage: 'linear-gradient(to bottom, black 65%, transparent 100%)',
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

  const list = items !== undefined ? items : fetched;

  // Auto-opens the "larger preview" on load when the URL carries
  // ?person=<id> (a card link, a carousel slide, a shared link) and that
  // person is one this block is showing. This used to also require the
  // page's pathname to end with the directory's hardcoded "/directory/staff"
  // -- which silently broke every faculty card the moment that page was
  // renamed to /directory/faculty-directory: the check failed, so nothing
  // ever opened. Whether the person is in THIS block's own list is the real
  // question, and doesn't depend on what any page is called.
  React.useEffect(() => {
    if (editable || !list || typeof window === 'undefined') return;
    const personId = new URLSearchParams(window.location.search).get('person');
    if (personId && list.some((p) => p.id === personId)) setOpenPersonId(personId);
  }, [editable, list]);

  function closeDialog() {
    setOpenPersonId(null);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('person');
      window.history.replaceState({}, '', url);
    }
  }

  return (
    <div>
      {(editable || heading) && (
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-heading)', margin: '0 0 var(--space-5)', textAlign: 'center', color: 'var(--text-primary)', ...textStyleToCss(headingStyle) }}>
          {editable ? (
            <EditableText value={heading} onCommit={(v) => onFieldChange('heading', v)} placeholder="Heading" styleValue={headingStyle} onStyleChange={(s) => onFieldChange('headingStyle', s)} />
          ) : <RichText inline text={heading} />}
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
                {/* Role / title leads the card, in the site's accent red. */}
                {person.extra_fields?.role && (
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-bold)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-link)', textAlign: 'center', marginBottom: 'var(--space-3)' }}>
                    {person.extra_fields.role}
                  </div>
                )}
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

            // Editable (admin canvas): never interactive -- clicking a card
            // in the page editor should just select the block, not open
            // anything or navigate to the live site.
            //
            // Outside the editor the WHOLE card opens the larger preview, not
            // just the photo and name: the click handler sits on a wrapper
            // around the entire card, and only steps aside for a link INSIDE
            // the bio snippet (an email/phone/url from linkify) so those
            // still work as links. The photo+name header stays a real <a> to
            // the directory's own page (?person=<id>) as the no-JavaScript /
            // new-tab / crawler fallback; with JavaScript, a plain click is
            // intercepted and opens the preview right here on whatever page
            // the card is on -- including the homepage teasers.
            // Interactive for EVERY directory, not just the three built-in
            // kinds in KIND_PATH: renaming "Staff" to "Faculty" changed its
            // kind to a custom one, which used to mean plain dead cards with
            // no preview at all. The preview dialog only needs a person id,
            // so it works for any directory; KIND_PATH now only decides where
            // the no-JavaScript fallback link points (a custom directory has
            // no dedicated page, so it falls back to the page it's already on).
            const interactive = !editable;
            const openPerson = () => {
              setOpenPersonId(person.id);
              const url = new URL(window.location.href);
              url.searchParams.set('person', person.id);
              window.history.replaceState({}, '', url);
            };
            const headerEl = !interactive ? header : (
              <a
                href={path ? withBase(`/directory/${path}?person=${person.id}`) : `?person=${person.id}`}
                data-person-open
                style={{ textDecoration: 'none', display: 'block' }}
                onClick={(e) => {
                  // Let a modified click (new tab/window) behave normally.
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) e.stopPropagation();
                  else e.preventDefault();
                }}
              >
                {header}
              </a>
            );
            const wrapperProps = !interactive ? {} : {
              style: { cursor: 'pointer', height: uniformCardSize ? '100%' : undefined },
              onClick: (e) => {
                const link = e.target.closest('a');
                if (link && !link.hasAttribute('data-person-open')) return; // a real link in the bio
                if (link && (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0)) return;
                openPerson();
              },
            };

            if (uniformCardSize) {
              return (
                <div key={person.id} {...wrapperProps} style={{ ...wrapperProps.style, height: '100%' }}>
                  <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', padding: 'var(--space-6)' }}>
                    {headerEl}
                    {snippet && <p style={{ ...snippetStyle, flex: 1 }}>{linkify(snippet)}</p>}
                  </div>
                </div>
              );
            }
            return (
              <div key={person.id} {...wrapperProps}>
                <Card>
                  {headerEl}
                  {snippet && <p style={snippetStyle}>{linkify(snippet)}</p>}
                </Card>
              </div>
            );
          })}
        </div>
      )}
      {!editable && <DirectoryPersonDialog personId={openPersonId} sourceType={sourceType} onClose={closeDialog} />}
    </div>
  );
}
