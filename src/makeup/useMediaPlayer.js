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

// One interface over a YouTube video and a plain audio/video file:
// the current time (for the live transcript), play / pause / seek (for clicking a
// transcript line), and how many seconds were really played (for the teacher).
export function useMediaPlayer({ url, type, durationHint = 0 }) {
  const [state, setState] = React.useState({ ready: false, playing: false, time: 0, duration: durationHint, error: '' });
  const [played, setPlayed] = React.useState(0);
  const mediaRef = React.useRef(null);   // <audio>/<video>
  const hostRef = React.useRef(null);    // YouTube mounts here
  const ytRef = React.useRef(null);
  const tracker = React.useRef(createPlayedTracker());

  React.useEffect(() => {
    tracker.current.reset(); setPlayed(0);
    let timer = 0, cancelled = false;
    const push = (time, playing, duration) => {
      const n = tracker.current.tick(time, playing);
      setPlayed(n);
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
          playerVars: { rel: 0, modestbranding: 1, playsinline: 1, cc_load_policy: 1 },
          events: {
            onReady: (e) => { timer = setInterval(() => { const p = e.target; push(p.getCurrentTime() || 0, p.getPlayerState() === 1, p.getDuration() || 0); }, 250); push(0, false, e.target.getDuration() || 0); },
            onError: () => setState((s) => ({ ...s, error: 'This video could not be played.' })),
          },
        });
      }).catch((err) => setState((s) => ({ ...s, error: err.message })));
    } else {
      const el = mediaRef.current;
      if (el) {
        const read = () => push(el.currentTime || 0, !el.paused && !el.ended, Number.isFinite(el.duration) ? el.duration : 0);
        el.addEventListener('loadedmetadata', read);
        el.addEventListener('error', () => setState((s) => ({ ...s, error: 'This file could not be played.' })));
        timer = setInterval(read, 250);
        read();
      }
    }
    return () => { cancelled = true; clearInterval(timer); try { ytRef.current && ytRef.current.destroy(); } catch { /* already gone */ } ytRef.current = null; };
  }, [url, type]);

  const api = React.useMemo(() => ({
    play: () => (type === 'youtube' ? ytRef.current?.playVideo() : mediaRef.current?.play()),
    pause: () => (type === 'youtube' ? ytRef.current?.pauseVideo() : mediaRef.current?.pause()),
    seek: (t) => { if (type === 'youtube') ytRef.current?.seekTo(t, true); else if (mediaRef.current) mediaRef.current.currentTime = t; },
  }), [type]);

  return { ...state, played, mediaRef, hostRef, ...api };
}
