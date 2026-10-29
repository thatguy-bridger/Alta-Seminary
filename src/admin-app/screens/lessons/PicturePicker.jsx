import React from 'react';
import { Button } from '../../../design-system/components/forms/Button.jsx';
import { ImageUploadField } from '../../ImageUploadField.jsx';
import { MediaLibraryPicker } from '../../MediaLibraryPicker.jsx';
import { PAINTINGS, thumbnailFor, paintingCredit, paintingFor, THUMBNAIL_SOURCE_LABEL } from '../../../makeup/thumbnails.js';

// A picture chosen from the gallery. One of the paintings that came with the site is kept as its own site path, which is how a lesson
// has always named it (so it is shown as a painting, with its credit); anything else is used by its address.
export function pictureValueFor(url, image) {
  const own = image && image.origin === 'site' && String(image.source_url || '');
  return own && own.startsWith('/makeup/thumbs/') ? own : url;
}

// The lesson's picture: what it is now and where it came from, and four ways to change it (choose one from the gallery, upload, paste an
// address, or pick one of the paintings). "Automatic" means a YouTube video's own picture, or a painting chosen for the lesson.
export function PicturePicker({ lesson, onChange, error }) {
  const [galleryOpen, setGalleryOpen] = React.useState(false);
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
        <div>
          <Button variant="primary" size="sm" onClick={() => setGalleryOpen(true)}>Choose from the gallery</Button>
          <MediaLibraryPicker open={galleryOpen} title="Choose a picture from the gallery" onClose={() => setGalleryOpen(false)} onSelect={(url, image) => { setGalleryOpen(false); onChange(pictureValueFor(url, image)); }} />
        </div>
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
