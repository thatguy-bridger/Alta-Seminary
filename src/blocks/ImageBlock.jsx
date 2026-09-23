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
  imageUrl, alt = '', caption, width = 'full', outboundWidth = false, aspectRatio = 'auto',
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
    <figure style={{ margin: 0, maxWidth: !outboundWidth && width === 'contained' ? 640 : undefined, marginLeft: !outboundWidth && width === 'contained' ? 'auto' : undefined, marginRight: !outboundWidth && width === 'contained' ? 'auto' : undefined }}>
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

  if (!outboundWidth) return figure;

  // Breaks past every ancestor's max-width (the page's own contained
  // column, a "Contained" width setting, a parent column) out to the edge
  // of the nearest `container-type: inline-size` ancestor -- `cqw` units
  // are relative to THAT container, not this block's own immediate parent,
  // so it works no matter how deep this is nested, same idea as `vw` being
  // viewport-relative but scoped one level in. That container is
  // `.site-main` on the public site, the Preview tab's own device frame
  // (preview-frame.astro), or the admin edit canvas's own column
  // (EditableCanvas.jsx) -- each already exists for the @container
  // (max-width:640px) rules elsewhere in this codebase, and picking
  // whichever one is actually closest is exactly why this breaks out to
  // "the page" in every context (including the admin canvas, where a true
  // 100vw would instead overlap the Style panel sidebar) instead of only
  // the real public site. The outer div's own width is a normal,
  // container-relative `100%` (never cqw), so it clips anything the inner
  // cqw-based div pushes past that true edge -- including the 1-2px some
  // browsers' cqw/vw units can run over by. That outer clip is what
  // actually delivers "crops instead of scrolls": without it, this is the
  // one CSS trick most prone to adding a horizontal scrollbar.
  return (
    <div style={{ width: '100%', overflow: 'hidden' }}>
      <div style={{ width: '100cqw', maxWidth: '100cqw', marginLeft: 'calc(50% - 50cqw)' }}>
        {figure}
      </div>
    </div>
  );
}
