import React from 'react';
import { Dialog } from '../design-system/components/core/Dialog.jsx';
import { Button } from '../design-system/components/forms/Button.jsx';

// Every source photo is a different size and aspect ratio, so rather than a
// fixed pixel crop rect, the zoom range is derived from each image's own
// natural dimensions and centered on 1.0 = the photo fills the frame
// edge-to-edge with no gaps (a "cover" fit, shown as 0% on the slider).
// Zooming in (toward MAX_ZOOM, +100%) shows roughly a quarter of the photo's
// area at most. Zooming out (toward MIN_ZOOM, -50%) shrinks the photo below
// that fit, leaving the frame's own background visible in the gaps -- for
// deliberately floating a smaller image inside a larger frame.
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const FRAME_SIZE = 360; // on-screen crop frame size (long edge), in css px
const MAX_OUTPUT = 1200; // cap on the exported crop's long edge, to match uploadImageFile's downscale ceiling

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

// A modal cropper: pans (drag) and zooms (slider) a photo within a fixed
// frame, then rasterizes the visible region to a webp Blob on confirm.
// `src` can be an object URL (freshly-picked file) or a hosted https URL
// (re-cropping an already-uploaded photo) -- the latter needs the host to
// serve permissive CORS headers for the canvas readback not to be tainted,
// which Supabase's public "images" bucket does.
//
// `aspect` is optional -- pass it when the caller renders at one fixed, known
// ratio (a carousel slide is always 16:9, a gallery tile is always square).
// Leave it unset and the frame matches the photo's OWN aspect ratio instead,
// so cropping can be the default step on every upload without ever forcing a
// crop the caller didn't ask for: at zoom 1 the whole photo is visible
// (nothing trimmed), and zooming in is still there for whoever wants it.
export function CropEditor({ src, aspect, title = 'Crop photo', onCancel, onConfirm }) {
  const [ready, setReady] = React.useState(false);
  const [natural, setNatural] = React.useState({ w: 0, h: 0 });
  const [zoom, setZoom] = React.useState(1);
  const [pos, setPos] = React.useState({ left: 0, top: 0 });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const imgRef = React.useRef(null);
  const dragRef = React.useRef(null);

  // Fall back to a square frame only until the photo's real dimensions are
  // known (the <img> itself stays hidden until then, so this is never seen).
  const effectiveAspect = aspect || (natural.w && natural.h ? natural.w / natural.h : 1);
  const frameW = effectiveAspect >= 1 ? FRAME_SIZE : FRAME_SIZE * effectiveAspect;
  const frameH = effectiveAspect >= 1 ? FRAME_SIZE / effectiveAspect : FRAME_SIZE;
  const scale0 = natural.w ? Math.max(frameW / natural.w, frameH / natural.h) : 1;
  const scale = scale0 * zoom;
  const dispW = natural.w * scale;
  const dispH = natural.h * scale;

  // When zoomed below the "cover" fit, the photo can be smaller than the
  // frame on one or both axes -- clamp to keep it fully inside the frame
  // (with the frame's background filling the gap) rather than the normal
  // "always overflow the frame" range used once the photo is bigger.
  function clampAxis(pos, itemSize, frameSize) {
    return itemSize >= frameSize ? clamp(pos, frameSize - itemSize, 0) : clamp(pos, 0, frameSize - itemSize);
  }
  function clampPos(left, top, s) {
    const w = natural.w * s, h = natural.h * s;
    return { left: clampAxis(left, w, frameW), top: clampAxis(top, h, frameH) };
  }

  function handleImgLoad(e) {
    const w = e.target.naturalWidth, h = e.target.naturalHeight;
    const effAspect = aspect || w / h;
    const fW = effAspect >= 1 ? FRAME_SIZE : FRAME_SIZE * effAspect;
    const fH = effAspect >= 1 ? FRAME_SIZE / effAspect : FRAME_SIZE;
    const fitScale = Math.max(fW / w, fH / h);
    setNatural({ w, h });
    setZoom(1);
    setPos({ left: (fW - w * fitScale) / 2, top: (fH - h * fitScale) / 2 });
    setReady(true);
  }

  function handleImgError() {
    setError("Couldn't load that photo for cropping.");
  }

  function handleZoomChange(nextZoom) {
    const nextScale = scale0 * nextZoom;
    // Anchor the zoom on the frame's center point rather than the corner.
    const cx = (frameW / 2 - pos.left) / scale;
    const cy = (frameH / 2 - pos.top) / scale;
    setZoom(nextZoom);
    setPos(clampPos(frameW / 2 - cx * nextScale, frameH / 2 - cy * nextScale, nextScale));
  }

  function handlePointerDown(e) {
    if (!ready) return;
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, left: pos.left, top: pos.top };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function handlePointerMove(e) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPos(clampPos(dragRef.current.left + dx, dragRef.current.top + dy, scale));
  }
  function handlePointerUp() {
    dragRef.current = null;
  }

  async function handleConfirm() {
    setSaving(true);
    setError('');
    try {
      const sourceX = -pos.left / scale;
      const sourceY = -pos.top / scale;
      const sourceW = frameW / scale;
      const sourceH = frameH / scale;
      const outW = Math.round(Math.min(sourceW, MAX_OUTPUT));
      const outH = Math.round(outW * (sourceH / sourceW));
      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      // Zoomed-out crops can extend past the photo's own edges (that's the
      // frame's background showing through) -- only draw the part of the
      // source rect that actually overlaps the photo, at its correct
      // position/size in the output, and leave the rest transparent.
      const ix = Math.max(sourceX, 0);
      const iy = Math.max(sourceY, 0);
      const iw = Math.min(sourceX + sourceW, natural.w) - ix;
      const ih = Math.min(sourceY + sourceH, natural.h) - iy;
      if (iw > 0 && ih > 0) {
        const destScaleX = outW / sourceW, destScaleY = outH / sourceH;
        ctx.drawImage(
          imgRef.current, ix, iy, iw, ih,
          (ix - sourceX) * destScaleX, (iy - sourceY) * destScaleY, iw * destScaleX, ih * destScaleY
        );
      }
      const blob = await new Promise((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not process image'))), 'image/webp', 0.9)
      );
      await onConfirm(blob);
    } catch (err) {
      setError(err.message || 'Could not crop this image.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open title={title} onClose={onCancel}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', alignItems: 'center' }}>
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          style={{
            width: frameW, height: frameH, position: 'relative', overflow: 'hidden',
            borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)',
            background: 'var(--surface-sunken)', cursor: ready ? 'grab' : 'default', touchAction: 'none',
          }}
        >
          <img
            ref={imgRef}
            src={src}
            alt=""
            crossOrigin="anonymous"
            onLoad={handleImgLoad}
            onError={handleImgError}
            draggable={false}
            style={{
              position: 'absolute', left: pos.left, top: pos.top,
              width: dispW || undefined, height: dispH || undefined,
              maxWidth: 'none', userSelect: 'none', visibility: ready ? 'visible' : 'hidden',
            }}
          />
          {!ready && !error && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)' }}>
              Loading…
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', width: frameW }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)' }}>−</span>
          <input
            type="range" min={MIN_ZOOM} max={MAX_ZOOM} step={0.01} value={zoom}
            onChange={(e) => handleZoomChange(Number(e.target.value))}
            disabled={!ready}
            style={{ flex: 1 }}
          />
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)' }}>+</span>
        </div>

        <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)', textAlign: 'center' }}>
          Drag the photo to reposition it, use the slider to zoom in or out.
        </p>

        {error && <p style={{ margin: 0, fontSize: 'var(--fs-caption)', color: 'var(--color-error)' }}>{error}</p>}

        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', width: '100%' }}>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" disabled={!ready || saving} onClick={handleConfirm}>{saving ? 'Saving…' : 'Use this crop'}</Button>
        </div>
      </div>
    </Dialog>
  );
}
