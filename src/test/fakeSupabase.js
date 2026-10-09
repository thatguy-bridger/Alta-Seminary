// A tiny in-memory stand-in for the Supabase client -- just enough of the
// chainable query builder for this codebase's calls, so tests can check what
// would have been written without a network or a database.
//
//   tables: { table_name: [rows...] }  what a plain select/single returns
//   errors: { table_name: 'message' }  makes that table's queries fail
//   log:    every insert/upsert/delete/update, in order, for assertions
export function createFakeSupabase({ tables = {}, errors = {} } = {}) {
  const log = [];
  let seq = 0;

  function from(table) {
    const state = { op: 'select', payload: null };
    const withId = (row) => ({ id: `${table}-${++seq}`, ...row });
    const resolve = () => {
      if (errors[table]) return { data: null, error: { message: errors[table] } };
      if (state.op === 'insert') {
        return { data: Array.isArray(state.payload) ? state.payload.map(withId) : withId(state.payload), error: null };
      }
      if (state.op === 'select') return { data: tables[table] ?? [], error: null };
      return { data: null, error: null };
    };
    const record = (op, payload) => { state.op = op; state.payload = payload; log.push({ table, op, payload }); return builder; };
    const builder = {
      select() { return builder; },
      insert: (payload) => record('insert', payload),
      upsert: (payload) => record('upsert', payload),
      update: (payload) => record('update', payload),
      delete: () => record('delete', null),
      eq() { return builder; }, in() { return builder; }, match() { return builder; },
      gte() { return builder; }, order() { return builder; }, limit() { return builder; },
      single: async () => { const r = resolve(); return Array.isArray(r.data) ? { ...r, data: r.data[0] ?? null } : r; },
      maybeSingle: async () => { const r = resolve(); return Array.isArray(r.data) ? { ...r, data: r.data[0] ?? null } : r; },
      then: (ok, fail) => Promise.resolve(resolve()).then(ok, fail),
    };
    return builder;
  }

  return { from, log };
}
