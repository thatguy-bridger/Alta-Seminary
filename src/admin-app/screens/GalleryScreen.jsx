import React from 'react';
import { supabaseBrowser } from '../../lib/supabase/browser-client';
import { uploadImageBlob } from '../imageUpload.js';
import { CropEditor } from '../CropEditor.jsx';
import { Card } from '../../design-system/components/core/Card.jsx';
import { Badge } from '../../design-system/components/core/Badge.jsx';
import { Button } from '../../design-system/components/forms/Button.jsx';
import { Input } from '../../design-system/components/forms/Input.jsx';
import { Select } from '../../design-system/components/forms/Select.jsx';
import { Dialog } from '../../design-system/components/core/Dialog.jsx';
import { EyeIcon, EyeOffIcon, TrashIcon } from '../icons.jsx';
import { useConfirm, useAlert } from '../ConfirmProvider.jsx';

// Photos with no album (e.g. left behind after their album was deleted --
// gallery_photos.album_id is ON DELETE SET NULL) live under this pseudo-tab.
// It isn't a row in gallery_albums, so it can't be created or deleted itself.
const UNSORTED = { id: null, name: 'Unsorted' };

export function GalleryScreen() {
  const confirm = useConfirm();
  const alertUser = useAlert();
  const [albums, setAlbums] = React.useState(null);
  const [activeAlbumId, setActiveAlbumId] = React.useState(undefined); // undefined = not yet chosen
  const [addAlbumOpen, setAddAlbumOpen] = React.useState(false);
  const [photos, setPhotos] = React.useState(null);
  const [editing, setEditing] = React.useState(null);
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState('');
  const [pendingFiles, setPendingFiles] = React.useState(null); // File[] awaiting crop, one dialog at a time
  const [pendingIndex, setPendingIndex] = React.useState(0);
  const [cropSrc, setCropSrc] = React.useState(null);
  const fileInputRef = React.useRef(null);
  const nextSortRef = React.useRef(0);

  // Each queued file gets its own object URL, created/revoked as the queue advances.
  React.useEffect(() => {
    if (!pendingFiles || pendingIndex >= pendingFiles.length) { setCropSrc(null); return; }
    const url = URL.createObjectURL(pendingFiles[pendingIndex]);
    setCropSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFiles, pendingIndex]);

  const activeAlbum = activeAlbumId === null ? UNSORTED : albums?.find((a) => a.id === activeAlbumId) || null;

  async function loadAlbums(selectId) {
    const { data } = await supabaseBrowser.from('gallery_albums').select('*').order('sort_order');
    setAlbums(data || []);
    if (selectId !== undefined) setActiveAlbumId(selectId);
    else if (activeAlbumId === undefined) setActiveAlbumId(data?.length ? data[0].id : null);
  }

  React.useEffect(() => { loadAlbums(); }, []);

  async function handleCreateAlbum(name) {
    const { data } = await supabaseBrowser
      .from('gallery_albums')
      .insert({ name, sort_order: albums.length })
      .select()
      .single();
    setAddAlbumOpen(false);
    await loadAlbums(data?.id);
  }

  async function handleDeleteAlbum(album) {
    const { count } = await supabaseBrowser
      .from('gallery_photos')
      .select('id', { count: 'exact', head: true })
      .eq('album_id', album.id);
    if (count > 0) {
      await alertUser(`"${album.name}" still has ${count} photo${count === 1 ? '' : 's'}. Move or delete those first.`, { title: 'Album not empty' });
      return;
    }
    if (!(await confirm(`Delete the "${album.name}" album? This can't be undone.`, { title: 'Delete album?', confirmLabel: 'Delete', danger: true }))) return;
    await supabaseBrowser.from('gallery_albums').delete().eq('id', album.id);
    if (activeAlbumId === album.id) setActiveAlbumId(undefined);
    loadAlbums();
  }

  async function loadPhotos() {
    if (activeAlbumId === undefined) return;
    const query = supabaseBrowser.from('gallery_photos').select('*').order('sort_order');
    const { data } = activeAlbumId === null ? await query.is('album_id', null) : await query.eq('album_id', activeAlbumId);
    setPhotos(data || []);
  }

  React.useEffect(() => { setPhotos(null); loadPhotos(); }, [activeAlbumId]);

  function startUpload(fileList) {
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) return;
    setUploadError('');
    nextSortRef.current = photos.length;
    setPendingFiles(files);
    setPendingIndex(0);
  }

  function advanceQueue() {
    setPendingIndex((i) => {
      const next = i + 1;
      if (next >= pendingFiles.length) {
        setPendingFiles(null);
        return 0;
      }
      return next;
    });
    loadPhotos();
  }

  function cancelUploadQueue() {
    setPendingFiles(null);
    setPendingIndex(0);
    loadPhotos();
  }

  async function handleCropConfirm(blob) {
    setUploading(true);
    try {
      const url = await uploadImageBlob(blob, `gallery/${activeAlbumId || 'unsorted'}`);
      await supabaseBrowser.from('gallery_photos').insert({
        album_id: activeAlbumId, image_url: url, status: 'draft', sort_order: nextSortRef.current++,
      });
    } catch (err) {
      setUploadError(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
      advanceQueue();
    }
  }

  async function move(row, direction) {
    const idx = photos.findIndex((p) => p.id === row.id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= photos.length) return;
    const other = photos[swapIdx];
    await Promise.all([
      supabaseBrowser.from('gallery_photos').update({ sort_order: other.sort_order }).eq('id', row.id),
      supabaseBrowser.from('gallery_photos').update({ sort_order: row.sort_order }).eq('id', other.id),
    ]);
    loadPhotos();
  }

  async function toggleStatus(row) {
    await supabaseBrowser.from('gallery_photos').update({ status: row.status === 'published' ? 'draft' : 'published' }).eq('id', row.id);
    loadPhotos();
  }

  async function handleDelete(row) {
    if (!(await confirm("Delete this photo? This can't be undone.", { title: 'Delete photo?', confirmLabel: 'Delete', danger: true }))) return;
    await supabaseBrowser.from('gallery_photos').delete().eq('id', row.id);
    loadPhotos();
  }

  async function handleSave(draft) {
    const { caption, alt_text, album_id, status } = draft;
    await supabaseBrowser.from('gallery_photos').update({ caption, alt_text, album_id, status }).eq('id', draft.id);
    setEditing(null);
    loadPhotos();
  }

  return (
    <Card title="Photo Gallery">
      <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-small)', marginTop: 0 }}>
        Organize photos into albums, then add a "Photo Gallery" block to any page to display one publicly.
      </p>

      {albums === null ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
          {albums.map((album) => (
            <div key={album.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
              <button
                onClick={() => setActiveAlbumId(album.id)}
                className={'tab' + (album.id === activeAlbumId ? ' active' : '')}
              >
                {album.name}
              </button>
              <button onClick={() => handleDeleteAlbum(album)} title={`Delete "${album.name}" album`} style={{ ...iconButtonStyle, color: 'var(--text-muted)' }}>
                <TrashIcon />
              </button>
            </div>
          ))}
          <button className={'tab' + (activeAlbumId === null ? ' active' : '')} onClick={() => setActiveAlbumId(null)}>
            {UNSORTED.name}
          </button>
          <button className="tab" onClick={() => setAddAlbumOpen(true)} style={{ color: 'var(--brand-secondary)' }}>+ New album</button>
        </div>
      )}

      {activeAlbum && (
        <div style={{ margin: '0 0 var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <Button variant="outline" disabled={uploading || !!pendingFiles} onClick={() => fileInputRef.current?.click()}>
            {uploading ? 'Uploading…' : '+ Add Photos'}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => { startUpload(e.target.files); e.target.value = ''; }}
          />
          {uploadError && <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-error)' }}>{uploadError}</span>}
        </div>
      )}

      {photos === null ? (
        <p style={{ color: 'var(--text-secondary)' }}>{activeAlbum ? 'Loading…' : 'Create an album to get started.'}</p>
      ) : photos.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-small)' }}>No photos in "{activeAlbum.name}" yet.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 'var(--space-3)' }}>
          {photos.map((photo, idx) => (
            <div key={photo.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              <img src={photo.image_url} alt={photo.alt_text || ''} style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', display: 'block' }} />
              <div style={{ padding: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Badge tone={photo.status === 'published' ? 'success' : 'neutral'}>{photo.status}</Badge>
                  <div style={{ display: 'flex', gap: 2 }}>
                    <button onClick={() => move(photo, -1)} disabled={idx === 0} title="Move earlier" style={arrowStyle}>◀</button>
                    <button onClick={() => move(photo, 1)} disabled={idx === photos.length - 1} title="Move later" style={arrowStyle}>▶</button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'space-between' }}>
                  <button onClick={() => setEditing(photo)} style={{ ...iconButtonStyle, fontSize: 'var(--fs-caption)', fontFamily: 'var(--font-sans)' }}>Edit</button>
                  <button onClick={() => toggleStatus(photo)} title={photo.status === 'published' ? 'Published — click to unpublish' : 'Draft — click to publish'} style={iconButtonStyle}>
                    {photo.status === 'published' ? <EyeIcon /> : <EyeOffIcon />}
                  </button>
                  <button onClick={() => handleDelete(photo)} title="Delete" style={{ ...iconButtonStyle, color: 'var(--color-error)' }}>
                    <TrashIcon />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <PhotoDialog
          photo={editing}
          albums={albums}
          onCancel={() => setEditing(null)}
          onSave={handleSave}
        />
      )}

      {addAlbumOpen && (
        <NewAlbumDialog onCancel={() => setAddAlbumOpen(false)} onCreate={handleCreateAlbum} />
      )}

      {cropSrc && pendingFiles && (
        <CropEditor
          src={cropSrc}
          aspect={1}
          title={pendingFiles.length > 1 ? `Crop photo (${pendingIndex + 1} of ${pendingFiles.length})` : 'Crop photo'}
          onCancel={cancelUploadQueue}
          onConfirm={handleCropConfirm}
        />
      )}
    </Card>
  );
}

function NewAlbumDialog({ onCancel, onCreate }) {
  const [name, setName] = React.useState('');
  const [creating, setCreating] = React.useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    await onCreate(name.trim());
    setCreating(false);
  }

  return (
    <Dialog open title="New album" onClose={onCancel}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', minWidth: 320 }}>
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Fall Retreat 2026" />
        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" disabled={creating || !name.trim()}>{creating ? 'Creating…' : 'Create'}</Button>
        </div>
      </form>
    </Dialog>
  );
}

function PhotoDialog({ photo, albums, onCancel, onSave }) {
  const [draft, setDraft] = React.useState(photo);
  const [cropping, setCropping] = React.useState(false);
  const [recropping, setRecropping] = React.useState(false);
  function patch(p) { setDraft((d) => ({ ...d, ...p })); }

  async function handleRecrop(blob) {
    setRecropping(true);
    try {
      const url = await uploadImageBlob(blob, `gallery/${draft.album_id || 'unsorted'}`);
      patch({ image_url: url });
    } finally {
      setRecropping(false);
      setCropping(false);
    }
  }

  return (
    <Dialog open title="Edit photo" onClose={onCancel}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', minWidth: 380, maxWidth: 480 }}>
        <div style={{ position: 'relative' }}>
          <img src={draft.image_url} alt="" style={{ width: '100%', maxHeight: 240, objectFit: 'contain', borderRadius: 'var(--radius-md)', background: 'var(--surface-muted)' }} />
          <div style={{ position: 'absolute', bottom: 8, right: 8 }}>
            <Button variant="outline" size="sm" disabled={recropping} onClick={() => setCropping(true)}>
              {recropping ? 'Saving…' : 'Re-crop'}
            </Button>
          </div>
        </div>
        <Input label="Caption (optional)" value={draft.caption || ''} onChange={(e) => patch({ caption: e.target.value })} />
        <Input label="Alt text (for accessibility)" value={draft.alt_text || ''} onChange={(e) => patch({ alt_text: e.target.value })} />
        <Select
          label="Album"
          value={draft.album_id ?? ''}
          options={[{ value: '', label: 'Unsorted' }, ...albums.map((a) => ({ value: a.id, label: a.name }))]}
          onChange={(e) => patch({ album_id: e.target.value || null })}
        />
        <Select
          label="Status"
          value={draft.status}
          options={[{ value: 'draft', label: 'Draft (hidden from public)' }, { value: 'published', label: 'Published' }]}
          onChange={(e) => patch({ status: e.target.value })}
        />
        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" onClick={() => onSave(draft)}>Save</Button>
        </div>
      </div>

      {cropping && (
        <CropEditor
          src={draft.image_url}
          aspect={1}
          title="Re-crop photo"
          onCancel={() => setCropping(false)}
          onConfirm={handleRecrop}
        />
      )}
    </Dialog>
  );
}

const arrowStyle = { border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 10, lineHeight: '12px', padding: 2 };
const iconButtonStyle = { border: 'none', background: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' };
