import React from 'react';
import { GalleryBlock } from './GalleryBlock.jsx';

// The photos from this event's linked album, shown on its page automatically
// once the album is published and has published photos -- add pictures during
// or after the event and they appear here with nothing else to do. Until then
// the block renders nothing at all on the public site (no empty "Photos"
// heading), and says what it's waiting for in the page editor.
//
// `items` is pre-fetched server-side (teaserData.js fetchEventPhotos); the
// editor fetches the same thing itself.
export function EventPhotosBlock({ eventId, heading = 'Photos', columns = '3', items, editable }) {
  const [fetched, setFetched] = React.useState(undefined);

  React.useEffect(() => {
    if (items !== undefined || !eventId) return;
    let active = true;
    import('../lib/supabase/browser-client').then(({ supabaseBrowser }) =>
      import('./teaserData.js').then(({ fetchEventPhotos }) =>
        fetchEventPhotos(supabaseBrowser, eventId).then((data) => active && setFetched(data))
      )
    );
    return () => { active = false; };
  }, [items, eventId]);

  const photos = items !== undefined ? items : fetched;
  if (!photos || photos.length === 0) {
    if (!editable) return null;
    return (
      <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
        Photos will appear here once this event's album is published and has photos.
      </p>
    );
  }
  return (
    <div id="photos">
      <GalleryBlock heading={heading} columns={columns} items={photos} />
    </div>
  );
}
