import React from 'react';
import { uploadImageBlob, fetchImageFromUrl } from './imageUpload.js';
import { CropEditor } from './CropEditor.jsx';
import { ImageSourceMenu } from './ImageSourceMenu.jsx';

// Side-panel version -- a compact thumbnail + button. See EditableImage.jsx
// for the click-directly-on-canvas version used inline in Image/Image+Text blocks.
// `aspect` (width/height) sets the crop frame's shape -- 1 (square) fits a
// person's photo, a wider ratio suits something like a post's cover image.
export function ImageUploadField({ label, value, onChange, pathPrefix = 'misc', aspect = 1 }) {
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [cropSrc, setCropSrc] = React.useState(null);

  function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
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

  async function handleCropConfirm(blob) {
    setUploading(true);
    try {
      const url = await uploadImageBlob(blob, pathPrefix);
      onChange(url);
    } catch (err) {
      setError(err.message || 'Upload failed.');
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
    <div className="field">
      {label && <span style={{ fontSize: 'var(--fs-small)', fontWeight: 'var(--fw-bold)', color: 'var(--text-secondary)' }}>{label}</span>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        {value ? (
          <img src={value} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }} />
        ) : (
          <div style={{ width: 64, height: 64, borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 'var(--fs-caption)' }}>
            None
          </div>
        )}
        <ImageSourceMenu
          label={value ? 'Replace image' : 'Upload image'}
          disabled={uploading}
          onFile={handleFile}
          onUrl={handleUrl}
          onExisting={(url) => onChange(url)}
        />
      </div>
      {error && <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-error)' }}>{error}</span>}

      {cropSrc && (
        <CropEditor src={cropSrc} aspect={aspect} onCancel={closeCropper} onConfirm={handleCropConfirm} />
      )}
    </div>
  );
}
