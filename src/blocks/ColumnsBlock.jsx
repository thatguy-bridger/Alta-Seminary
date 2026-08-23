import React from 'react';
import { RichText } from './richText.jsx';
import { EditableText } from '../admin-app/builder/EditableText.jsx';
import { EditableImage } from '../admin-app/builder/EditableImage.jsx';
import { textStyleToCss } from '../admin-app/builder/textStyle.js';
import { AddBlockButton } from '../admin-app/builder/AddBlockButton.jsx';
import { Input } from '../design-system/components/forms/Input.jsx';
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { useDndContext } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { BLOCK_REGISTRY, isInlineField } from './registry.js';
// BlockRenderer.jsx imports ColumnsBlock (it's one of the types in
// BLOCK_COMPONENTS), so this is a circular import -- safe here for the same
// reason it's safe in CarouselBlock.jsx: BLOCK_COMPONENTS is only read
// lazily inside function bodies below, never at module-evaluation time.
import { BLOCK_COMPONENTS } from './BlockRenderer.jsx';

// A column can either be the original "content" shape (image + heading +
// body -- the block's original and still most common use) or a full nested
// block of any other registered type (quote, button, embed, ...), exactly
// like a carousel slide (see CarouselBlock.jsx, which this mirrors). 'content'
// isn't a real BLOCK_REGISTRY entry -- it's columns-only. Nesting columns
// inside its own column is excluded (see the "change column type" picker
// below) since that has no sensible UI.

function columnPropsForType(type) {
  if (type === 'content') return { image: '', heading: '', body: '', link: '' };
  const def = BLOCK_REGISTRY[type];
  return def ? structuredClone(def.defaultProps) : {};
}

// A "content" column with a Link set (see the input added below) becomes a
// real <a> on the live site; without one it's a plain <div> -- same content
// either way, so the column's own render doesn't need two near-duplicate paths.
function ColumnContentLink({ link, children }) {
  if (!link) return <div>{children}</div>;
  return <a href={link} style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>{children}</a>;
}

function newColumn() {
  return { id: crypto.randomUUID(), type: 'content', props: columnPropsForType('content') };
}

function normalizeColumn(item) {
  if (item && typeof item === 'object' && item.type && item.props) return item;
  return newColumn();
}

// Columns created before the {type, props} rewrite stored their image/
// heading/body/headingStyle/bodyStyle flat as col1Image/col1Heading/... props
// on the block itself. Reads real content out of those legacy fields so
// existing pages don't silently lose their columns.
function legacyColumnsFromProps(legacyProps) {
  const columns = [];
  for (let i = 1; i <= 3; i++) {
    const image = legacyProps[`col${i}Image`];
    const heading = legacyProps[`col${i}Heading`];
    const body = legacyProps[`col${i}Body`];
    const headingStyle = legacyProps[`col${i}HeadingStyle`];
    const bodyStyle = legacyProps[`col${i}BodyStyle`];
    if (image || heading || body) {
      columns.push({
        id: `legacy-${i}`,
        type: 'content',
        props: {
          image: image || '', heading: heading || '', body: body || '',
          ...(headingStyle ? { headingStyle } : {}),
          ...(bodyStyle ? { bodyStyle } : {}),
        },
      });
    }
  }
  return columns;
}

function mergeLegacyColumns(items, legacyProps) {
  const legacy = legacyColumnsFromProps(legacyProps);
  if (legacy.length === 0) return items;
  const merged = items.map((item, i) => {
    const fallback = legacy[i];
    if (!fallback || item.type !== 'content') return item;
    return {
      ...item,
      props: {
        ...item.props,
        image: item.props.image || fallback.props.image,
        heading: item.props.heading || fallback.props.heading,
        body: item.props.body || fallback.props.body,
      },
    };
  });
  if (legacy.length > merged.length) merged.push(...legacy.slice(merged.length));
  return merged;
}

