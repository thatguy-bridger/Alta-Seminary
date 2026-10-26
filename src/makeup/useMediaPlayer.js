import React from 'react';
import { youtubeId } from './media.js';
import { createPlayedTracker } from './playedTracker.js';

let ytReady = null;
function loadYouTubeApi() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (!ytReady) {
    ytReady = new Promise((resolve, reject) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev && prev(); resolve(window.YT); };
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.onerror = () => { ytReady = null; reject(new Error('YouTube could not be loaded.')); };
      document.head.appendChild(tag);
    });
  }
  return ytReady;
}

// Is the YouTube player's own sound off (muted, or the volume turned to nothing)? The page cannot see the computer's
// speakers or headphones, only the player.
const soundOffYouTube = (p) => { try { return !!(p.isMuted && p.isMuted()) || (p.getVolume ? p.getVolume() : 100) === 0; } catch { return false; } };

// One interface over a YouTube video and a plain audio/video file:
// the current time (for the live transcript), play / pause / seek (for clicking a
// transcript line), and how many seconds were really played (for the teacher).
// `resume` ({ seen, quiet, time }) puts back a student's place after they closed the page: which seconds were already
// played, and where to wait. It is used once, the first time the player is set up.
export function useMediaPlayer({ url, type, durationHint = 0, resume }) {
  const resumeRef = React.useRef(resume);
  const [state, setState] = React.useState({ ready: false, playing: false, time: resume?.time || 0, duration: durationHint, error: '' });
  const [played, setPlayed] = React.useState(0);
  const [mutedPlayed, setMutedPlayed] = React.useState(0);   // how many of those seconds the player's sound was off
  const mediaRef = React.useRef(null);   // <audio>/<video>
  const hostRef = React.useRef(null);    // YouTube mounts here
  const ytRef = React.useRef(null);
  const tracker = React.useRef(createPlayedTracker());

  React.useEffect(() => {
    tracker.current.reset();
    const back = resumeRef.current; resumeRef.current = null;
    if (back) tracker.current.restore(back);
    setPlayed(tracker.current.count()); setMutedPlayed(tracker.current.mutedCount());
    const startAt = back && Number.isFinite(back.time) && back.time > 1 ? back.time : 0;   // wait where they stopped; never start by itself
    let timer = 0, cancelled = false;
    const push = (time, playing, duration, muted = false) => {
      const n = tracker.current.tick(time, playing, muted);
      setPlayed(n); setMutedPlayed(tracker.current.mutedCount());
      setState((s) => (Math.abs(s.time - time) < 0.2 && s.playing === playing && s.duration === (duration || s.duration) && s.ready) ? s : { ...s, ready: true, time, playing, duration: duration || s.duration });
    };
    if (type === 'youtube') {
      loadYouTubeApi().then((YT) => {
        if (cancelled || !hostRef.current) return;
        const mount = document.createElement('div');
        hostRef.current.innerHTML = '';
        hostRef.current.appendChild(mount);
        ytRef.current = new YT.Player(mount, {
          videoId: youtubeId(url), width: '100%', height: '100%',
          host: 'https://www.youtube-nocookie.com',   // privacy-enhanced mode: no tracking cookies until the student plays
          playerVars: { rel: 0, modestbranding: 1, playsinline: 1, cc_load_policy: 1, ...(startAt ? { start: Math.floor(startAt) } : {}) },
          events: {
            onReady: (e) => { timer = setInterval(() => { const p = e.target; push(p.getCurrentTime() || 0, p.getPlayerState() === 1, p.getDuration() || 0, soundOffYouTube(p)); }, 250); push(startAt, false, e.target.getDuration() || 0); },
            onError: () => setState((s) => ({ ...s, error: 'This video could not be played.' })),
          },
        });
      }).catch((err) => setState((s) => ({ ...s, error: err.message })));
    } else {
      const el = mediaRef.current;
      if (el) {
        let waiting = !!startAt;   // until the file can be moved to where they stopped, that place is still the place (never 0)
        const read = () => push(waiting ? startAt : el.currentTime || 0, !el.paused && !el.ended, Number.isFinite(el.duration) ? el.duration : 0, !!el.muted || el.volume === 0);
        if (startAt) el.addEventListener('loadedmetadata', () => { if (el.currentTime < startAt) el.currentTime = startAt; waiting = false; }, { once: true });
        el.addEventListener('loadedmetadata', read);
        el.addEventListener('error', () => setState((s) => ({ ...s, error: 'This file could not be played.' })));
        timer = setInterval(read, 250);
        read();
      }
    }
    return () => { cancelled = true; clearInterval(timer); try { ytRef.current && ytRef.current.destroy(); } catch { /* already gone */ } ytRef.current = null; };
  }, [url, type]);

  const api = React.useMemo(() => ({
    play: () => (type === 'youtube' ? ytRef.current?.playVideo() : mediaRef.current?.play()?.catch(() => {})), // a blocked or interrupted play() is not an error to show
    pause: () => (type === 'youtube' ? ytRef.current?.pauseVideo() : mediaRef.current?.pause()),
    seek: (t) => { if (type === 'youtube') ytRef.current?.seekTo(t, true); else if (mediaRef.current) mediaRef.current.currentTime = t; },
  }), [type]);

  return { ...state, played, mutedPlayed, mediaRef, hostRef, ...api, exportPlayed: () => tracker.current.export() };
}
