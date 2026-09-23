import React from 'react';
import { supabaseBrowser } from '../../lib/supabase/browser-client';
import { Card } from '../../design-system/components/core/Card.jsx';
import { Badge } from '../../design-system/components/core/Badge.jsx';
import { Button } from '../../design-system/components/forms/Button.jsx';
import { Input } from '../../design-system/components/forms/Input.jsx';
import { Textarea } from '../../design-system/components/forms/Textarea.jsx';
import { Select } from '../../design-system/components/forms/Select.jsx';
import { Switch } from '../../design-system/components/forms/Switch.jsx';
import { Dialog } from '../../design-system/components/core/Dialog.jsx';
import { EyeIcon, EyeOffIcon, TrashIcon } from '../icons.jsx';
import { useConfirm } from '../ConfirmProvider.jsx';
import { useBulkListShortcuts } from '../useBulkListShortcuts.js';
import { useModKeyLabel } from '../useModKeyLabel.js';
import { UsedOnLine } from '../UsedOnLine.jsx';
import { slugify, uniqueSlug } from '../slug.js';
import { withBase } from '../../lib/url.js';
import { linkContent } from '../contentLinks.js';
import { LinkedContentPanel } from '../LinkedContentPanel.jsx';

const emptyEvent = () => ({
  title: '', description: '', location: '', start_at: '', end_at: '', all_day: false, status: 'draft',
});

