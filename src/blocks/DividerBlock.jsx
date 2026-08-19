import React from 'react';

const SIZE_VAR = { sm: 'var(--space-4)', md: 'var(--space-8)', lg: 'var(--space-16)' };

export function DividerBlock({ style = 'line', size = 'md' }) {
  const height = SIZE_VAR[size] || SIZE_VAR.md;
  if (style === 'space') {
    return <div style={{ height }} aria-hidden="true" />;
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', height }}>
      <hr style={{ width: '100%', border: 'none', borderTop: '1px solid var(--border-subtle)', margin: 0 }} />
    </div>
  );
}
