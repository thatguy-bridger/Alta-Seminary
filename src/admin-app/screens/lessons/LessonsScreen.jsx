import React from 'react';
import './lessons.css';
import { supabaseBrowser } from '../../../lib/supabase/browser-client';
import { Button } from '../../../design-system/components/forms/Button.jsx';
import { Input } from '../../../design-system/components/forms/Input.jsx';
import { Select } from '../../../design-system/components/forms/Select.jsx';
import { withBase } from '../../../lib/url.js';
import { typeTabs, collectionsFor, filterLessons, sectionsFor, needsAttention, kindInfo } from '../../../makeup/lessonsModel.js';
import { LessonCard } from './LessonCard.jsx';
import { LessonEditor } from './LessonEditor.jsx';

const PER_SECTION = 12;                    // cards shown per collection before "Show all"
const small = { fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)', margin: 0 };

function fromUrl() {
  if (typeof window === 'undefined') return null;
  const q = new URLSearchParams(window.location.search);
  if (q.get('edit')) return { id: q.get('edit') };
  if (q.get('new')) return { id: null, kind: q.get('new') === '1' ? 'scripture' : q.get('new') };
  return null;
}
function setUrl(params) {
  try { window.history.replaceState({}, '', `${window.location.pathname}${params ? `?${params}` : ''}`); } catch { /* not a browser */ }
}

