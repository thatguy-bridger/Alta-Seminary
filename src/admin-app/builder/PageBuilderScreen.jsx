import React from 'react';
import { supabaseBrowser } from '../../lib/supabase/browser-client';
import { createBlock, BLOCK_REGISTRY } from '../../blocks/registry.js';
import { BlockRenderer } from '../../blocks/BlockRenderer.jsx';
import { EditableCanvas } from './EditableCanvas.jsx';
import { BlockConfigPanel } from './BlockConfigPanel.jsx';
import { AddBlockButton } from './AddBlockButton.jsx';
import { Button } from '../../design-system/components/forms/Button.jsx';
import { Input } from '../../design-system/components/forms/Input.jsx';
import { Textarea } from '../../design-system/components/forms/Textarea.jsx';
import { Dialog } from '../../design-system/components/core/Dialog.jsx';
import { Badge } from '../../design-system/components/core/Badge.jsx';
import { Tabs } from '../../design-system/components/core/Tabs.jsx';
import { Toast } from '../../design-system/components/core/Toast.jsx';
import { Card } from '../../design-system/components/core/Card.jsx';
import { ImageUploadField } from '../ImageUploadField.jsx';
import { withBase } from '../../lib/url.js';
import { useModKeyLabel } from '../useModKeyLabel.js';

const AUTOSAVE_DELAY_MS = 1000;
const DEVICE_WIDTHS = { Desktop: null, Tablet: 768, Mobile: 390 };

