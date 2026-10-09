import React from 'react';
import { supabaseBrowser } from '../../lib/supabase/browser-client';
import { Card } from '../../design-system/components/core/Card.jsx';
import { Badge } from '../../design-system/components/core/Badge.jsx';
import { Button } from '../../design-system/components/forms/Button.jsx';
import { Input } from '../../design-system/components/forms/Input.jsx';
import { Select } from '../../design-system/components/forms/Select.jsx';
import { Dialog } from '../../design-system/components/core/Dialog.jsx';
import { EyeIcon, EyeOffIcon, CopyIcon, TrashIcon } from '../icons.jsx';
import { slugify, uniqueSlug } from '../slug.js';
import { withBase } from '../../lib/url.js';
import { useConfirm, useAlert } from '../ConfirmProvider.jsx';
import { useBulkListShortcuts } from '../useBulkListShortcuts.js';
import { useModKeyLabel } from '../useModKeyLabel.js';
import { UsedOnLine } from '../UsedOnLine.jsx';
import { kindLabel, kindIcon } from '../contentLinks.js';
import { loadContentIndex, relatedItems, editHref, deleteLinksFor } from '../contentIndex.js';
import { RelatedContentDialog } from '../RelatedContentDialog.jsx';
import { createEventWithExtras } from '../crossCreate.js';
import { AnnouncementExtras } from '../AnnouncementExtras.jsx';
import { EventDialog, emptyEvent, eventToDraft, draftToEventPatch } from '../EventDialog.jsx';

const KIND_TABS = [
  { key: 'all', label: 'All' },
  { key: 'announcement', label: 'Announcements' },
  { key: 'event', label: 'Events' },
  { key: 'album', label: 'Albums' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'Any status' },
  { value: 'published', label: 'Published' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'draft', label: 'Draft' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'az', label: 'A–Z' },
];

const TABLE = { event: 'calendar_events', announcement: 'blog_posts', album: 'gallery_albums' };

const fmtDate = (iso) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const fmtDateTime = (iso) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

// One quiet line of context under each title -- what actually distinguishes
// one item of its kind from another at a glance.
function metaLine(item) {
  const r = item.raw;
  if (item.kind === 'event') {
    const when = r.all_day ? fmtDate(r.start_at) : fmtDateTime(r.start_at);
    return `${when}${r.location ? ` · ${r.location}` : ''}`;
  }
  if (item.kind === 'announcement') {
    if (r.status === 'published' && r.published_at) return `Published ${fmtDate(r.published_at)}${r.unpublish_at ? ` · unpublishes ${fmtDate(r.unpublish_at)}` : ''}`;
    if (r.status === 'scheduled' && r.publish_at) return `Goes live ${fmtDateTime(r.publish_at)}`;
    return `Draft · created ${fmtDate(r.created_at)}`;
  }
  return `${item.photoCount} photo${item.photoCount === 1 ? '' : 's'}`;
}

