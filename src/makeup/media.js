// What kind of address is this? Decides which player a video/audio source gets.
// YouTube is controlled through its player API; direct files through the
// browser's own <video>/<audio>. Both report the playing time, which is what
// the live transcript, "cite this moment" and the watched-time check need.
const AUDIO_EXT = /\.(mp3|m4a|aac|wav|ogg|oga|opus)(\?|#|$)/i;
const VIDEO_EXT = /\.(mp4|m4v|webm|mov)(\?|#|$)/i;

export function youtubeId(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '').replace(/^m\./, '');
    if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      if (u.pathname === '/watch') return u.searchParams.get('v');
      const m = /^\/(embed|shorts|live)\/([\w-]{6,})/.exec(u.pathname);
      if (m) return m[2];
    }
  } catch { /* not a URL */ }
  return null;
}

// -> 'youtube' | 'audio' | 'video' | null (unsupported)
export function mediaKind(url, kind) {
  if (!url) return null;
  if (youtubeId(url)) return 'youtube';
  if (AUDIO_EXT.test(url)) return 'audio';
  if (VIDEO_EXT.test(url)) return 'video';
  return null;
}

export const mediaLabel = { youtube: 'YouTube video', audio: 'Audio file', video: 'Video file' };
