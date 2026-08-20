import React from 'react';
import { supabaseBrowser } from '../../lib/supabase/browser-client';
import { Card } from '../../design-system/components/core/Card.jsx';
import { Badge } from '../../design-system/components/core/Badge.jsx';
import { Button } from '../../design-system/components/forms/Button.jsx';
import { Input } from '../../design-system/components/forms/Input.jsx';
import { Dialog } from '../../design-system/components/core/Dialog.jsx';
import { CopyIcon, TrashIcon } from '../icons.jsx';
import { slugify, uniqueSlug } from '../slug.js';
import { withBase } from '../../lib/url.js';
import { useConfirm } from '../ConfirmProvider.jsx';
import { useBulkListShortcuts } from '../useBulkListShortcuts.js';
import { useModKeyLabel } from '../useModKeyLabel.js';

export function PostsListScreen() {
  const confirm = useConfirm();
  const modKeyLabel = useModKeyLabel();
  const [posts, setPosts] = React.useState(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState('');
  const [creating, setCreating] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [selected, setSelected] = React.useState(() => new Set());

  async function load() {
    const { data } = await supabaseBrowser.from('blog_posts').select('*').order('created_at', { ascending: false });
    setPosts(data || []);
  }

  React.useEffect(() => { load(); }, []);

  const filtered = React.useMemo(() => {
    if (!posts) return posts;
    const q = query.trim().toLowerCase();
    return q ? posts.filter((p) => p.title.toLowerCase().includes(q)) : posts;
  }, [posts, query]);

  function toggleSelected(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleSelectAll() {
    setSelected((prev) => (prev.size === filtered.length ? new Set() : new Set(filtered.map((p) => p.id))));
  }

  useBulkListShortcuts({
    selected, setSelected,
    allIds: filtered ? filtered.map((p) => p.id) : [],
    onDeleteSelected: handleBulkDelete,
  });

  async function handleBulkDelete() {
    if (!(await confirm(`Delete ${selected.size} announcement${selected.size > 1 ? 's' : ''}? This can't be undone.`, { title: 'Delete announcements?', confirmLabel: 'Delete', danger: true }))) return;
    await supabaseBrowser.from('blog_posts').delete().in('id', [...selected]);
    setSelected(new Set());
    load();
  }
  async function handleBulkPublish() {
    // Mirrors PageBuilderScreen's real publish (published_blocks = draft_blocks,
    // not just a status flip) -- a post that's never been individually
    // published has no published_blocks yet, so a bare status update would
    // mark it "published" with nothing to actually show for it.
    const rows = posts.filter((p) => selected.has(p.id));
    await Promise.all(rows.map((row) =>
      supabaseBrowser.from('blog_posts')
        .update({ published_blocks: row.draft_blocks, status: 'published', published_at: new Date().toISOString() })
        .eq('id', row.id)
    ));
    setSelected(new Set());
    load();
  }
  async function handleBulkUnpublish() {
    await supabaseBrowser.from('blog_posts').update({ status: 'draft' }).in('id', [...selected]);
    setSelected(new Set());
    load();
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    const slug = await uniqueSlug('blog_posts', slugify(newTitle));
    await supabaseBrowser.from('blog_posts').insert({
      slug, title: newTitle.trim(), status: 'draft', draft_blocks: [],
    });
    setCreating(false);
    setCreateOpen(false);
    setNewTitle('');
    load();
  }

  async function handleCopy(row) {
    const slug = await uniqueSlug('blog_posts', slugify(`${row.title}-copy`));
    await supabaseBrowser.from('blog_posts').insert({
      slug, title: `${row.title} (Copy)`, excerpt: row.excerpt, cover_image_url: row.cover_image_url,
      status: 'draft', draft_blocks: row.draft_blocks || [],
    });
    load();
  }

  async function handleDelete(row) {
    if (!(await confirm(`Delete "${row.title}"? This can't be undone.`, { title: 'Delete announcement?', confirmLabel: 'Delete', danger: true }))) return;
    await supabaseBrowser.from('blog_posts').delete().eq('id', row.id);
    load();
  }

  if (posts === null) {
    return <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>;
  }

  return (
    <Card title="Announcements">
      <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-small)', marginTop: 0 }}>
        Posts shown on the public Announcements page, newest first. Create, edit, copy, or delete below.
      </p>
      <div style={{ marginBottom: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
        <Button variant="outline" onClick={() => setCreateOpen(true)}>+ New Announcement</Button>
        <div style={{ flex: 1, minWidth: 200 }}>
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by title…" aria-label="Filter announcements by title" />
        </div>
      </div>

      {selected.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-md)' }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)', fontWeight: 'var(--fw-bold)' }}>{selected.size} selected</span>
          <Button variant="ghost" size="sm" onClick={handleBulkPublish}>Publish</Button>
          <Button variant="ghost" size="sm" onClick={handleBulkUnpublish}>Unpublish</Button>
          <Button variant="ghost" size="sm" onClick={handleBulkDelete}>Delete</Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {filtered.length === 0 && (
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-small)' }}>
            {posts.length === 0 ? 'No announcements yet.' : 'No announcements match that filter.'}
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
            style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
              padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)',
            }}
          >
            <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleSelected(row.id)} aria-label={`Select ${row.title}`} />
            <div style={{ flex: 1 }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)' }}>{row.title}</span>
              {row.published_at && (
                <span style={{ marginLeft: 'var(--space-3)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)' }}>
                  {new Date(row.published_at).toLocaleDateString()}
                </span>
              )}
            </div>
            <Badge tone={row.status === 'published' ? 'success' : row.status === 'scheduled' ? 'warning' : 'neutral'}>
              {row.status === 'scheduled' && row.publish_at
                ? `scheduled · ${new Date(row.publish_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
                : row.status}
            </Badge>
            <a href={withBase(`/admin/posts/edit?slug=${row.slug}`)} style={{ textDecoration: 'none' }}>
              <Button variant="primary" size="sm">Edit</Button>
            </a>
            <button onClick={() => handleCopy(row)} title="Copy this announcement" style={iconButtonStyle}>
              <CopyIcon />
            </button>
            <button onClick={() => handleDelete(row)} title="Delete this announcement" style={{ ...iconButtonStyle, color: 'var(--color-error)' }}>
              <TrashIcon />
            </button>
          </div>
        ))}
      </div>

      <Dialog open={createOpen} title="New announcement" onClose={() => setCreateOpen(false)}>
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', minWidth: 320 }}>
          <Input label="Title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. Fall Semester Kickoff" />
          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button variant="primary" disabled={creating || !newTitle.trim()}>{creating ? 'Creating…' : 'Create'}</Button>
          </div>
        </form>
      </Dialog>
    </Card>
  );
}

const iconButtonStyle = { border: 'none', background: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' };
