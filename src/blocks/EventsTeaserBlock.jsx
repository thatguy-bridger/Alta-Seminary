import React from 'react';
import { EditableText } from '../admin-app/builder/EditableText.jsx';
import { textStyleToCss } from '../admin-app/builder/textStyle.js';
import { Card } from '../design-system/components/core/Card.jsx';
import { Badge } from '../design-system/components/core/Badge.jsx';

// See DirectoryTeaserBlock.jsx for the `items` pre-fetch-vs-client-fetch pattern.
export function EventsTeaserBlock({ heading, count = '3', timeframe = 'upcoming', items, headingStyle, editable, onFieldChange }) {
  const [fetched, setFetched] = React.useState(null);
  const [selected, setSelected] = React.useState(() => new Set());

  React.useEffect(() => {
    if (items !== undefined) return;
    let active = true;
    import('../lib/supabase/browser-client').then(({ supabaseBrowser }) =>
      import('./teaserData.js').then(({ fetchEventsTeaserItems }) =>
        fetchEventsTeaserItems(supabaseBrowser, count, timeframe).then((data) => active && setFetched(data))
      )
    );
    return () => { active = false; };
  }, [items, count, timeframe]);

  const list = items !== undefined ? items : fetched;

  function toggleSelected(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function exportEvents(events, filename) {
    import('./icsExport.js').then(({ downloadIcs }) => downloadIcs(events, filename));
  }

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
        editable ? <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No {timeframe === 'upcoming' ? 'upcoming ' : ''}published events yet.</p> : null
      ) : (
        <>
          {!editable && list.length > 1 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginBottom: 'var(--space-3)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)' }}>
              {selected.size > 0 && (
                <button onClick={() => exportEvents(list.filter((e) => selected.has(e.id)), 'events.ics')} style={linkBtnStyle}>
                  Export {selected.size} selected ↓
                </button>
              )}
              <button onClick={() => exportEvents(list, 'events.ics')} style={linkBtnStyle}>Export all ↓</button>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {list.map((event) => (
              <Card key={event.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                  {!editable && (
                    <input
                      type="checkbox"
                      checked={selected.has(event.id)}
                      onChange={() => toggleSelected(event.id)}
                      aria-label={`Select ${event.title} for export`}
                      style={{ marginTop: 4 }}
                    />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)' }}>{event.title}</div>
                    {event.location && <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)', color: 'var(--text-muted)' }}>{event.location}</div>}
                    {event.description && <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)', color: 'var(--text-secondary)', marginTop: 'var(--space-2)' }}>{event.description}</div>}
                    {!editable && (
                      <button onClick={() => exportEvents([event], `${event.title}.ics`)} style={{ ...linkBtnStyle, marginTop: 'var(--space-2)' }}>
                        + Add to calendar
                      </button>
                    )}
                  </div>
                  <Badge tone="info">
                    {new Date(event.start_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    {!event.all_day && ` · ${new Date(event.start_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const linkBtnStyle = {
  border: 'none', background: 'none', padding: 0, cursor: 'pointer',
  color: 'var(--text-link)', fontFamily: 'inherit', fontSize: 'inherit',
};
