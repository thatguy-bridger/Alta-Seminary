import React from 'react';
import { uploadDocumentFile } from '../fileUpload.js';

// Click-to-upload/replace for arbitrary documents (PDF, Word, etc.), used
// inline by DownloadBlock -- the file-kind analog of EditableImage.jsx.
// `accept`/`uploadFn` let a different caller (Background Music) reuse this
// same click-to-upload UI against a different file type and storage bucket
// (see fileUpload.js's uploadAudioFile) without duplicating this component.
export function EditableFile({ value, fileName, onChange, pathPrefix, accept = '.pdf,.doc,.docx,.xls,.xlsx,image/png,image/jpeg', uploadFn = uploadDocumentFile, label = 'file' }) {
  const inputRef = React.useRef(null);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState('');

  async function handleFile(file) {
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const { url, name } = await uploadFn(file, pathPrefix);
      onChange(url, name);
    } catch (err) {
      // Logged in full (not just err.message) so a vague on-screen message
      // still has the real underlying cause available in devtools --
      // Supabase storage/RLS errors often carry more detail (status code,
      // a Postgres error code) on the object than the message string alone.
      console.error('File upload failed:', err);
      setError(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        className="btn btn-outline btn-sm"
        onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
        disabled={uploading}
      >
        {uploading ? 'Uploading…' : value ? `Replace ${label}${fileName ? ` (${fileName})` : ''}` : `Upload ${label}`}
      </button>
      <input ref={inputRef} type="file" accept={accept} style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files?.[0])} />
      {error && (
        <div style={{ marginTop: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-sm)', background: 'var(--tint-error-bg)', border: '1px solid var(--color-error)', color: 'var(--color-error)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)', fontWeight: 'var(--fw-bold)' }}>
          {error}
        </div>
      )}
    </div>
  );
}
