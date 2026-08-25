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

// A Google Drive "share" link (drive.google.com/file/d/<id>/view?usp=sharing,
// or the older open?id=<id> form) points at an HTML preview page, not the
// actual audio bytes -- <audio src> just gets that HTML back and fails with
// a format error. Rewriting it to Drive's own direct-content endpoint
// (uc?export=download&id=<id>) is what actually serves the raw file instead,
// and works for anything shared "Anyone with the link" without needing to be
// public on the web. Content-Disposition: attachment on that response would
// force a download for a clicked link/top-level navigation, but doesn't stop
// a browser from loading it as a resource for an <audio> element the way it
// would here. Anything that isn't a Drive link passes through untouched.
function resolveAudioUrl(url) {
  const trimmed = (url || '').trim();
  const match = trimmed.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)([a-zA-Z0-9_-]+)/);
  return match ? `https://drive.google.com/uc?export=download&id=${match[1]}` : trimmed;
}

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
  const src = resolveAudioUrl(sourceType === 'url' ? externalUrl : fileUrl);

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

// This is a real multi-page site, not a single-page app -- every navigation
// tears down and rebuilds the whole document, which would otherwise reset
// an admin's carefully-set-up background music to 0:00 (or silence
// entirely) every time a visitor clicks to another page. sessionStorage is
// what actually survives that: this component saves {src, time, playing}
// as it plays and on the way out (see the 'pagehide' listener below), and
// the NEXT page's copy of this same component reads it back on mount to
// resume from that position instead of starting over. It can't make the
// audio play gaplessly straight through the page transition itself --
// nothing running client-side today can do that without turning the whole
// site into an SPA -- so there's still a brief silent gap while the new
// page loads, but playback picks back up automatically afterward rather
// than requiring the visitor to find and press Play again on every page.
const RESUME_KEY = 'alta-bg-music-state';

function readResumeState(src) {
  try {
    const raw = sessionStorage.getItem(RESUME_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw);
    return state && state.src === src ? state : null;
  } catch {
    return null;
  }
}

function writeResumeState(src, time, playing) {
  try {
    sessionStorage.setItem(RESUME_KEY, JSON.stringify({ src, time, playing }));
  } catch {
    // Storage disabled/full -- resuming across pages just silently won't
    // happen this visit, same as if nothing had been saved at all.
  }
}

// Browsers block audio-with-sound from starting before the visitor has
// interacted with the page at all -- true regardless of any `autoplay`
// attribute or a resumed-from-a-previous-page state. Either case starts
// playback immediately but muted (always allowed), then unmutes on the
// visitor's first click/tap/keypress anywhere on the NEW page, so it's
// already playing the instant sound is actually permitted instead of
// waiting for them to find and press the play button themselves.
function LiveBackgroundMusic({ src, volume, loop, autoplay, showControls, position }) {
  const audioRef = React.useRef(null);
  const [playing, setPlaying] = React.useState(false);

  React.useEffect(() => {
    if (audioRef.current) audioRef.current.volume = Math.min(100, Math.max(0, volume)) / 100;
  }, [volume]);

  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const resumeState = readResumeState(src);
    // A visitor's own earlier "press Play" on a previous page always wins
    // over the admin's `autoplay` setting -- resuming what they themselves
    // started is different from forcing sound on a first-time visitor who
    // never asked for it.
    const shouldStart = resumeState?.playing || autoplay;
    if (resumeState && resumeState.time > 0) audio.currentTime = resumeState.time;

    let cleanupUnlock = () => {};
    if (shouldStart) {
      audio.muted = true;
      audio.play().then(() => setPlaying(true)).catch(() => {});
      const unlock = () => {
        audio.muted = false;
        audio.play().then(() => setPlaying(true)).catch(() => {});
        document.removeEventListener('pointerdown', unlock);
        document.removeEventListener('keydown', unlock);
      };
      document.addEventListener('pointerdown', unlock);
      document.addEventListener('keydown', unlock);
      cleanupUnlock = () => {
        document.removeEventListener('pointerdown', unlock);
        document.removeEventListener('keydown', unlock);
      };
    }

    const saveState = () => writeResumeState(src, audio.currentTime, !audio.paused);
    const throttledSave = () => { if (Math.floor(audio.currentTime) % 2 === 0) saveState(); };
    audio.addEventListener('timeupdate', throttledSave);
    audio.addEventListener('play', saveState);
    audio.addEventListener('pause', saveState);
    // 'pagehide' (not 'beforeunload', which also blocks the back/forward
    // cache) is the reliable "the visitor is navigating away right now"
    // signal -- this is what lets the NEXT page's mount above find an
    // accurate, up-to-the-second position to resume from.
    window.addEventListener('pagehide', saveState);

    return () => {
      cleanupUnlock();
      audio.removeEventListener('timeupdate', throttledSave);
      audio.removeEventListener('play', saveState);
      audio.removeEventListener('pause', saveState);
      window.removeEventListener('pagehide', saveState);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- set up once per mount (a fresh mount IS a fresh page here); volume/loop have their own effects
  }, [src]);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      writeResumeState(src, audio.currentTime, false);
    } else {
      audio.muted = false;
      audio.play().then(() => setPlaying(true)).catch(() => {});
      writeResumeState(src, audio.currentTime, true);
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
