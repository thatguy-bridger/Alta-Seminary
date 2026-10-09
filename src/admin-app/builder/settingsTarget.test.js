import { describe, it, expect } from 'vitest';
import { isSameTarget, resolveTarget, applyTargetUpdate, targetLabel } from './settingsTarget.js';

const button = (id, label) => ({ id, type: 'button', props: { label, href: '/x' } });
const blocks = [
  { id: 'hero', type: 'hero', props: { heading: 'Hi' } },
  { id: 'car', type: 'carousel', props: { items: [
    { id: 's1', type: 'media', props: { image: '', heading: '' } },
    { id: 's2', type: 'columns', props: { columnCount: '2', columns: [button('c1', 'One'), button('c2', 'Two')] } },
  ] } },
  { id: 'cols', type: 'columns', props: { columns: [button('k1', 'Alpha')] } },
];

describe('resolveTarget (what the settings panel shows)', () => {
  it('a top-level block', () => {
    expect(resolveTarget(blocks, { blockId: 'hero' }).id).toBe('hero');
  });

  it('one level down: a slide, or a column', () => {
    expect(resolveTarget(blocks, { blockId: 'car', nestedKey: 'items', nestedIndex: 1 })).toMatchObject({ id: 's2', type: 'columns' });
    expect(resolveTarget(blocks, { blockId: 'cols', nestedKey: 'columns', nestedIndex: 0 })).toMatchObject({ id: 'k1', type: 'button' });
  });

  it('two levels down: an item inside the Columns block that is a slide', () => {
    const t = resolveTarget(blocks, { blockId: 'car', nestedKey: 'items', nestedIndex: 1, subKey: 'columns', subIndex: 1 });
    expect(t).toMatchObject({ id: 'c2', type: 'button', props: { label: 'Two' } });
  });

  it('is null when the path no longer exists (deleted or reordered away)', () => {
    expect(resolveTarget(blocks, null)).toBeNull();
    expect(resolveTarget(blocks, { blockId: 'gone' })).toBeNull();
    expect(resolveTarget(blocks, { blockId: 'car', nestedKey: 'items', nestedIndex: 9 })).toBeNull();
    expect(resolveTarget(blocks, { blockId: 'car', nestedKey: 'items', nestedIndex: 1, subKey: 'columns', subIndex: 7 })).toBeNull();
  });
});

describe('applyTargetUpdate (what the panel writes back)', () => {
  it('edits an item two levels deep without touching anything else', () => {
    const target = { blockId: 'car', nestedKey: 'items', nestedIndex: 1, subKey: 'columns', subIndex: 0 };
    const next = applyTargetUpdate(blocks, target, { id: 'c1', type: 'button', props: { label: 'Renamed', href: '/new' } });
    expect(next[1].props.items[1].props.columns[0].props).toEqual({ label: 'Renamed', href: '/new' });
    expect(next[1].props.items[1].props.columns[1]).toBe(blocks[1].props.items[1].props.columns[1]); // sibling untouched
    expect(next[1].props.items[0]).toBe(blocks[1].props.items[0]);                                    // other slide untouched
    expect(next[1].props.items[1].props.columnCount).toBe('2');                                        // the Columns block's own props kept
    expect(next[0]).toBe(blocks[0]);
    expect(blocks[1].props.items[1].props.columns[0].props.label).toBe('One');                         // input not mutated
  });

  it('still edits one level down and the top level', () => {
    const slide = applyTargetUpdate(blocks, { blockId: 'car', nestedKey: 'items', nestedIndex: 0 }, { id: 's1', type: 'media', props: { image: 'x.png' } });
    expect(slide[1].props.items[0].props.image).toBe('x.png');
    const top = applyTargetUpdate(blocks, { blockId: 'hero' }, { id: 'hero', type: 'hero', props: { heading: 'Changed' } });
    expect(top[0].props.heading).toBe('Changed');
  });

  it('keeps the slot\'s own id even if the update carries a different one', () => {
    const next = applyTargetUpdate(blocks, { blockId: 'cols', nestedKey: 'columns', nestedIndex: 0 }, { id: 'other', type: 'button', props: { label: 'Z' } });
    expect(next[2].props.columns[0].id).toBe('k1');
  });
});

describe('targetLabel and isSameTarget', () => {
  it('says where the target lives', () => {
    expect(targetLabel(blocks, { blockId: 'cols', nestedKey: 'columns', nestedIndex: 0 })).toBe('Columns — column 1');
    expect(targetLabel(blocks, { blockId: 'car', nestedKey: 'items', nestedIndex: 1 })).toBe('Carousel / Slider — slide 2');
    expect(targetLabel(blocks, { blockId: 'car', nestedKey: 'items', nestedIndex: 1, subKey: 'columns', subIndex: 1 })).toBe('Carousel / Slider — slide 2 — column 2');
  });

  it('compares the whole path, so a column inside a slide is not the slide itself', () => {
    const slide = { blockId: 'car', nestedKey: 'items', nestedIndex: 1 };
    const inner = { ...slide, subKey: 'columns', subIndex: 0 };
    expect(isSameTarget(slide, { ...slide })).toBe(true);
    expect(isSameTarget(slide, inner)).toBe(false);
    expect(isSameTarget(inner, { ...inner, subIndex: 1 })).toBe(false);
    expect(isSameTarget(null, slide)).toBe(false);
  });
});