// Datetime-local inputs need "YYYY-MM-DDTHH:mm" with no timezone suffix;
// Postgres timestamptz values round-trip as ISO strings with one, so this
// pair of helpers strips/restores that for the form fields specifically.
function toLocalInputValue(isoString, allDay) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return allDay ? date : `${date}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(value, allDay) {
  if (!value) return null;
  const iso = allDay ? new Date(`${value}T00:00`).toISOString() : new Date(value).toISOString();
  return iso;
}

export function EventsScreen() {
  const confirm = useConfirm();
  const modKeyLabel = useModKeyLabel();
  const [events, setEvents] = React.useState(null);
  const [editing, setEditing] = React.useState(null);
  const [saving, setSaving] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [selected, setSelected] = React.useState(() => new Set());
  const highlightId = React.useMemo(() => new URLSearchParams(window.location.search).get('event'), []);

  async function load() {
    const { data } = await supabaseBrowser.from('calendar_events').select('*').order('start_at', { ascending: false });
    setEvents(data || []);
  }

  React.useEffect(() => { load(); }, []);

  React.useEffect(() => {
    if (!highlightId || !events) return;
    document.getElementById(`event-${highlightId}`)?.scrollIntoView({ block: 'center' });
  }, [highlightId, events]);

  // Prefills a sensible starting point: the event's own title/timing as a
  // Hero heading+subheading, and -- the actual point of this button --
  // unpublish_at defaulted to when the event itself ends (or starts, if no
  // end time), so the announcement doesn't just sit there advertising an
  // event that already happened. `?schedule=1` on the redirect opens the
  // editor straight into "Schedule for later" so the admin is immediately
  // asked for a PUBLISH time too, same turn -- nothing here guesses that
  // one, since "announce it now" vs "announce it a week before" is a real
  // choice only the admin can make. The new post is linked back to this
  // event through content_links (contentLinks.js) -- the same generic
  // link every OTHER pair of event/announcement/album uses, so it shows up
  // identically via LinkedContentPanel on either side.
  async function createAnnouncementForEvent(row) {
    const slug = await uniqueSlug('blog_posts', slugify(row.title));
    const when = new Date(row.start_at).toLocaleString(undefined, row.all_day
      ? { month: 'long', day: 'numeric', year: 'numeric' }
      : { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    const subheading = row.location ? `${when} · ${row.location}` : when;
    const { data: post } = await supabaseBrowser.from('blog_posts').insert({
      slug, title: row.title, excerpt: subheading, status: 'draft',
      draft_blocks: [{
        id: crypto.randomUUID(), type: 'hero',
        props: { heading: row.title, subheading, align: 'center', background: 'none', headingSize: 'normal', overlayOpacity: 'medium', textColor: 'auto' },
      }],
      unpublish_at: row.end_at || row.start_at,
    }).select().single();
    if (!post) return;
    await linkContent('event', row.id, 'announcement', post.id);
    window.location.href = withBase(`/admin/posts/edit?slug=${post.slug}&schedule=1`);
  }

  // Same idea, for the other half of "tie it all together": a dedicated
  // album an admin can drop event photos into as they come in (during/after
  // the event), already linked back to it. Starts as an ordinary draft
  // album -- nothing here assumes the photos exist yet.
  async function createAlbumForEvent(row) {
    const { data: album } = await supabaseBrowser.from('gallery_albums').insert({
      name: `${row.title} Photos`, status: 'draft', sort_order: 0,
    }).select().single();
    if (!album) return;
    await linkContent('event', row.id, 'album', album.id);
    window.location.href = withBase(`/admin/gallery?album=${album.id}`);
  }

  const filtered = React.useMemo(() => {
    if (!events) return events;
    const q = query.trim().toLowerCase();
    return q ? events.filter((e) => e.title.toLowerCase().includes(q) || (e.location || '').toLowerCase().includes(q)) : events;
  }, [events, query]);

  function toggleSelected(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleSelectAll() {
    setSelected((prev) => (prev.size === filtered.length ? new Set() : new Set(filtered.map((e) => e.id))));
  }

  useBulkListShortcuts({
    selected, setSelected,
    allIds: filtered ? filtered.map((e) => e.id) : [],
    onDeleteSelected: handleBulkDelete,
  });

  async function toggleStatus(row) {
    await supabaseBrowser.from('calendar_events').update({ status: row.status === 'published' ? 'draft' : 'published' }).eq('id', row.id);
    load();
  }

  async function handleDelete(row) {
    if (!(await confirm(`Delete "${row.title}"? This can't be undone.`, { title: 'Delete event?', confirmLabel: 'Delete', danger: true }))) return;
    await supabaseBrowser.from('calendar_events').delete().eq('id', row.id);
    load();
  }

  async function handleBulkDelete() {
    if (!(await confirm(`Delete ${selected.size} event${selected.size > 1 ? 's' : ''}? This can't be undone.`, { title: 'Delete events?', confirmLabel: 'Delete', danger: true }))) return;
    await supabaseBrowser.from('calendar_events').delete().in('id', [...selected]);
    setSelected(new Set());
    load();
  }
  async function handleBulkStatus(status) {
    await supabaseBrowser.from('calendar_events').update({ status }).in('id', [...selected]);
    setSelected(new Set());
    load();
  }

  async function handleSave(draft) {
    setSaving(true);
    const patch = {
      title: draft.title.trim(),
      description: draft.description || null,
      location: draft.location || null,
      start_at: fromLocalInputValue(draft.start_at, draft.all_day),
      end_at: fromLocalInputValue(draft.end_at, draft.all_day),
      all_day: draft.all_day,
      status: draft.status,
    };
    if (draft.id) {
      await supabaseBrowser.from('calendar_events').update(patch).eq('id', draft.id);
    } else {
      await supabaseBrowser.from('calendar_events').insert(patch);
    }
    setSaving(false);
    setEditing(null);
    load();
  }

  if (events === null) {
    return <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>;
  }

  return (
    <Card title="Events">
      <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-small)', marginTop: 0, marginBottom: 0 }}>
        Events shown on the public Events page. Add an "Events Teaser" block to any page to display upcoming events there too.
      </p>
      {/* Individual events aren't referenced by an Events Teaser block --
          it just shows "upcoming"/"all" events generically -- so this
          reports at that level: every page that has one at all. */}
      <UsedOnLine predicate={(block) => block.type === 'events-teaser'} />
      <div style={{ marginBottom: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
        <Button variant="outline" onClick={() => setEditing(emptyEvent())}>+ New Event</Button>
        <div style={{ flex: 1, minWidth: 200 }}>
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by title or location…" aria-label="Filter events" />
        </div>
      </div>

      {selected.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-md)' }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)', fontWeight: 'var(--fw-bold)' }}>{selected.size} selected</span>
          <Button variant="ghost" size="sm" onClick={() => handleBulkStatus('published')}>Publish</Button>
          <Button variant="ghost" size="sm" onClick={() => handleBulkStatus('draft')}>Unpublish</Button>
          <Button variant="ghost" size="sm" onClick={handleBulkDelete}>Delete</Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {filtered.length === 0 && (
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-small)' }}>
            {events.length === 0 ? 'No events yet.' : 'No events match that filter.'}
          </p>
        )}
        {filtered.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)', padding: '0 var(--space-3)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)' }}>
              <input type="checkbox" checked={selected.size === filtered.length} onChange={toggleSelectAll} />
              Select all
            </label>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)' }}>
              <kbd>{modKeyLabel}A</kbd> select all · <kbd>Delete</kbd> remove selected · <kbd>Esc</kbd> clear
            </span>
          </div>
        )}
        {filtered.map((row) => (
          <div
            key={row.id}
            id={`event-${row.id}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
              padding: 'var(--space-3)', borderRadius: 'var(--radius-md)',
              // Highlights whichever event a ?event=<id> link (see
              // contentLinks.js's hrefFor) actually landed on -- events have
              // no dedicated edit page of their own to land ON, so this
              // (plus the scroll-into-view effect below) is the whole of
              // "here's the one you clicked through to."
              border: `1px solid ${row.id === highlightId ? 'var(--brand-secondary)' : 'var(--border-subtle)'}`,
              boxShadow: row.id === highlightId ? '0 0 0 2px var(--tint-info-bg)' : undefined,
            }}
          >
            <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleSelected(row.id)} aria-label={`Select ${row.title}`} />
            <div style={{ flex: 1 }}>
              <div>
                <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)' }}>{row.title}</span>
                <span style={{ marginLeft: 'var(--space-3)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)' }}>
                  {new Date(row.start_at).toLocaleString(undefined, row.all_day ? { month: 'short', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  {row.location ? ` · ${row.location}` : ''}
                </span>
              </div>
              {/* Generic cross-linking (content_links, same as
                  PostsListScreen.jsx/GalleryScreen.jsx) -- chips for
                  whatever's already linked plus a picker to link an
                  existing announcement/album. The two buttons below are
                  this screen's own shortcut on top of that: make a NEW
                  announcement/album (prefilled from this event) and link
                  it in one step, instead of creating it elsewhere first. */}
              <div style={{ marginTop: 'var(--space-2)' }}>
                <LinkedContentPanel kind="event" id={row.id} title={row.title} />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', marginTop: 'var(--space-2)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)' }}>
                <button onClick={() => createAnnouncementForEvent(row)} style={linkBtnStyle}>+ Create &amp; link a new Announcement</button>
                <button onClick={() => createAlbumForEvent(row)} style={linkBtnStyle}>+ Create &amp; link a new Photo Album</button>
              </div>
            </div>
            <Badge tone={row.status === 'published' ? 'success' : 'neutral'}>{row.status}</Badge>
            <Button variant="primary" size="sm" onClick={() => setEditing({
              ...row,
              start_at: toLocalInputValue(row.start_at, row.all_day),
              end_at: toLocalInputValue(row.end_at, row.all_day),
              description: row.description || '',
              location: row.location || '',
            })}>Edit</Button>
            <button onClick={() => toggleStatus(row)} title={row.status === 'published' ? 'Published — click to unpublish' : 'Draft — click to publish'} style={iconButtonStyle}>
              {row.status === 'published' ? <EyeIcon /> : <EyeOffIcon />}
            </button>
            <button onClick={() => handleDelete(row)} title="Delete" style={{ ...iconButtonStyle, color: 'var(--color-error)' }}>
              <TrashIcon />
            </button>
          </div>
        ))}
      </div>

      {editing && (
        <EventDialog
          event={editing}
          saving={saving}
          onCancel={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
    </Card>
  );
}

function EventDialog({ event, saving, onCancel, onSave }) {
  const [draft, setDraft] = React.useState(event);
  function patch(p) { setDraft((d) => ({ ...d, ...p })); }

  function toggleAllDay(checked) {
    // Re-derive the input values for the new field type (date vs datetime-local)
    // from whatever's currently in the (still-string) fields, so switching
    // doesn't silently blank out a time the admin already picked.
    patch({
      all_day: checked,
      start_at: draft.start_at ? draft.start_at.slice(0, 10) : '',
      end_at: draft.end_at ? draft.end_at.slice(0, 10) : '',
    });
  }

  const canSave = draft.title.trim() && draft.start_at;

  return (
    <Dialog open title={event.id ? `Edit ${draft.title || 'event'}` : 'New event'} onClose={onCancel}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', minWidth: 380, maxWidth: 480 }}>
        <Input label="Title" value={draft.title} onChange={(e) => patch({ title: e.target.value })} placeholder="e.g. Fall Fireside" />
        <Textarea label="Description (optional)" value={draft.description} onChange={(e) => patch({ description: e.target.value })} rows={3} />
        <Input label="Location (optional)" value={draft.location} onChange={(e) => patch({ location: e.target.value })} placeholder="e.g. Seminary Building, Room 4" />
        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)', color: 'var(--text-primary)' }}>
          <Switch checked={draft.all_day} onChange={(e) => toggleAllDay(e.target.checked)} />
          All-day event
        </label>
        <Input label="Starts" type={draft.all_day ? 'date' : 'datetime-local'} value={draft.start_at} onChange={(e) => patch({ start_at: e.target.value })} />
        <Input label="Ends (optional)" type={draft.all_day ? 'date' : 'datetime-local'} value={draft.end_at} onChange={(e) => patch({ end_at: e.target.value })} />
        <Select
          label="Status"
          value={draft.status}
          options={[{ value: 'draft', label: 'Draft (hidden from public)' }, { value: 'published', label: 'Published' }]}
          onChange={(e) => patch({ status: e.target.value })}
        />
        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" disabled={saving || !canSave} onClick={() => onSave(draft)}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </div>
    </Dialog>
  );
}

const iconButtonStyle = { border: 'none', background: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' };
const linkBtnStyle = { border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-link)', fontFamily: 'inherit', fontSize: 'inherit' };
