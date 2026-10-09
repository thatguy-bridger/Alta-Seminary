// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { renderInBrowser } from '../test/render.js';
import { EventsTeaserBlock } from './EventsTeaserBlock.jsx';

const base = { id: 'e1', title: 'Sophomore Soda Social', description: 'Fun', location: 'Assembly Room',
  start_at: '2026-10-09T18:30:00Z', end_at: null, all_day: false };
const withLinks = {
  ...base,
  links: { announcement: { slug: 'sophomore-soda-social', title: 'Sophomore Soda Social' }, album: { id: 'album-7', title: 'Soda Photos' } },
};

let mounted;
afterEach(async () => { await mounted?.unmount(); document.body.innerHTML = ''; });
const hrefs = () => [...mounted.container.querySelectorAll('a')].map((a) => [a.textContent.trim(), a.getAttribute('href')]);

describe('EventsTeaserBlock links to linked content', () => {
  it('shows "Read more" and "Photos" when the event has a published announcement and album', async () => {
    mounted = await renderInBrowser(<EventsTeaserBlock items={[withLinks]} />);
    expect(hrefs()).toEqual([
      ['Read more →', '/announcements/sophomore-soda-social'],
      ['Photos →', '/gallery?album=album-7'],
    ]);
    expect(mounted.container.textContent).toContain('+ Add to calendar');
  });

  it('shows only what exists', async () => {
    const onlyPost = { ...base, links: { announcement: withLinks.links.announcement } };
    mounted = await renderInBrowser(<EventsTeaserBlock items={[onlyPost]} />);
    expect(hrefs().map(([text]) => text)).toEqual(['Read more →']);
  });

  it('shows neither for an event with no links (or no links field at all)', async () => {
    mounted = await renderInBrowser(<EventsTeaserBlock items={[{ ...base, links: {} }, { ...base, id: 'e2' }]} />);
    expect(hrefs()).toEqual([]);
  });

  it('shows no links in the page editor, where nothing is clickable', async () => {
    mounted = await renderInBrowser(<EventsTeaserBlock items={[withLinks]} editable onFieldChange={() => {}} />);
    expect(hrefs()).toEqual([]);
  });
});

describe('EventsTeaserBlock date text (hydration safety)', () => {
  const originalTz = process.env.TZ;
  afterEach(() => { process.env.TZ = originalTz; });

  // The server renders in UTC; a visitor's browser in their own zone. Any
  // difference in the text is a React hydration mismatch (#418), which throws
  // away the server HTML. Same input must give byte-identical output anywhere.
  it('renders byte-identical HTML in every time zone', () => {
    const html = ['UTC', 'America/Denver', 'Pacific/Auckland'].map((tz) => {
      process.env.TZ = tz;
      return renderToString(<EventsTeaserBlock items={[withLinks]} />);
    });
    expect(new Set(html).size).toBe(1);
    expect(html[0]).toContain('Oct 9');
    expect(html[0]).toContain('12:30 PM');
  });
});
