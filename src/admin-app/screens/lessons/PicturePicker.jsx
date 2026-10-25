import React from 'react';
import { Button } from '../../../design-system/components/forms/Button.jsx';
import { ImageUploadField } from '../../ImageUploadField.jsx';
import { PAINTINGS, thumbnailFor, paintingCredit, paintingFor, THUMBNAIL_SOURCE_LABEL } from '../../../makeup/thumbnails.js';

// The lesson's picture: what it is now and where it came from, and three ways to change it (upload, paste an address,
// or pick one of the paintings). "Automatic" means a YouTube video's own picture, or a painting chosen for the lesson.
export function PicturePicker({ lesson, onChange, error }) {
  const t = thumbnailFor(lesson);
  const fallback = paintingFor(lesson.id || lesson.title);
  const credit = t.painting ? paintingCredit(t.painting) : '';
  return (
    <div className="ls-pic">
      <div>
        <div className="frame">
          <img src={t.src} alt="" title={credit || undefined}
            onError={(e) => { if (!e.currentTarget.dataset.fell) { e.currentTarget.dataset.fell = '1'; e.currentTarget.src = fallback.src; } }} />
        </div>
        <p className="ls-help" style={{ marginTop: 6 }}>{THUMBNAIL_SOURCE_LABEL[t.source]}{credit ? `: ${credit}` : ''}</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <ImageUploadField label="Upload your own picture" value={lesson.thumbnail_url} onChange={onChange} pathPrefix="makeup" aspect={16 / 9} />
        <label className="ls-lbl">Or paste a picture address
          <input className="input" value={lesson.thumbnail_url} onChange={(e) => onChange(e.target.value)} placeholder="https://…" aria-invalid={error ? true : undefined} />
        </label>
        {error && <p className="ls-err" role="alert">{error}</p>}
        <div>
          <span className="ls-lbl" style={{ marginBottom: 6 }}>Or choose a painting</span>
          <div className="ls-paintings">
            {PAINTINGS.map((p) => (
              <button key={p.id} type="button" className="ls-pick" aria-pressed={lesson.thumbnail_url === p.src} aria-label={paintingCredit(p)} title={paintingCredit(p)} onClick={() => onChange(p.src)}>
                <img src={p.src} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        </div>
        {lesson.thumbnail_url && <div><Button variant="outline" size="sm" onClick={() => onChange('')}>Use the automatic picture</Button></div>}
      </div>
    </div>
  );
}
