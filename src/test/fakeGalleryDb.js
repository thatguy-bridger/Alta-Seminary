// An in-memory stand-in for the image library's database, for the gallery tests. It really filters, orders, inserts, updates (with the
// one-row-per-address rule), upserts and deletes, and mirrors the three things the database does that the screens depend on:
//   search_media_library()      every word typed is a PREFIX, all words must match, best matches first, paged, with filters
//   media_library_tag_counts    worked out from the images' tags
//   media_library_usage         whatever the test says uses each image (`usage`)
// plus a little of Supabase storage (upload with upsert, remove, public addresses) and the signed-in user.
// `registerUploads: true` makes an upload also create its library row, the way the database trigger on the storage bucket does.
// `fail` makes one call fail with a message, by name: 'rpc', 'storage.upload', 'storage.remove', 'media_library.update', 'media_library.delete', ...
const clone = (x) => JSON.parse(JSON.stringify(x));
export const BASE = 'https://project.supabase.co/storage/v1/object/public/images/';

const words = (text) => String(text || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

export function createGalleryDb({ images = [], usage = [], registerUploads = false, fail = {}, user = { id: 'user-1' } } = {}) {
  let seq = 0;
  const tables = { media_library: images.map((i) => ({ id: `img-${++seq}`, origin: 'uploaded', title: '', description: '', alt_text: '', tags: [], credit: '', license: '', source_url: null, storage_path: null, mime_type: null,
    width: null, height: null, size_bytes: null, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z', ...clone(i) })) };
  const usageRows = usage.map(clone);
  const files = new Map();          // storage path -> { blob, contentType }
  const log = [];
  const failure = (name) => (fail[name] ? { message: fail[name] } : null);
  const nextId = () => `img-${++seq}`;

  const usageCount = (id) => usageRows.filter((u) => u.media_id === id).length;
  const haystack = (m) => ({
    title: words(m.title), tags: words((m.tags || []).join(' ')), text: words(`${m.alt_text} ${m.description}`), small: words(`${m.credit} ${m.license} ${m.origin}`),
  });
  function rank(m, ws) {
    const h = haystack(m);
    let score = 0;
    for (const w of ws) {
      const hit = (list) => list.some((x) => x.startsWith(w));
      if (!hit(h.title) && !hit(h.tags) && !hit(h.text) && !hit(h.small)) return -1;
      score += (hit(h.title) ? 4 : 0) + (hit(h.tags) ? 4 : 0) + (hit(h.text) ? 2 : 0) + (hit(h.small) ? 1 : 0);
    }
    return score;
  }

  function search(a) {
    const ws = words(a.p_query);
    let rows = tables.media_library.map((m) => ({ m, score: ws.length ? rank(m, ws) : 0, used: usageCount(m.id) })).filter((r) => r.score >= 0);
    if (a.p_tag) rows = rows.filter((r) => (r.m.tags || []).includes(a.p_tag));
    if (a.p_origin) rows = rows.filter((r) => r.m.origin === a.p_origin);
    if (a.p_use === 'used') rows = rows.filter((r) => r.used > 0);
    if (a.p_use === 'unused') rows = rows.filter((r) => r.used === 0);
    if (a.p_area) rows = rows.filter((r) => usageRows.some((u) => u.media_id === r.m.id && u.area === a.p_area));
    rows.sort((x, y) => y.score - x.score || (x.m.created_at < y.m.created_at ? 1 : x.m.created_at > y.m.created_at ? -1 : 0) || (x.m.id > y.m.id ? 1 : -1));
    const total = rows.length;
    const limit = Math.max(1, Math.min(a.p_limit ?? 60, 200)), offset = Math.max(0, a.p_offset ?? 0);
    return rows.slice(offset, offset + limit).map((r) => ({ ...clone(r.m), usage_count: r.used, total_count: total }));
  }

  const viewRows = (table) => {
    if (table === 'media_library_usage') return usageRows;
    if (table === 'media_library_tag_counts') {
      const counts = new Map();
      tables.media_library.forEach((m) => (m.tags || []).forEach((t) => counts.set(t, (counts.get(t) || 0) + 1)));
      return [...counts].map(([tag, n]) => ({ tag, n }));
    }
    return tables[table] || (tables[table] = []);
  };

  function from(table) {
    const q = { op: 'select', payload: null, filters: [], order: [], limit: Infinity, onConflict: null };
    const matches = (r) => q.filters.every((f) => f(r));
    const run = () => {
      const failing = failure(`${table}.${q.op}`);
      if (failing) return { data: null, error: failing };
      const store = tables[table] || (tables[table] = []);
      if (q.op === 'insert') {
        const made = [];
        for (const p of Array.isArray(q.payload) ? q.payload : [q.payload]) {
          if (table === 'media_library' && store.some((r) => r.url === p.url)) return { data: null, error: { message: 'duplicate key value violates unique constraint "media_library_url_key"' } };
          made.push({ id: nextId(), created_at: '2026-10-28T00:00:00Z', updated_at: '2026-10-28T00:00:00Z', title: '', description: '', alt_text: '', tags: [], credit: '', license: '', ...clone(p) });
        }
        store.push(...made); log.push({ table, op: 'insert', payload: q.payload });
        return { data: Array.isArray(q.payload) ? clone(made) : clone(made[0]), error: null };
      }
      if (q.op === 'upsert') {
        const key = q.onConflict || 'id';
        const row = clone(q.payload);
        const existing = store.find((r) => r[key] === row[key]);
        log.push({ table, op: 'upsert', payload: q.payload });
        if (existing) { Object.assign(existing, row, { updated_at: '2026-10-28T00:00:00Z' }); return { data: clone(existing), error: null }; }
        const made = { id: nextId(), created_at: '2026-10-28T00:00:00Z', updated_at: '2026-10-28T00:00:00Z', ...row };
        store.push(made); return { data: clone(made), error: null };
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
      let rows = viewRows(table).filter(matches);
      for (const [col, asc] of [...q.order].reverse()) rows = [...rows].sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (asc ? 1 : -1));
      return { data: clone(rows.slice(0, q.limit)), error: null };
    };
    const one = () => { const r = run(); return Array.isArray(r.data) ? { ...r, data: r.data[0] ?? null } : r; };
    const b = {
      select() { return b; },
      insert(p) { q.op = 'insert'; q.payload = p; return b; },
      upsert(p, opts) { q.op = 'upsert'; q.payload = p; q.onConflict = opts?.onConflict || null; return b; },
      update(p) { q.op = 'update'; q.payload = p; return b; },
      delete() { q.op = 'delete'; return b; },
      eq(col, v) { q.filters.push((r) => r[col] === v); return b; },
      in(col, vs) { q.filters.push((r) => vs.includes(r[col])); return b; },
      order(col, o) { q.order.push([col, o?.ascending !== false]); return b; },
      limit(n) { q.limit = n; return b; },
      maybeSingle: async () => one(),
      single: async () => one(),
      then: (ok, fn) => Promise.resolve(run()).then(ok, fn),
    };
    return b;
  }

  const storage = {
    from(bucket) {
      return {
        async upload(path, blob, opts = {}) {
          const failing = failure('storage.upload');
          if (failing) return { data: null, error: failing };
          if (files.has(path) && !opts.upsert) return { data: null, error: { message: 'The resource already exists' } };
          files.set(path, { blob, contentType: opts.contentType, upsert: !!opts.upsert });
          log.push({ table: `storage:${bucket}`, op: opts.upsert && files.has(path) ? 'upsert' : 'upload', path });
          if (registerUploads && !tables.media_library.some((r) => r.url === BASE + path)) {
            tables.media_library.push({ id: nextId(), origin: 'uploaded', url: BASE + path, storage_path: path, title: '', description: '', alt_text: '', tags: [], credit: '', license: '', source_url: null,
              mime_type: opts.contentType || null, width: null, height: null, size_bytes: blob?.size ?? null, created_at: '2026-10-28T00:00:00Z', updated_at: '2026-10-28T00:00:00Z' });
          }
          return { data: { path }, error: null };
        },
        async remove(paths) {
          const failing = failure('storage.remove');
          if (failing) return { data: null, error: failing };
          paths.forEach((p) => { files.delete(p); });
          // what the database trigger does when a file leaves the bucket
          tables.media_library = tables.media_library.filter((r) => !(paths.includes(r.storage_path) && r.origin !== 'linked'));
          log.push({ table: `storage:${bucket}`, op: 'remove', paths });
          return { data: paths, error: null };
        },
        getPublicUrl: (path) => ({ data: { publicUrl: BASE + path } }),
      };
    },
  };

  return {
    from, storage, log, tables, files, usage: usageRows,
    auth: { getUser: async () => ({ data: { user: user ? { ...user } : null } }) },
    rpc: async (name, args) => {
      const failing = failure('rpc');
      if (failing) return { data: null, error: failing };
      log.push({ table: 'rpc', op: name, args });
      if (name === 'search_media_library') return { data: search(args), error: null };
      return { data: null, error: { message: `unknown function ${name}` } };
    },
  };
}
