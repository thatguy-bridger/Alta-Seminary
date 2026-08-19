import React from 'react';
import { BLOCK_REGISTRY, BLOCK_TYPES } from '../../blocks/registry.js';
import { Button } from '../../design-system/components/forms/Button.jsx';
import { Dialog } from '../../design-system/components/core/Dialog.jsx';
import { BlockIcon } from './blockIcons.jsx';

// label/dialogTitle/excludeTypes let this same picker double as a "change
// slide type" control inside CarouselBlock.jsx, not just the page-level
// "+ Add block" button.
export function AddBlockButton({ onAdd, label = '+ Add block', dialogTitle = 'Add a block', excludeTypes = [] }) {
  const [open, setOpen] = React.useState(false);
  const types = excludeTypes.length > 0 ? BLOCK_TYPES.filter((t) => !excludeTypes.includes(t)) : BLOCK_TYPES;

  function handlePick(type) {
    onAdd(type);
    setOpen(false);
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>{label}</Button>
      <Dialog open={open} title={dialogTitle} onClose={() => setOpen(false)} wide>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-2)', width: '100%', maxHeight: '80vh', overflowY: 'auto' }}>
          {types.map((type) => {
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
      </Dialog>
    </>
  );
}
