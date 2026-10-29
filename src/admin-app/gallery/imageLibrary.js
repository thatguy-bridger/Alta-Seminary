// The image library: what is known about every picture on the site, and how an admin finds, describes, replaces and removes one.
// Plain functions that take the database client as an argument, so they can be tested without a network.
import { withBase } from '../../lib/url.js';

export const PAGE_SIZE = 48;
// The same limits the database enforces (migration 0047), so a form can say so before the save does.
export const LIMITS = { title: 200, description: 1000, alt_text: 300, credit: 300, license: 300, tags: 20, tag: 40 };

export const ORIGINS = [
  { value: 'uploaded', label: 'Uploaded to the site' },
  { value: 'site', label: 'Comes with the site' },
  { value: 'linked', label: 'Linked from another website' },
];
export const ORIGIN_LABEL = { uploaded: 'Uploaded', site: 'Comes with the site', linked: 'Linked' };

// Where an image can be used. The first is what the database calls it (media_library_usage.area).
export const AREAS = [
  { value: 'page', label: 'Pages' },
  { value: 'post', label: 'Announcements' },
  { value: 'event', label: 'Events' },
  { value: 'directory', label: 'Directory' },
  { value: 'gallery', label: 'Photo albums' },
  { value: 'lesson', label: 'Makeup lessons' },
  { value: 'site', label: 'Site header and footer' },
];
export const AREA_LABEL = Object.fromEntries(AREAS.map((a) => [a.value, a.label]));

/* ---------- describing an image ---------- */

// "alpha, Beta ,, alpha" -> ["alpha", "beta"]: lower case, no blanks or repeats, short, in alphabetical order (as the database keeps them).
export function parseTags(text) {
  const out = new Set();
  for (const raw of String(text || '').split(/[,;\n]/)) {
    const t = raw.trim().toLowerCase().slice(0, LIMITS.tag);
    if (t) out.add(t);
  }
  return [...out].sort().slice(0, LIMITS.tags);
}
export const tagsText = (tags) => (Array.isArray(tags) ? tags.join(', ') : '');

export const draftFromImage = (item) => ({
  title: item.title || '', alt_text: item.alt_text || '', description: item.description || '',
  tagsText: tagsText(item.tags), credit: item.credit || '', license: item.license || '',
});
export const rowFromDraft = (d) => ({
  title: d.title.trim(), alt_text: d.alt_text.trim(), description: d.description.trim(),
  tags: parseTags(d.tagsText), credit: d.credit.trim(), license: d.license.trim(),
});
export const sameDraft = (a, b) => JSON.stringify(rowFromDraft(a)) === JSON.stringify(rowFromDraft(b));

// -> { ok, errors: { field: message } }
export function validateDraft(d) {
  const errors = {};
  for (const f of ['title', 'alt_text', 'description', 'credit', 'license']) {
    if (d[f].trim().length > LIMITS[f]) errors[f] = `Keep this to ${LIMITS[f]} characters or fewer (it is ${d[f].trim().length}).`;
  }
  const typed = String(d.tagsText || '').split(/[,;\n]/).map((t) => t.trim()).filter(Boolean);
  if (typed.some((t) => t.length > LIMITS.tag)) errors.tagsText = `Each tag can be up to ${LIMITS.tag} characters.`;
  else if (parseTags(d.tagsText).length < new Set(typed.map((t) => t.toLowerCase())).size) errors.tagsText = `At most ${LIMITS.tags} tags.`;
  return { ok: Object.keys(errors).length === 0, errors };
}

/* ---------- labels ---------- */

