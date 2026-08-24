import React from 'react';
import { DndContext, DragOverlay, closestCenter, useDndContext, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { BLOCK_COMPONENTS } from '../../blocks/BlockRenderer.jsx';
import { BlockWrapper } from '../../blocks/BlockWrapper.jsx';
import { BLOCK_REGISTRY } from '../../blocks/registry.js';
import { BlockIcon } from './blockIcons.jsx';
import { planDragMove, locate } from './dragReorg.js';
import { useConfirm } from '../ConfirmProvider.jsx';

// A short label for whatever's being dragged -- a real top-level block uses
// its own registry label; a Carousel slide/Columns column can be either a
// real nested block (same label) or one of the two carousel/columns-only
// pseudo-types ('media'/'content', see dragReorg.js), which have no
// registry entry of their own.
function describeDraggedItem(found) {
  if (!found) return 'Block';
  const { item } = found;
  if (item.type === 'media') return 'Image + caption';
  if (item.type === 'content') return 'Image + text';
  return BLOCK_REGISTRY[item.type]?.label || item.type;
}

function SortableBlock({ block, selected, onSelect, onFieldChange, onOpenSettings, activeSettingsTarget, onRemove, onDuplicate, onDuplicateWithImages, pathPrefix }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  // Reads the SAME drag in progress that's driving the DragOverlay/planning
  // logic above -- useDndContext works from anywhere inside the DndContext
  // regardless of nesting, so this needs no prop drilling from EditableCanvas.
  // Shows a red dashed outline on whichever block is currently under the
  // dragged item -- i.e. exactly where it would land if dropped right now.
  const { active, over } = useDndContext();
  const isDropTarget = !!active && active.id !== block.id && over?.id === block.id;
  const Component = BLOCK_COMPONENTS[block.type];
  if (!Component) return null;

  // Settings is showing THIS block's own (top-level) fields right now --
  // its button fills with the secondary color to say so; clicking it again
  // is a toggle (see PageBuilderScreen.jsx's handleOpenSettings) that closes
  // the panel and reverts the button to plain.
  const isSettingsActive = activeSettingsTarget?.blockId === block.id && !activeSettingsTarget?.nestedKey;
  // A nested slide/column belonging to THIS block might be the active target
  // instead -- forwarded to the block's own component (Carousel/Columns) so
  // its per-slide/per-column settings buttons can highlight themselves too.
  const nestedSettingsTarget = activeSettingsTarget?.blockId === block.id ? activeSettingsTarget : null;

  return (
    <div
      ref={setNodeRef}
      // Drag listeners deliberately do NOT live on this whole wrapper --
      // they used to, and every plain click to select a block (any small
      // hand/trackpad jitter counts as "movement" to dnd-kit's activation
      // distance) risked being read as the start of a drag instead, which
      // could end the "click" somewhere else entirely once the pointer
      // settled. The dedicated "⠿ Move" bar below (same pattern as Carousel/
      // Columns' own "⠿ Drag" handles) is now the only way to start a
      // reorder, so a plain click anywhere else always just selects.
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        position: 'relative',
        borderRadius: 'var(--radius-md)',
        border: selected ? '3px solid var(--brand-secondary)' : '3px solid transparent',
        outline: isDropTarget ? '3px dashed var(--color-error)' : 'none',
        outlineOffset: isDropTarget ? 3 : undefined,
        touchAction: 'none',
      }}
      onClick={(e) => { e.stopPropagation(); onSelect(block.id); }}
    >
      {selected && (
        <>
          <div
            {...attributes}
            {...listeners}
            title="Drag this bar to reorder"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-2)',
              height: 32,
              marginBottom: 'var(--space-2)',
              background: 'var(--brand-secondary)',
              color: 'var(--text-on-secondary)',
              borderRadius: 'var(--radius-sm)',
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--fs-small)',
              fontWeight: 'var(--fw-bold)',
              cursor: 'grab',
              touchAction: 'none',
            }}
          >
            ⠿ Move
          </div>
          <div style={{ position: 'absolute', top: 4, right: 4, zIndex: 20, display: 'flex', gap: 2, background: 'var(--surface-inverse)', borderRadius: 'var(--radius-sm)', padding: 2 }}>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onOpenSettings(block.id); }}
              style={{
                border: 'none', cursor: 'pointer', padding: '4px 8px', fontSize: 'var(--fs-caption)', borderRadius: 'var(--radius-sm)',
                background: isSettingsActive ? 'var(--brand-secondary)' : 'none',
                color: isSettingsActive ? 'var(--text-on-secondary)' : 'var(--text-on-inverse)',
              }}
            >
              ⚙ Settings
            </button>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onDuplicate(block.id); }}
              style={{ border: 'none', background: 'none', color: 'var(--text-on-inverse)', cursor: 'pointer', padding: '4px 8px', fontSize: 'var(--fs-caption)' }}
            >
              Duplicate
            </button>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onRemove(block.id); }}
              style={{ border: 'none', background: 'none', color: 'var(--color-error)', cursor: 'pointer', padding: '4px 8px', fontSize: 'var(--fs-caption)' }}
            >
              Remove
            </button>
          </div>
        </>
      )}
      {(() => {
        const content = (
          <Component
            {...block.props}
            editable
            onFieldChange={(key, value) => onFieldChange(block.id, key, value)}
            onAddImageBlocks={onDuplicateWithImages ? (urls) => onDuplicateWithImages(block.id, urls) : undefined}
            onOpenSettings={(nestedKey, nestedIndex) => onOpenSettings(block.id, nestedKey, nestedIndex)}
            activeSettingsTarget={nestedSettingsTarget}
            pathPrefix={pathPrefix}
            blockId={block.id}
          />
        );
        // A "chromeless" block (Background Music, and any future block that
        // sits outside the normal content flow) renders no visible content
        // at this position -- BlockWrapper's spacing padding would just be
        // an empty gap in the page with nothing in it to justify one.
        return BLOCK_REGISTRY[block.type]?.chromeless ? content : <BlockWrapper layout={block.layout}>{content}</BlockWrapper>;
      })()}
    </div>
  );
}

