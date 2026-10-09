// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { renderInBrowser } from '../test/render.js';
import { EventDetailsBlock } from './EventDetailsBlock.jsx';
import { EventPhotosBlock } from './EventPhotosBlock.jsx';
import { PostsTeaserBlock } from './PostsTeaserBlock.jsx';

const event = { id: 'e1', slug: 'fireside', title: 'Fall Fireside', description: 'Hot cocoa\nand music', location: 'Chapel',
  start_at: '2026-10-30T18:30:00Z', end_at: '2026-10-30T19:30:00Z', all_day: false, phase: 'upcoming' };

let mounted;
afterEach(async () => { await mounted?.unmount(); document.body.innerHTML = ''; });
const text = () => mounted.container.textContent;

describe('EventDetailsBlock', () => {
  it('shows the event live: title, full date line, place, description', async () => {
    mounted = await renderInBrowser(<EventDetailsBlock items={event} />);
    expect(mounted.container.querySelector('h1').textContent).toBe('Fall Fireside');
    expect(text()).toContain('Friday, October 30, 2026 · 12:30 – 1:30 PM');
    expect(text()).toContain('Chapel');
    expect(text()).toContain('Hot cocoa');
    expect(text()).toContain('Upcoming');
  });

  it('offers Add to calendar while the event is not over, and always a way back to all events', async () => {
    mounted = await renderInBrowser(<EventDetailsBlock items={event} />);
    expect([...mounted.container.querySelectorAll('button')].map((b) => b.textContent)).toContain('+ Add to calendar');
    expect(mounted.container.querySelector('a').getAttribute('href')).toBe('/events');
  });

  it('becomes the archive version once the event is over: a notice, a Past badge, no Add to calendar', async () => {
    mounted = await renderInBrowser(<EventDetailsBlock items={{ ...event, phase: 'past' }} />);
    expect(text()).toContain('This event has passed');
    expect(text()).toContain('Past event');
    expect([...mounted.container.querySelectorAll('button')].map((b) => b.textContent)).not.toContain('+ Add to calendar');
    expect(mounted.container.querySelector('h1').textContent).toBe('Fall Fireside'); // still all there
  });

  it('can hide the description and the calendar button', async () => {
    mounted = await renderInBrowser(<EventDetailsBlock items={event} showDescription={false} showCalendarButton={false} />);
    expect(text()).not.toContain('Hot cocoa');
    expect([...mounted.container.querySelectorAll('button')]).toHaveLength(0);
  });

  it('renders nothing on the public site if the event is missing, but a hint in the editor', async () => {
    mounted = await renderInBrowser(<EventDetailsBlock items={null} />);
    expect(mounted.container.innerHTML).toBe('');
    await mounted.unmount();
    mounted = await renderInBrowser(<EventDetailsBlock items={null} editable />);
    expect(text()).toContain('Event details appear here');
  });

  it('renders identical server HTML in every time zone (the phase comes pre-computed)', () => {
    const originalTz = process.env.TZ;
    const html = ['UTC', 'America/Denver', 'Asia/Tokyo'].map((tz) => { process.env.TZ = tz; return renderToString(<EventDetailsBlock items={event} />); });
    process.env.TZ = originalTz;
    expect(new Set(html).size).toBe(1);
  });
});

describe('EventPhotosBlock', () => {
  const photos = [{ id: 'p1', image_url: 'https://x/1.webp', caption: 'One' }, { id: 'p2', image_url: 'https://x/2.webp', caption: 'Two' }];

  it('shows the album photos under a heading, with a #photos anchor for the "Photos →" link', async () => {
    mounted = await renderInBrowser(<EventPhotosBlock items={photos} heading="Photos from the night" />);
    expect(mounted.container.querySelector('#photos')).not.toBeNull();
    expect(text()).toContain('Photos from the night');
    expect(mounted.container.querySelectorAll('img')).toHaveLength(2);
  });

  it('renders NOTHING when there are no photos -- no empty "Photos" heading on the public page', async () => {
    mounted = await renderInBrowser(<EventPhotosBlock items={[]} />);
    expect(mounted.container.innerHTML).toBe('');
  });

  it('tells the editor what it is waiting for', async () => {
    mounted = await renderInBrowser(<EventPhotosBlock items={[]} editable />);
    expect(text()).toContain('once this event');
  });
});

describe('PostsTeaserBlock (the announcements feed) with events in it', () => {
  const feed = [
    { id: 'p1', kind: 'announcement', slug: 'welcome', title: 'Welcome Back', excerpt: 'Hi', published_at: '2026-10-01T18:00:00Z' },
    { id: 'e1', kind: 'event', slug: 'fireside', title: 'Fall Fireside', excerpt: 'Cocoa', published_at: '2026-10-02T00:00:00Z',
      event: { start_at: '2026-10-30T18:30:00Z', all_day: false } },
  ];

  it('links an event to its own page and an announcement to its announcement page', async () => {
    mounted = await renderInBrowser(<PostsTeaserBlock items={feed} />);
    const hrefs = [...mounted.container.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/announcements/welcome', '/events/fireside']);
  });

  it('marks events as events and shows WHEN they happen, not when they were posted', async () => {
    mounted = await renderInBrowser(<PostsTeaserBlock items={feed} />);
    const eventCard = mounted.container.querySelectorAll('a')[1];
    expect(eventCard.textContent).toContain('Event');
    expect(eventCard.textContent).toContain('Oct 30, 2026 · 12:30 PM');
    expect(mounted.container.querySelectorAll('a')[0].textContent).toContain('Oct 1, 2026'); // posts keep their post date
  });
});
