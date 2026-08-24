import React from 'react';
import { EditableFile } from '../admin-app/builder/EditableFile.jsx';
import { uploadAudioFile } from '../admin-app/fileUpload.js';
import { BlockIcon } from '../admin-app/builder/blockIcons.jsx';

const POSITION_STYLE = {
  'bottom-right': { bottom: 'var(--space-4)', right: 'var(--space-4)' },
  'bottom-left': { bottom: 'var(--space-4)', left: 'var(--space-4)' },
  'top-right': { top: 'var(--space-4)', right: 'var(--space-4)' },
  'top-left': { top: 'var(--space-4)', left: 'var(--space-4)' },
};

const PlayGlyph = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><path d="M8 5v14l11-7z" /></svg>
);
const PauseGlyph = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
);

// A "chromeless" block (registry.js) -- it's placed in the block list like
// any other so it publishes/unpublishes/reorders/deletes the same way, but
// renders no content at that position on the live page. Instead it mounts a
// small floating play/pause control (or nothing at all, if showControls is
// off) fixed to a corner of the viewport, independent of where in the block
// list it actually sits.
export function BackgroundMusicBlock({
  sourceType = 'upload', fileUrl = '', fileName = '', externalUrl = '',
  volume = 40, loop = true, autoplay = false, showControls = true, position = 'bottom-right',
  editable, onFieldChange, pathPrefix,
}) {
  const src = sourceType === 'url' ? externalUrl : fileUrl;

  if (editable) {
    return (
      <div style={{ display: 'flex', gap: 'var(--space-3)', padding: 'var(--space-3)', border: '1px dashed var(--border-default)', borderRadius: 'var(--radius-md)', background: 'var(--surface-sunken)' }}>
        <span style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', background: 'var(--tint-info-bg)', color: 'var(--brand-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <BlockIcon name="music" />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 'var(--fw-bold)', fontSize: 'var(--fs-small)', color: 'var(--text-primary)' }}>
            Background Music
          </div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)' }}>
            {src
              ? "Plays as a floating control on the published page — doesn't take up space here in the block list."
              : 'No audio set yet — this floating control won\'t appear on the published page until you add one.'}
          </div>
          {sourceType !== 'url' && (
            <div style={{ marginTop: 'var(--space-2)' }} onPointerDown={(e) => e.stopPropagation()}>
              <EditableFile
                value={fileUrl}
                fileName={fileName}
                onChange={(url, name) => { onFieldChange('fileUrl', url); onFieldChange('fileName', name); }}
                pathPrefix={pathPrefix}
                accept="audio/*"
                uploadFn={uploadAudioFile}
                label="audio file"
              />
            </div>
          )}
          {sourceType === 'url' && !externalUrl && (
            <div style={{ marginTop: 'var(--space-2)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--color-error)' }}>
              Add the audio file's URL in Settings.
            </div>
          )}
          {src && (
            // eslint-disable-next-line jsx-a11y/media-has-caption -- background music, not spoken/captioned content
            <audio controls src={src} onPointerDown={(e) => e.stopPropagation()} style={{ marginTop: 'var(--space-2)', width: '100%', height: 32 }} />
          )}
        </div>
      </div>
    );
  }

  if (!src) return null;
  return <LiveBackgroundMusic src={src} volume={volume} loop={loop} autoplay={autoplay} showControls={showControls} position={position} />;
}

// Browsers block audio-with-sound from starting before the visitor has
// interacted with the page at all -- true regardless of any `autoplay`
// attribute. When `autoplay` is on, this still starts playback immediately
// but muted (always allowed), then unmutes on the visitor's first
// click/tap/keypress anywhere on the page, so it's already playing the
// instant sound is actually permitted instead of waiting for them to find
// and press the play button themselves.
function LiveBackgroundMusic({ src, volume, loop, autoplay, showControls, position }) {
  const audioRef = React.useRef(null);
  const [playing, setPlaying] = React.useState(false);

  React.useEffect(() => {
    if (audioRef.current) audioRef.current.volume = Math.min(100, Math.max(0, volume)) / 100;
  }, [volume]);

  React.useEffect(() => {
    const audio = audioRef.current;
    if (!autoplay || !audio) return;
    audio.muted = true;
    audio.play().then(() => setPlaying(true)).catch(() => {});
    function unlock() {
      audio.muted = false;
      audio.play().then(() => setPlaying(true)).catch(() => {});
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    }
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);
    return () => {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- set up once per mount; volume/loop have their own effects
  }, [autoplay]);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.muted = false;
      audio.play().then(() => setPlaying(true)).catch(() => {});
    }
  }

  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- background music, not spoken/captioned content */}
      <audio ref={audioRef} src={src} loop={loop} preload="none" />
      {showControls && (
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? 'Pause background music' : 'Play background music'}
          style={{
            position: 'fixed', zIndex: 500, ...(POSITION_STYLE[position] || POSITION_STYLE['bottom-right']),
            width: 40, height: 40, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: 'var(--brand-secondary)', color: 'var(--text-on-secondary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-md)',
          }}
        >
          {playing ? <PauseGlyph /> : <PlayGlyph />}
        </button>
      )}
    </>
  );
}