export function EditableCanvas({ blocks, selectedId, onSelect, onReorder, onFieldChange, onOpenSettings, activeSettingsTarget, onRemove, onDuplicate, onDuplicateWithImages, pathPrefix }) {
  const confirm = useConfirm();
  const [activeId, setActiveId] = React.useState(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragStart(event) {
    setActiveId(event.active.id);
  }

  // Handles four cases (see dragReorg.js's planDragMove): reordering the
  // top-level list (unchanged from before), reordering slides within one
  // Carousel or columns within one Columns block, moving a real page block
  // INTO a Carousel slide / Columns column slot (replacing whatever was
  // there, confirmed first if it wasn't blank), and pulling a slide/column
  // back OUT to become a real top-level block again.
  async function handleDragEnd(event) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const plan = planDragMove(blocks, active.id, over.id);
    if (plan.type === 'noop') return;
    if (plan.needsConfirm) {
      const ok = await confirm(plan.confirmMessage, { title: 'Replace this content?', confirmLabel: 'Replace', danger: true });
      if (!ok) return;
    }
    onReorder(plan.apply(blocks));
  }

  if (!blocks.length) {
    return (
      <div style={{ padding: 'var(--space-16)', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-default)', borderRadius: 'var(--radius-lg)' }}>
        No blocks yet — click "Add block" to start building this page.
      </div>
    );
  }

  // Only ever set from a genuine drag start (handleDragStart), so it's
  // always resolvable in the current `blocks` tree -- top-level or nested
  // inside a Carousel/Columns block alike (see dragReorg.js's locate()).
  const draggedItem = activeId ? locate(blocks, activeId) : null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveId(null)}>
      <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
        <div onClick={() => onSelect(null)}>
          {blocks.map((block) => (
            <SortableBlock
              key={block.id}
              block={block}
              selected={block.id === selectedId}
              onSelect={onSelect}
              onFieldChange={onFieldChange}
              onOpenSettings={onOpenSettings}
              activeSettingsTarget={activeSettingsTarget}
              onRemove={onRemove}
              onDuplicate={onDuplicate}
              onDuplicateWithImages={onDuplicateWithImages}
              pathPrefix={pathPrefix}
            />
          ))}
        </div>
      </SortableContext>
      {/* A floating preview under the cursor while dragging, instead of just
          fading the original in place -- the previous fade-only feedback
          gave no sense of what was actually being picked up or where it'd
          land, especially for a slide/column pulled out of a Carousel/
          Columns block (dropped somewhere in an entirely different
          SortableContext, so there's no built-in reordering animation to
          lean on). One simple generic card covers every drag source --
          a real top-level block or a nested slide/column alike -- since the
          full interactive block content isn't safe to re-mount mid-drag. */}
      <DragOverlay>
        {draggedItem && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
            padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)',
            background: 'var(--surface-card)', border: '2px solid var(--brand-secondary)',
            boxShadow: 'var(--shadow-lg)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)',
            fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)', cursor: 'grabbing',
          }}>
            <BlockIcon name={BLOCK_REGISTRY[draggedItem.item.type]?.icon || 'type'} />
            {describeDraggedItem(draggedItem)}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
