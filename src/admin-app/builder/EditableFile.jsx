import React from 'react';
import { uploadDocumentFile } from '../fileUpload.js';

// Click-to-upload/replace for arbitrary documents (PDF, Word, etc.), used
// inline by DownloadBlock -- the file-kind analog of EditableImage.jsx.
export function EditableFile({ value, fileName, onChange, pathPrefix }) {
  const inputRef = React.useRef(null);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState('');

  async function handleFile(file) {
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const { url, name } = await uploadDocumentFile(file, pathPrefix);
      onChange(url, name);
    } catch (err) {
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
        {uploading ? 'Uploading…' : value ? `Replace file${fileName ? ` (${fileName})` : ''}` : 'Upload file'}
      </button>
      <input ref={inputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,image/png,image/jpeg" style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files?.[0])} />
      {error && <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-error)', marginTop: 'var(--space-1)' }}>{error}</div>}
    </div>
  );
}
