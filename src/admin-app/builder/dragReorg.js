// Cross-container drag logic for EditableCanvas.jsx -- lets an admin drag a
// real top-level page block into a Carousel slide or Columns column slot
// (and back out again), not just reorder the top-level list among itself.
// Kept as plain functions (no React/dnd-kit imports) so the actual move/
// replace/reorder rules are easy to read and reason about on their own.
import { DEFAULT_LAYOUT } from '../../blocks/registry.js';

// Finds an id anywhere in the block tree: the top-level list, or nested
// inside any Carousel's `items` or Columns' `columns` array.
export function locate(blocks, id) {
  const topIndex = blocks.findIndex((b) => b.id === id);
  if (topIndex !== -1) return { kind: 'top', index: topIndex, item: blocks[topIndex] };
  for (const block of blocks) {
    if (block.type === 'carousel') {
      const items = block.props.items || [];
      const i = items.findIndex((s) => s.id === id);
      if (i !== -1) return { kind: 'items', parentId: block.id, index: i, item: items[i] };
    }
    if (block.type === 'columns') {
      const cols = block.props.columns || [];
      const i = cols.findIndex((c) => c.id === id);
      if (i !== -1) return { kind: 'columns', parentId: block.id, index: i, item: cols[i] };
    }
  }
  return null;
}

// A slide/column slot with nothing in it yet -- dropping onto one of these
// never needs a confirm, since there's nothing to lose. Any real (non-
// pseudo-type) nested block is never "blank": always confirm before
// clobbering actual content.
export function isBlankNestedItem(item) {
  if (item.type === 'media') return !item.props.image && !item.props.heading && !item.props.caption;
  if (item.type === 'content') return !item.props.image && !item.props.heading && !item.props.body;
  return false;
}

// Converts a slide/column pulled back out to the top level into a real page
// block -- 'media'/'content' are pseudo-types local to Carousel/Columns (see
// those files), not real BLOCK_REGISTRY entries, so they need a stand-in
// real type to render as a normal block.
export function nestedToTopLevelBlock(nested) {
  if (nested.type === 'media') {
    return {
      id: nested.id, type: 'image', layout: { ...DEFAULT_LAYOUT },
      props: { imageUrl: nested.props.image || '', alt: '', caption: nested.props.caption || '', width: 'full', aspectRatio: 'auto', corners: 'rounded', border: false, shadow: true, lightbox: false, link: nested.props.link || '' },
    };
  }
  if (nested.type === 'content') {
    return {
      id: nested.id, type: 'image-text', layout: { ...DEFAULT_LAYOUT },
      props: { imageUrl: nested.props.image || '', alt: '', heading: nested.props.heading || '', body: nested.props.body || '', imagePosition: 'left', verticalAlign: 'center', gap: 'lg', mobileImageFirst: true },
    };
  }
  return { id: nested.id, type: nested.type, props: nested.props, layout: { ...DEFAULT_LAYOUT } };
}

function withoutAt(list, index) {
  return [...list.slice(0, index), ...list.slice(index + 1)];
}

function replaceParentArray(blocks, parentId, kind, nextArray) {
  const key = kind === 'items' ? 'items' : 'columns';
  return blocks.map((b) => (b.id === parentId ? { ...b, props: { ...b.props, [key]: nextArray } } : b));
}

// Returns a plan describing what a drag from `activeId` onto `overId` would
// do: { type: 'noop' } (nothing to do / not allowed), { type: 'reorder',
// apply(blocks) } (same container, no confirm needed), or { type: 'move',
// apply(blocks), needsConfirm, confirmMessage } (crossing containers, or a
// top-level block replacing a slide/column). EditableCanvas.jsx calls
// `apply` immediately for a reorder, or awaits a confirm() first for a move
// that needsConfirm.
export function planDragMove(blocks, activeId, overId) {
  if (activeId === overId) return { type: 'noop' };
  const src = locate(blocks, activeId);
  const dst = locate(blocks, overId);
  if (!src || !dst) return { type: 'noop' };

  const sameContainer = src.kind === dst.kind && (src.kind === 'top' || src.parentId === dst.parentId);
  if (sameContainer) {
    return {
      type: 'reorder',
      apply(current) {
        if (src.kind === 'top') {
          const next = [...current];
          const [moved] = next.splice(src.index, 1);
          next.splice(dst.index, 0, moved);
          return next;
        }
        const parent = current.find((b) => b.id === src.parentId);
        const list = [...(parent.props[src.kind === 'items' ? 'items' : 'columns'] || [])];
        const [moved] = list.splice(src.index, 1);
        list.splice(dst.index, 0, moved);
        return replaceParentArray(current, src.parentId, src.kind, list);
      },
    };
  }

  // Crossing containers -- a real move, not a reorder. Reject nesting a
  // Carousel inside its own (or another) Carousel's slide, or Columns
  // inside a Columns column -- same restriction the "Change slide/column
  // type" picker already enforces (AddBlockButton's excludeTypes).
  if (dst.kind === 'items' && src.item.type === 'carousel') return { type: 'noop' };
  if (dst.kind === 'columns' && src.item.type === 'columns') return { type: 'noop' };

  const needsConfirm = dst.kind !== 'top' && !isBlankNestedItem(dst.item);
  const confirmMessage = dst.kind !== 'top'
    ? `This ${dst.kind === 'items' ? 'slide' : 'column'} already has content -- replace it?`
    : undefined;

  return {
    type: 'move',
    needsConfirm,
    confirmMessage,
    apply(current) {
      // 1. Remove the dragged item from wherever it currently lives.
      let next = current;
      if (src.kind === 'top') {
        next = withoutAt(next, src.index);
      } else {
        const parent = next.find((b) => b.id === src.parentId);
        const list = withoutAt(parent.props[src.kind === 'items' ? 'items' : 'columns'] || [], src.index);
        next = replaceParentArray(next, src.parentId, src.kind, list);
      }

      // 2. Place it at the destination -- a fixed-size slide/column slot
      // gets REPLACED (matches the existing "Change slide/column type"
      // picker's behavior, just via drag); the free-form top-level list
      // gets the extracted block INSERTED at that position instead, since
      // there's no "slot" there to replace.
      if (dst.kind === 'top') {
        const nested = src.kind !== 'top';
        const block = nested ? nestedToTopLevelBlock(src.item) : src.item;
        // dst.index was computed against the pre-removal array; only
        // correct for a same-array splice, which top-level insertion isn't
        // (the item came from elsewhere) -- re-find the drop target fresh.
        const freshDstIndex = next.findIndex((b) => b.id === overId);
        const insertAt = freshDstIndex === -1 ? next.length : freshDstIndex;
        next = [...next.slice(0, insertAt), block, ...next.slice(insertAt)];
      } else {
        const nestedItem = src.kind === 'top' ? { id: src.item.id, type: src.item.type, props: src.item.props } : src.item;
        const parent = next.find((b) => b.id === dst.parentId);
        const list = [...(parent.props[dst.kind === 'items' ? 'items' : 'columns'] || [])];
        const freshIndex = list.findIndex((c) => c.id === overId);
        if (freshIndex !== -1) list[freshIndex] = nestedItem;
        next = replaceParentArray(next, dst.parentId, dst.kind, list);
      }
      return next;
    },
  };
}