export function ColumnsBlock({
  editable, onFieldChange, onOpenSettings, activeSettingsTarget, pathPrefix, textAlign = 'left', widthRatio = 'equal', divider = false,
  columns: columnsProp, columnCount, ...legacyProps
}) {
  const count = columnCount === '3' ? 3 : 2;
  const originalItems = Array.isArray(columnsProp) ? columnsProp : [];
  const normalized = originalItems.map(normalizeColumn);
  const merged = mergeLegacyColumns(normalized, legacyProps);
  while (merged.length < 3) merged.push(newColumn());
  const columns = merged.slice(0, count);

  // One-time self-heal, same pattern as CarouselBlock: persist the migrated
  // shape once so it's not silently re-derived every render, and the old
  // flat/legacy fields can eventually go stale. Keeps all 3 slots (not just
  // the currently-visible `count`) so switching 2 -> 3 columns doesn't lose data.
  const mergedJSON = JSON.stringify(merged);
  React.useEffect(() => {
    if (editable && onFieldChange && mergedJSON !== JSON.stringify(originalItems)) {
      onFieldChange('columns', merged);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per real change in the merged result, not on every render
  }, [mergedJSON]);

  function updateColumn(i, patch) {
    const next = merged.map((c, ci) => (ci === i ? { ...c, ...patch } : c));
    onFieldChange('columns', next);
  }
  function updateColumnProps(i, propsPatch) {
    updateColumn(i, { props: { ...merged[i].props, ...propsPatch } });
  }
  function setColumnType(i, type) {
    updateColumn(i, { type, props: columnPropsForType(type) });
  }

  const columnList = columns.map((col, i) => {
    const inner = (
      <>
        {editable && (
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <AddBlockButton
              label={`Column ${i + 1}: ${col.type === 'content' ? 'Image + text' : BLOCK_REGISTRY[col.type]?.label || col.type}`}
              dialogTitle={`Choose column ${i + 1}'s content`}
              excludeTypes={['columns']}
              onAdd={(type) => setColumnType(i, type)}
            />
          </div>
        )}
        {col.type === 'content' ? (
          <ColumnContentLink link={editable ? '' : col.props.link}>
            {(editable || col.props.image) && (
              <div style={{ marginBottom: 'var(--space-3)' }}>
                {editable ? (
                  <EditableImage value={col.props.image} alt="" onChange={(url) => updateColumnProps(i, { image: url })} pathPrefix={pathPrefix} emptyLabel={`Column ${i + 1} image (optional)`} />
                ) : (
                  <img src={col.props.image} alt="" loading="lazy" style={{ width: '100%', borderRadius: 'var(--radius-md)' }} />
                )}
              </div>
            )}
            {(editable || col.props.heading) && (
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-subheading)', margin: '0 0 var(--space-2)', color: 'var(--text-primary)', ...textStyleToCss(col.props.headingStyle) }}>
                {editable ? (
                  <EditableText value={col.props.heading} onCommit={(v) => updateColumnProps(i, { heading: v })} placeholder={`Column ${i + 1} heading`} styleValue={col.props.headingStyle} onStyleChange={(s) => updateColumnProps(i, { headingStyle: s })} />
                ) : col.props.heading}
              </h3>
            )}
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', ...textStyleToCss(col.props.bodyStyle) }}>
              {editable ? (
                <EditableText value={col.props.body} onCommit={(v) => updateColumnProps(i, { body: v })} placeholder={`Column ${i + 1} body`} multiline as="div" styleValue={col.props.bodyStyle} onStyleChange={(s) => updateColumnProps(i, { bodyStyle: s })} />
              ) : (
                <RichText text={col.props.body} />
              )}
            </div>
            {editable && (
              <div style={{ marginTop: 'var(--space-2)' }} onPointerDown={(e) => e.stopPropagation()}>
                <Input
                  label={`Column ${i + 1} link (optional — makes it clickable)`}
                  value={col.props.link || ''}
                  onChange={(e) => updateColumnProps(i, { link: e.target.value })}
                  placeholder="/announcements/... or https://…"
                />
              </div>
            )}
          </ColumnContentLink>
        ) : editable ? (
          <ColumnBlockEditor
            type={col.type}
            blockId={col.id}
            props={col.props}
            pathPrefix={pathPrefix}
            onFieldChange={(key, value) => updateColumnProps(i, { [key]: value })}
            onOpenSettings={onOpenSettings ? () => onOpenSettings('columns', i) : undefined}
            isSettingsActive={activeSettingsTarget?.nestedKey === 'columns' && activeSettingsTarget?.nestedIndex === i}
          />
        ) : (
          <ColumnBlockLive type={col.type} id={col.id} props={col.props} />
        )}
      </>
    );
    // Drag-and-drop (SortableColumn, below) is an editor-only concept -- the
    // live public site never mounts a DndContext at all, and useSortable
    // called with no such ancestor is exactly the kind of thing not worth
    // relying on being harmless on every dnd-kit version. Plain <div> there instead.
    return editable
      ? <SortableColumn key={col.id} id={col.id}>{inner}</SortableColumn>
      : <div key={col.id}>{inner}</div>;
  });

  return (
    <div className="block-columns" data-count={count} data-ratio={count === 2 ? widthRatio : 'equal'} data-divider={divider} style={{ textAlign }}>
      {editable ? (
        <SortableContext items={columns.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
          {columnList}
        </SortableContext>
      ) : columnList}
    </div>
  );
}

// Draggable AND a drop target (useSortable does both) -- lets an admin drag
// a real top-level page block onto this column to put it there (see
// dragReorg.js), drag this column onto another to reorder, or drag it out
// to the main page list to extract it back into a real block. The handle
// bar (not the whole column, which is full of its own clickable content
// like EditableImage/EditableText) carries the actual drag listeners.
// Only ever rendered when editable (see columnList above).
function SortableColumn({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  // Same drag-in-progress every other drop-target indicator in the builder
  // reads (see EditableCanvas.jsx's SortableBlock) -- a red dashed outline
  // on whichever column is currently under the dragged item.
  const { active, over } = useDndContext();
  const isDropTarget = !!active && active.id !== id && over?.id === id;
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1,
        outline: isDropTarget ? '3px dashed var(--color-error)' : 'none', outlineOffset: isDropTarget ? 3 : undefined, borderRadius: 'var(--radius-md)',
      }}
    >
      <div
        {...attributes}
        {...listeners}
        title="Drag to reorder this column, or drag it onto the main page to pull it out"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 22, marginBottom: 'var(--space-2)', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-muted)', fontSize: 'var(--fs-caption)', cursor: 'grab', touchAction: 'none' }}
      >
        ⠿ Drag
      </div>
      {children}
    </div>
  );
}

