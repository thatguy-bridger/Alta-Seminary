import React from 'react';
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { BLOCK_COMPONENTS } from '../../blocks/BlockRenderer.jsx';
import { BlockWrapper } from '../../blocks/BlockWrapper.jsx';
import { planDragMove } from './dragReorg.js';
import { useConfirm } from '../ConfirmProvider.jsx';

function SortableBlock({ block, selected, onSelect, onFieldChange, onOpenSettings, activeSettingsTarget, onRemove, onDuplicate, onDuplicateWithImages, pathPrefix }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
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
      // Drag listeners live on this whole wrapper (border included), not just a
      // small icon -- a real drag (pointer down + move) starts a reorder, while
      // a plain click still reaches inner elements normally (see EditableText/
      // EditableImage's own onClick), so text/image editing is unaffected.
      {...attributes}
      {...listeners}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        position: 'relative',
        borderRadius: 'var(--radius-md)',
        border: selected ? '3px solid var(--brand-secondary)' : '3px solid transparent',
        cursor: selected ? 'grab' : 'default',
        touchAction: 'none',
      }}
      onClick={(e) => { e.stopPropagation(); onSelect(block.id); }}
    >
      {selected && (
        <>
          <div
            title="Drag anywhere on this bar (or the block's border) to reorder"
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
      <BlockWrapper layout={block.layout}>
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
      </BlockWrapper>
    </div>
  );
}

export function EditableCanvas({ blocks, selectedId, onSelect, onReorder, onFieldChange, onOpenSettings, activeSettingsTarget, onRemove, onDuplicate, onDuplicateWithImages, pathPrefix }) {
  const confirm = useConfirm();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Handles four cases (see dragReorg.js's planDragMove): reordering the
  // top-level list (unchanged from before), reordering slides within one
  // Carousel or columns within one Columns block, moving a real page block
  // INTO a Carousel slide / Columns column slot (replacing whatever was
  // there, confirmed first if it wasn't blank), and pulling a slide/column
  // back OUT to become a real top-level block again.
  async function handleDragEnd(event) {
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

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
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
    </DndContext>
  );
}
