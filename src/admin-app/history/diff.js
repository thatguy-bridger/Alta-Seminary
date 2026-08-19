// Turns a change_log row's raw before_data/after_data (full-row jsonb
// snapshots) into a human-readable diff: a list of {label, before, after}
// field changes, plus a separate "blocksChange" when the page/post builder
// content itself changed (draft_blocks or published_blocks), since that's
// rendered as a visual preview rather than as JSON -- see HistoryDetails.jsx.

const IGNORED_KEYS = new Set(['id', 'created_at', 'updated_at', 'draft_updated_at']);
const BLOCKS_KEYS = ['published_blocks', 'draft_blocks'];
const NESTED_OBJECT_KEYS = new Set(['extra_fields']);
export const IMAGE_KEYS = new Set(['photo_url', 'cover_image_url', 'image_url', 'og_image_url']);

function titleCase(key) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function valuesEqual(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

export function diffRecord(beforeData, afterData) {
  const before = beforeData || {};
  const after = afterData || {};
  const fieldChanges = [];
  let blocksChange = null;

  for (const key of BLOCKS_KEYS) {
    if (!(key in before) && !(key in after)) continue;
    const b = before[key];
    const a = after[key];
    if (!valuesEqual(b, a)) {
      blocksChange = { field: key, before: Array.isArray(b) ? b : [], after: Array.isArray(a) ? a : [] };
      break;
    }
  }

  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if (IGNORED_KEYS.has(key) || BLOCKS_KEYS.includes(key)) continue;
    const b = before[key];
    const a = after[key];
    if (valuesEqual(b, a)) continue;

    if (NESTED_OBJECT_KEYS.has(key) && (typeof b === 'object' || typeof a === 'object')) {
      const nb = b || {};
      const na = a || {};
      const nestedKeys = new Set([...Object.keys(nb), ...Object.keys(na)]);
      for (const nk of nestedKeys) {
        if (!valuesEqual(nb[nk], na[nk])) {
          fieldChanges.push({ key: nk, label: titleCase(nk), before: nb[nk], after: na[nk] });
        }
      }
      continue;
    }

    fieldChanges.push({ key, label: titleCase(key), before: b, after: a });
  }

  return { fieldChanges, blocksChange };
}

export function formatDiffValue(value) {
  if (value === null || value === undefined || value === '') return '(empty)';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string') return value.length > 140 ? value.slice(0, 140) + '…' : value;
  return JSON.stringify(value);
}
