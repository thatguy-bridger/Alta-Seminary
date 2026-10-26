// Stand-in content so the journey can be tried before any real classes or
// sources have been added. Used by the admin test page only, never shown to students.
export const SAMPLE_CLASSES = [
  { id: 'sample-1', name: 'Early morning', requires_code: false },
  { id: 'sample-2', name: 'Period 2', requires_code: false },
  { id: 'sample-3', name: 'Online', requires_code: false },
];

const T = (rows) => rows.map(([start, end, text]) => ({ start, end, text }));
const AUDIO_TRANSCRIPT = T([
  [0, 5, 'This is a sample recording, so the words here are placeholders.'],
  [5, 11, 'Notice how the line being spoken lights up as time moves along.'],
  [11, 17, 'You can click any line to jump to that moment.'],
  [17, 24, 'A truth is something you could say as, if we do this, then that follows.'],
  [24, 31, 'Pick one moment that stood out and use the cite button on its line.'],
  [31, 38, 'The moment you cite becomes where you found your truth.'],
  [38, 45, 'Real talks will have their own captions, added by an admin.'],
  [45, 52, 'Keep listening a little longer.'],
  [52, 60, 'Thank you for trying it.'],
]);

export const SAMPLE_SOURCES = [
  { id: 'sample-read', kind: 'scripture', title: 'Doing what the Lord asks', reference: '1 Nephi 3:7', minutes: 4, show_images: true, description: 'A scripture and a short thought.',
    body: 'I will go and do the things which the Lord hath commanded, for I know that the Lord giveth no commandments unto the children of men, save he shall prepare a way that they may accomplish the thing which he commandeth them.' },
  { id: 'sample-audio', kind: 'audio', title: 'A sample recording', minutes: 5, description: 'Silent practice audio with a transcript.', embed_url: 'sample:audio', duration_seconds: 60, transcript: AUDIO_TRANSCRIPT },
  { id: 'sample-video', kind: 'video', title: 'A sample clip', minutes: 5, description: 'Silent practice audio with a transcript.', embed_url: 'sample:audio', duration_seconds: 60, transcript: AUDIO_TRANSCRIPT },
];

// A silent WAV of the given length, so the sample "recording" plays with no files to host.
export function silentWavUrl(seconds = 60) {
  const rate = 8000, n = rate * seconds, buf = new ArrayBuffer(44 + n), v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true);
  new Uint8Array(buf, 44).fill(128);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}
