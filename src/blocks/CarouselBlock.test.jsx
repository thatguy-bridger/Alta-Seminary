// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { renderInBrowser } from '../test/render.js';
import { CarouselBlock, carouselFitsContent, tickerLayout } from './CarouselBlock.jsx';

const button = (id, label) => ({ id, type: 'button', props: { label, href: '/x' } });
const image = (id) => ({ id, type: 'media', props: { image: `https://x/${id}.webp`, heading: '', caption: '' } });
const buttons = [button('b1', 'Bell Schedules'), button('b2', 'Calendar')];

let mounted;
afterEach(async () => { await mounted?.unmount(); document.body.innerHTML = ''; });
const frame = () => mounted.container.querySelector('[role="region"]').firstElementChild;
const slideCards = () => [...mounted.container.querySelectorAll('[role="region"] a.btn, [role="region"] .btn')];

describe('carouselFitsContent', () => {
  it('fits when asked to', () => {
    expect(carouselFitsContent('auto', [image('a')])).toBe(true);
  });
  it('fits automatically when no slide has an image (a lone button in a 16:9 slab was the bug)', () => {
    expect(carouselFitsContent('16:9', buttons)).toBe(true);
    expect(carouselFitsContent('16:9', [{ id: 'm', type: 'media', props: { image: '', heading: 'Text only' } }])).toBe(true);
  });
  it('keeps the chosen shape when there are images', () => {
    expect(carouselFitsContent('16:9', [image('a'), button('b', 'x')])).toBe(false);
  });
});

describe('CarouselBlock height', () => {
  it('sizes to its content (no fixed aspect ratio) when every slide is a button', async () => {
    mounted = await renderInBrowser(<CarouselBlock items={buttons} aspectRatio="16:9" />);
    expect(frame().style.aspectRatio).toBe('');
  });

  it('keeps the aspect ratio for an image slider', async () => {
    mounted = await renderInBrowser(<CarouselBlock items={[image('a'), image('b')]} aspectRatio="16:9" />);
    expect(frame().style.aspectRatio.replace(/ /g, '')).toBe('16/9');
  });

  it('"Fit the tallest slide" overrides the ratio even with images', async () => {
    mounted = await renderInBrowser(<CarouselBlock items={[image('a'), image('b')]} aspectRatio="auto" />);
    expect(frame().style.aspectRatio).toBe('');
  });

  it('stacks fading slides in one grid cell in fit mode, so the height is the tallest slide', async () => {
    mounted = await renderInBrowser(<CarouselBlock items={buttons} transition="fade" />);
    expect(frame().style.display).toBe('grid');
    expect([...frame().children].filter((c) => c.style.gridArea).length).toBe(2);
  });
});

describe('CarouselBlock background toggle', () => {
  const slideSurface = () => mounted.container.querySelector('[role="region"] .btn').closest('div[style*="padding"]');

  it('shows the card behind each slide, and its shadow, by default', async () => {
    mounted = await renderInBrowser(<CarouselBlock items={buttons} />);
    expect(slideSurface().style.background).toBe('var(--surface-card)');
    expect(frame().style.boxShadow).toBe('var(--shadow-sm)');
  });

  it('removes both when switched off', async () => {
    mounted = await renderInBrowser(<CarouselBlock items={buttons} showBackground={false} />);
    expect(slideSurface().style.background).toBe('transparent');
    expect(frame().style.boxShadow).toBe('none');
  });
});

describe('tickerLayout (smooth slider math)', () => {
  it('lays the set out twice, so sliding left by half the track repeats seamlessly', () => {
    const l = tickerLayout(3, '3', 'normal');
    expect(l.setSize).toBe(3);
    expect(l.trackSize).toBe(6);
    expect(l.trackWidthPct).toBeCloseTo(200);      // 6 slides at 3-visible = twice the row
    expect(l.itemBasisPct).toBeCloseTo(100 / 6);
    expect(l.seconds).toBe(15);                     // 3 slides x 5s
  });

  it('keeps the same pace per slide however many there are', () => {
    expect(tickerLayout(3, '3', 'fast').seconds / 3).toBe(tickerLayout(9, '3', 'fast').seconds / 9);
  });

  it('repeats a short list until it fills the row, so the end of a pass never shows a gap', () => {
    const l = tickerLayout(2, '5', 'normal');
    expect(l.setSize).toBeGreaterThanOrEqual(5);
    expect(l.setSize % 2).toBe(0);
  });

  it('copes with nonsense input', () => {
    expect(tickerLayout(3, 'x', 'bogus').perView).toBe(3);
    expect(tickerLayout(3, '0', 'normal').perView).toBe(3);
  });
});

describe('CarouselBlock smooth slider', () => {
  const track = () => mounted.container.querySelector('.alta-ticker__track');

  it('scrolls continuously with a CSS animation instead of stepping', async () => {
    mounted = await renderInBrowser(<CarouselBlock items={buttons} smoothScroll smoothVisible="2" smoothSpeed="slow" />);
    expect(track().style.animation).toContain('alta-ticker');
    expect(track().style.animation).toContain('linear infinite');
  });

  it('has no arrows or dots (nothing to click between)', async () => {
    mounted = await renderInBrowser(<CarouselBlock items={buttons} smoothScroll showArrows showDots />);
    expect(mounted.container.querySelector('[aria-label="Next slide"]')).toBeNull();
    expect(mounted.container.querySelector('[aria-label^="Go to slide"]')).toBeNull();
  });

  it('hides the duplicate copy of each slide from assistive tech and the keyboard', async () => {
    mounted = await renderInBrowser(<CarouselBlock items={buttons} smoothScroll smoothVisible="2" />);
    const items = [...track().children];
    expect(items).toHaveLength(tickerLayout(2, '2', 'normal').trackSize);
    const hidden = items.filter((i) => i.getAttribute('aria-hidden') === 'true');
    expect(hidden).toHaveLength(items.length / 2);
    expect(hidden.every((i) => i.hasAttribute('inert'))).toBe(true);
  });

  it('can be paused (it is always moving, so the pause control is always there)', async () => {
    mounted = await renderInBrowser(<CarouselBlock items={buttons} smoothScroll autoplay={false} />);
    expect(mounted.container.querySelector('[aria-label="Pause carousel"]')).not.toBeNull();
  });

  it('is not used unless switched on', async () => {
    mounted = await renderInBrowser(<CarouselBlock items={buttons} />);
    expect(track()).toBeNull();
  });
});

describe('CarouselBlock editor: items inside a Columns slide', () => {
  it('each column gets its own settings button that reports (slide, column)', async () => {
    const calls = [];
    const slide = { id: 's', type: 'columns', props: { columnCount: '2', columns: [button('c1', 'One'), button('c2', 'Two')] } };
    mounted = await renderInBrowser(<CarouselBlock items={[slide]} editable onFieldChange={() => {}} onOpenSettings={(...a) => calls.push(a)} />);
    const gears = [...mounted.container.querySelectorAll('button')].filter((b) => b.textContent.includes('Settings'));
    expect(gears.length).toBe(3); // two columns + the slide itself
    gears[1].click();
    expect(calls).toEqual([['items', 0, 'columns', 1]]);
  });
});
