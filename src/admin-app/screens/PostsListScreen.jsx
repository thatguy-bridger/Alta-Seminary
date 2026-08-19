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

export function PostsListScreen() {
  const [posts, setPosts] = React.useState(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState('');
  const [creating, setCreating] = React.useState(false);

  async function load() {
    const { data } = await supabaseBrowser.from('blog_posts').select('*').order('created_at', { ascending: false });
    setPosts(data || []);
  }

  React.useEffect(() => { load(); }, []);

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
    if (!window.confirm(`Delete "${row.title}"? This can't be undone.`)) return;
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
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <Button variant="outline" onClick={() => setCreateOpen(true)}>+ New Announcement</Button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {posts.length === 0 && (
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-small)' }}>No announcements yet.</p>
        )}
        {posts.map((row) => (
          <div
            key={row.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
              padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ flex: 1 }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)' }}>{row.title}</span>
              {row.published_at && (
                <span style={{ marginLeft: 'var(--space-3)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)' }}>
                  {new Date(row.published_at).toLocaleDateString()}
                </span>
              )}
            </div>
            <Badge tone={row.status === 'published' ? 'success' : 'neutral'}>{row.status}</Badge>
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
