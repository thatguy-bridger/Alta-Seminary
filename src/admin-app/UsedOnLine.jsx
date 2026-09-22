import React from 'react';
import { findPagesUsingBlock } from './blockUsage.js';

// "Shown on: Home, About" -- or nothing at all if it's not used anywhere,
// rather than an empty "Shown on:" label. `predicate` and its dependency
// array follow the same shape as a memo/effect dep list: recomputes only
// when something in `deps` actually changes, not on every parent render.
export function UsedOnLine({ predicate, deps = [] }) {
  const [pages, setPages] = React.useState(null);

  React.useEffect(() => {
    let active = true;
    findPagesUsingBlock(predicate).then((result) => { if (active) setPages(result); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- predicate is a fresh closure every render by design; deps is the caller's real dependency list
  }, deps);

  if (pages === null || pages.length === 0) return null;

  return (
    <div style={{ marginTop: 'var(--space-1)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)' }}>
      Shown on:{' '}
      {pages.map((p, i) => (
        <React.Fragment key={p.key}>
          {i > 0 && ', '}
          <a href={p.href} style={{ color: 'var(--text-link)' }}>{p.title}</a>
        </React.Fragment>
      ))}
    </div>
  );
}
