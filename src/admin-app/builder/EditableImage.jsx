import React from 'react';
import { uploadImageBlob, uploadImageFile } from '../imageUpload.js';
import { CropEditor } from '../CropEditor.jsx';

// Wraps an <img> (or empty-state placeholder) with a click-to-replace overlay,
// used inline on the edit canvas -- as opposed to ImageUploadField, the small
// side-panel thumbnail+button version used for things like a Hero's background image.
// Cropping is the default for every upload here. `aspect` locks the crop
// frame to a fixed ratio for callers with one known, fixed display shape
// (e.g. a carousel slide is always 16:9); leave it unset and CropEditor
// matches the frame to the photo's own aspect ratio instead, so a block with
// a flexible/user-chosen final aspect (Image, Hero, Columns, ...) never has
// content force-trimmed by default -- zooming in to crop is still available.
//
// `multiple` + `onExtraImages` opt a caller into picking several files at
// once (Finder/Explorer's native multi-select): the first file still goes
// through the normal single-file crop flow below, but selecting more than
// one skips cropping entirely (reviewing N crops one at a time defeats the
// point of a bulk upload) and hands the rest of the uploaded URLs to
// `onExtraImages` for the caller to turn into more blocks/slides -- see
// ImageBlock (duplicates itself per extra photo) and CarouselBlock's media
// slide (adds one new slide per extra photo).
export function EditableImage({ value, alt, onChange, pathPrefix, style, emptyLabel = 'Click to add image', aspect, multiple = false, onExtraImages }) {
  const inputRef = React.useRef(null);
  const [uploading, setUploading] = React.useState(false);
  const [uploadStatus, setUploadStatus] = React.useState('');
  const [cropSrc, setCropSrc] = React.useState(null);

  function handleFiles(fileList) {
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) return;
    if (files.length === 1) {
      setCropSrc(URL.createObjectURL(files[0]));
      return;
    }
    uploadMultiple(files);
  }

  async function uploadMultiple(files) {
    setUploading(true);
    try {
      const urls = [];
      for (let i = 0; i < files.length; i++) {
        setUploadStatus(`Uploading ${i + 1} of ${files.length}…`);
        urls.push(await uploadImageFile(files[i], pathPrefix));
      }
      onChange(urls[0]);
      if (urls.length > 1) onExtraImages?.(urls.slice(1));
    } catch (err) {
      alert(err.message || 'Upload failed.'); // eslint-disable-line no-alert -- rare path, fine as a simple admin-only notice
    } finally {
      setUploading(false);
      setUploadStatus('');
    }
  }

  async function handleCropConfirm(blob) {
    setUploading(true);
    try {
      const url = await uploadImageBlob(blob, pathPrefix);
      onChange(url);
    } catch (err) {
      alert(err.message || 'Upload failed.'); // eslint-disable-line no-alert -- rare path, fine as a simple admin-only notice
    } finally {
      setUploading(false);
      closeCropper();
    }
  }

  function closeCropper() {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  }

  return (
    <div
      onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
      className="editable-image"
      style={{ position: 'relative', cursor: 'pointer', borderRadius: 'var(--radius-lg)', overflow: 'hidden', ...style }}
    >
      {value ? (
        <img src={value} alt={alt} style={{ width: '100%', display: 'block' }} />
      ) : (
        <div style={{ width: '100%', minHeight: 160, background: 'var(--surface-sunken)', border: '1px dashed var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)' }}>
          {uploading ? (uploadStatus || 'Uploading…') : emptyLabel}
        </div>
      )}
      {value && (
        <div
          className="editable-image-overlay"
          style={{ position: 'absolute', inset: 0, background: 'rgba(20,20,22,0.55)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)', opacity: 0, transition: 'opacity var(--duration-fast)' }}
        >
          {uploading ? (uploadStatus || 'Uploading…') : 'Click to replace'}
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" multiple={multiple} style={{ display: 'none' }} onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }} />

      {cropSrc && (
        <div onClick={(e) => e.stopPropagation()}>
          <CropEditor src={cropSrc} aspect={aspect} onCancel={closeCropper} onConfirm={handleCropConfirm} />
        </div>
      )}
    </div>
  );
}
