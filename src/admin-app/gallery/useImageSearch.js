import React from 'react';
import { supabaseBrowser } from '../../lib/supabase/browser-client';
import { searchImages } from './imageLibrary.js';

// A value that follows `value` only after it has been still for `ms`: so typing a word does not search for every letter.
export function useDebouncedValue(value, ms = 250) {
  const [settled, setSettled] = React.useState(value);
  React.useEffect(() => { const id = setTimeout(() => setSettled(value), ms); return () => clearTimeout(id); }, [value, ms]);
  return settled;
}

// The images matching `filters` ({ query, tag, origin, use, area }), one page at a time, with "show more". A search that has been
// overtaken by a newer one is ignored, so a slow answer can never replace a fresher one.
export function useImageSearch(filters, { enabled = true, db = supabaseBrowser } = {}) {
  const [state, setState] = React.useState({ items: [], total: 0, loading: false, error: '', page: 0, loaded: false });
  const latest = React.useRef(0);
  const key = JSON.stringify(filters);

  const load = React.useCallback(async (page) => {
    const mine = ++latest.current;
    setState((s) => ({ ...s, loading: true, error: '' }));
    const { items, total, error } = await searchImages(db, { ...JSON.parse(key), page });
    if (mine !== latest.current) return;
    setState((s) => ({ items: page === 0 ? items : [...s.items, ...items], total, loading: false, error, page, loaded: true }));
  }, [key, db]);

  React.useEffect(() => { if (enabled) load(0); }, [load, enabled]);

  return {
    ...state,
    hasMore: state.items.length < state.total,
    loadMore: () => load(state.page + 1),
    reload: () => load(0),
    patch: (id, fields) => setState((s) => ({ ...s, items: s.items.map((i) => (i.id === id ? { ...i, ...fields } : i)) })),
    remove: (id) => setState((s) => ({ ...s, items: s.items.filter((i) => i.id !== id), total: Math.max(0, s.total - 1) })),
  };
}
