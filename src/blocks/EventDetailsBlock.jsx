import React from 'react';
import { Badge } from '../design-system/components/core/Badge.jsx';
import { formatEventWhen } from '../lib/dateFormat.js';
import { eventPhase } from '../lib/eventPhase.js';
import { withBase } from '../lib/url.js';

// The heart of an event's own page: its title, when, where, and what -- read
// LIVE from the event record, so correcting the date or location in the
// Content screen fixes the page too. Nothing here is copied text that can
// drift out of date.
//
// Once the event is over it turns into the archive version of itself: a
// "this event has passed" notice leads, and the rest (including the Photos
// block that follows it) stays exactly as it was, so everything is still there
// to look at -- it just stops presenting itself as upcoming.
//
// `items` is the event, pre-fetched on the server (see teaserData.js
// fetchEventDetails, which also works out `phase` once so the server HTML and
// the browser's first render agree). Without it (the admin canvas/preview) it
// fetches the same thing itself.
const PHASE_BADGE = { upcoming: { tone: 'info', label: 'Upcoming' }, live: { tone: 'success', label: 'Happening now' }, past: { tone: 'neutral', label: 'Past event' } };

export function EventDetailsBlock({ eventId, showDescription = true, showCalendarButton = true, items, editable }) {
  const [fetched, setFetched] = React.useState(undefined);

  React.useEffect(() => {
    if (items !== undefined || !eventId) return;
    let active = true;
    import('../lib/supabase/browser-client').then(({ supabaseBrowser }) =>
      import('./teaserData.js').then(({ fetchEventDetails }) =>
        fetchEventDetails(supabaseBrowser, eventId).then((data) => active && setFetched(data))
      )
    );
    return () => { active = false; };
  }, [items, eventId]);

  const event = items !== undefined ? items : fetched;

  if (!event) {
    if (!editable) return null;
    return (
      <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
        {eventId ? 'Loading event details…' : 'Event details appear here -- this block shows the event it belongs to.'}
      </p>
    );
  }

  const phase = event.phase || eventPhase(event);
  const badge = PHASE_BADGE[phase];

  async function addToCalendar() {
    const { downloadIcs } = await import('./icsExport.js');
    downloadIcs([event], `${event.title}.ics`);
  }

  return (
    <section style={{ textAlign: 'center', fontFamily: 'var(--font-sans)' }}>
      {phase === 'past' && (
        <p
          role="note"
          style={{ margin: '0 0 var(--space-5)', padding: 'var(--space-3) var(--space-4)', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)', fontSize: 'var(--fs-small)' }}
        >
          This event has passed. It stays here so you can look back on it.
        </p>
      )}
      <div style={{ marginBottom: 'var(--space-3)' }}><Badge tone={badge.tone}>{badge.label}</Badge></div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-display)', color: 'var(--text-primary)', margin: '0 0 var(--space-3)' }}>
        {event.title}
      </h1>
      <p style={{ margin: 0, fontSize: 'var(--fs-body-lg)', color: 'var(--text-primary)' }}>{formatEventWhen(event)}</p>
      {event.location && (
        <p style={{ margin: 'var(--space-1) 0 0', fontSize: 'var(--fs-body)', color: 'var(--text-secondary)' }}>{event.location}</p>
      )}
      {showDescription && event.description && (
        <p style={{ margin: 'var(--space-5) auto 0', maxWidth: 640, fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', textAlign: 'left' }}>
          {event.description}
        </p>
      )}
      {!editable && (
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 'var(--space-4)', marginTop: 'var(--space-5)', fontSize: 'var(--fs-small)' }}>
          {showCalendarButton && phase !== 'past' && (
            <button onClick={addToCalendar} style={linkButton}>+ Add to calendar</button>
          )}
          <a href={withBase('/events')} style={{ ...linkButton, textDecoration: 'none' }}>← All events</a>
        </div>
      )}
    </section>
  );
}

const linkButton = { border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-link)', fontFamily: 'inherit', fontSize: 'inherit' };
