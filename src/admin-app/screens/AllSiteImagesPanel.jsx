import React from 'react';
import { supabaseBrowser } from '../../lib/supabase/browser-client';
import { uploadImageBlob, fetchImageFromUrl } from '../imageUpload.js';
import { CropEditor } from '../CropEditor.jsx';
import { ImageSourceMenu } from '../ImageSourceMenu.jsx';
import { Badge } from '../../design-system/components/core/Badge.jsx';

// Every image anywhere on the site, grouped by where it's actually used --
// no manual album/category upkeep required. Lets an admin swap out a stale
// photo (e.g. a staff member's headshot) directly from here, without
// hunting down which directory/page/post it lives on.
//
// Content-embedded images (Hero/Image/Carousel/Quote block props inside
// pages & blog_posts) are matched by exact URL string across draft_blocks
// AND published_blocks, so a replace here is reflected the next time either
// gets rendered -- no separate "re-publish" step needed for the swap itself.
function keyMatchesImage(key) {
  return /image|photo|avatar|background/i.test(key);
}

function walkBlocksForImages(node, urlMap, sourceLabel) {
  if (Array.isArray(node)) { node.forEach((n) => walkBlocksForImages(n, urlMap, sourceLabel)); return; }
  if (node && typeof node === 'object') {
    for (const [key, val] of Object.entries(node)) {
      if (typeof val === 'string' && val && keyMatchesImage(key) && /^https?:\/\//.test(val)) {
        if (!urlMap.has(val)) urlMap.set(val, new Set());
        urlMap.get(val).add(sourceLabel);
      } else {
        walkBlocksForImages(val, urlMap, sourceLabel);
      }
    }
  }
}

function replaceUrlInBlocks(blocks, oldUrl, newUrl) {
  if (!blocks) return blocks;
  const serialized = JSON.stringify(blocks);
  if (!serialized.includes(oldUrl)) return blocks;
  return JSON.parse(serialized.split(oldUrl).join(newUrl));
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
        supabaseBrowser.from('directories').select('id, slug, name'),
        supabaseBrowser.from('directory_entries').select('id, directory_kind, name, photo_url'),
        supabaseBrowser.from('blog_posts').select('id, title, cover_image_url, draft_blocks, published_blocks'),
        supabaseBrowser.from('pages').select('id, title, og_image_url, draft_blocks, published_blocks'),
        supabaseBrowser.from('gallery_albums').select('id, name'),
        supabaseBrowser.from('gallery_photos').select('id, album_id, image_url, caption'),
      ]);
      if (cancelled) return;

      const dirNameByKind = new Map((directories || []).map((d) => [d.slug, d.name]));
      const albumNameById = new Map((albums || []).map((a) => [a.id, a.name]));

      const directoryItems = (dirEntries || []).filter((e) => e.photo_url).map((e) => ({
        id: `dir-${e.id}`,
        imageUrl: e.photo_url,
        aspect: 1,
        title: e.name,
        subtitle: dirNameByKind.get(e.directory_kind) || e.directory_kind,
        pathPrefix: `directory/${e.directory_kind}`,
        onReplace: async (newUrl) => {
          await supabaseBrowser.from('directory_entries').update({ photo_url: newUrl }).eq('id', e.id);
        },
      }));

      const announcementItems = (posts || []).filter((p) => p.cover_image_url).map((p) => ({
        id: `post-${p.id}`,
        imageUrl: p.cover_image_url,
        aspect: 16 / 9,
        title: p.title,
        subtitle: 'Cover image',
        pathPrefix: `posts/${p.id}`,
        onReplace: async (newUrl) => {
          await supabaseBrowser.from('blog_posts').update({ cover_image_url: newUrl }).eq('id', p.id);
        },
      }));

      const pageItems = (pages || []).filter((p) => p.og_image_url).map((p) => ({
        id: `page-${p.id}`,
        imageUrl: p.og_image_url,
        aspect: 16 / 9,
        title: p.title,
        subtitle: 'Social share image (og:image)',
        pathPrefix: `pages/${p.id}`,
        onReplace: async (newUrl) => {
          await supabaseBrowser.from('pages').update({ og_image_url: newUrl }).eq('id', p.id);
        },
      }));

      const galleryItems = (photos || []).map((ph) => ({
        id: `photo-${ph.id}`,
        imageUrl: ph.image_url,
        aspect: 1,
        title: ph.caption || '(untitled photo)',
        subtitle: ph.album_id ? albumNameById.get(ph.album_id) || 'Album' : 'Unsorted',
        pathPrefix: `gallery/${ph.album_id || 'unsorted'}`,
        onReplace: async (newUrl) => {
          await supabaseBrowser.from('gallery_photos').update({ image_url: newUrl }).eq('id', ph.id);
        },
      }));

      // Content-embedded images: same URL can appear on multiple
      // pages/posts and in both the draft and the live (published) copy, so
      // group by URL and touch every row + both block columns that mention it.
      const urlToSources = new Map(); // url -> Set(labels)
      const urlToRows = new Map(); // url -> [{ table, row }]
      function record(table, row) {
        const found = new Map();
        walkBlocksForImages(row.draft_blocks, found, row.title);
        walkBlocksForImages(row.published_blocks, found, row.title);
        for (const [url, labels] of found) {
          if (!urlToSources.has(url)) urlToSources.set(url, new Set());
          labels.forEach((l) => urlToSources.get(url).add(l));
          if (!urlToRows.has(url)) urlToRows.set(url, []);
          urlToRows.get(url).push({ table, row });
        }
      }
      (pages || []).forEach((p) => record('pages', p));
      (posts || []).forEach((p) => record('blog_posts', p));

      const contentItems = [...urlToSources.entries()].map(([url, labels]) => ({
        id: `content-${url}`,
        imageUrl: url,
        aspect: 16 / 9,
        title: [...labels].join(', '),
        subtitle: 'Used in page/post content',
        pathPrefix: 'content',
        onReplace: async (newUrl) => {
          const rows = urlToRows.get(url) || [];
          await Promise.all(rows.map(({ table, row }) =>
            supabaseBrowser.from(table).update({
              draft_blocks: replaceUrlInBlocks(row.draft_blocks, url, newUrl),
              published_blocks: replaceUrlInBlocks(row.published_blocks, url, newUrl),
            }).eq('id', row.id)
          ));
        },
      }));

      setGroups([
        { label: 'Directory photos', items: directoryItems },
        { label: 'Announcement cover images', items: announcementItems },
        { label: 'Page social share images', items: pageItems },
        { label: 'Gallery photos', items: galleryItems },
        { label: 'Images used in page/post content', items: contentItems },
      ].filter((g) => g.items.length > 0));
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [refreshKey]);

  if (loading) return <p style={{ color: 'var(--text-secondary)' }}>Loading every image on the site…</p>;
  if (groups.length === 0) return <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-small)' }}>No images found yet.</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {groups.map((group) => (
        <div key={group.label}>
          <h4 style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--fs-body)' }}>{group.label} <Badge tone="neutral">{group.items.length}</Badge></h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
            {group.items.map((item) => (
              <ImageTile key={item.id} item={item} onReplaced={() => setRefreshKey((k) => k + 1)} />
            ))}
          </div>
        </div>
      ))}
    </div>
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
