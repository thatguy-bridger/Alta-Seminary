import React from 'react';
import { Button } from '../../../design-system/components/forms/Button.jsx';
import { Switch } from '../../../design-system/components/forms/Switch.jsx';
import { thumbnailFor, paintingFor, paintingCredit } from '../../../makeup/thumbnails.js';
import { kindInfo, needsAttention } from '../../../makeup/lessonsModel.js';
import { formatTimestamp } from '../../../makeup/transcript.js';
import { byline } from '../../../makeup/byline.js';

// One lesson as a card: its picture, its type, what it is, and the few things worth knowing at a glance.
export function LessonCard({ lesson: l, onEdit, onToggle }) {
  const t = thumbnailFor(l);
  const fallback = paintingFor(l.id || l.title);
  const problems = needsAttention(l);
  const meta = byline(l);
  const pauses = Array.isArray(l.pauses) ? l.pauses.length : 0;
  const tags = [
    l.duration_seconds ? formatTimestamp(l.duration_seconds) : `${l.minutes} min`,
    l.one_time && 'Once per student',
    pauses > 0 && `${pauses} question${pauses > 1 ? 's' : ''}`,
    l.guide_line && 'Own guiding line',
    Number.isFinite(l.min_seconds) && 'Set time',
  ].filter(Boolean);
  const cannotShow = !l.active && problems.length > 0;

  return (
    <article className={`ls-card${l.active ? '' : ' off'}`} aria-label={l.title}>
      <button type="button" className="ls-thumb" onClick={onEdit} aria-label={`Edit ${l.title}`}>
        <img src={t.src} alt="" loading="lazy" title={t.painting ? paintingCredit(t.painting) : undefined}
          onError={(e) => { if (!e.currentTarget.dataset.fell) { e.currentTarget.dataset.fell = '1'; e.currentTarget.src = fallback.src; } }} />
        <span className="ls-badge type">{kindInfo(l.kind).label}</span>
        {!l.active && <span className="ls-badge state">Hidden</span>}
      </button>
      <div className="ls-body">
        <h4 className="ls-title">{l.title}</h4>
        {meta && <p className="ls-meta" title={meta}>{meta}</p>}
        <ul className="ls-tags">
          {tags.map((x) => <li key={x} className="ls-tag">{x}</li>)}
          {problems.map((x) => <li key={x} className="ls-tag warn">{x}</li>)}
        </ul>
      </div>
      <div className="ls-actions">
        <Button variant="outline" size="sm" onClick={onEdit}>Edit</Button>
        <span className="grow" />
        <label className="shown" title={cannotShow ? `Cannot be shown yet: ${problems.join(', ').toLowerCase()}` : undefined}>
          <Switch checked={!!l.active} disabled={cannotShow} label={`Show ${l.title} to students`} onChange={(e) => onToggle(e.target.checked)} /> Shown
        </label>
      </div>
    </article>
  );
}
