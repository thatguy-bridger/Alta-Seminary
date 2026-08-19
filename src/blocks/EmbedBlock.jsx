import React from 'react';
import { isAllowedEmbedUrl, normalizeEmbedUrl } from './registry.js';
import { EditableText } from '../admin-app/builder/EditableText.jsx';
import { textStyleToCss } from '../admin-app/builder/textStyle.js';

const RATIO = { '16:9': '56.25%', '4:3': '75%', '1:1': '100%' };

const PROVIDER_LABEL = {
  youtube: 'YouTube video',
  vimeo: 'Vimeo video',
  'google-maps': 'map',
  spotify: 'Spotify player',
  custom: 'embed',
};

export function EmbedBlock({ embedType = 'youtube', url, caption, aspectRatio = '16:9', clickToLoad = true, captionStyle, editable, onFieldChange }) {
  const [loaded, setLoaded] = React.useState(!clickToLoad);
  const embedUrl = normalizeEmbedUrl(embedType, url);
  const valid = embedUrl && isAllowedEmbedUrl(embedUrl);
  if (!editable && !valid) return null;

  return (
    <figure style={{ margin: 0 }}>
      <div style={{ position: 'relative', paddingBottom: RATIO[aspectRatio] || RATIO['16:9'], borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)', background: 'var(--surface-sunken)' }}>
        {valid && (loaded || editable) ? (
          <iframe
            src={embedUrl}
            title={caption || PROVIDER_LABEL[embedType]}
            loading="lazy"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
            allowFullScreen
          />
        ) : valid && !loaded ? (
          <button
            onClick={() => setLoaded(true)}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none', background: 'var(--surface-inverse)', color: 'var(--text-on-inverse)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)' }}
          >
            <span style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--brand-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M8 5v14l11-7z" /></svg>
            </span>
            Click to load {PROVIDER_LABEL[embedType]}
          </button>
        ) : editable ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)', textAlign: 'center', padding: 'var(--space-4)' }}>
            Add a YouTube, Vimeo, Google Maps, or Spotify URL in the settings panel →
          </div>
        ) : null}
      </div>
      {(editable || caption) && (
        <figcaption style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)', marginTop: 'var(--space-2)', textAlign: 'center', ...textStyleToCss(captionStyle) }}>
          {editable ? (
            <EditableText value={caption} onCommit={(v) => onFieldChange('caption', v)} placeholder="Caption (optional)" styleValue={captionStyle} onStyleChange={(s) => onFieldChange('captionStyle', s)} />
          ) : caption}
        </figcaption>
      )}
    </figure>
  );
}