// Every lesson, organised: type tabs, then collections (the books of scripture, the conferences...), then cards with
// a picture each. Open one to edit it from beginning to end.
export function LessonsScreen() {
  const [lessons, setLessons] = React.useState(null);
  const [error, setError] = React.useState('');
  const [filters, setFilters] = React.useState({ kind: '', collection: '', status: '', q: '' });
  const [open, setOpen] = React.useState({});          // collections expanded past the first few cards
  const [editing, setEditing] = React.useState(fromUrl);
  const [msg, setMsg] = React.useState('');
  const flash = React.useCallback((m) => { setMsg(m); setTimeout(() => setMsg(''), 3500); }, []);

  const load = React.useCallback(async () => {
    const { data, error: e } = await supabaseBrowser.from('admin_makeup_lessons').select('*').order('sort_order').order('title').limit(2000);
    if (e) setError(e.message); else { setError(''); setLessons(data || []); }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  const edit = (target) => { setEditing(target); setUrl(target ? (target.id ? `edit=${target.id}` : `new=${target.kind || 1}`) : ''); window.scrollTo?.(0, 0); };
  const closeEditor = () => { edit(null); load(); };

  async function toggle(l, on) {
    setLessons((all) => all.map((x) => (x.id === l.id ? { ...x, active: on } : x)));
    const { error: e } = await supabaseBrowser.from('makeup_sources').update({ active: on }).eq('id', l.id);
    if (e) { flash(`Couldn't save: ${e.message}`); load(); }
  }
  async function bulk(section, on) {
    const ids = section.lessons.filter((l) => !!l.active !== on && (!on || !needsAttention(l).length)).map((l) => l.id);
    if (!ids.length) { flash(on ? 'Everything here that can be shown already is.' : 'Everything here is already hidden.'); return; }
    const { error: e } = await supabaseBrowser.from('makeup_sources').update({ active: on }).in('id', ids);
    if (e) flash(`Couldn't save: ${e.message}`); else flash(`${on ? 'Showing' : 'Hiding'} ${ids.length} lesson${ids.length > 1 ? 's' : ''}.`);
    load();
  }

  async function bulkPictures(section, on) {
    const ids = section.lessons.filter((l) => !!l.show_images !== on).map((l) => l.id);
    if (!ids.length) { flash(on ? 'Pictures are already on for everything here.' : 'Pictures are already off for everything here.'); return; }
    const { error: e } = await supabaseBrowser.from('makeup_sources').update({ show_images: on }).in('id', ids);
    if (e) flash(`Couldn't save: ${e.message}`); else flash(`Pictures ${on ? 'on' : 'off'} for ${ids.length} lesson${ids.length > 1 ? 's' : ''}.`);
    load();
  }

  if (editing) return <LessonEditor key={editing.id || 'new'} id={editing.id} initialKind={editing.kind} onClose={closeEditor} onOpen={(id) => edit({ id })} onSaved={load} flash={flash} msg={msg} />;
  if (error) return <p role="alert" style={{ color: 'var(--color-error)' }}>Couldn't load the lessons: {error}</p>;
  if (!lessons) return <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>;

  const tabs = typeTabs(lessons);
  const collections = filters.kind ? collectionsFor(lessons, filters.kind) : [];
  const results = filterLessons(lessons, filters);
  const sections = sectionsFor(results);
  const attention = lessons.filter((l) => needsAttention(l).length).length;
  const shownCount = lessons.filter((l) => l.active).length;
  const set = (patch) => setFilters((f) => ({ ...f, ...patch }));
  const filtered = filters.kind || filters.collection || filters.status || filters.q;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <p style={{ margin: 0 }}><a href={withBase('/admin/makeup-work')}>← Makeup Work</a></p>
          <h2 style={{ margin: '4px 0 2px', fontFamily: 'var(--font-display)' }}>Lessons</h2>
          <p style={small}>{lessons.length} lessons, {shownCount} shown to students{attention ? `, ${attention} need attention` : ''}.</p>
        </div>
        <a className="btn btn-outline btn-sm" href={withBase('/admin/makeup-work/test')} style={{ textDecoration: 'none' }}>Try as a student</a>
        <Button variant="primary" onClick={() => edit({ id: null, kind: filters.kind || 'scripture' })}>+ New lesson</Button>
      </div>
      {msg && <p role="status" style={small}>{msg}</p>}

      <ul className="ls-tabs" aria-label="Types of lesson">
        {tabs.map((t) => (
          <li key={t.value}><button type="button" className="ls-tab" aria-pressed={filters.kind === t.value} onClick={() => set({ kind: t.value, collection: '' })}>{t.label === 'All' ? 'All lessons' : t.plural} <b>{t.count}</b></button></li>
        ))}
      </ul>
      {filters.kind && <p style={small}>{kindInfo(filters.kind).blurb}</p>}
      {collections.length > 1 && (
        <div className="ls-chips" role="group" aria-label="Collections">
          <button type="button" className="ls-chipbtn" aria-pressed={!filters.collection} onClick={() => set({ collection: '' })}>All collections</button>
          {collections.map((c) => <button key={c.name} type="button" className="ls-chipbtn" aria-pressed={filters.collection === c.name} onClick={() => set({ collection: c.name })}>{c.name} ({c.count})</button>)}
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '2 1 240px' }}><Input label="Search lessons" value={filters.q} onChange={(e) => set({ q: e.target.value })} placeholder="Title, scripture, speaker, type…" /></div>
        <div style={{ flex: '1 1 180px' }}>
          <Select label="Show" value={filters.status} onChange={(e) => set({ status: e.target.value })}
            options={[{ value: '', label: 'Everything' }, { value: 'shown', label: 'Shown to students' }, { value: 'hidden', label: 'Hidden' }, { value: 'attention', label: `Needs attention (${attention})` }]} />
        </div>
        {filtered && <Button variant="ghost" size="sm" onClick={() => setFilters({ kind: '', collection: '', status: '', q: '' })}>Clear filters</Button>}
      </div>

      {results.length === 0 && <p style={small}>{lessons.length === 0 ? 'No lessons yet. Press "New lesson" to add the first.' : 'No lessons match. Try clearing a filter.'}</p>}
      {sections.map((s) => {
        const many = s.lessons.length > PER_SECTION && !open[s.key];
        const cards = many ? s.lessons.slice(0, PER_SECTION) : s.lessons;
        const on = s.lessons.filter((l) => l.active).length;
        return (
          <section key={s.key} className="ls-section" aria-label={s.name}>
            <div className="ls-sechead">
              <h3>{filters.kind ? s.name : `${kindInfo(s.kind).plural}: ${s.name}`}</h3>
              <span className="count">{s.lessons.length} lesson{s.lessons.length > 1 ? 's' : ''}, {on} shown</span>
              <span className="spacer" />
              <Button variant="ghost" size="sm" onClick={() => bulk(s, true)}>Show all</Button>
              <Button variant="ghost" size="sm" onClick={() => bulk(s, false)}>Hide all</Button>
              <Button variant="ghost" size="sm" onClick={() => bulkPictures(s, true)}>Pictures on</Button>
              <Button variant="ghost" size="sm" onClick={() => bulkPictures(s, false)}>Pictures off</Button>
            </div>
            <div className="ls-grid">
              {cards.map((l) => <LessonCard key={l.id} lesson={l} onEdit={() => edit({ id: l.id })} onToggle={(on2) => toggle(l, on2)} />)}
            </div>
            {many && <div><Button variant="outline" size="sm" onClick={() => setOpen((o) => ({ ...o, [s.key]: true }))}>Show all {s.lessons.length}</Button></div>}
          </section>
        );
      })}
    </div>
  );
}
