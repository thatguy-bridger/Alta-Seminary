// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { renderInBrowser } from '../../test/render.js';
import { SLIDES, FEATURES } from './guideContent.js';
import { GuideProvider } from './GuideProvider.jsx';
import { InfoButton } from './InfoButton.jsx';

let mounted;
afterEach(async () => { await mounted?.unmount(); document.body.innerHTML = ''; try { localStorage.clear(); } catch {} });

describe('guide content', () => {
  it('has unique slides that each teach something', () => {
    expect(new Set(SLIDES.map((s) => s.id)).size).toBe(SLIDES.length);
    for (const s of SLIDES) { expect(s.title && s.what && s.steps.length).toBeTruthy(); }
  });
  it('every (i) button points at a real slide', () => {
    const ids = new Set(SLIDES.map((s) => s.id));
    for (const [k, f] of Object.entries(FEATURES)) { expect(ids.has(f.slide), k).toBe(true); expect(f.blurb).toBeTruthy(); }
  });
});

describe('InfoButton', () => {
  it('explains the feature, and "Demonstrate for me" opens that slide of the guide', async () => {
    mounted = await renderInBrowser(<GuideProvider><InfoButton feature="publish" /></GuideProvider>);
    mounted.container.querySelector('button[aria-label="About: Publish"]').click();
    await new Promise((r) => setTimeout(r, 0));
    expect(mounted.container.textContent).toContain('Makes your draft live');
    const demo = [...mounted.container.querySelectorAll('button')].find((b) => b.textContent === 'Demonstrate for me');
    demo.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(document.body.textContent).toContain('Publishing');
    expect(document.body.textContent).toContain(`Slide ${SLIDES.findIndex((s) => s.id === 'publish') + 1} of ${SLIDES.length}`);
  });
});
