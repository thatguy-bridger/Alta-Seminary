import { describe, it, expect } from 'vitest';
import { youtubeId, mediaKind } from './media.js';

describe('youtubeId', () => {
  it('finds the id in every common form', () => {
    expect(youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=4s')).toBe('dQw4w9WgXcQ');
    expect(youtubeId('https://youtu.be/dQw4w9WgXcQ?si=x')).toBe('dQw4w9WgXcQ');
    expect(youtubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(youtubeId('https://m.youtube.com/watch?v=abc123DEF45')).toBe('abc123DEF45');
    expect(youtubeId('https://www.youtube-nocookie.com/embed/abc123DEF45')).toBe('abc123DEF45');
  });
  it('is null for anything else', () => {
    expect(youtubeId('https://example.com/watch?v=abc')).toBeNull();
    expect(youtubeId('not a url')).toBeNull();
    expect(youtubeId('https://www.youtube.com/')).toBeNull();
  });
});

describe('mediaKind', () => {
  it('routes to the right player, or says unsupported', () => {
    expect(mediaKind('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube');
    expect(mediaKind('https://x.supabase.co/storage/v1/object/public/audio/talk.mp3?x=1')).toBe('audio');
    expect(mediaKind('https://x.org/clip.MP4')).toBe('video');
    expect(mediaKind('https://vimeo.com/123')).toBeNull();
    expect(mediaKind('')).toBeNull();
  });
});