// datetime-local inputs need "YYYY-MM-DDTHH:mm" with no timezone suffix;
// Postgres timestamptz values round-trip as ISO strings with one.
function toLocalInputValue(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInputValue(value) {
  return value ? new Date(value).toISOString() : null;
}

// "Carousel — slide 2" / "Columns — column 1" -- a nested block's own label
// ("Quote / Scripture") doesn't say where it lives, and the Style panel can
// otherwise be showing settings for something nowhere near what's visibly
// selected on the canvas.
function nestedContextLabel(blocks, settingsTarget) {
  const parent = blocks.find((b) => b.id === settingsTarget.blockId);
  if (!parent) return '';
  const parentLabel = BLOCK_REGISTRY[parent.type]?.label || parent.type;
  const noun = settingsTarget.nestedKey === 'items' ? 'slide' : 'column';
  return `${parentLabel} — ${noun} ${settingsTarget.nestedIndex + 1}`;
}

const linkButtonStyle = {
  border: 'none', background: 'none', padding: 0, cursor: 'pointer',
  color: 'inherit', textDecoration: 'underline', fontFamily: 'inherit', fontSize: 'inherit',
};

// Shared by the Pages editor (table="pages") and the Announcements editor
// (table="blog_posts") -- both rows have the same draft_blocks/published_blocks
// shape (see 0001_init.sql), so one screen drives both rather than duplicating
// ~200 lines of autosave/publish logic per content type.
export function PageBuilderScreen({ slug, table = 'pages', backHref = '/admin' }) {
  const [row, setRow] = React.useState(null);
  const [blocks, setBlocks] = React.useState([]);
  const [selectedId, setSelectedId] = React.useState(null);
  // Which block's settings the right-hand panel is showing -- see
  // handleOpenSettings/resolveSettingsBlock below. Independent of
  // `selectedId` (the canvas highlight/drag target) since it can point at a
  // slide/column nested inside a Carousel/Columns block, not just a
  // top-level one.
  const [settingsTarget, setSettingsTarget] = React.useState(null);
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [saveState, setSaveState] = React.useState('idle'); // idle | saving | saved
  const [view, setView] = React.useState('Edit');
  const [publishOpen, setPublishOpen] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);
  const [toast, setToast] = React.useState(null);
  const modKeyLabel = useModKeyLabel();
  const [previewDevice, setPreviewDevice] = React.useState('Desktop');
  const [publishMode, setPublishMode] = React.useState('now');
  const [scheduleAt, setScheduleAt] = React.useState('');
  const [unpublishAt, setUnpublishAt] = React.useState('');
  const saveTimer = React.useRef(null);
  const isPost = table === 'blog_posts';

  // Warn on navigating away mid-autosave -- the whole app has no client-side
  // router (every nav, including the Back link, is a real page load), so
  // beforeunload alone covers every path. saveState is exactly "is there an
  // edit not yet written to the database" -- no separate dirty flag needed.
  React.useEffect(() => {
    function onBeforeUnload(e) {
      if (saveState !== 'saving') return;
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [saveState]);

  React.useEffect(() => {
    let active = true;
    supabaseBrowser.from(table).select('*').eq('slug', slug).single().then(({ data }) => {
      if (!active || !data) return;
      setRow(data);
      setBlocks(Array.isArray(data.draft_blocks) ? data.draft_blocks : []);
      setUnpublishAt(toLocalInputValue(data.unpublish_at));
    });
    return () => { active = false; };
  }, [slug, table]);

  const selectedBlock = blocks.find((b) => b.id === selectedId) || null;

  function scheduleSave(nextBlocks, extra) {
    setSaveState('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await supabaseBrowser
        .from(table)
        .update({ draft_blocks: nextBlocks, draft_updated_at: new Date().toISOString(), ...extra })
        .eq('id', row.id);
      setSaveState('saved');
    }, AUTOSAVE_DELAY_MS);
  }

  function updateBlocks(next) {
    setBlocks(next);
    scheduleSave(next);
  }

  function updateMeta(patch) {
    setRow((r) => ({ ...r, ...patch }));
    scheduleSave(blocks, patch);
  }

  function handleAdd(type) {
    const block = createBlock(type);
    updateBlocks([...blocks, block]);
    setSelectedId(block.id);
  }

  function handleReorder(next) {
    updateBlocks(next);
  }

  function handleRemove(id) {
    updateBlocks(blocks.filter((b) => b.id !== id));
    if (selectedId === id) setSelectedId(null);
    if (settingsTarget?.blockId === id) setSettingsTarget(null);
  }

  function handleDuplicate(id) {
    const idx = blocks.findIndex((b) => b.id === id);
    if (idx === -1) return;
    // Deep-clone props, not a shallow spread -- a block with an array/object
    // prop (e.g. carousel's `items`) would otherwise leave the original and
    // the duplicate sharing the exact same nested reference.
    const copy = { ...blocks[idx], id: crypto.randomUUID(), props: structuredClone(blocks[idx].props) };
    const next = [...blocks.slice(0, idx + 1), copy, ...blocks.slice(idx + 1)];
    updateBlocks(next);
  }

  function moveBlock(id, direction) {
    const idx = blocks.findIndex((b) => b.id === id);
    const target = idx + direction;
    if (idx === -1 || target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[idx], next[target]] = [next[target], next[idx]];
    updateBlocks(next);
  }

  // Keyboard shortcuts for the selected block -- Delete/Backspace to match
  // the trash-icon button exactly (no confirm dialog there either), the rest
  // mirroring common editor conventions. Ignored while typing anywhere
  // (inputs, textareas, or a block's own contentEditable text) so e.g.
  // deleting a character in a heading never deletes the whole block.
  React.useEffect(() => {
    function isTypingInField() {
      const el = document.activeElement;
      if (!el) return false;
      if (el.isContentEditable) return true;
      return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT';
    }

    function onKeyDown(e) {
      if (view !== 'Edit' || !selectedId || isTypingInField()) return;
      const mod = e.metaKey || e.ctrlKey;
      if ((e.key === 'Delete' || e.key === 'Backspace') && !mod) {
        e.preventDefault();
        handleRemove(selectedId);
      } else if (mod && !e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleDuplicate(selectedId);
      } else if (e.key === 'Escape') {
        setSelectedId(null);
      } else if (mod && e.shiftKey && e.key === 'ArrowUp') {
        e.preventDefault();
        moveBlock(selectedId, -1);
      } else if (mod && e.shiftKey && e.key === 'ArrowDown') {
        e.preventDefault();
        moveBlock(selectedId, 1);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [view, selectedId, blocks]);

  // Selecting several photos at once in an Image block's file picker (see
  // EditableImage's `multiple` mode): the first becomes this block's own
  // image via the normal field-change path, and one duplicate of this block
  // is inserted right after it per remaining photo.
  function handleDuplicateWithImages(id, urls) {
    const idx = blocks.findIndex((b) => b.id === id);
    if (idx === -1 || urls.length === 0) return;
    const copies = urls.map((url) => ({
      ...blocks[idx],
      id: crypto.randomUUID(),
      props: { ...structuredClone(blocks[idx].props), imageUrl: url },
    }));
    const next = [...blocks.slice(0, idx + 1), ...copies, ...blocks.slice(idx + 1)];
    updateBlocks(next);
  }

  // The Style panel's target: either a real top-level block (nestedKey
  // undefined) or a slide/column nested inside one (a Carousel/Columns
  // block's own props.items/props.columns array) -- see EditableCanvas.jsx's
  // onOpenSettings and CarouselBlock.jsx/ColumnsBlock.jsx's "⚙ Settings"
  // buttons on each slide/column.
  // Clicking the settings button for whatever's already open just closes
  // the panel again (and its button reverts from filled back to outline --
  // see EditableCanvas.jsx/CarouselBlock.jsx/ColumnsBlock.jsx); clicking any
  // other block's settings button switches the panel to that target instead.
  function handleOpenSettings(blockId, nestedKey, nestedIndex) {
    const isSameTarget = sidebarOpen && settingsTarget
      && settingsTarget.blockId === blockId
      && settingsTarget.nestedKey === nestedKey
      && settingsTarget.nestedIndex === nestedIndex;
    if (isSameTarget) {
      setSidebarOpen(false);
      return;
    }
    setSettingsTarget({ blockId, nestedKey, nestedIndex });
    setSidebarOpen(true);
  }

  function resolveSettingsBlock() {
    if (!settingsTarget) return null;
    const parent = blocks.find((b) => b.id === settingsTarget.blockId);
    if (!parent) return null;
    if (!settingsTarget.nestedKey) return parent;
    const nested = (parent.props[settingsTarget.nestedKey] || [])[settingsTarget.nestedIndex];
    return nested ? { id: nested.id, type: nested.type, props: nested.props } : null;
  }

  function handleConfigChange(updatedBlock) {
    if (!settingsTarget) return;
    if (!settingsTarget.nestedKey) {
      updateBlocks(blocks.map((b) => (b.id === updatedBlock.id ? updatedBlock : b)));
      return;
    }
    updateBlocks(blocks.map((b) => {
      if (b.id !== settingsTarget.blockId) return b;
      const list = [...(b.props[settingsTarget.nestedKey] || [])];
      list[settingsTarget.nestedIndex] = { id: list[settingsTarget.nestedIndex].id, type: updatedBlock.type, props: updatedBlock.props };
      return { ...b, props: { ...b.props, [settingsTarget.nestedKey]: list } };
    }));
  }

  function handleFieldChange(blockId, key, value) {
    updateBlocks(blocks.map((b) => (b.id === blockId ? { ...b, props: { ...b.props, [key]: value } } : b)));
  }

  async function handlePublish() {
    setPublishing(true);
    const { error } = await supabaseBrowser
      .from(table)
      .update({ published_blocks: blocks, status: 'published', published_at: new Date().toISOString(), publish_at: null })
      .eq('id', row.id);
    setPublishing(false);
    setPublishOpen(false);
    if (error) {
      setToast({ tone: 'error', text: 'Could not publish: ' + error.message });
    } else {
      setToast({ tone: 'success', text: 'Published — live in about a minute.' });
      setRow((r) => ({ ...r, status: 'published', publish_at: null }));
    }
    setTimeout(() => setToast(null), 4000);
  }

  // Scheduled publish doesn't touch published_blocks yet -- sweep-scheduled-
  // content (runs every 15min via GitHub Actions cron) does the real publish
  // once publish_at passes, using whatever draft_blocks looks like at that
  // moment. Optional unpublish_at is independent of scheduling a publish --
  // editable any time the row is published or scheduled, via updateMeta like
  // any other field, not its own save flow.
  async function handleSchedule(publishAtISO) {
    setPublishing(true);
    const { error } = await supabaseBrowser
      .from(table)
      .update({ status: 'scheduled', publish_at: publishAtISO })
      .eq('id', row.id);
    setPublishing(false);
    setPublishOpen(false);
    if (error) {
      setToast({ tone: 'error', text: 'Could not schedule: ' + error.message });
    } else {
      setToast({ tone: 'success', text: `Scheduled — will publish ${new Date(publishAtISO).toLocaleString()}.` });
      setRow((r) => ({ ...r, status: 'scheduled', publish_at: publishAtISO }));
    }
    setTimeout(() => setToast(null), 4000);
  }

  async function handleResetToPublished() {
    if (!row.published_blocks) return;
    updateBlocks(row.published_blocks);
  }

  if (!row) {
    return <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>;
  }

  // Only meaningful once published -- the live site only ever renders
  // published_blocks, so a draft-only page has no real public URL yet.
  const liveHref = row.status === 'published'
    ? withBase(isPost ? `/announcements/${row.slug}` : (row.route_path || `/${row.slug}`))
    : null;

  return (
    <div>
      <a href={withBase(backHref)} style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)', color: 'var(--text-link)', textDecoration: 'none' }}>← Back</a>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', margin: 'var(--space-3) 0 var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', margin: 0 }}>{row.title}</h2>
            <Badge tone={row.status === 'published' ? 'success' : row.status === 'scheduled' ? 'warning' : 'neutral'}>{row.status}</Badge>
            <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-muted)' }}>
              {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Draft saved' : ''}
            </span>
          </div>
          {row.status === 'scheduled' && row.publish_at && (
            <div style={{ marginTop: 'var(--space-2)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)', color: 'var(--color-warning)' }}>
              📅 Publishes automatically {new Date(row.publish_at).toLocaleString()} —{' '}
              <button onClick={() => updateMeta({ status: 'draft', publish_at: null })} style={linkButtonStyle}>cancel schedule</button>
            </div>
          )}
          {row.unpublish_at && (
            <div style={{ marginTop: 'var(--space-1)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)', color: 'var(--text-muted)' }}>
              ⏳ Automatically unpublishes {new Date(row.unpublish_at).toLocaleString()} —{' '}
              <button onClick={() => updateMeta({ unpublish_at: null })} style={linkButtonStyle}>remove</button>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
          {liveHref && (
            <a href={liveHref} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)', color: 'var(--text-link)', textDecoration: 'none' }}>
              View live ↗
            </a>
          )}
          {row.published_blocks && <Button variant="ghost" size="sm" onClick={handleResetToPublished}>Reset to current setup - unedited</Button>}
          <Button variant="primary" onClick={() => { setPublishMode('now'); setScheduleAt(''); setPublishOpen(true); }}>Publish</Button>
        </div>
      </div>

      {isPost && (
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <Card title="Post details">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <Input label="Title" value={row.title} onChange={(e) => updateMeta({ title: e.target.value })} />
              <Textarea label="Excerpt (shown on the announcements list)" value={row.excerpt} onChange={(e) => updateMeta({ excerpt: e.target.value })} rows={2} />
              <ImageUploadField label="Cover image" value={row.cover_image_url} onChange={(url) => updateMeta({ cover_image_url: url })} pathPrefix={`posts/${row.id}`} aspect={16 / 9} />
            </div>
          </Card>
        </div>
      )}

      {!isPost && row.page_kind === 'builder' && (
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <Card title="Page SEO details">
            {/* Collapsed by default -- these matter for search/social sharing
                but aren't needed to just write and publish a page, so they
                shouldn't compete with the actual content for attention. The
                Pages overview flags a published page missing a description
                (see PagesListScreen.jsx) so there's still a clear path back here. */}
            <details>
              <summary style={{ cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)', color: 'var(--text-secondary)' }}>
                Meta description & social share image {!row.meta_description && '(not set yet)'}
              </summary>
              <div style={{ marginTop: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <Textarea
                  label="Meta description (shown in search results and link previews)"
                  value={row.meta_description || ''}
                  onChange={(e) => updateMeta({ meta_description: e.target.value })}
                  rows={2}
                />
                <ImageUploadField label="Social share image (og:image)" value={row.og_image_url} onChange={(url) => updateMeta({ og_image_url: url })} pathPrefix={`pages/${row.id}`} aspect={16 / 9} />
              </div>
            </details>
          </Card>
        </div>
      )}

      <Tabs tabs={['Edit', 'Preview']} active={view} onChange={setView} />

      <div style={{ marginTop: 'var(--space-6)' }}>
        {view === 'Edit' ? (
          <div style={{ display: 'grid', gridTemplateColumns: sidebarOpen ? '1.6fr 1fr' : '1fr', gap: 'var(--space-6)', alignItems: 'start', minWidth: 0 }}>
            {/* minWidth: 0 -- a grid item's default min-width is `auto`
                just like a flex item's, so wide content inside (a Carousel's
                row of slides, a long unbreakable value) could otherwise
                force this whole column -- and the grid, and the page --
                wider than the viewport instead of letting it shrink. */}
            <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)', background: 'var(--surface-page)', minWidth: 0 }}>
              <EditableCanvas
                blocks={blocks}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onReorder={handleReorder}
                onFieldChange={handleFieldChange}
                onOpenSettings={handleOpenSettings}
                activeSettingsTarget={sidebarOpen ? settingsTarget : null}
                onRemove={handleRemove}
                onDuplicate={handleDuplicate}
                onDuplicateWithImages={handleDuplicateWithImages}
                pathPrefix={`${table}/${row.id}`}
              />
              <div style={{ marginTop: 'var(--space-6)' }}>
                <AddBlockButton onAdd={handleAdd} />
              </div>
              {selectedBlock && (
                <p style={{ marginTop: 'var(--space-3)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)' }}>
                  Selected: press <kbd>Delete</kbd> to remove, <kbd>{modKeyLabel}D</kbd> to duplicate, <kbd>Esc</kbd> to deselect.
                </p>
              )}
            </div>
            {sidebarOpen ? (
              <div style={{ position: 'sticky', top: 'var(--space-6)' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-2)' }}>
                  <button
                    onClick={() => setSidebarOpen(false)}
                    title="Hide the settings panel to give the canvas more room"
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)' }}
                  >
                    Hide panel »
                  </button>
                </div>
                <BlockConfigPanel
                  block={resolveSettingsBlock()}
                  onChange={handleConfigChange}
                  showLayout={!settingsTarget?.nestedKey}
                  contextLabel={settingsTarget?.nestedKey ? nestedContextLabel(blocks, settingsTarget) : undefined}
                />
              </div>
            ) : (
              <button
                onClick={() => setSidebarOpen(true)}
                title="Show the settings panel"
                style={{
                  position: 'fixed', top: '50%', right: 0, transform: 'translateY(-50%)', zIndex: 30,
                  border: '1px solid var(--border-subtle)', borderRight: 'none', borderRadius: 'var(--radius-md) 0 0 var(--radius-md)',
                  background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)', cursor: 'pointer',
                  padding: 'var(--space-3) var(--space-2)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)',
                  writingMode: 'vertical-rl',
                }}
              >
                « Settings
              </button>
            )}
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
              {Object.keys(DEVICE_WIDTHS).map((device) => (
                <Button key={device} variant={previewDevice === device ? 'primary' : 'outline'} size="sm" onClick={() => setPreviewDevice(device)}>
                  {device}
                </Button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div
                style={{
                  width: DEVICE_WIDTHS[previewDevice] || '100%',
                  maxWidth: '100%',
                  border: previewDevice === 'Desktop' ? '1px solid var(--border-subtle)' : '8px solid var(--text-primary)',
                  borderRadius: previewDevice === 'Desktop' ? 'var(--radius-lg)' : 'var(--radius-xl, 32px)',
                  background: 'var(--surface-page)',
                  overflow: 'hidden',
                  transition: 'width var(--duration-standard)',
                  // Blocks' own responsive CSS reacts to @container, not
                  // @media (see components.css) -- without this, the frame
                  // can look narrow while every block still renders its
                  // desktop layout, since @media only ever sees the real
                  // (full-width admin) browser window, never this div's width.
                  containerType: 'inline-size',
                }}
              >
                {previewDevice === 'Mobile' && (
                  <div style={{ height: 18, background: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 60, height: 5, borderRadius: 3, background: 'var(--surface-page)' }} />
                  </div>
                )}
                {/* overflowX explicit -- setting overflowY without it makes a
                    browser compute overflow-x as its own independent 'auto'
                    (a CSS quirk), so this div could show its own sideways
                    scrollbar for wide content even though the frame around
                    it already has overflow:hidden. */}
                <div style={{ padding: 'var(--space-8)', maxHeight: '80vh', overflowY: 'auto', overflowX: 'hidden' }}>
                  <BlockRenderer blocks={blocks} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <Dialog open={publishOpen} title={isPost ? 'Publish this announcement?' : 'Publish this page?'} onClose={() => setPublishOpen(false)}>
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
          <Button variant={publishMode === 'now' ? 'primary' : 'outline'} size="sm" onClick={() => setPublishMode('now')}>Publish now</Button>
          <Button variant={publishMode === 'schedule' ? 'primary' : 'outline'} size="sm" onClick={() => setPublishMode('schedule')}>Schedule for later</Button>
        </div>

        {publishMode === 'now' ? (
          <p style={{ color: 'var(--text-secondary)', marginTop: 0 }}>
            This replaces the live version of "{row.title}" with your current draft. It'll be visible on the public
            site within about a minute.
          </p>
        ) : (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <Input
              label="Publish at"
              type="datetime-local"
              value={scheduleAt}
              onChange={(e) => setScheduleAt(e.target.value)}
            />
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-caption)', marginTop: 'var(--space-2)' }}>
              Goes live automatically at this time, using whatever your draft looks like when it fires — checked every 15 minutes.
            </p>
          </div>
        )}

        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
          <Input
            label="Unpublish automatically (optional)"
            type="datetime-local"
            value={unpublishAt}
            onChange={(e) => { setUnpublishAt(e.target.value); updateMeta({ unpublish_at: e.target.value ? fromLocalInputValue(e.target.value) : null }); }}
          />
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-caption)', marginTop: 'var(--space-2)' }}>
            Reverts to draft at this time — content stays saved, so republishing later needs no rework.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={() => setPublishOpen(false)}>Cancel</Button>
          {publishMode === 'now' ? (
            <Button variant="primary" disabled={publishing} onClick={handlePublish}>
              {publishing ? 'Publishing…' : 'Publish'}
            </Button>
          ) : (
            <Button variant="primary" disabled={publishing || !scheduleAt} onClick={() => handleSchedule(fromLocalInputValue(scheduleAt))}>
              {publishing ? 'Scheduling…' : 'Schedule'}
            </Button>
          )}
        </div>
      </Dialog>

      {toast && (
        <div style={{ position: 'fixed', bottom: 'var(--space-6)', right: 'var(--space-6)' }}>
          <Toast tone={toast.tone}>{toast.text}</Toast>
        </div>
      )}
    </div>
  );
}
