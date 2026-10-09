import React from 'react';
import { EditableText } from '../admin-app/builder/EditableText.jsx';
import { EditableImage } from '../admin-app/builder/EditableImage.jsx';
import { textStyleToCss } from '../admin-app/builder/textStyle.js';
import { RichText } from './richText.jsx';

const RATIO_PRESET_KEYS = ['1:1', '4:3', '16:9', '9:16'];

// aspectRatio is either 'auto', one of RATIO_PRESET_KEYS, or a custom
// "W:H" string the admin typed into the crop dialog's picker (see
// CropEditor.jsx) -- CSS's aspect-ratio property already accepts "W/H"
// directly, so a custom value needs nothing beyond the same ':' -> '/' swap
// the presets get.
function cssAspectRatio(value) {
  if (!value || value === 'auto') return undefined;
  return value.replace(':', '/');
}

// The crop dialog's ratio picker (CropEditor.jsx) is keyed by 'auto' | one
// of RATIO_PRESET_KEYS | 'custom' -- a custom "5:2" stored value needs
// splitting back into that key + the {w,h} numbers the dialog's own inputs
// show, so re-cropping opens exactly where the admin left it instead of
// resetting to auto every time.
function aspectRatioToPickerProps(value) {
  if (!value || value === 'auto' || RATIO_PRESET_KEYS.includes(value)) {
    return { initialAspectKey: value || 'auto' };
  }
  const [w, h] = value.split(':').map(Number);
  return { initialAspectKey: 'custom', initialCustom: { w: w || 1, h: h || 1 } };
}

export function ImageBlock({
  imageUrl, alt = '', caption, width = 'full', aspectRatio = 'auto',
  corners = 'rounded', border = false, shadow = true, lightbox = false, link = '',
  captionStyle, editable, onFieldChange, pathPrefix, onAddImageBlocks,
}) {
  const [open, setOpen] = React.useState(false);
  if (!editable && !imageUrl) return null;
  const cssRatio = cssAspectRatio(aspectRatio);
  const imgStyle = {
    width: '100%', display: 'block',
    borderRadius: corners === 'rounded' ? 'var(--radius-lg)' : 0,
    boxShadow: shadow ? 'var(--shadow-sm)' : 'none',
    border: border ? '1px solid var(--border-default)' : 'none',
    aspectRatio: cssRatio, objectFit: 'cover',
    cursor: !editable && lightbox ? 'zoom-in' : undefined,
  };

  const img = editable ? (
    <EditableImage
      value={imageUrl}
      alt={alt}
      onChange={(url) => onFieldChange('imageUrl', url)}
      pathPrefix={pathPrefix}
      multiple={!!onAddImageBlocks}
      onExtraImages={onAddImageBlocks}
      aspectRatioKey={aspectRatioToPickerProps(aspectRatio).initialAspectKey}
      aspectRatioCustom={aspectRatioToPickerProps(aspectRatio).initialCustom}
      onAspectRatioChange={(key, ratioValue) => onFieldChange('aspectRatio', key === 'auto' ? 'auto' : ratioValue)}
      style={{ aspectRatio: cssRatio, boxShadow: shadow ? 'var(--shadow-sm)' : 'none', borderRadius: corners === 'rounded' ? 'var(--radius-lg)' : 0, border: border ? '1px solid var(--border-default)' : 'none' }}
    />
  ) : (
    <img src={imageUrl} alt={alt} loading="lazy" style={imgStyle} onClick={lightbox ? () => setOpen(true) : undefined} />
  );

  const figure = (
    // Explicit left/right margins, never `margin: 0` plus `marginLeft:
    // undefined`. <figure> has a 40px left/right margin from the browser's own
    // stylesheet, and when React CLIENT-renders an element it applies `margin:
    // 0` and then literally clears `marginLeft`/`marginRight` for the
    // `undefined` entries -- which also erases the left/right half of that
    // shorthand and lets the 40px default come back. Server-rendered HTML
    // doesn't do that, so the image looked right until React re-rendered the
    // block in the browser (the editor Preview and canvas always do; the live
    // site does after any hydration mismatch), at which point a "full width"
    // image shrank by 40px on each side.
    <figure style={{ margin: 0, marginLeft: width === 'contained' ? 'auto' : 0, marginRight: width === 'contained' ? 'auto' : 0, maxWidth: width === 'contained' ? 640 : undefined }}>
      {!editable && link ? <a href={link}>{img}</a> : img}
      {editable && imageUrl && !alt.trim() && (
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--color-warning)', margin: 'var(--space-2) 0 0' }}>
          No alt text yet — screen readers can't describe this image to visitors who can't see it. Add it in the panel on the right.
        </p>
      )}
      {(editable || caption) && (
        <figcaption style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)', marginTop: 'var(--space-2)', textAlign: 'center' }}>
          {editable ? (
            <EditableText
              value={caption}
              onCommit={(v) => onFieldChange('caption', v)}
              placeholder="Caption (optional)"
              styleValue={captionStyle}
              onStyleChange={(s) => onFieldChange('captionStyle', s)}
            />
          ) : <RichText inline text={caption} style={textStyleToCss(captionStyle)} />}
        </figcaption>
      )}
      {!editable && lightbox && open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(20,20,22,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, cursor: 'zoom-out', padding: 'var(--space-6)' }}
        >
          <img src={imageUrl} alt={alt} style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 'var(--radius-md)' }} />
        </div>
      )}
    </figure>
  );

  // "Flow past the page edges" (full-bleed breakout) is now a universal
  // per-block Layout option applied by BlockWrapper.jsx to whatever the
  // block renders, rather than something each block type implements for
  // itself -- see registry.js's LAYOUT_FIELDS/DEFAULT_LAYOUT.
  return figure;
}
