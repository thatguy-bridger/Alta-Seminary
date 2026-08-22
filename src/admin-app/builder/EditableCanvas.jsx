import React from 'react';
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { BLOCK_COMPONENTS } from '../../blocks/BlockRenderer.jsx';
import { BlockWrapper } from '../../blocks/BlockWrapper.jsx';
import { BLOCK_REGISTRY, LAYOUT_FIELDS, isInlineField } from '../../blocks/registry.js';
import { renderField } from './BlockConfigPanel.jsx';

// Same fields the right-hand Style panel (BlockConfigPanel.jsx) shows for
// the selected block, but collapsed by default directly under the block
// itself -- so a quick tweak (e.g. Carousel's autoplay speed, an Image's alt
// text) doesn't require hunting down the equivalent row in the sidebar.
// Collapsed <details> by default: most edits are inline-on-canvas already
// (EditableText/EditableImage), this is only for the handful of settings
// that have no other home.
function InlineMoreOptions({ block, onFieldChange, onLayoutChange }) {
  const def = BLOCK_REGISTRY[block.type];
  if (!def) return null;
  const settingsFields = def.fields.filter((f) => !isInlineField(f)).filter((f) => !f.showIf || f.showIf(block.props));
  if (settingsFields.length === 0 && LAYOUT_FIELDS.length === 0) return null;

  return (
    // stopPropagation on pointerdown: this sits inside the draggable block
    // wrapper (see SortableBlock below) -- without it, opening the
    // disclosure or touching a field bubbles a pointerdown up to dnd-kit's
    // listeners and starts a reorder drag right after the click.
    <div onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} style={{ marginTop: 'var(--space-3)' }}>
      <details>
        <summary style={{ cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-bold)', color: 'var(--text-secondary)', userSelect: 'none' }}>
          More options
        </summary>
        <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-4)', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {settingsFields.map((field) => renderField(field, block.props[field.key], onFieldChange))}
          {settingsFields.length > 0 && <div style={{ borderTop: '1px solid var(--border-subtle)' }} />}
          {LAYOUT_FIELDS.map((field) => renderField(field, block.layout?.[field.key], onLayoutChange))}
        </div>
      </details>
    </div>
  );
}

function SortableBlock({ block, selected, onSelect, onFieldChange, onLayoutChange, onRemove, onDuplicate, onDuplicateWithImages, pathPrefix }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const Component = BLOCK_COMPONENTS[block.type];
  if (!Component) return null;

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
          pathPrefix={pathPrefix}
          blockId={block.id}
        />
      </BlockWrapper>
      {selected && (
        <InlineMoreOptions
          block={block}
          onFieldChange={(key, value) => onFieldChange(block.id, key, value)}
          onLayoutChange={(key, value) => onLayoutChange(block.id, key, value)}
        />
      )}
    </div>
  );
}

export function EditableCanvas({ blocks, selectedId, onSelect, onReorder, onFieldChange, onLayoutChange, onRemove, onDuplicate, onDuplicateWithImages, pathPrefix }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = blocks.findIndex((b) => b.id === active.id);
    const newIndex = blocks.findIndex((b) => b.id === over.id);
    onReorder(arrayMove(blocks, oldIndex, newIndex));
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
              onLayoutChange={onLayoutChange}
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
