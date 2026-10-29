import React from 'react';
import { supabaseBrowser } from '../../lib/supabase/browser-client';
import { Badge } from '../../design-system/components/core/Badge.jsx';
import { Button } from '../../design-system/components/forms/Button.jsx';
import { uploadImageFile } from '../imageUpload.js';
import { ImageDetail } from './ImageDetail.jsx';
import { useDebouncedValue, useImageSearch } from './useImageSearch.js';
import { ORIGINS, ORIGIN_LABEL, AREAS, imageName, factsLine, usageLabel, loadTags } from './imageLibrary.js';

const small = { fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)', margin: 0 };
const control = { flex: '1 1 150px', display: 'flex', flexDirection: 'column', gap: 4, fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-secondary)' };

// Every picture on the site in one place, with the information that makes each one findable. Type a word to search (the start of a
// word is enough, in the title, tags, description, alt text or credit), narrow by tag, where it came from, or where it is used,
// open one to describe it, see where it is used, replace it or remove it.
export function ImageLibrary({ db = supabaseBrowser }) {
  const [text, setText] = React.useState('');
  const [tag, setTag] = React.useState('');
  const [origin, setOrigin] = React.useState('');
  const [usedIn, setUsedIn] = React.useState('');         // '', 'used', 'unused', or a part of the site (see AREAS)
  const use = usedIn === 'used' || usedIn === 'unused' ? usedIn : '';
  const area = usedIn && !use ? usedIn : '';
  const [tags, setTags] = React.useState([]);
  const [openId, setOpenId] = React.useState(null);
  const [upload, setUpload] = React.useState({ busy: false, text: '', bad: false });
  const fileRef = React.useRef(null);

  const query = useDebouncedValue(text, 250);
  const search = useImageSearch({ query, tag, origin, use, area }, { db });
  const refreshTags = React.useCallback(() => loadTags(db).then(setTags), [db]);
  React.useEffect(() => { refreshTags(); }, [refreshTags]);

  const open = search.items.find((i) => i.id === openId) || null;
  const filtered = Boolean(query.trim() || tag || origin || use || area);
  const clear = () => { setText(''); setTag(''); setOrigin(''); setUsedIn(''); };

  async function addFiles(files) {
    const list = [...(files || [])];
    if (!list.length) return;
    setUpload({ busy: true, text: '', bad: false });
    let done = 0; const failed = [];
    for (let i = 0; i < list.length; i++) {
      setUpload({ busy: true, text: `Uploading ${i + 1} of ${list.length}…`, bad: false });
      try { await uploadImageFile(list[i], 'library'); done += 1; } catch (e) { failed.push(`${list[i].name || 'a file'}: ${e.message || 'could not be uploaded'}`); }
    }
    setUpload({ busy: false, bad: failed.length > 0, text: [done ? `Added ${done} picture${done === 1 ? '' : 's'}. Open one to describe it.` : '', ...failed].filter(Boolean).join(' ') });
    clear(); search.reload(); refreshTags();
  }

  return (
    <div className="gl" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <p style={{ ...small, fontSize: 'var(--fs-small)' }}>
        Every picture used on the site, with what is known about it. Pictures are added here automatically whenever one is uploaded anywhere. Describe them so they are easy to find.
      </p>

      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ ...control, flex: '2 1 240px' }}>Search
          <input className="input" type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Try a name, a place, a tag, a word from the description…" aria-label="Search pictures" />
        </label>
        <label style={control}>Tag
          <select className="select" value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Tag">
            <option value="">All tags</option>
            {tags.map((t) => <option key={t.tag} value={t.tag}>{t.tag} ({t.n})</option>)}
          </select>
        </label>
        <label style={control}>Where it came from
          <select className="select" value={origin} onChange={(e) => setOrigin(e.target.value)} aria-label="Where it came from">
            <option value="">Anywhere</option>
            {ORIGINS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label style={control}>Where it is used
          <select className="select" value={usedIn} onChange={(e) => setUsedIn(e.target.value)} aria-label="Where it is used">
            <option value="">Anywhere or nowhere</option>
            <option value="used">Used somewhere</option>
            <option value="unused">Not used anywhere</option>
            {AREAS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </label>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <Button variant="outline" size="sm" disabled={upload.busy} onClick={() => fileRef.current?.click()}>{upload.busy ? 'Uploading…' : 'Add pictures'}</Button>
          <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} aria-label="Choose pictures to add" onChange={(e) => { const f = e.target.files; addFiles(f); e.target.value = ''; }} />
          {filtered && <Button variant="ghost" size="sm" onClick={clear}>Clear</Button>}
        </div>
      </div>

      <p role="status" aria-live="polite" style={{ ...small, minHeight: '1.2em', color: upload.bad ? 'var(--color-error)' : upload.text ? 'var(--color-success)' : 'var(--text-muted)' }}>
        {upload.text || (search.loaded && !search.error ? `${search.total} picture${search.total === 1 ? '' : 's'}${filtered ? ' match' : ' in the library'}` : '')}
      </p>

      {search.error && <p role="alert" style={{ color: 'var(--color-error)', fontSize: 'var(--fs-small)', margin: 0 }}>Couldn't load the pictures: {search.error}</p>}
      {!search.loaded && !search.error && <p style={small}>Loading…</p>}
      {search.loaded && !search.error && search.items.length === 0 && (
        <p style={{ ...small, fontSize: 'var(--fs-small)' }}>{filtered ? 'No picture matches that. Try fewer words, or clear the filters.' : 'No pictures yet. Add one and it will appear here.'}</p>
      )}

      <div className="gl-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 'var(--space-3)' }}>
        {search.items.map((item) => (
          <button key={item.id} type="button" className="gl-card" onClick={() => setOpenId(item.id)} aria-label={`Open ${imageName(item)}`}
            style={{ textAlign: 'left', padding: 0, border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', background: 'var(--surface-card)', cursor: 'pointer', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <img src={item.url} alt="" loading="lazy" style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', display: 'block', background: 'var(--surface-sunken)' }} />
            <span style={{ padding: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: 4, fontFamily: 'var(--font-sans)' }}>
              <span className="gl-title" style={{ fontSize: 'var(--fs-small)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{imageName(item)}</span>
              <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <Badge tone="neutral">{ORIGIN_LABEL[item.origin] || item.origin}</Badge>
                <Badge tone={item.usage_count > 0 ? 'success' : 'warning'}>{item.usage_count > 0 ? usageLabel(item.usage_count) : 'Not used'}</Badge>
              </span>
              {factsLine(item) && <span style={small}>{factsLine(item)}</span>}
            </span>
          </button>
        ))}
      </div>

      {search.hasMore && <div><Button variant="outline" disabled={search.loading} onClick={search.loadMore}>{search.loading ? 'Loading…' : `Show more (${search.total - search.items.length} left)`}</Button></div>}

      {open && (
        <ImageDetail key={open.id} item={open} db={db} suggestions={tags.map((t) => t.tag)} onClose={() => setOpenId(null)}
          onChanged={(updated) => { search.patch(updated.id, updated); refreshTags(); }}
          onRemoved={(id) => { setOpenId(null); search.remove(id); refreshTags(); }} />
      )}
    </div>
  );
}
