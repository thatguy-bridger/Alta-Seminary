import React from 'react';
import { EditableText } from '../admin-app/builder/EditableText.jsx';
import { EditableFile } from '../admin-app/builder/EditableFile.jsx';
import { textStyleToCss } from '../admin-app/builder/textStyle.js';

const DownloadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

// The HTML `download` attribute is silently ignored for cross-origin URLs
// (which this always is -- the file lives on Supabase's own domain, not the
// site's), so the browser just navigates to the file instead of downloading
// it. Supabase Storage's own `?download` query param makes the response
// itself carry a Content-Disposition: attachment header, which forces a real
// download regardless of origin -- this isn't a localhost-only quirk, it'd
// behave identically in production without this.
function downloadUrl(fileUrl, fileName) {
  if (!fileUrl) return fileUrl;
  const separator = fileUrl.includes('?') ? '&' : '?';
  const param = fileName ? `download=${encodeURIComponent(fileName)}` : 'download';
  return `${fileUrl}${separator}${param}`;
}

export function DownloadBlock({ label, fileUrl, fileName, align = 'left', labelStyle, editable, onFieldChange }) {
  if (!editable && !fileUrl) return null;

  return (
    <div style={{ textAlign: align }}>
      {editable ? (
        <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 'var(--space-2)', alignItems: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start' }}>
          <span className="btn btn-outline" style={textStyleToCss(labelStyle)}>
            <DownloadIcon />
            <EditableText value={label} onCommit={(v) => onFieldChange('label', v)} placeholder="Button label (e.g. Download Permission Slip)" styleValue={labelStyle} onStyleChange={(s) => onFieldChange('labelStyle', s)} />
          </span>
          <EditableFile value={fileUrl} fileName={fileName} onChange={(url, name) => { onFieldChange('fileUrl', url); if (!fileName) onFieldChange('fileName', name); }} />
          {!fileUrl && (
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--color-error)' }}>
              No file uploaded yet — this button won't appear on the published page until you add one.
            </span>
          )}
        </div>
      ) : (
        <a href={downloadUrl(fileUrl, fileName)} download={fileName || undefined} className="btn btn-outline" style={textStyleToCss(labelStyle)}>
          <DownloadIcon />
          {label || 'Download'}
        </a>
      )}
    </div>
  );
}
