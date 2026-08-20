import React from 'react';
import { EditableText } from '../admin-app/builder/EditableText.jsx';
import { EditableImage } from '../admin-app/builder/EditableImage.jsx';
import { textStyleToCss } from '../admin-app/builder/textStyle.js';

const RATIO = { '16:9': '16/9', '4:3': '4/3', '1:1': '1/1', auto: undefined };

export function ImageBlock({
  imageUrl, alt = '', caption, width = 'full', aspectRatio = 'auto',
  corners = 'rounded', border = false, shadow = true, lightbox = false, link = '',
  captionStyle, editable, onFieldChange, pathPrefix, onAddImageBlocks,
}) {
  const [open, setOpen] = React.useState(false);
  if (!editable && !imageUrl) return null;
  const imgStyle = {
    width: '100%', display: 'block',
    borderRadius: corners === 'rounded' ? 'var(--radius-lg)' : 0,
    boxShadow: shadow ? 'var(--shadow-sm)' : 'none',
    border: border ? '1px solid var(--border-default)' : 'none',
    aspectRatio: RATIO[aspectRatio], objectFit: 'cover',
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
      style={{ aspectRatio: RATIO[aspectRatio], boxShadow: shadow ? 'var(--shadow-sm)' : 'none', borderRadius: corners === 'rounded' ? 'var(--radius-lg)' : 0, border: border ? '1px solid var(--border-default)' : 'none' }}
    />
  ) : (
    <img src={imageUrl} alt={alt} loading="lazy" style={imgStyle} onClick={lightbox ? () => setOpen(true) : undefined} />
  );

  return (
    <figure style={{ margin: 0, maxWidth: width === 'contained' ? 640 : undefined, marginLeft: width === 'contained' ? 'auto' : undefined, marginRight: width === 'contained' ? 'auto' : undefined }}>
      {!editable && link ? <a href={link}>{img}</a> : img}
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
          ) : <span style={textStyleToCss(captionStyle)}>{caption}</span>}
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
}
