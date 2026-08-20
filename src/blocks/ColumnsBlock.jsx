import React from 'react';
import { RichText } from './richText.jsx';
import { EditableText } from '../admin-app/builder/EditableText.jsx';
import { EditableImage } from '../admin-app/builder/EditableImage.jsx';
import { textStyleToCss } from '../admin-app/builder/textStyle.js';
import { AddBlockButton } from '../admin-app/builder/AddBlockButton.jsx';
import { renderField } from '../admin-app/builder/BlockConfigPanel.jsx';
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
  if (type === 'content') return { image: '', heading: '', body: '' };
  const def = BLOCK_REGISTRY[type];
  return def ? structuredClone(def.defaultProps) : {};
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
  editable, onFieldChange, pathPrefix, textAlign = 'left', widthRatio = 'equal', divider = false,
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

  return (
    <div className="block-columns" data-count={count} data-ratio={count === 2 ? widthRatio : 'equal'} data-divider={divider} style={{ textAlign }}>
      {columns.map((col, i) => (
        <div key={col.id}>
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
            <>
              {(editable || col.props.image) && (
                <div style={{ marginBottom: 'var(--space-3)' }}>
                  {editable ? (
                    <EditableImage value={col.props.image} alt="" onChange={(url) => updateColumnProps(i, { image: url })} pathPrefix={pathPrefix} emptyLabel={`Column ${i + 1} image (optional)`} />
                  ) : (
                    <img src={col.props.image} alt="" style={{ width: '100%', borderRadius: 'var(--radius-md)' }} />
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
            </>
          ) : editable ? (
            <ColumnBlockEditor
              type={col.type}
              blockId={col.id}
              props={col.props}
              pathPrefix={pathPrefix}
              onFieldChange={(key, value) => updateColumnProps(i, { [key]: value })}
            />
          ) : (
            <ColumnBlockLive type={col.type} id={col.id} props={col.props} />
          )}
        </div>
      ))}
    </div>
  );
}

// Renders a nested block's own inline canvas editing UI plus whatever
// non-inline "settings" fields that block type has, using the same field
// renderer as the page-level style panel -- exactly CarouselBlock.jsx's
// SlideBlockEditor, since a column isn't a real page block with its own row
// in BlockConfigPanel either.
function ColumnBlockEditor({ type, blockId, props, pathPrefix, onFieldChange }) {
  const def = BLOCK_REGISTRY[type];
  const Component = BLOCK_COMPONENTS[type];
  if (!def || !Component) return null;
  const settingsFields = def.fields.filter((f) => !isInlineField(f)).filter((f) => !f.showIf || f.showIf(props));

  return (
    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', background: 'var(--surface-card)' }}>
      <Component {...props} editable onFieldChange={onFieldChange} pathPrefix={pathPrefix} blockId={blockId} />
      {settingsFields.length > 0 && (
        <div style={{ marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {settingsFields.map((field) => renderField(field, props[field.key], onFieldChange))}
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
