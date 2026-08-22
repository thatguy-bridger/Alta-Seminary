import React from 'react';
import { supabaseBrowser } from '../../lib/supabase/browser-client';
import { uploadImageBlob, fetchImageFromUrl } from '../imageUpload.js';
import { CropEditor } from '../CropEditor.jsx';
import { ImageSourceMenu } from '../ImageSourceMenu.jsx';
import { Badge } from '../../design-system/components/core/Badge.jsx';
import { BLOCK_REGISTRY } from '../../blocks/registry.js';

// Every image anywhere on the site, grouped by where it's actually used --
// no manual album/category upkeep required. Lets an admin swap out a stale
// photo (e.g. a staff member's headshot) directly from here, without
// hunting down which directory/page/post it lives on.
//
// Content-embedded images (Hero/Image/Carousel/Quote block props inside
// pages & blog_posts) are matched against a specific page/post's own block
// tree, so each occurrence carries a "where on the page" location (e.g.
// "Carousel -> slide 2 (Image + caption)") and a Replace that only touches
// that one row -- not every other page that happens to reuse the same URL.
function keyMatchesImage(key) {
  return /image|photo|avatar|background/i.test(key);
}

// Friendly label for a slide/column's nested type -- 'media' and 'content'
// are pseudo-types local to Carousel/Columns (see CarouselBlock.jsx /
// ColumnsBlock.jsx), not real BLOCK_REGISTRY entries.
function nestedTypeLabel(type) {
  if (type === 'media') return 'Image + caption';
  if (type === 'content') return 'Image + text';
  return BLOCK_REGISTRY[type]?.label || type;
}

// Image keys sit directly on a block/slide/column's own `props` -- nothing
// in this codebase nests an image any deeper than that (see registry.js).
function imageUrlsInProps(props) {
  const found = [];
  if (!props || typeof props !== 'object') return found;
  for (const [key, val] of Object.entries(props)) {
    if (typeof val === 'string' && val && keyMatchesImage(key) && /^https?:\/\//.test(val)) {
      found.push(val);
    }
  }
  return found;
}

// Walks one page/post's block array and returns [{url, location}] --
// Carousel slides and Columns columns are the only two container shapes
// that nest their own {id, type, props}, so those get a specific "slide N" /
// "column N" location; everything else is just the block's own label.
function findImagesInBlocks(blocks) {
  const results = [];
  for (const block of blocks || []) {
    if (!block || typeof block !== 'object') continue;
    const topLabel = BLOCK_REGISTRY[block.type]?.label || block.type;
    if (block.type === 'carousel') {
      (block.props?.items || []).forEach((slide, i) => {
        imageUrlsInProps(slide.props).forEach((url) => {
          results.push({ url, location: `${topLabel} — slide ${i + 1} (${nestedTypeLabel(slide.type)})` });
        });
      });
    } else if (block.type === 'columns') {
      (block.props?.columns || []).forEach((col, i) => {
        imageUrlsInProps(col.props).forEach((url) => {
          results.push({ url, location: `${topLabel} — column ${i + 1} (${nestedTypeLabel(col.type)})` });
        });
      });
    } else {
      imageUrlsInProps(block.props).forEach((url) => {
        results.push({ url, location: topLabel });
      });
    }
  }
  return results;
}

function replaceUrlInBlocks(blocks, oldUrl, newUrl) {
  if (!blocks) return blocks;
  const serialized = JSON.stringify(blocks);
  if (!serialized.includes(oldUrl)) return blocks;
  return JSON.parse(serialized.split(oldUrl).join(newUrl));
}

// A group is either a flat leaf ({ label, items }) or a nested parent
// ({ label, subgroups }) -- Page Images/Announcement Images are two levels
// (the category, then one subgroup per page/post) so a category with a lot
// of pages doesn't dump every image from every page into one giant grid.
function countGroupItems(group) {
  if (group.items) return group.items.length;
  return (group.subgroups || []).reduce((sum, sg) => sum + countGroupItems(sg), 0);
}

