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

// The block-builder pages this phase seeds if missing. Every other nav entry
// (Schedule/Announcements/Directory+subpages/Gallery/Events/Contact/Makeup
// Work) is seeded once by the 0005_nav_structure.sql migration instead, since
// those are fixed feature routes with no block content of their own.
const DEFAULT_BUILDER_PAGES = [
  { slug: 'home', title: 'Home', nav_label: 'Home', nav_order: 1, route_path: '/' },
  { slug: 'about', title: 'About', nav_label: 'About', nav_order: 2, route_path: '/about' },
  { slug: 'enrollment', title: 'Enrollment', nav_label: 'Enrollment', nav_order: 6, route_path: '/enrollment' },
];

function buildTree(rows) {
  const byParent = new Map();
  for (const row of rows) {
    const key = row.parent_id || 'root';
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(row);
  }
  for (const list of byParent.values()) list.sort((a, b) => (a.nav_order ?? 0) - (b.nav_order ?? 0));
  const attachChildren = (row) => ({ ...row, children: (byParent.get(row.id) || []).map(attachChildren) });
  return (byParent.get('root') || []).map(attachChildren);
}

export function PagesListScreen() {
  const [pages, setPages] = React.useState(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState('');
  const [newParentId, setNewParentId] = React.useState('');
  const [creating, setCreating] = React.useState(false);

  async function load() {
    const { data: existing } = await supabaseBrowser.from('pages').select('*');
    const existingSlugs = new Set((existing || []).map((p) => p.slug));
    const missing = DEFAULT_BUILDER_PAGES.filter((p) => !existingSlugs.has(p.slug));
    if (missing.length) {
      await supabaseBrowser.from('pages').insert(missing.map((p) => ({ ...p, page_kind: 'builder' })));
    }
    const { data: finalPages } = await supabaseBrowser.from('pages').select('*');
    setPages(finalPages || []);
  }

  React.useEffect(() => { load(); }, []);

  async function toggleVisible(row) {
    await supabaseBrowser.from('pages').update({ show_in_nav: !row.show_in_nav }).eq('id', row.id);
    load();
  }

  async function move(siblings, row, direction) {
    const idx = siblings.findIndex((s) => s.id === row.id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= siblings.length) return;
    const other = siblings[swapIdx];
    await Promise.all([
      supabaseBrowser.from('pages').update({ nav_order: other.nav_order }).eq('id', row.id),
      supabaseBrowser.from('pages').update({ nav_order: row.nav_order }).eq('id', other.id),
    ]);
    load();
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    const parentId = newParentId || null;
    const siblingCount = pages.filter((p) => (p.parent_id || null) === parentId).length;
    const slug = await uniqueSlug('pages', slugify(newTitle));
    await supabaseBrowser.from('pages').insert({
      slug, title: newTitle.trim(), nav_label: newTitle.trim(),
      nav_order: siblingCount + 1, show_in_nav: true, page_kind: 'builder',
      route_path: `/${slug}`, parent_id: parentId, status: 'draft', draft_blocks: [],
    });
    setCreating(false);
    setCreateOpen(false);
    setNewTitle('');
    setNewParentId('');
    load();
  }

  async function handleCopy(row) {
    const slug = await uniqueSlug('pages', slugify(`${row.title}-copy`));
    const siblingCount = pages.filter((p) => (p.parent_id || null) === (row.parent_id || null)).length;
    await supabaseBrowser.from('pages').insert({
      slug, title: `${row.title} (Copy)`, nav_label: `${row.title} (Copy)`,
      nav_order: siblingCount + 1, show_in_nav: false, page_kind: 'builder',
      route_path: `/${slug}`, parent_id: row.parent_id, status: 'draft',
      draft_blocks: row.draft_blocks || [],
    });
    load();
  }

  async function handleDelete(row) {
    const childCount = pages.filter((p) => p.parent_id === row.id).length;
    const warning = childCount > 0
      ? `Delete "${row.title}"? This will also delete its ${childCount} sub-page${childCount > 1 ? 's' : ''}. This can't be undone.`
      : `Delete "${row.title}"? This can't be undone.`;
    if (!window.confirm(warning)) return;
    await supabaseBrowser.from('pages').delete().eq('id', row.id);
    load();
  }

  if (pages === null) {
    return <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>;
  }

  const tree = buildTree(pages);
  const topLevelOptions = [
    { value: '', label: 'None (top level)' },
    ...pages.filter((p) => !p.parent_id).map((p) => ({ value: p.id, label: p.title })),
  ];

  return (
    <Card title="Pages & Site Navigation">
      <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-small)', marginTop: 0 }}>
        Every page and section of the site, in nav order. Toggle visibility, reorder with the arrows, edit content, or create/copy/delete pages — including sub-pages nested under a parent.
      </p>
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <Button variant="outline" onClick={() => setCreateOpen(true)}>+ New Page</Button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {tree.map((row) => (
          <PageRow key={row.id} row={row} siblings={tree} onToggle={toggleVisible} onMove={move} onCopy={handleCopy} onDelete={handleDelete} depth={0} />
        ))}
      </div>

      <Dialog open={createOpen} title="New page" onClose={() => setCreateOpen(false)}>
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', minWidth: 320 }}>
          <Input label="Title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. Youth Conference" />
          <Select label="Parent (optional — makes this a sub-page)" value={newParentId} options={topLevelOptions} onChange={(e) => setNewParentId(e.target.value)} />
          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button variant="primary" disabled={creating || !newTitle.trim()}>{creating ? 'Creating…' : 'Create'}</Button>
          </div>
        </form>
      </Dialog>
    </Card>
  );
}

