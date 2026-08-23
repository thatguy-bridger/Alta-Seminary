import React from 'react';
import { uploadImageBlob, uploadImageFile, fetchImageFromUrl } from '../imageUpload.js';
import { CropEditor } from '../CropEditor.jsx';
import { useAlert } from '../ConfirmProvider.jsx';

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
export function EditableImage({ value, alt, onChange, pathPrefix, style, emptyLabel = 'Click to add image', aspect, multiple = false, onExtraImages, showCropThumbnail = true }) {
  const alertUser = useAlert();
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
      await alertUser(err.message || 'Upload failed.', { title: 'Upload failed' });
    } finally {
      setUploading(false);
      setUploadStatus('');
    }
  }

  async function handleUrl(url) {
    setUploading(true);
    setUploadStatus('Fetching…');
    try {
      const file = await fetchImageFromUrl(url);
      setCropSrc(URL.createObjectURL(file));
    } catch (err) {
      await alertUser(err.message || 'Could not load that URL.', { title: 'Could not load image' });
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
      await alertUser(err.message || 'Upload failed.', { title: 'Upload failed' });
    } finally {
      setUploading(false);
      closeCropper();
    }
  }

  function closeCropper() {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  }

  // Re-opens the crop frame on the CURRENT (already-hosted) photo, rather
  // than picking a new one first -- CropEditor accepts a hosted https URL
  // directly for exactly this (see its own comment). Confirming still
  // uploads the result as a new file and swaps it in via onChange, same as
  // any other crop.
  function handleReCrop() {
    setCropSrc(value);
  }

  // Lets the "Change image" control inside the crop dialog itself swap
  // which photo is being cropped, without closing the dialog first -- same
  // effect as picking a brand new source, just applied to the crop already
  // in progress. handleUrl already fetches+opens the cropper, so it works
  // unchanged for both "paste a URL" and "choose an existing image" (both
  // need a real fetch before a canvas can read the pixels without CORS
  // issues) -- a fresh file just needs an object URL, no fetch involved.
  function handleSwapFile(file) {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(URL.createObjectURL(file));
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

      {/* Clicking the image itself is always "upload from computer" (the
          common case, zero extra clicks). This small corner thumbnail --
          same compact-thumbnail idea as ImageUploadField's side-panel
          version -- is the way to re-crop the CURRENT photo instead of
          replacing it outright; it stops the parent image click from also
          firing when it's used. The old "⋯" menu here is gone -- every
          other source (paste a URL, an existing library image) is reachable
          from the "Change image" control inside the crop dialog it opens.
          Skipped entirely (showCropThumbnail=false) for callers that are
          ALREADY a small corner control themselves -- e.g. Hero's own
          background-image picker -- where a second nested thumbnail inside
          an already-small preview is just visual clutter, not a new capability. */}
      {value && showCropThumbnail && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); handleReCrop(); }}
          disabled={uploading}
          title="Crop or replace this image"
          style={{
            position: 'absolute', bottom: 6, right: 6, zIndex: 1, padding: 0, cursor: 'pointer',
            width: 36, height: 36, borderRadius: 'var(--radius-sm)', overflow: 'hidden',
            border: '2px solid var(--surface-card)', boxShadow: 'var(--shadow-md)',
          }}
        >
          <img src={value} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </button>
      )}

      {cropSrc && (
        <div onClick={(e) => e.stopPropagation()}>
          <CropEditor
            src={cropSrc}
            aspect={aspect}
            onCancel={closeCropper}
            onConfirm={handleCropConfirm}
            onSwapFile={handleSwapFile}
            onSwapUrl={handleUrl}
            onSwapExisting={handleUrl}
          />
        </div>
      )}
    </div>
  );
}
