import { BLOCK_REGISTRY } from '../../blocks/registry.js';

// What the Style/Settings panel is pointed at. A target is a path from a
// top-level block down to the thing being edited, at most two levels deep:
//
//   { blockId }                                       the block itself
//   { blockId, nestedKey, nestedIndex }               a slide/column inside it
//   { blockId, nestedKey, nestedIndex, subKey, subIndex }
//                                                     an item inside a Columns
//                                                     block that is itself a
//                                                     slide of a Carousel
//
// (nestedKey/subKey are the props arrays: 'items' for a Carousel, 'columns'
// for Columns.) Kept as pure functions over the block tree so the panel's
// read and write paths can't drift apart, and so they're testable.

export const isSameTarget = (a, b) =>
  !!a && !!b
  && a.blockId === b.blockId && a.nestedKey === b.nestedKey && a.nestedIndex === b.nestedIndex
  && a.subKey === b.subKey && a.subIndex === b.subIndex;

// The {id, type, props} the panel should show fields for, or null if the
// path no longer points at anything (it was deleted or reordered away).
export function resolveTarget(blocks, target) {
  if (!target) return null;
  const parent = blocks.find((b) => b.id === target.blockId);
  if (!parent) return null;
  if (!target.nestedKey) return parent;
  const slide = (parent.props[target.nestedKey] || [])[target.nestedIndex];
  if (!slide) return null;
  if (!target.subKey) return { id: slide.id, type: slide.type, props: slide.props };
  const item = (slide.props?.[target.subKey] || [])[target.subIndex];
  return item ? { id: item.id, type: item.type, props: item.props } : null;
}

// The block tree with the target replaced by what the panel produced.
export function applyTargetUpdate(blocks, target, updated) {
  if (!target.nestedKey) return blocks.map((b) => (b.id === updated.id ? updated : b));
  return blocks.map((b) => {
    if (b.id !== target.blockId) return b;
    const list = [...(b.props[target.nestedKey] || [])];
    const slide = list[target.nestedIndex];
    if (!target.subKey) {
      list[target.nestedIndex] = { id: slide.id, type: updated.type, props: updated.props };
    } else {
      const subList = [...(slide.props[target.subKey] || [])];
      subList[target.subIndex] = { id: subList[target.subIndex].id, type: updated.type, props: updated.props };
      list[target.nestedIndex] = { ...slide, props: { ...slide.props, [target.subKey]: subList } };
    }
    return { ...b, props: { ...b.props, [target.nestedKey]: list } };
  });
}

// "Carousel — slide 2 — column 1": says where the panel's target lives, since a
// nested block's own label ("Button") doesn't.
export function targetLabel(blocks, target) {
  const parent = blocks.find((b) => b.id === target.blockId);
  if (!parent) return '';
  const label = (type) => BLOCK_REGISTRY[type]?.label || type;
  const noun = (key) => (key === 'items' ? 'slide' : 'column');
  let text = `${label(parent.type)} — ${noun(target.nestedKey)} ${target.nestedIndex + 1}`;
  if (target.subKey) text += ` — ${noun(target.subKey)} ${target.subIndex + 1}`;
  return text;
}
