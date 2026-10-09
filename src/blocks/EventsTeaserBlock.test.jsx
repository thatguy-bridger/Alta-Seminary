// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { renderInBrowser } from '../test/render.js';
import { EventsTeaserBlock } from './EventsTeaserBlock.jsx';

const base = { id: 'e1', slug: 'sophomore-soda-social', title: 'Sophomore Soda Social', description: 'Fun', location: 'Assembly Room',
  start_at: '2026-10-09T18:30:00Z', end_at: null, all_day: false, phase: 'upcoming' };
const withAlbum = { ...base, links: { album: { id: 'album-7', title: 'Soda Photos' } } };

let mounted;
afterEach(async () => { await mounted?.unmount(); document.body.innerHTML = ''; });
const links = () => [...mounted.container.querySelectorAll('a')].map((a) => [a.textContent.trim(), a.getAttribute('href')]);
const buttons = () => [...mounted.container.querySelectorAll('button')].map((b) => b.textContent.trim());

describe('EventsTeaserBlock cards link to each event\'s own page', () => {
  it('links "Read more" to the event page, and "Photos" to its photos section when the album has photos', async () => {
    mounted = await renderInBrowser(<EventsTeaserBlock items={[withAlbum]} />);
    expect(links()).toContainEqual(['Read more →', '/events/sophomore-soda-social']);
    expect(links()).toContainEqual(['Photos →', '/events/sophomore-soda-social#photos']);
  });

  it('has no Photos link when there is no published album with photos', async () => {
    mounted = await renderInBrowser(<EventsTeaserBlock items={[{ ...base, links: {} }]} />);
    expect(links().map(([t]) => t)).not.toContain('Photos →');
    expect(links()).toContainEqual(['Read more →', '/events/sophomore-soda-social']);
  });

  it('offers "Add to calendar" for an upcoming event but not one that is over', async () => {
    mounted = await renderInBrowser(<EventsTeaserBlock items={[base, { ...base, id: 'e2', slug: 'old', phase: 'past' }]} />);
    expect(buttons().filter((b) => b === '+ Add to calendar')).toHaveLength(1);
  });

  it('points upcoming lists at the archive of past events', async () => {
    mounted = await renderInBrowser(<EventsTeaserBlock items={[base]} timeframe="upcoming" />);
    expect(links()).toContainEqual(['Past events →', '/events/archive']);
  });

  it('does not link to the archive from the archive itself, and has no bulk export there', async () => {
    mounted = await renderInBrowser(<EventsTeaserBlock items={[{ ...base, phase: 'past' }, { ...base, id: 'e2', slug: 'b', phase: 'past' }]} timeframe="past" />);
    expect(links().map(([t]) => t)).not.toContain('Past events →');
    expect(buttons().some((b) => b.startsWith('Export'))).toBe(false);
  });

  it('says so when there is nothing to list, instead of rendering nothing', async () => {
    mounted = await renderInBrowser(<EventsTeaserBlock items={[]} timeframe="upcoming" />);
    expect(mounted.container.textContent).toContain('No upcoming events right now.');
    await mounted.unmount();
    mounted = await renderInBrowser(<EventsTeaserBlock items={[]} timeframe="past" />);
    expect(mounted.container.textContent).toContain('No past events yet.');
  });

  it('shows no links in the page editor, where nothing is clickable', async () => {
    mounted = await renderInBrowser(<EventsTeaserBlock items={[withAlbum]} editable onFieldChange={() => {}} />);
    expect(links()).toEqual([]);
  });
});

describe('EventsTeaserBlock date text (hydration safety)', () => {
  const originalTz = process.env.TZ;
  afterEach(() => { process.env.TZ = originalTz; });

  it('renders byte-identical HTML in every time zone', () => {
    const html = ['UTC', 'America/Denver', 'Pacific/Auckland'].map((tz) => {
      process.env.TZ = tz;
      return renderToString(<EventsTeaserBlock items={[withAlbum]} />);
    });
    expect(new Set(html).size).toBe(1);
    expect(html[0]).toContain('Oct 9');
    expect(html[0]).toContain('12:30 PM');
  });
});