// Renders a nested block's own inline canvas editing UI plus whatever
// non-inline "settings" fields that block type has, using the same field
// renderer as the page-level style panel -- exactly CarouselBlock.jsx's
// SlideBlockEditor, since a column isn't a real page block with its own row
// in BlockConfigPanel either.
function ColumnBlockEditor({ type, blockId, props, pathPrefix, onFieldChange, onOpenSettings, isSettingsActive }) {
  const def = BLOCK_REGISTRY[type];
  const Component = BLOCK_COMPONENTS[type];
  if (!def || !Component) return null;
  const settingsFields = def.fields.filter((f) => !isInlineField(f)).filter((f) => !f.showIf || f.showIf(props));

  return (
    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', background: 'var(--surface-card)' }}>
      <Component {...props} editable onFieldChange={onFieldChange} pathPrefix={pathPrefix} blockId={blockId} />
      {settingsFields.length > 0 && onOpenSettings && (
        // This column's settings live in the right-hand panel like everything
        // else -- see PageBuilderScreen.jsx's settingsTarget. stopPropagation:
        // this sits inside the Columns block, itself inside the canvas's
        // draggable wrapper -- without it, clicking bubbles a pointerdown up
        // and starts a reorder drag right after the click.
        <div style={{ marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border-subtle)' }}>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onOpenSettings(); }}
            className={`btn btn-sm ${isSettingsActive ? 'btn-secondary' : 'btn-outline'}`}
          >
            ⚙ Settings
          </button>
        </div>
      )}
    </div>
  );
}

function ColumnBlockLive({ type, id, props }) {
  const Component = BLOCK_COMPONENTS[type];
  if (!Component) return null;
  return <Component {...props} blockId={id} />;
}