// An image with no title still needs a name on screen.
export function imageName(item) {
  if (item.title) return item.title;
  return 'Untitled image';
}
export function fileSizeLabel(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
export const dimensionsLabel = (item) => (item.width && item.height ? `${item.width} × ${item.height}` : '');
export const factsLine = (item) => [dimensionsLabel(item), fileSizeLabel(item.size_bytes)].filter(Boolean).join(' · ');
export const usageLabel = (n) => (n > 0 ? `Used in ${n} place${n === 1 ? '' : 's'}` : 'Not used anywhere yet');

/* ---------- where an image is used ---------- */

export function usageHref(row) {
  const slug = encodeURIComponent(row.ref_slug || '');
  switch (row.area) {
    case 'page': return withBase(`/admin/pages/edit?slug=${slug}`);
    case 'post': return withBase(`/admin/posts/edit?slug=${slug}`);
    case 'event': return withBase(`/admin/events/edit?slug=${slug}`);
    case 'directory': return withBase('/admin/directory');
    case 'gallery': return withBase('/admin/gallery');
    case 'lesson': return withBase(`/admin/makeup-work/lessons?edit=${encodeURIComponent(row.ref_id || '')}`);
    case 'site': return withBase('/admin/site-chrome');
    default: return withBase('/admin');
  }
}

// Rows from media_library_usage -> [{ area, label, places: [{ key, label, detail, href }] }], in the order of AREAS.
export function groupUsage(rows) {
  return AREAS.map((a) => ({
    area: a.value, label: a.label,
    places: (rows || []).filter((r) => r.area === a.value).map((r) => ({ key: `${r.area}:${r.ref_id}:${r.detail}`, label: r.label || '(untitled)', detail: r.detail || '', href: usageHref(r) })),
  })).filter((g) => g.places.length > 0);
}
export const countPlaces = (rows) => (rows || []).length;

/* ---------- the database ---------- */

// One page of results. `page` starts at 0. -> { items, total, error }
export async function searchImages(db, { query = '', tag = '', origin = '', use = '', area = '', page = 0 } = {}) {
  const { data, error } = await db.rpc('search_media_library', {
    p_query: query.trim(), p_tag: tag || null, p_origin: origin || null, p_use: use || null, p_area: area || null, p_limit: PAGE_SIZE, p_offset: page * PAGE_SIZE,
  });
  if (error) return { items: [], total: 0, error: error.message };
  const rows = data || [];
  return { items: rows.map(({ total_count, ...item }) => item), total: rows.length ? Number(rows[0].total_count) : 0, error: '' };
}

export async function loadTags(db) {
  const { data } = await db.from('media_library_tag_counts').select('tag, n').order('n', { ascending: false }).order('tag');
  return data || [];
}

export async function loadUsage(db, mediaId) {
  const { data, error } = await db.from('media_library_usage').select('area, detail, ref_id, ref_slug, label').eq('media_id', mediaId);
  return { rows: data || [], error: error ? error.message : '' };
}

export async function saveDescription(db, id, draft) {
  const { error } = await db.from('media_library').update(rowFromDraft(draft)).eq('id', id);
  return { error: error ? error.message : '' };
}

// Only an image nothing uses can be removed: a used one is a picture that would vanish from a page. The check is made again here,
// right before removing, in case something started using it since the screen was opened.
export async function deleteImage(db, item) {
  const { rows, error: usageError } = await loadUsage(db, item.id);
  if (usageError) return { ok: false, error: usageError };
  if (rows.length > 0) return { ok: false, error: `It is used in ${rows.length} place${rows.length === 1 ? '' : 's'}, so it cannot be removed.`, usage: rows };
  if (item.storage_path && item.origin !== 'linked') {
    const { error } = await db.storage.from('images').remove([item.storage_path]);
    if (error) return { ok: false, error: error.message };
  }
  const { error } = await db.from('media_library').delete().eq('id', item.id);   // the storage trigger already removed it for a hosted file; this makes sure, and removes a link
  return error ? { ok: false, error: error.message } : { ok: true };
}

// Hosted images made by this site's own uploads are all .webp. Only those can be replaced in place.
export const canReplaceFile = (item) => item.origin !== 'linked' && /\.webp$/i.test(item.storage_path || '');

// The new picture is stored at the SAME address, so every place that uses the image shows the new one. `blob` is already sized and encoded.
export async function replaceImageFile(db, item, blob, size = {}) {
  if (!canReplaceFile(item)) return { ok: false, error: 'This image cannot be replaced in place.' };
  const { error } = await db.storage.from('images').upload(item.storage_path, blob, { contentType: 'image/webp', upsert: true });
  if (error) return { ok: false, error: error.message };
  const facts = { mime_type: 'image/webp', size_bytes: blob.size ?? null, width: size.width || null, height: size.height || null };
  const { error: factsError } = await db.from('media_library').update(facts).eq('id', item.id);
  return { ok: true, facts, warning: factsError ? factsError.message : '' };
}

// Remembers a picture that is only linked from another website (a lesson's picture address, say) so it can be found and described.
// Never throws and never blocks what the admin was doing.
export async function ensureInLibrary(db, url, meta = {}) {
  const address = String(url || '').trim();
  if (!/^https:\/\/\S+$/i.test(address)) return { added: false };          // our own paths and anything odd are not "linked" images
  try {
    const { data: known } = await db.from('media_library').select('id').eq('url', address).maybeSingle();
    if (known) return { added: false };
    const { error } = await db.from('media_library').insert({
      url: address, origin: 'linked', title: meta.title || '', description: meta.description || '', credit: meta.credit || '',
      license: meta.license || 'Linked from another website, not copied.', tags: meta.tags || ['linked'], source_url: meta.source_url || null,
    });
    return { added: !error };
  } catch { return { added: false }; }
}