export function AllSiteImagesPanel() {
  const [loading, setLoading] = React.useState(true);
  const [groups, setGroups] = React.useState([]);
  const [refreshKey, setRefreshKey] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [{ data: directories }, { data: dirEntries }, { data: posts }, { data: pages }, { data: albums }, { data: photos }] = await Promise.all([
        supabaseBrowser.from('directories').select('id, slug, name').order('sort_order'),
        supabaseBrowser.from('directory_entries').select('id, directory_kind, name, photo_url'),
        supabaseBrowser.from('blog_posts').select('id, title, cover_image_url, draft_blocks, published_blocks'),
        supabaseBrowser.from('pages').select('id, title, og_image_url, draft_blocks, published_blocks'),
        supabaseBrowser.from('gallery_albums').select('id, name').order('sort_order'),
        supabaseBrowser.from('gallery_photos').select('id, album_id, image_url, caption'),
      ]);
      if (cancelled) return;

      // One dropdown per specific directory (e.g. "Directory: Seminary
      // Council") rather than one lumped "Directory photos" group.
      const directoryGroups = (directories || []).map((dir) => {
        const items = (dirEntries || []).filter((e) => e.directory_kind === dir.slug && e.photo_url).map((e) => ({
          id: `dir-${e.id}`,
          imageUrl: e.photo_url,
          aspect: 1,
          title: e.name,
          subtitle: 'Directory photo',
          pathPrefix: `directory/${e.directory_kind}`,
          onReplace: async (newUrl) => {
            await supabaseBrowser.from('directory_entries').update({ photo_url: newUrl }).eq('id', e.id);
          },
        }));
        return { label: `Directory: ${dir.name}`, items };
      }).filter((g) => g.items.length > 0);

      // One dropdown per album (+ Unsorted), same reasoning as directories.
      const albumNameById = new Map((albums || []).map((a) => [a.id, a.name]));
      const albumIds = [...new Set((photos || []).map((ph) => ph.album_id))];
      const galleryGroups = albumIds.map((albumId) => {
        const items = (photos || []).filter((ph) => ph.album_id === albumId).map((ph) => ({
          id: `photo-${ph.id}`,
          imageUrl: ph.image_url,
          aspect: 1,
          title: ph.caption || '(untitled photo)',
          subtitle: 'Gallery photo',
          pathPrefix: `gallery/${ph.album_id || 'unsorted'}`,
          onReplace: async (newUrl) => {
            await supabaseBrowser.from('gallery_photos').update({ image_url: newUrl }).eq('id', ph.id);
          },
        }));
        const label = albumId ? albumNameById.get(albumId) || 'Album' : 'Unsorted';
        return { label: `Gallery: ${label}`, items };
      }).filter((g) => g.items.length > 0);

      const coverImageItems = (posts || []).filter((p) => p.cover_image_url).map((p) => ({
        id: `post-cover-${p.id}`,
        imageUrl: p.cover_image_url,
        aspect: 16 / 9,
        title: p.title,
        subtitle: 'Announcement cover image',
        pathPrefix: `posts/${p.id}`,
        onReplace: async (newUrl) => {
          await supabaseBrowser.from('blog_posts').update({ cover_image_url: newUrl }).eq('id', p.id);
        },
      }));

      // Per-page subgroup: that page's own og:image (if any) plus every
      // image found in its live (published) block tree, each carrying a
      // "where on the page" location. Falls back to draft_blocks for a page
      // that's never been published, so a brand-new page's images still show up.
      function contentItemsForRow(row, table, pathPrefixBase) {
        const source = (row.published_blocks && row.published_blocks.length) ? row.published_blocks : row.draft_blocks;
        return findImagesInBlocks(source).map(({ url, location }, i) => ({
          id: `${table}-content-${row.id}-${i}`,
          imageUrl: url,
          aspect: 16 / 9,
          title: row.title,
          subtitle: location,
          pathPrefix: `${pathPrefixBase}/${row.id}`,
          onReplace: async (newUrl) => {
            await supabaseBrowser.from(table).update({
              draft_blocks: replaceUrlInBlocks(row.draft_blocks, url, newUrl),
              published_blocks: replaceUrlInBlocks(row.published_blocks, url, newUrl),
            }).eq('id', row.id);
          },
        }));
      }

      const pageSubgroups = (pages || []).map((p) => {
        const items = [];
        if (p.og_image_url) {
          items.push({
            id: `page-og-${p.id}`,
            imageUrl: p.og_image_url,
            aspect: 16 / 9,
            title: p.title,
            subtitle: 'Social share image (og:image)',
            pathPrefix: `pages/${p.id}`,
            onReplace: async (newUrl) => {
              await supabaseBrowser.from('pages').update({ og_image_url: newUrl }).eq('id', p.id);
            },
          });
        }
        items.push(...contentItemsForRow(p, 'pages', 'pages'));
        return { label: p.title, items };
      }).filter((g) => g.items.length > 0);

      const postSubgroups = (posts || []).map((p) => {
        const items = contentItemsForRow(p, 'blog_posts', 'posts');
        return { label: p.title, items };
      }).filter((g) => g.items.length > 0);

      const allGroups = [
        ...directoryGroups,
        ...galleryGroups,
        coverImageItems.length > 0 ? { label: 'Cover Images', items: coverImageItems } : null,
        pageSubgroups.length > 0 ? { label: 'Page Images', subgroups: pageSubgroups } : null,
        postSubgroups.length > 0 ? { label: 'Announcement Images', subgroups: postSubgroups } : null,
      ].filter(Boolean);

      setGroups(allGroups);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [refreshKey]);

  if (loading) return <p style={{ color: 'var(--text-secondary)' }}>Loading every image on the site…</p>;
  if (groups.length === 0) return <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-small)' }}>No images found yet.</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {groups.map((group) => (
        <GroupDisclosure key={group.label} group={group} onReplaced={() => setRefreshKey((k) => k + 1)} />
      ))}
    </div>
  );
}

