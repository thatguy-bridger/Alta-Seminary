// A small in-memory stand-in for the lessons tables, for the admin Lessons tests. Unlike fakeSupabase.js it really
// filters (eq, in), orders, inserts, updates and deletes, so a test can check what is left afterwards.
// `admin_makeup_lessons` is derived from `makeup_sources` the way the real view is (no body or transcript, plus lengths).
const clone = (x) => JSON.parse(JSON.stringify(x));

export function createLessonsDb({ sources = [], other = {} } = {}) {
  const tables = { makeup_sources: sources.map(clone), ...Object.fromEntries(Object.entries(other).map(([k, v]) => [k, v.map(clone)])) };
  const log = [];
  let seq = 0;

  const view = () => tables.makeup_sources.map(({ body, transcript, ...rest }) => ({
    ...rest, body_words: body ? body.trim().split(/\s+/).length : 0, transcript_lines: Array.isArray(transcript) ? transcript.length : 0,
  }));
  const rowsOf = (table) => (table === 'admin_makeup_lessons' ? view() : tables[table] || []);

  function from(table) {
    const q = { op: 'select', payload: null, filters: [], order: [], limit: Infinity, error: null };
    const matches = (r) => q.filters.every((f) => f(r));
    const run = () => {
      if (q.error) return { data: null, error: { message: q.error } };
      const store = tables[table === 'admin_makeup_lessons' ? 'makeup_sources' : table] || (tables[table] = []);
      if (q.op === 'insert') {
        const made = (Array.isArray(q.payload) ? q.payload : [q.payload]).map((p) => ({ id: `${table}-${++seq}`, created_at: new Date().toISOString(), ...clone(p) }));
        store.push(...made); log.push({ table, op: 'insert', payload: q.payload });
        return { data: Array.isArray(q.payload) ? clone(made) : clone(made[0]), error: null };
      }
      if (q.op === 'update') {
        const hit = store.filter(matches); hit.forEach((r) => Object.assign(r, clone(q.payload)));
        log.push({ table, op: 'update', payload: q.payload, ids: hit.map((r) => r.id) });
        return { data: clone(hit), error: null };
      }
      if (q.op === 'delete') {
        const gone = store.filter(matches); tables[table] = store.filter((r) => !matches(r)); log.push({ table, op: 'delete', ids: gone.map((r) => r.id) });
        return { data: clone(gone), error: null };
      }
      let rows = rowsOf(table).filter(matches);
      for (const [col, asc] of [...q.order].reverse()) rows = [...rows].sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (asc ? 1 : -1));
      return { data: clone(rows.slice(0, q.limit)), error: null };
    };
    const one = () => { const r = run(); return Array.isArray(r.data) ? { ...r, data: r.data[0] ?? null } : r; };
    const b = {
      select() { return b; },
      insert(p) { q.op = 'insert'; q.payload = p; return b; },
      update(p) { q.op = 'update'; q.payload = p; return b; },
      delete() { q.op = 'delete'; return b; },
      eq(col, v) { q.filters.push((r) => r[col] === v); return b; },
      in(col, vs) { q.filters.push((r) => vs.includes(r[col])); return b; },
      order(col, o) { q.order.push([col, o?.ascending !== false]); return b; },
      limit(n) { q.limit = n; return b; },
      maybeSingle: async () => one(),
      single: async () => one(),
      then: (ok, fail) => Promise.resolve(run()).then(ok, fail),
    };
    return b;
  }
  return { from, log, tables };
}