export function ContentScreen({ initialKind = 'all' }) {
  const confirm = useConfirm();
  const alertUser = useAlert();
  const modKeyLabel = useModKeyLabel();

  const [index, setIndex] = React.useState(null);
  const [kind, setKind] = React.useState(initialKind);
  const [status, setStatus] = React.useState('all');
  const [sort, setSort] = React.useState('newest');
  const [query, setQuery] = React.useState('');
  const [selected, setSelected] = React.useState(() => new Set());
  const [highlightKey, setHighlightKey] = React.useState(null);
  const [relatedKey, setRelatedKey] = React.useState(null);
  const [eventDraft, setEventDraft] = React.useState(null);
  const [saving, setSaving] = React.useState(false);
  const [naming, setNaming] = React.useState(null); // 'announcement' | 'album' while the name dialog is open
  const [newName, setNewName] = React.useState('');

  async function reload() { setIndex(await loadContentIndex()); }

  // ?item=<kind>:<id> (what a link chip, or an old ?event= link, points at)
  // opens the list scrolled to and highlighting that one item.
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('item') || (params.get('event') ? `event:${params.get('event')}` : null);
    if (params.get('kind')) setKind(params.get('kind'));
    reload().then(() => { if (fromUrl) setHighlightKey(fromUrl); });
  }, []);

  React.useEffect(() => {
    if (!highlightKey || !index) return;
    document.getElementById(`content-${highlightKey}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const t = setTimeout(() => setHighlightKey(null), 2600);
    return () => clearTimeout(t);
  }, [highlightKey, index]);

  const counts = React.useMemo(() => {
    const c = { all: 0, announcement: 0, event: 0, album: 0 };
    for (const i of index?.items || []) { c.all++; c[i.kind]++; }
    return c;
  }, [index]);

  const visible = React.useMemo(() => {
    if (!index) return [];
    const q = query.trim().toLowerCase();
    const list = index.items
      .filter((i) => kind === 'all' || i.kind === kind)
      .filter((i) => status === 'all' || i.status === status)
      .filter((i) => !q || i.title.toLowerCase().includes(q));
    const byDate = (a, b) => new Date(b.sortAt || 0) - new Date(a.sortAt || 0);
    if (sort === 'az') return list.sort((a, b) => a.title.localeCompare(b.title));
    return list.sort(sort === 'oldest' ? (a, b) => byDate(b, a) : byDate);
  }, [index, kind, status, query, sort]);

  // Jump to a related item from a chip -- clearing whatever filters would
  // otherwise hide it, since "go there" that lands on nothing is worse than
  // losing the filter.
  function focusItem(key) {
    setKind('all'); setStatus('all'); setQuery('');
    setHighlightKey(null);
    setTimeout(() => setHighlightKey(key), 0);
  }

  const toggleSelected = (key) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const allSelected = visible.length > 0 && selected.size === visible.length;
  const selectedItems = () => (index?.items || []).filter((i) => selected.has(i.key));

  // --- status changes ---------------------------------------------------
  // Publishing an announcement means copying draft_blocks into
  // published_blocks (a post that was never published has none yet, so a
  // bare status flip would mark it live with nothing to show); events and
  // albums are just a status flag.
  async function setPublished(items, publish) {
    await Promise.all(items.map((item) => {
      const table = supabaseBrowser.from(TABLE[item.kind]);
      if (item.kind === 'announcement' && publish) {
        return table.update({ published_blocks: item.raw.draft_blocks, status: 'published', published_at: new Date().toISOString() }).eq('id', item.id);
      }
      return table.update({ status: publish ? 'published' : 'draft' }).eq('id', item.id);
    }));
    setSelected(new Set());
    await reload();
  }

  // --- deletion ---------------------------------------------------------
  async function deleteItems(items) {
    // Same rule the album screen always had: an album that still holds
    // photos can't be deleted out from under them.
    const blocked = items.filter((i) => i.kind === 'album' && i.photoCount > 0);
    if (blocked.length) {
      await alertUser(
        `${blocked.map((a) => `"${a.title}"`).join(', ')} still ${blocked.length === 1 ? 'has photos' : 'have photos'}. Move or delete those first, then delete the album.`,
        { title: 'Album not empty' },
      );
      items = items.filter((i) => !blocked.includes(i));
      if (!items.length) return;
    }
    const what = items.length === 1 ? `"${items[0].title}"` : `${items.length} items`;
    if (!(await confirm(`Delete ${what}? This can't be undone.`, { title: items.length === 1 ? `Delete ${kindLabel(items[0].kind).toLowerCase()}?` : 'Delete items?', confirmLabel: 'Delete', danger: true }))) return;
    for (const k of ['event', 'announcement', 'album']) {
      const ids = items.filter((i) => i.kind === k).map((i) => i.id);
      if (!ids.length) continue;
      await supabaseBrowser.from(TABLE[k]).delete().in('id', ids);
      await deleteLinksFor(k, ids);
    }
    setSelected(new Set());
    await reload();
  }

  useBulkListShortcuts({
    selected, setSelected,
    allIds: visible.map((i) => i.key),
    onDeleteSelected: () => deleteItems(selectedItems()),
  });

  async function copyAnnouncement(item) {
    const r = item.raw;
    const slug = await uniqueSlug('blog_posts', slugify(`${r.title}-copy`));
    await supabaseBrowser.from('blog_posts').insert({
      slug, title: `${r.title} (Copy)`, excerpt: r.excerpt, cover_image_url: r.cover_image_url,
      status: 'draft', draft_blocks: r.draft_blocks || [],
    });
    await reload();
  }

  // --- creating ---------------------------------------------------------
  async function createNamed(e) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    if (naming === 'announcement') {
      const slug = await uniqueSlug('blog_posts', slugify(name));
      await supabaseBrowser.from('blog_posts').insert({ slug, title: name, status: 'draft', draft_blocks: [] });
      window.location.href = withBase(`/admin/posts/edit?slug=${slug}`);
      return;
    }
    const { data } = await supabaseBrowser.from('gallery_albums').insert({ name, status: 'draft', sort_order: 0 }).select().single();
    if (data) { window.location.href = withBase(`/admin/gallery?album=${data.id}`); return; }
    setSaving(false);
  }

  // Editing just updates. A NEW event is created through createEventWithExtras
  // (crossCreate.js), which also makes whichever announcement/album the admin
  // ticked; if an announcement was made we go straight to its editor, otherwise
  // we stay here with the new event highlighted and its link chips showing.
  async function saveEvent(draft, extras = {}) {
    setSaving(true);
    const patch = draftToEventPatch(draft);
    let created = null;
    let redirect = null;
    if (draft.id) {
      await supabaseBrowser.from('calendar_events').update(patch).eq('id', draft.id);
    } else {
      ({ event: created, redirect } = await createEventWithExtras(patch, extras));
    }
    setSaving(false);
    setEventDraft(null);
    if (redirect) { window.location.href = withBase(redirect); return; }
    await reload();
    if (created) setHighlightKey(`event:${created.id}`);
  }

  if (index === null) return <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>;

  const relatedItem = relatedKey ? index.items.find((i) => i.key === relatedKey) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <Card title="Content">
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-small)', marginTop: 0 }}>
          Announcements, events and photo albums in one place. Link related items together (an event with its announcement and photos) and they point to each other.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
          <Button variant="primary" onClick={() => { setNewName(''); setNaming('announcement'); }}>+ Announcement</Button>
          <Button variant="outline" onClick={() => setEventDraft(emptyEvent())}>+ Event</Button>
          <Button variant="outline" onClick={() => { setNewName(''); setNaming('album'); }}>+ Photo album</Button>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-3)' }}>
          {KIND_TABS.map((t) => (
            <button key={t.key} onClick={() => { setKind(t.key); setSelected(new Set()); }} className={'tab' + (kind === t.key ? ' active' : '')}>
              {t.label} <span style={{ opacity: 0.6 }}>({counts[t.key]})</span>
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 'var(--space-4)' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by title…" aria-label="Search content by title" />
          </div>
          <div style={{ minWidth: 150 }}><Select value={status} options={STATUS_OPTIONS} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status" /></div>
          <div style={{ minWidth: 150 }}><Select value={sort} options={SORT_OPTIONS} onChange={(e) => setSort(e.target.value)} aria-label="Sort order" /></div>
        </div>

        {/* Where each kind actually appears on the public site -- only
            meaningful once a single kind is in view. */}
        {kind === 'announcement' && <UsedOnLine predicate={(b) => b.type === 'posts-teaser'} deps={[kind]} />}
        {kind === 'event' && <UsedOnLine predicate={(b) => b.type === 'events-teaser'} deps={[kind]} />}
        {kind === 'album' && <UsedOnLine predicate={(b) => b.type === 'gallery'} deps={[kind]} />}

        {selected.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap', margin: 'var(--space-3) 0', padding: 'var(--space-3)', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)', fontWeight: 'var(--fw-bold)' }}>{selected.size} selected</span>
            <Button variant="ghost" size="sm" onClick={() => setPublished(selectedItems(), true)}>Publish</Button>
            <Button variant="ghost" size="sm" onClick={() => setPublished(selectedItems(), false)}>Unpublish</Button>
            <Button variant="ghost" size="sm" onClick={() => deleteItems(selectedItems())}>Delete</Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
          {visible.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-small)' }}>
              {index.items.length === 0 ? 'Nothing here yet — create an announcement, event or photo album above.' : 'Nothing matches those filters.'}
            </p>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)', padding: '0 var(--space-3)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)' }}>
                <input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(visible.map((i) => i.key)))} />
                Select all
              </label>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)' }}>
                <kbd>{modKeyLabel}A</kbd> select all · <kbd>Delete</kbd> remove selected · <kbd>Esc</kbd> clear
              </span>
            </div>
          )}

          {visible.map((item) => (
            <ContentRow
              key={item.key}
              item={item}
              related={relatedItems(index, item)}
              selected={selected.has(item.key)}
              highlighted={highlightKey === item.key}
              onSelect={() => toggleSelected(item.key)}
              onEditEvent={() => setEventDraft(eventToDraft(item.raw))}
              onTogglePublished={() => setPublished([item], item.status !== 'published')}
              onCopy={() => copyAnnouncement(item)}
              onDelete={() => deleteItems([item])}
              onOpenRelated={() => setRelatedKey(item.key)}
              onFocusRelated={focusItem}
            />
          ))}
        </div>
      </Card>

      {kind === 'announcement' && <AnnouncementExtras />}

      {relatedItem && (
        <RelatedContentDialog item={relatedItem} index={index} onChanged={reload} onClose={() => setRelatedKey(null)} />
      )}

      {eventDraft && <EventDialog event={eventDraft} saving={saving} onCancel={() => setEventDraft(null)} onSave={saveEvent} />}

      <Dialog open={!!naming} title={naming === 'album' ? 'New photo album' : 'New announcement'} onClose={() => setNaming(null)}>
        <form onSubmit={createNamed} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', minWidth: 320 }}>
          <Input
            label={naming === 'album' ? 'Album name' : 'Title'}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={naming === 'album' ? 'e.g. Fall Fireside 2026' : 'e.g. Fall Semester Kickoff'}
            autoFocus
          />
          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setNaming(null)}>Cancel</Button>
            <Button variant="primary" disabled={saving || !newName.trim()}>{saving ? 'Creating…' : 'Create'}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