function PageRow({ row, siblings, onToggle, onMove, onCopy, onDelete, depth }) {
  const isBuilder = row.page_kind === 'builder';
  return (
    <div>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
          padding: 'var(--space-3)', paddingLeft: `calc(var(--space-3) + ${depth * 24}px)`,
          borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)',
          opacity: row.show_in_nav ? 1 : 0.55,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <button onClick={() => onMove(siblings, row, -1)} title="Move up" style={arrowStyle}>▲</button>
          <button onClick={() => onMove(siblings, row, 1)} title="Move down" style={arrowStyle}>▼</button>
        </div>

        <div style={{ flex: 1 }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)' }}>{row.title}</span>
          {!isBuilder && row.route_path && (
            <span style={{ marginLeft: 'var(--space-3)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)' }}>{row.route_path}</span>
          )}
        </div>

        <Badge tone={isBuilder ? (row.status === 'published' ? 'success' : 'neutral') : 'info'}>
          {isBuilder ? row.status : 'section'}
        </Badge>

        {isBuilder && (
          <a href={withBase(`/admin/pages/edit?slug=${row.slug}`)} style={{ textDecoration: 'none' }}>
            <Button variant="primary" size="sm">Edit</Button>
          </a>
        )}
        {isBuilder && (
          <button onClick={() => onCopy(row)} title="Copy this page" style={iconButtonStyle}>
            <CopyIcon />
          </button>
        )}
        <button onClick={() => onDelete(row)} title="Delete this page" style={{ ...iconButtonStyle, color: 'var(--color-error)' }}>
          <TrashIcon />
        </button>
        <button
          onClick={() => onToggle(row)}
          title={row.show_in_nav ? 'Visible in nav — click to hide' : 'Hidden from nav — click to show'}
          style={{ ...iconButtonStyle, color: row.show_in_nav ? 'var(--text-primary)' : 'var(--text-muted)' }}
        >
          {row.show_in_nav ? <EyeIcon /> : <EyeOffIcon />}
        </button>
      </div>
      {row.children.length > 0 && (
        <div style={{ marginTop: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {row.children.map((child) => (
            <PageRow key={child.id} row={child} siblings={row.children} onToggle={onToggle} onMove={onMove} onCopy={onCopy} onDelete={onDelete} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

const arrowStyle = { border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 10, lineHeight: '12px', padding: 0 };
const iconButtonStyle = { border: 'none', background: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' };
