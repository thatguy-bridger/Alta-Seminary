// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderInBrowser } from '../test/render.js';
import { useMediaPlayer } from './useMediaPlayer.js';

// A stand-in for YouTube's player: same calls, but the test decides what time it is and whether it is playing.
let players;
function installFakeYouTube() {
  players = [];
  class Player {
    constructor(el, opts) {
      Object.assign(this, { el, opts, t: 0, state: -1, duration: 600, destroyed: false });
      players.push(this);
      queueMicrotask(() => opts.events.onReady({ target: this }));
    }
    getCurrentTime() { return this.t; }
    getPlayerState() { return this.state; }       // 1 = playing, 2 = paused
    getDuration() { return this.duration; }
    playVideo() { this.state = 1; }
    pauseVideo() { this.state = 2; }
    seekTo(t) { this.t = t; }
    destroy() { this.destroyed = true; }
  }
  window.YT = { Player };
}

let probe, mounted;
function Probe({ url }) {
  probe = useMediaPlayer({ url, type: 'youtube' });
  return <div ref={probe.hostRef} />;
}
// The hook reads the player every 250 ms. Only the interval is faked, so each step below is exactly one read.
const read = (player, t) => { if (t !== undefined) player.t = t; return React.act(async () => { vi.advanceTimersByTime(250); }); };

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  installFakeYouTube();
  mounted = await renderInBrowser(<Probe url="https://www.youtube.com/watch?v=OJ2pLI0tZvY" />);
  await React.act(async () => { await new Promise((r) => setTimeout(r, 20)); });   // the player is created and reports ready
});
afterEach(async () => { await mounted?.unmount(); vi.useRealTimers(); document.body.innerHTML = ''; delete window.YT; });

describe('the YouTube player', () => {
  it('opens the right video, in privacy-enhanced mode, with captions on', () => {
    expect(players).toHaveLength(1);
    const { videoId, host, playerVars } = players[0].opts;
    expect(videoId).toBe('OJ2pLI0tZvY');
    expect(host).toBe('https://www.youtube-nocookie.com');
    expect(playerVars).toMatchObject({ cc_load_policy: 1, rel: 0, playsinline: 1 });
  });

  it('becomes ready and reports the length', () => {
    expect(probe.ready).toBe(true);
    expect(probe.duration).toBe(600);
  });

  it('reports the time and whether it is playing (what the live transcript follows)', async () => {
    const p = players[0];
    p.state = 1; await read(p, 15);
    expect(probe.time).toBe(15);
    expect(probe.playing).toBe(true);
    p.state = 2; await read(p);
    expect(probe.playing).toBe(false);
  });

  it('counts played seconds while playing, but not a seek or a pause', async () => {
    const p = players[0];
    p.state = 1;
    await read(p, 10); await read(p, 10.5); await read(p, 11);
    expect(probe.played).toBe(2);                 // seconds 10 and 11
    probe.seek(300);                              // jumping ahead earns nothing by itself
    await read(p);
    expect(probe.played).toBe(2);
    p.state = 2; await read(p, 305);              // time moves while paused: not counted
    expect(probe.played).toBe(2);
    p.state = 1; await read(p, 305.5);            // the first read after a pause only finds its place
    expect(probe.played).toBe(2);
    await read(p, 306);                           // steady playing after that counts
    expect(probe.played).toBe(3);
  });

  it('sends play, pause and seek through to the player', () => {
    const p = players[0];
    probe.play(); expect(p.state).toBe(1);
    probe.pause(); expect(p.state).toBe(2);
    probe.seek(42); expect(p.t).toBe(42);
  });

  it('shows a plain message if the video cannot be played', async () => {
    await React.act(async () => { players[0].opts.events.onError(); });
    expect(probe.error).toBe('This video could not be played.');
  });

  it('lets go of the player when the lesson is left', async () => {
    await mounted.unmount();
    expect(players[0].destroyed).toBe(true);
    mounted = null;
  });
});