function ContentRow({ item, related, selected, highlighted, onSelect, onEditEvent, onTogglePublished, onCopy, onDelete, onOpenRelated, onFocusRelated }) {
  const tone = item.status === 'published' ? 'success' : item.status === 'scheduled' ? 'warning' : 'neutral';
  const shown = related.slice(0, 3);
  return (
    <div
      id={`content-${item.key}`}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)', flexWrap: 'wrap',
        padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', background: 'var(--surface-card)',
        border: `1px solid ${highlighted ? 'var(--brand-secondary)' : 'var(--border-subtle)'}`,
        boxShadow: highlighted ? '0 0 0 3px var(--tint-info-bg)' : undefined,
        transition: 'box-shadow var(--duration-standard), border-color var(--duration-standard)',
      }}
    >
      <input type="checkbox" checked={selected} onChange={onSelect} aria-label={`Select ${item.title}`} style={{ marginTop: 6 }} />
      <div
        aria-hidden
        title={kindLabel(item.kind)}
        style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'var(--surface-sunken)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}
      >
        {kindIcon(item.kind)}
      </div>

      <div style={{ flex: '1 1 240px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-body-lg)', color: 'var(--text-primary)' }}>{item.title}</span>
          <Badge tone={tone}>{item.status}</Badge>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)' }}>{kindLabel(item.kind)}</span>
        </div>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)', color: 'var(--text-muted)', marginTop: 2 }}>{metaLine(item)}</div>

        {related.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
            {shown.map((r) => (
              <button
                key={r.key}
                onClick={() => onFocusRelated(r.key)}
                title={`Go to ${kindLabel(r.kind).toLowerCase()} "${r.title}"`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: 220, padding: '3px 10px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-subtle)', background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-link)' }}
              >
                <span aria-hidden>{kindIcon(r.kind)}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</span>
              </button>
            ))}
            {related.length > shown.length && (
              <button onClick={onOpenRelated} style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)' }}>
                +{related.length - shown.length} more
              </button>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap', marginLeft: 'auto' }}>
        <Button variant="outline" size="sm" onClick={onOpenRelated}>🔗 {related.length > 0 ? related.length : 'Link'}</Button>
        {item.kind === 'event' ? (
          <Button variant="primary" size="sm" onClick={onEditEvent}>Edit</Button>
        ) : (
          <a href={editHref(item)} style={{ textDecoration: 'none' }}><Button variant="primary" size="sm">Edit</Button></a>
        )}
        <button onClick={onTogglePublished} title={item.status === 'published' ? 'Published — click to unpublish' : 'Not published — click to publish now'} style={iconButtonStyle}>
          {item.status === 'published' ? <EyeIcon /> : <EyeOffIcon />}
        </button>
        {item.kind === 'announcement' && (
          <button onClick={onCopy} title="Copy this announcement" style={iconButtonStyle}><CopyIcon /></button>
        )}
        <button onClick={onDelete} title={`Delete this ${kindLabel(item.kind).toLowerCase()}`} style={{ ...iconButtonStyle, color: 'var(--color-error)' }}><TrashIcon /></button>
      </div>
    </div>
  );
}

const iconButtonStyle = { border: 'none', background: 'none', cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' };