// <details>/<summary> gives collapse/expand behavior (and keyboard/
// screen-reader support) for free -- no extra open/closed state to manage.
// Nested one level for Page Images/Announcement Images (category -> page).
function GroupDisclosure({ group, onReplaced, nested = false }) {
  const count = countGroupItems(group);
  return (
    <details style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', background: nested ? 'var(--surface-card)' : 'var(--surface-sunken)' }}>
      <summary style={{ cursor: 'pointer', padding: 'var(--space-3)', fontFamily: 'var(--font-sans)', fontWeight: 'var(--fw-bold)', fontSize: nested ? 'var(--fs-small)' : 'var(--fs-body)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        {group.label} <Badge tone="neutral">{count}</Badge>
      </summary>
      <div style={{ padding: '0 var(--space-3) var(--space-3)' }}>
        {group.subgroups ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {group.subgroups.map((sg) => (
              <GroupDisclosure key={sg.label} group={sg} onReplaced={onReplaced} nested />
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
            {group.items.map((item) => (
              <ImageTile key={item.id} item={item} onReplaced={onReplaced} />
            ))}
          </div>
        )}
      </div>
    </details>
  );
}

function ImageTile({ item, onReplaced }) {
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [cropSrc, setCropSrc] = React.useState(null);

  function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) { setError('Please choose an image file.'); return; }
    setError('');
    setCropSrc(URL.createObjectURL(file));
  }

  async function handleUrl(url) {
    setError('');
    setUploading(true);
    try {
      const file = await fetchImageFromUrl(url);
      setCropSrc(URL.createObjectURL(file));
    } catch (err) {
      setError(err.message || 'Could not load that URL.');
    } finally {
      setUploading(false);
    }
  }

  async function finishReplace(newUrl) {
    setUploading(true);
    try {
      await item.onReplace(newUrl);
      onReplaced();
    } catch (err) {
      setError(err.message || 'Replace failed.');
    } finally {
      setUploading(false);
    }
  }

  async function handleCropConfirm(blob) {
    try {
      const url = await uploadImageBlob(blob, item.pathPrefix);
      await finishReplace(url);
    } catch (err) {
      setError(err.message || 'Upload failed.');
      setUploading(false);
    } finally {
      setCropSrc(null);
    }
  }

  return (
    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <img src={item.imageUrl} alt="" style={{ width: '100%', aspectRatio: String(item.aspect), objectFit: 'cover', display: 'block', background: 'var(--surface-muted)' }} />
      <div style={{ padding: 'var(--space-2) var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', flex: 1 }}>
        <div style={{ fontSize: 'var(--fs-small)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.title}>
          {item.title}
        </div>
        <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-muted)' }}>{item.subtitle}</div>
        <ImageSourceMenu
          label={uploading ? 'Working…' : 'Replace image'}
          disabled={uploading}
          onFile={handleFile}
          onUrl={handleUrl}
          onExisting={finishReplace}
        />
        {error && <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-error)' }}>{error}</span>}
      </div>

      {cropSrc && (
        <CropEditor
          src={cropSrc}
          aspect={item.aspect}
          title="Crop replacement image"
          onCancel={() => setCropSrc(null)}
          onConfirm={handleCropConfirm}
        />
      )}
    </div>
  );
}
