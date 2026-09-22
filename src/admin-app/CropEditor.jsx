import React from 'react';
import { Dialog } from '../design-system/components/core/Dialog.jsx';
import { Button } from '../design-system/components/forms/Button.jsx';
import { ImageSourceMenu } from './ImageSourceMenu.jsx';

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

// The 4 "classic" ratios + a free-form custom one, offered as a picker
// inside the crop dialog itself (see aspectKey below) -- separate from the
// `aspect` prop, which is how a caller with one fixed known shape (a
// carousel slide is always 16:9) locks the frame WITHOUT showing this
// picker at all.
export const ASPECT_RATIO_OPTIONS = [
  { key: 'auto', label: 'Auto (photo’s own shape)' },
  { key: '1:1', label: '1:1' },
  { key: '4:3', label: '4:3' },
  { key: '16:9', label: '16:9' },
  { key: '9:16', label: '9:16' },
  { key: 'custom', label: 'Custom' },
];
const RATIO_PRESETS = { '1:1': 1, '4:3': 4 / 3, '16:9': 16 / 9, '9:16': 9 / 16 };

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
// ratio the visitor never chooses (a carousel slide is always 16:9, a
// gallery tile is always square). It LOCKS the frame and hides the ratio
// picker below entirely.
//
// Leave `aspect` unset for callers that let an admin pick the ratio
// themselves (see ASPECT_RATIO_OPTIONS/ImageBlock's own `aspectRatio` field)
// -- this then shows that picker, seeded from `initialAspectKey`
// ('auto' | '1:1' | '4:3' | '16:9' | '9:16' | 'custom'), and reports back
// through `onAspectChange(key, ratioValue)` whenever the admin changes it so
// the caller can persist the choice (ratioValue is null for 'auto', since
// that one deliberately has no fixed number -- it just matches whatever
// photo is loaded). 'auto' matches the photo's own shape (nothing trimmed
// at zoom 1); 'custom' shows two plain width/height number inputs.
// onSwapFile/onSwapUrl/onSwapExisting (all optional): when passed, shows a
// "Change image" control that lets the photo being cropped be swapped for a
// different one without closing this dialog first -- callers that don't
// need that (re-cropping is the only entry point for them) simply omit all
// three and the control doesn't render.
export function CropEditor({
  src, aspect, initialAspectKey = 'auto', initialCustomRatio = { w: 1, h: 1 }, onAspectChange,
  title = 'Crop photo', onCancel, onConfirm, onSwapFile, onSwapUrl, onSwapExisting,
}) {
  const [ready, setReady] = React.useState(false);
  const [natural, setNatural] = React.useState({ w: 0, h: 0 });
  const [zoom, setZoom] = React.useState(1);
  const [pos, setPos] = React.useState({ left: 0, top: 0 });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const [aspectKey, setAspectKey] = React.useState(initialAspectKey);
  const [customRatio, setCustomRatio] = React.useState(initialCustomRatio);
  const imgRef = React.useRef(null);
  const dragRef = React.useRef(null);
  const pickerShown = aspect == null;

  // Fall back to a square frame only until the photo's real dimensions are
  // known (the <img> itself stays hidden until then, so this is never seen).
  const naturalRatio = natural.w && natural.h ? natural.w / natural.h : 1;
  const customValue = customRatio.w > 0 && customRatio.h > 0 ? customRatio.w / customRatio.h : naturalRatio;
  const effectiveAspect = aspect
    ?? (aspectKey === 'auto' ? naturalRatio : aspectKey === 'custom' ? customValue : RATIO_PRESETS[aspectKey]);
  const frameW = effectiveAspect >= 1 ? FRAME_SIZE : FRAME_SIZE * effectiveAspect;
  const frameH = effectiveAspect >= 1 ? FRAME_SIZE / effectiveAspect : FRAME_SIZE;
  const scale0 = natural.w ? Math.max(frameW / natural.w, frameH / natural.h) : 1;
  const scale = scale0 * zoom;
  const dispW = natural.w * scale;
  const dispH = natural.h * scale;

  // Re-fits the photo (zoom back to 1, centered) whenever the frame's own
  // shape changes after it's already loaded -- picking a different ratio
  // (or typing new custom numbers) mid-dialog, same as the initial fit
  // handleImgLoad below does for the frame shape the dialog OPENED with.
  React.useEffect(() => {
    if (!ready || !natural.w) return;
    const fitScale = Math.max(frameW / natural.w, frameH / natural.h);
    setZoom(1);
    setPos({ left: (frameW - natural.w * fitScale) / 2, top: (frameH - natural.h * fitScale) / 2 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-fit when the FRAME shape changes, not on every zoom/pos update
  }, [frameW, frameH]);

  function selectAspectKey(key) {
    setAspectKey(key);
    onAspectChange?.(key, key === 'auto' ? null : key === 'custom' ? `${customRatio.w}:${customRatio.h}` : key);
  }
  function updateCustomRatio(next) {
    setCustomRatio(next);
    if (aspectKey === 'custom') onAspectChange?.('custom', `${next.w}:${next.h}`);
  }

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
    // Can't reuse `effectiveAspect`/`naturalRatio` here -- they're still
    // computed off the PREVIOUS natural.{w,h} (0 before this load), one
    // render behind the values this same handler is about to set. Redoing
    // the 'auto' case inline with this load event's own w/h keeps the
    // very first fit correct; the [frameW, frameH] effect above takes over
    // for every fit after this one (ratio changed, or a re-crop reopens
    // with different natural dimensions).
    const effAspect = aspect ?? (aspectKey === 'auto' ? w / h : aspectKey === 'custom' ? customValue : RATIO_PRESETS[aspectKey]);
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

  // Swapping the source photo mid-dialog (see "Change image" below) changes
  // `src` on the very same <img> already in the DOM -- handleImgLoad above
  // recalculates natural/zoom/pos for it once the new photo decodes and
  // fires its own load event, so no other reset is needed there. Marking
  // not-ready here just for the moment in between hides the outgoing photo
  // instead of leaving it visible (at the wrong size/position) until the
  // new one finishes loading.
  function handleSwap(fn) {
    return (arg) => {
      setReady(false);
      setError('');
      fn(arg);
    };
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

        {pickerShown && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
              {ASPECT_RATIO_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => selectAspectKey(opt.key)}
                  style={{
                    fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', padding: '4px 10px',
                    borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-default)', cursor: 'pointer',
                    background: aspectKey === opt.key ? 'var(--text-primary)' : 'var(--surface-card)',
                    color: aspectKey === opt.key ? 'var(--surface-page)' : 'var(--text-primary)',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {aspectKey === 'custom' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)' }}>
                <input
                  type="number" min={1} value={customRatio.w}
                  onChange={(e) => updateCustomRatio({ ...customRatio, w: Number(e.target.value) || 1 })}
                  style={{ width: 48, textAlign: 'center', fontSize: 12, padding: '3px 2px', borderRadius: 4, border: '1px solid var(--border-default)', background: 'var(--surface-page)', color: 'var(--text-primary)' }}
                />
                <span>:</span>
                <input
                  type="number" min={1} value={customRatio.h}
                  onChange={(e) => updateCustomRatio({ ...customRatio, h: Number(e.target.value) || 1 })}
                  style={{ width: 48, textAlign: 'center', fontSize: 12, padding: '3px 2px', borderRadius: 4, border: '1px solid var(--border-default)', background: 'var(--surface-page)', color: 'var(--text-primary)' }}
                />
              </div>
            )}
          </div>
        )}

        {error && <p style={{ margin: 0, fontSize: 'var(--fs-caption)', color: 'var(--color-error)' }}>{error}</p>}

        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'space-between', width: '100%' }}>
          {(onSwapFile || onSwapUrl || onSwapExisting) ? (
            <ImageSourceMenu
              label="Change image"
              disabled={saving}
              onFile={onSwapFile && handleSwap(onSwapFile)}
              onUrl={onSwapUrl && handleSwap(onSwapUrl)}
              onExisting={onSwapExisting && handleSwap(onSwapExisting)}
            />
          ) : <span />}
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <Button variant="ghost" onClick={onCancel}>Cancel</Button>
            <Button variant="primary" disabled={!ready || saving} onClick={handleConfirm}>{saving ? 'Saving…' : 'Use this crop'}</Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
