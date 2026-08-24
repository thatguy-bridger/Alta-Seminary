import React from 'react';
import { BLOCK_REGISTRY, BLOCK_TYPES, BLOCK_CATEGORIES } from '../../blocks/registry.js';
import { Button } from '../../design-system/components/forms/Button.jsx';
import { Dialog } from '../../design-system/components/core/Dialog.jsx';
import { BlockIcon } from './blockIcons.jsx';

// label/dialogTitle/excludeTypes let this same picker double as a "change
// slide type" control inside CarouselBlock.jsx, not just the page-level
// "+ Add block" button.
// excludeChromeless: a "chromeless" block (Background Music, and any future
// block that sits outside the normal content flow -- see registry.js) makes
// no sense as a Carousel slide or Columns column, so both of those pickers
// pass this; the top-level "+ Add block" button leaves it off.
export function AddBlockButton({ onAdd, label = '+ Add block', dialogTitle = 'Add a block', excludeTypes = [], excludeChromeless = false }) {
  const [open, setOpen] = React.useState(false);
  const types = BLOCK_TYPES.filter((t) => !excludeTypes.includes(t) && !(excludeChromeless && BLOCK_REGISTRY[t].chromeless));
  // Grouped by category (Layout/Media/Informational/Interactive/Live
  // Content -- see registry.js) instead of one long flat list, now that
  // there are enough block types that scanning all of them at once is a lot
  // to visually parse.
  const groups = BLOCK_CATEGORIES
    .map((category) => ({ category, types: types.filter((t) => BLOCK_REGISTRY[t].category === category) }))
    .filter((g) => g.types.length > 0);

  function handlePick(type) {
    onAdd(type);
    setOpen(false);
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>{label}</Button>
      <Dialog open={open} title={dialogTitle} onClose={() => setOpen(false)} wide>
        <div style={{ width: '100%', maxHeight: '80vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          {groups.map(({ category, types: groupTypes }) => (
            <div key={category}>
              <h4 style={{ margin: '0 0 var(--space-2)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-bold)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 'var(--ls-caption)' }}>
                {category}
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-2)' }}>
                {groupTypes.map((type) => {
                  const def = BLOCK_REGISTRY[type];
                  return (
                    <button
                      key={type}
                      onClick={() => handlePick(type)}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)', textAlign: 'left',
                        width: '100%', boxSizing: 'border-box', minWidth: 0,
                        padding: 'var(--space-3)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
                        background: 'var(--surface-card)', cursor: 'pointer', fontFamily: 'inherit',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-sunken)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface-card)'; }}
                    >
                      <span
                        style={{
                          flex: '0 0 auto', width: 36, height: 36, borderRadius: 'var(--radius-sm)',
                          background: 'var(--tint-info-bg)', color: 'var(--brand-secondary)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <BlockIcon name={def.icon} />
                      </span>
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                        <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 'var(--fw-bold)', fontSize: 'var(--fs-body)', color: 'var(--text-primary)' }}>
                          {def.label}
                        </span>
                        {def.description && (
                          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)', color: 'var(--text-muted)' }}>
                            {def.description}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Dialog>
    </>
  );
}
