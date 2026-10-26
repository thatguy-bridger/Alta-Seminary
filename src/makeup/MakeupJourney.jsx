import React from 'react';
import './journey.css';
import logo from '../assets/alta-seminary-logo.png';
import { withBase } from '../lib/url.js';
import {
  STEPS, RULES, initialState, canAdvance, sourcesNeeded, wordsNeeded, voiceSecondsNeeded, estimateMinutes, wordCount,
} from './journey.js';
import { GROUPS, groupOf, AV_KINDS, WORDS, STARTERS, STYLES, FEEL_HEAD, INVITES, CLOSERS, PASS_ON } from './content.js';
import { TILE_URLS, SUN_TOP, FILL_GRAY, paletteAt, duotoneFor, stageBottomColor, rollScene, lerp, hex, mixc } from './scene.js';
import { mediaKind } from './media.js';
import { currentIndex, formatTimestamp, timestampRef, playedFraction } from './transcript.js';
import { useMediaPlayer } from './useMediaPlayer.js';
import { useEffortTracker } from './useEffortTracker.js';
import { analyzeEffort, formatDuration } from './effort.js';
import { buildSubmission } from './submission.js';
import { composeTeacherEmail } from './teacherEmail.js';
import { silentWavUrl } from './sampleContent.js';
import { artFor, artCredit } from './art.js';
import { useSoundscape } from './useSoundscape.js';
import { VoiceAnswer } from './VoiceAnswer.jsx';
import { splitParagraphs, cleanPauses, nextDuePause, allAnswered, pauseKey, pauseWhere, answersPayload, PAUSE_MIN_WORDS } from './pauses.js';
import { thumbnailFor, paintingFor, paintingCredit } from './thumbnails.js';
import { byline } from './byline.js';
import { glideTo, stopGlide, prefersReducedMotion } from './glide.js';
import { speechSupported } from './useSpeech.js';
import { NotesButton, NotesPanel, takeNotesHint } from './Notes.jsx';
import { readProgress, writeProgress, clearProgress, hasProgress, emptyTotals, learnKey } from './progress.js';

const N = STEPS.length;
const WATCHED_ENOUGH = 0.75;
const RIDGE_PTS = [[0, 22], [9, 12], [17, 18], [27, 5], [37, 16], [46, 9], [57, 19], [68, 4], [79, 14], [88, 8], [100, 15]];

/* ---------- sound: a speaker button, and quiet options ---------- */
function SoundControl({ sound }) {
  const [open, setOpen] = React.useState(false);
  if (!sound.supported) return null;
  const { prefs } = sound;
  return (
    <div className="mw-sound">
      <button type="button" className="mw-sbtn" aria-pressed={prefs.on} aria-label={prefs.on ? 'Sound is on. Turn sound off' : 'Sound is off. Turn sound on'} onClick={() => sound.update({ on: !prefs.on })}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z" />{prefs.on ? <><path d="M16 9a4 4 0 0 1 0 6" /><path d="M18.5 6.5a8 8 0 0 1 0 11" /></> : <path d="M17 9l5 6M22 9l-5 6" />}</svg>
      </button>
      <button type="button" className="mw-sbtn small" aria-expanded={open} aria-label="Sound options" onClick={() => setOpen((o) => !o)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="mw-spanel" role="group" aria-label="Sound options">
          <label><input type="checkbox" checked={prefs.music} onChange={(e) => sound.update({ music: e.target.checked })} /> Quiet music</label>
          <label><input type="checkbox" checked={prefs.fx} onChange={(e) => sound.update({ fx: e.target.checked })} /> Soft sounds</label>
          <label className="vol">Volume<input type="range" min="0" max="1" step="0.05" value={prefs.volume} onChange={(e) => sound.update({ volume: Number(e.target.value) })} aria-label="Volume" /></label>
          {!prefs.on && <p className="mw-fine">Sound is off. Tap the speaker to turn it on.</p>}
        </div>
      )}
    </div>
  );
}

/* ---------- a painting of the Savior at the top of each step ---------- */
function StepArt({ step, short }) {
  const art = artFor(step);
  if (!art) return null;
  return (
    <figure className={`mw-art${short ? ' short' : ''}`}>
      <img src={withBase(art.src)} alt={art.alt} loading="eager" decoding="async" />
      <figcaption>{artCredit(art)}</figcaption>
    </figure>
  );
}

/* ---------- the mountain scene ---------- */
function Scene({ stage, stepRaw, page = false }) {
  const uid = React.useId().replace(/:/g, '');
  const [layers] = React.useState(() => rollScene());
  const sunRef = React.useRef(null);
  const stripRefs = React.useRef([]);
  const filterRefs = React.useRef([]);
  const cur = React.useRef(null);
  const raf = React.useRef(0);

  // On a phone the stage ends where the browser's toolbar begins, and the page's own background shows through under it.
  // While the journey is open, the page takes the color the stage ends in, and gives its own back afterwards.
  React.useEffect(() => {
    if (!page) return undefined;
    const els = [document.documentElement, document.body];
    const before = els.map((el) => [el.style.backgroundColor, el.style.transition]);
    els.forEach((el) => { el.style.transition = 'none'; });         // follow the stage frame by frame, not a beat behind it
    return () => els.forEach((el, i) => { el.style.backgroundColor = before[i][0]; el.style.transition = before[i][1]; });
  }, [page]);

  React.useEffect(() => {
    if (!stage.current) return undefined;
    const { i0, f, colors } = paletteAt(stepRaw);
    stage.current.style.setProperty('--s-bg', colors[0]);
    stage.current.classList.toggle('day', stepRaw >= 3.6);
    if (sunRef.current) sunRef.current.style.top = lerp(SUN_TOP[i0], SUN_TOP[i0 + 1], f).toFixed(1) + '%';
    stripRefs.current.forEach((el, i) => { if (el) el.style.backgroundPositionX = (layers[i].off - stepRaw * layers[i].par * 140) + 'px'; });
    const target = duotoneFor(colors, stepRaw);
    const from = cur.current || target, start = performance.now();
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    cancelAnimationFrame(raf.current);
    const set = (cols) => {
      cols.forEach(([D, L], i) => {
        const f2 = filterRefs.current[i]; if (!f2) return;
        const d = hex(D), l = hex(L);
        ['R', 'G', 'B'].forEach((ch, k) => f2.querySelector('feFunc' + ch).setAttribute('tableValues', (d[k] / 255).toFixed(3) + ' ' + (l[k] / 255).toFixed(3)));
      });
      if (page) document.documentElement.style.backgroundColor = document.body.style.backgroundColor = stageBottomColor(cols[cols.length - 1]);
    };
    if (page) set(from);       // no flash of the site's own background before the first frame
    const run = (n) => {
      const u = reduce ? 1 : Math.min(1, (n - start) / 1200);
      set(target.map((pair, i) => pair.map((c, k) => mixc(from[i][k], c, u))));
      if (u < 1) raf.current = requestAnimationFrame(run); else cur.current = target;
    };
    raf.current = requestAnimationFrame(run);
    return () => cancelAnimationFrame(raf.current);
  }, [stepRaw, layers, stage, page]);

  return (
    <div className="mw-scene" aria-hidden="true">
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          {[0, 1, 2].map((i) => (
            <filter key={i} id={`mwduo${uid}${i}`} ref={(el) => { filterRefs.current[i] = el; }} colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
              <feColorMatrix type="matrix" values="0.333 0.333 0.333 0 0 0.333 0.333 0.333 0 0 0.333 0.333 0.333 0 0 0 0 0 1 0" />
              <feComponentTransfer><feFuncR type="table" tableValues="0 1" /><feFuncG type="table" tableValues="0 1" /><feFuncB type="table" tableValues="0 1" /></feComponentTransfer>
            </filter>
          ))}
        </defs>
      </svg>
      <div className="mw-sun" ref={sunRef} style={{ top: '88%' }} />
      {layers.map((l, i) => {
        const h = Math.round(l.h * l.scale);
        return (
          <div key={i} className="mw-mt" style={{ height: l.bottom + h, filter: `url(#mwduo${uid}${i})` }}>
            <div className="fill" style={{ height: l.bottom + 26, background: `rgb(${FILL_GRAY},${FILL_GRAY},${FILL_GRAY})` }} />
            <div className="strip" ref={(el) => { stripRefs.current[i] = el; }}
              style={{ height: h, backgroundImage: `url(${withBase(TILE_URLS[l.key])})`, backgroundSize: 'auto 100%', backgroundPositionX: l.off, transform: l.flip ? 'scaleX(-1)' : undefined }} />
          </div>
        );
      })}
    </div>
  );
}

function RidgeProgress({ stepRaw }) {
  const svgRef = React.useRef(null);
  const [W, setW] = React.useState(600);
  React.useEffect(() => {
    const el = svgRef.current; if (!el) return undefined;
    const measure = () => setW(el.clientWidth || 600);
    measure();
    const ro = new ResizeObserver(measure); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const d = 'M' + RIDGE_PTS.map(([x, y]) => `${(x * W / 100).toFixed(1)},${y}`).join('L');
  const fullRef = React.useRef(null);
  const [dot, setDot] = React.useState({ x: 0, y: 22 });
  const u = Math.min(1, stepRaw / (N - 1));
  React.useEffect(() => {
    const p = fullRef.current; if (!p) return;
    const pt = p.getPointAtLength(p.getTotalLength() * u); setDot({ x: pt.x, y: pt.y });
  }, [u, d]);
  return (
    <div className="mw-ridge" aria-hidden="true">
      <svg ref={svgRef}>
        <path ref={fullRef} d={d} fill="none" stroke="var(--s-line)" strokeWidth="1.5" />
        <path d={d} fill="none" stroke="#a32030" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - u * 100} style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.22,.61,.36,1)' }} />
        <circle r="4" fill="#a32030" cx={dot.x} cy={dot.y} style={{ transition: 'cx 1.2s cubic-bezier(.22,.61,.36,1), cy 1.2s cubic-bezier(.22,.61,.36,1)' }} />
      </svg>
    </div>
  );
}

/* ---------- a pause question: it appears at a chosen moment, and its short answer goes to the teacher ---------- */
function PauseCard({ id, question, where, saved, draft = '', onDraft, onSave, fieldProps, actionLabel }) {
  const [text, setText] = React.useState(saved || draft || '');
  const [editing, setEditing] = React.useState(!saved);
  const ok = wordCount(text) >= PAUSE_MIN_WORDS;
  const props = fieldProps ? fieldProps(`pause-${id}`) : {};
  if (!editing && saved) {
    return (
      <div className="mw-pause saved">
        <div className="mw-pause-q">{question}</div>
        <p className="mw-pause-a">{saved}</p>
        <div><button type="button" className="mw-ghost" onClick={() => setEditing(true)}>Change my answer</button></div>
      </div>
    );
  }
  return (
    <div className="mw-pause" role="group" aria-label="A question to think about">
      <div className="mw-eyebrow">Pause and think{where ? ` · ${where}` : ''}</div>
      <label className="mw-pause-q" htmlFor={`mw-p-${id}`}>{question}</label>
      <textarea id={`mw-p-${id}`} placeholder="In your own words…" value={text} {...props} onChange={(e) => { if (props.onChange) props.onChange(e); setText(e.target.value); if (onDraft) onDraft(e.target.value); }} />
      <div className="mw-row" style={{ alignItems: 'center' }}>
        <button type="button" className="mw-cta" disabled={!ok} onClick={() => { onSave(text.trim()); setEditing(false); }}>{actionLabel}</button>
        <span className="mw-fine" aria-live="polite">{ok ? '' : `A few words, ${PAUSE_MIN_WORDS} or more.`}</span>
      </div>
    </div>
  );
}

/* ---------- learning: reading, and video/audio with a live transcript ---------- */
function Reader({ src, onDone, onSeconds, answers = {}, onAnswer = () => {}, drafts = {}, onDraft = () => {}, startSeconds = 0, fieldProps }) {
  const text = src.body || '';
  const paras = splitParagraphs(text);
  const pauses = cleanPauses(src.pauses, { text: true, paragraphs: paras.length });
  const auto = Math.max(20, Math.ceil((wordCount(text) / 200) * 60 * 0.6));
  const need = Number.isFinite(src.min_seconds) ? src.min_seconds : auto;   // an admin can set the time for a lesson
  const [t, setT] = React.useState(startSeconds);
  React.useEffect(() => { const id = setInterval(() => setT((x) => x + 1), 1000); return () => clearInterval(id); }, []);
  const timed = t >= need;
  const answered = allAnswered(src.id, pauses, answers);
  const done = timed && answered;
  React.useEffect(() => { onSeconds(t); if (done) onDone(true); }, [t, done]); // eslint-disable-line react-hooks/exhaustive-deps

  // The text in pieces, with each question right after the paragraph it belongs to.
  const sep = text.trim().split(/\n{2,}/).filter(Boolean).length > 1 ? '\n\n' : '\n';
  const pieces = [];
  let from = 0;
  for (const at of [...pauses.map((p) => p.at), paras.length]) { if (at > from) { pieces.push({ text: paras.slice(from, at).join(sep), after: at }); from = at; } }
  return (
    <>
      <div className="mw-readwrap">
        {pieces.length === 0 && <div className="mw-reader" onCopy={(e) => e.preventDefault()} onContextMenu={(e) => e.preventDefault()}>{src.reference && <div className="ref">{src.reference}</div>}<p>Open your scriptures to {src.reference || 'the passage'} and read it slowly.</p></div>}
        {pieces.map((piece, i) => (
          <React.Fragment key={piece.after}>
            <div className="mw-reader" onCopy={(e) => e.preventDefault()} onContextMenu={(e) => e.preventDefault()}>
              {i === 0 && src.reference && <div className="ref">{src.reference}</div>}
              <p>{piece.text}</p>
            </div>
            {pauses.filter((p) => p.at === piece.after).map((p) => {
              const key = pauseKey(src.id, p);
              return <PauseCard key={key} id={key} question={p.question} where={pauseWhere(true, p.at, formatTimestamp)} saved={answers[key]} draft={drafts[key]} onDraft={(txt) => onDraft(key, txt)} onSave={(txt) => { onAnswer(key, txt); onDraft(key, ''); }} fieldProps={fieldProps} actionLabel="Save my answer" />;
            })}
          </React.Fragment>
        ))}
      </div>
      <div className="mw-stay"><span>{done ? 'Thank you for staying with it' : timed && !answered ? 'Answer the question above to continue.' : 'Read slowly. We will wait with you.'}</span><div className="mw-meter"><b style={{ width: Math.min(100, (t / Math.max(need, 1)) * 100) + '%' }} /></div></div>
    </>
  );
}

function MediaStage({ src, mediaUrl, mediaType, cites, onCite, onProgress, skipEnabled, answers = {}, onAnswer = () => {}, drafts = {}, onDraft = () => {}, resume, registerMedia, fieldProps }) {
  const duration = src.duration_seconds || 0;
  const p = useMediaPlayer({ url: mediaUrl, type: mediaType, durationHint: duration, resume });
  // Lets the page ask where the player is, and which seconds were played, whenever it saves the student's place.
  const latestPlayer = React.useRef(p); latestPlayer.current = p;
  React.useEffect(() => {
    if (!registerMedia) return undefined;
    registerMedia(() => ({ time: latestPlayer.current.time, ...latestPlayer.current.exportPlayed() }));
    return () => registerMedia(null);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const segs = src.transcript || [];
  const total = p.duration || duration;
  const idx = currentIndex(segs, p.time);
  const listRef = React.useRef(null);
  const lineRefs = React.useRef([]);
  const pauses = cleanPauses(src.pauses, { lengthSeconds: total });
  const due = nextDuePause(src.id, pauses, p.time, answers);                    // a question whose moment has come
  const need = Number.isFinite(src.min_seconds) ? Math.min(src.min_seconds, total || src.min_seconds) : null;   // an admin can set the time for a lesson
  const enough = need !== null ? p.played >= need : playedFraction(p.played, total) >= WATCHED_ENOUGH;
  const answered = allAnswered(src.id, pauses, answers);
  const done = enough && answered;
  React.useEffect(() => { if (due && p.playing) p.pause(); }, [due && due.at, p.playing]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => { onProgress({ played: p.played, duration: total, done, playing: p.playing, mutedPlayed: p.mutedPlayed }); }, [p.played, p.mutedPlayed, total, done, p.playing]); // eslint-disable-line react-hooks/exhaustive-deps
  // The transcript follows the talk by default. If the student scrolls away it stops following and offers a way back; it
  // follows again on its own once the current line has been scrolled back to its resting place near the middle.
  const REST = 0.38;
  const [following, setFollowing] = React.useState(true);
  const followRef = React.useRef(true); followRef.current = following;
  const idxRef = React.useRef(idx); idxRef.current = idx;
  const wentAway = React.useRef(false);
  const [dir, setDir] = React.useState('down');           // where the current line is from where the student is looking: 'up' or 'down'
  const settleTimer = React.useRef(0);
  const distFromRest = () => {
    const box = listRef.current, el = lineRefs.current[idxRef.current];
    return box && el ? Math.abs(el.offsetTop + el.offsetHeight / 2 - box.scrollTop - box.clientHeight * REST) : null;
  };
  // Which way is the current line? Above its resting place means the student has scrolled down past it, so the way back is up.
  const aim = () => {
    const box = listRef.current, el = lineRefs.current[idxRef.current];
    if (!box || !el) return;
    const d = el.offsetTop + el.offsetHeight / 2 - box.scrollTop - box.clientHeight * REST;
    if (d < -6) setDir('up'); else if (d > 6) setDir('down');
  };
  const leaveSync = (e) => {
    stopGlide(listRef.current); wentAway.current = false;
    if (!followRef.current) return;
    setFollowing(false);
    // Before the box has moved we go by which way they pushed: scrolling down sends the current line up.
    if (e && e.deltaY) setDir(e.deltaY > 0 ? 'up' : 'down');
    else if (e && e.key) setDir(['ArrowDown', 'PageDown', 'End'].includes(e.key) ? 'up' : 'down');
  };
  const checkCentered = () => {
    if (followRef.current) return;
    aim();
    const box = listRef.current, el = lineRefs.current[idxRef.current];
    const dist = distFromRest();
    if (dist === null) return;
    const near = Math.max(box.clientHeight * 0.14, el.offsetHeight * 0.75);
    clearTimeout(settleTimer.current);
    if (dist > box.clientHeight * 0.3) wentAway.current = true;
    if (dist <= near && wentAway.current) { setFollowing(true); return; }          // scrolled away, and brought the current line back
    settleTimer.current = setTimeout(() => { const d = distFromRest(); if (d !== null && d <= near) setFollowing(true); }, 900);   // or only nudged, and it is still in place
  };
  React.useEffect(() => { // let the spoken line drift to its resting place, slowly, without moving the page
    if (!following) return;
    const box = listRef.current, el = lineRefs.current[idx];
    if (!box || !el) return;
    glideTo(box, el.offsetTop - box.clientHeight * REST + el.offsetHeight / 2, { reduced: prefersReducedMotion() });
  }, [idx, following]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { if (!following) aim(); }, [idx, following]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => () => { clearTimeout(settleTimer.current); stopGlide(listRef.current); }, []);
  const seekTo = (t) => { setFollowing(true); p.seek(t); p.play(); };

  const citedAt = new Set(cites.filter((c) => c.sourceId === src.id).map((c) => Math.round(c.seconds)));
  return (
    <>
      {due && (() => {
        const key = pauseKey(src.id, due);
        return <PauseCard key={key} id={key} question={due.question} where={pauseWhere(false, due.at, formatTimestamp)} saved="" draft={drafts[key]} onDraft={(txt) => onDraft(key, txt)} onSave={(txt) => { onAnswer(key, txt); onDraft(key, ''); p.play(); }} fieldProps={fieldProps} actionLabel="Keep going" />;
      })()}
      <div className="mw-av">
        <div className={`mw-media ${mediaType === 'audio' ? 'audio' : 'vid'}`}>
          {mediaType === 'audio' ? (
            <>
              {src.show_images && <div className="cover"><img src={thumbnailFor(src).src} alt="" /></div>}
              <audio ref={p.mediaRef} src={mediaUrl} controls preload="metadata" aria-label={src.title} />
            </>
          ) : mediaType === 'video' ? (
            <div className="frame"><video ref={p.mediaRef} src={mediaUrl} controls playsInline preload="metadata" aria-label={src.title} /></div>
          ) : (
            <div className="frame"><div ref={p.hostRef} /></div>
          )}
        </div>
        <div className="mw-txwrap">
        <div className="mw-tx" ref={listRef} role="region" aria-label="Transcript" onWheel={leaveSync} onTouchMove={leaveSync} onScroll={checkCentered}
          onKeyDown={(e) => { if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) leaveSync(e); }}>
          <h3 className="mw-vh">Transcript</h3>
          <div className="mw-tx-pad top" aria-hidden="true" />
          {segs.map((s, i) => (
            <div key={i} ref={(el) => { lineRefs.current[i] = el; }} className={`mw-line${i === idx ? ' on' : ''}${citedAt.has(Math.round(s.start)) ? ' cited' : ''}`}
              style={{ '--d': idx < 0 ? Math.min(i + 1, 7) : Math.min(Math.abs(i - idx), 7) }}
              role="button" tabIndex={0} aria-current={i === idx ? 'true' : undefined}
              onClick={() => seekTo(s.start)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); seekTo(s.start); } }}>
              <span className="t">{formatTimestamp(s.start)}</span>
              <span className="x">{s.text}</span>
              <button type="button" className="mw-cite" onClick={(e) => { e.stopPropagation(); onCite({ sourceId: src.id, title: src.title, seconds: s.start }); }} aria-label={`Cite ${formatTimestamp(s.start)}`}>
                {citedAt.has(Math.round(s.start)) ? 'Cited' : 'Cite'}
              </button>
            </div>
          ))}
          <div className="mw-tx-pad bottom" aria-hidden="true" />
        </div>
        {!following && idx >= 0 && <button type="button" key={dir} className={`mw-follow ${dir}`} onClick={() => setFollowing(true)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6" /></svg>{dir === 'up' ? 'Back up to what is playing' : 'Back down to what is playing'}</button>}
        </div>
      </div>
      {p.error && <p className="mw-err" role="alert">{p.error}</p>}
      <div className="mw-stay">
        <span>{done ? 'Thank you for staying with it' : enough && !answered ? 'There is still a question ahead. Keep watching.' : `Played ${formatDuration(p.played)} of ${formatDuration(total)}. Skipping ahead does not count.`}</span>
        <div className="mw-meter"><b style={{ width: Math.min(100, (need !== null ? p.played / Math.max(need, 1) : playedFraction(p.played, total) / WATCHED_ENOUGH) * 100) + '%' }} /></div>
      </div>
    </>
  );
}

/* ---------- the journey ---------- */
export function MakeupJourney({ classes, sources, onSubmit, skipTools = false, phone = false, testMode = false, full = false, persist = false, startAtLesson = '' }) {
  const stageRef = React.useRef(null);
  // Only the student page keeps a student's place (on their own device); previews and tests always start clean.
  const store = React.useMemo(() => { if (!persist) return null; try { return window.localStorage; } catch { return null; } }, [persist]);
  const [restored] = React.useState(() => (store ? readProgress(store, { classes, sources }) : null));
  const headingRef = React.useRef(null);
  const [S, setS] = React.useState(() => ({
    ...initialState(), picks: [], word: '', code: '', closer: '', styleOffset: Math.floor(Math.random() * 3),
    // previewing one lesson (admin): begin at that lesson, as a student on day one
    ...(startAtLesson ? { step: STEPS.indexOf('learn'), name: 'Test Student', cls: classes[0]?.id || '', days: 1, settled: true, sourceIds: [startAtLesson], learned: false } : {}),
    ...(restored ? restored.S : {}),
  }));
  const [cites, setCites] = React.useState(restored ? restored.cites : []);
  const [pauseAnswers, setPauseAnswers] = React.useState(restored ? restored.pauseAnswers : {});   // answers to pause questions, by question
  const answerPause = (key, text) => setPauseAnswers((a) => ({ ...a, [key]: text }));
  const [pauseDrafts, setPauseDrafts] = React.useState(restored ? restored.pauseDrafts : {});     // a question started but not yet saved
  const draftPause = (key, text) => setPauseDrafts((d) => ({ ...d, [key]: text }));
  const [notes, setNotes] = React.useState(restored ? restored.notes : '');
  const [notesOpen, setNotesOpen] = React.useState(false);
  const [notesHint, setNotesHint] = React.useState(false);       // pointing out the notes button, the first time only
  React.useEffect(() => { if (!notesHint) return undefined; const id = setTimeout(() => setNotesHint(false), 9000); return () => clearTimeout(id); }, [notesHint]);
  const [toast, setToast] = React.useState('');
  const soundRef = React.useRef(null);
  const [status, setStatus] = React.useState({ state: 'idle', error: '', result: null });
  const mediaTotals = React.useRef(restored ? { ...restored.totals } : emptyTotals());
  const resumeLearn = React.useRef(restored ? restored.learn : null);      // the lesson they were partway through, until they move on
  const learn = React.useRef({ done: false, played: restored?.learn?.played || 0, duration: restored?.learn?.duration || 0, readSeconds: restored?.learn?.readSeconds || 0, mutedPlayed: restored?.learn?.mutedPlayed || 0 });
  const mediaCollect = React.useRef(null);                                 // the player's place, when a video or audio is open
  const resumeFor = (src, index) => (resumeLearn.current && resumeLearn.current.key === learnKey(index, src.id) ? resumeLearn.current : undefined);
  const [learnDone, setLearnDone] = React.useState(false);
  const tracker = useEffortTracker({ onBlocked: (kind) => { if (kind !== 'menu') soundRef.current && soundRef.current.play('thud'); setToast(kind === 'drop' ? 'Dropping text is turned off here.' : kind === 'paste' ? 'Pasting is turned off. Write it in your own words.' : ''); } });
  const trackerRestored = React.useRef(false);
  if (restored && !trackerRestored.current) {
    trackerRestored.current = true;
    const stats = { ...restored.tracker.stats };
    if (restored.closed && Number.isFinite(stats.leaves)) stats.leaves = Math.max(0, stats.leaves - 1);   // closing the page is not "leaving it while writing"
    tracker.restore({ stats, prevLen: restored.tracker.prevLen });
  }
  const upd = (patch) => setS((s) => ({ ...s, ...patch }));
  const sampleUrls = React.useRef({});

  const step = STEPS[S.step];
  const n = sourcesNeeded(S.days);
  const learnSources = S.sourceIds.map((id) => sources.find((x) => x.id === id)).filter(Boolean);
  const cur = learnSources[S.learnIndex];
  const stepRaw = S.step + (step === 'learn' && learnSources.length > 1 ? (S.learnIndex / learnSources.length) * 0.9 : 0);

  const sound = useSoundscape(stepRaw);
  soundRef.current = sound;
  const prevStep = React.useRef(0);
  React.useEffect(() => { // a breath of air between steps, and a small flourish at the end
    if (S.step !== prevStep.current && S.step > 0) sound.play(S.step === STEPS.length - 1 ? 'finish' : 'swell');
    prevStep.current = S.step;
  }, [S.step]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { if (learnDone) sound.play('ding'); }, [learnDone]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { if (step !== 'learn') sound.duck(false); }, [step]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { headingRef.current && headingRef.current.focus({ preventScroll: true }); }, [S.step, S.learnIndex]);
  React.useEffect(() => { if (!toast) return undefined; const id = setTimeout(() => setToast(''), 2600); return () => clearTimeout(id); }, [toast]);
  React.useEffect(() => { // the quiet moment before "Begin"
    if (step !== 'begin' || S.settled) return undefined;
    const id = setTimeout(() => upd({ settled: true }), RULES.settleSeconds * 1000); return () => clearTimeout(id);
  }, [step, S.settled]);
  const keepRestored = React.useRef(!!restored);
  React.useEffect(() => {
    if (keepRestored.current) { keepRestored.current = false; return; }       // the first time is the page opening on a saved place
    resumeLearn.current = null;
    learn.current = { done: false, played: 0, duration: 0, readSeconds: 0, mutedPlayed: 0 }; setLearnDone(false);
  }, [S.learnIndex, S.step]);

  /* ----- keeping the student's place on their device ----- */
  const voicePartsRef = React.useRef(null);
  const finished = React.useRef(false);
  const lastSaved = React.useRef('');
  const latest = React.useRef(null);
  latest.current = () => {
    if (S.step >= N - 1 || !hasProgress(S, notes)) return null;
    const inLearn = step === 'learn' && cur;
    const place = inLearn && mediaCollect.current ? mediaCollect.current() : {};
    return {
      S, cites, pauseAnswers, pauseDrafts, notes, tracker: tracker.export(), totals: mediaTotals.current,
      voiceParts: voicePartsRef.current ? voicePartsRef.current.current : { under: 0, feel: 0 },
      learn: inLearn ? { key: learnKey(S.learnIndex, cur.id), ...learn.current, ...place } : null,
    };
  };
  React.useEffect(() => {
    if (!store) return undefined;
    const save = (hidden = false) => {
      if (finished.current || !latest.current) return;
      const data = latest.current();
      if (!data) return;
      const body = JSON.stringify(data) + (hidden ? '#' : '');
      if (body !== lastSaved.current && writeProgress(store, data, { hidden })) lastSaved.current = body;
    };
    const onHide = () => save(document.hidden);
    const id = setInterval(save, 1500);                                        // time passing counts too: watching, reading
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', onHide); save(); };
  }, [store]);
  React.useEffect(() => {
    if (!restored) return;
    const who = restored.S.name.trim();
    setToast(`Welcome back${who ? `, ${who}` : ''}. Your place was saved.`);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [confirmReset, setConfirmReset] = React.useState(false);
  React.useEffect(() => { if (!confirmReset) return undefined; const id = setTimeout(() => setConfirmReset(false), 4000); return () => clearTimeout(id); }, [confirmReset]);
  // Begin again with nothing kept: the answers, notes, and the numbers the teacher's signal is built from.
  const restart = () => {
    if (store) clearProgress(store);
    lastSaved.current = ''; finished.current = false;
    tracker.reset();
    mediaTotals.current = emptyTotals(); resumeLearn.current = null; learn.current = { done: false, played: 0, duration: 0, readSeconds: 0, mutedPlayed: 0 };
    if (voicePartsRef.current) voicePartsRef.current.current = { under: 0, feel: 0 };
    setCites([]); setPauseAnswers({}); setPauseDrafts({}); setNotes(''); setNotesOpen(false); setLearnDone(false); setConfirmReset(false);
    setStatus({ state: 'idle', error: '', result: null });
    setS({ ...initialState(), picks: [], word: '', code: '', closer: '', styleOffset: Math.floor(Math.random() * 3) });
  };

  const available = Object.keys(GROUPS).filter((g) => sources.some((x) => groupOf(x.kind) === g));
  const advance = (patch = {}) => { sound.play('chime'); setS((s) => ({ ...s, ...patch, step: Math.min(N - 1, s.step + 1) })); };
  const goBack = () => setS((s) => ({ ...s, step: Math.max(0, s.step - 1), learnIndex: 0 }));

  // choose a specific source for each pick, avoiding repeats within a journey when there is a choice
  const resolvePicks = (picks) => {
    const used = new Set();
    return picks.map((g) => {
      const pool = sources.filter((x) => groupOf(x.kind) === g);
      const fresh = pool.filter((x) => !used.has(x.id));
      const list = fresh.length ? fresh : pool;
      const chosen = list[Math.floor(Math.random() * list.length)];
      used.add(chosen.id); return chosen.id;
    });
  };

  const mediaFor = (src) => {
    if (!AV_KINDS.includes(src.kind)) return null;
    let url = src.embed_url;
    if (url === 'sample:audio') { sampleUrls.current[src.id] = sampleUrls.current[src.id] || silentWavUrl(src.duration_seconds || 60); return { url: sampleUrls.current[src.id], type: 'audio' }; }
    const type = mediaKind(url); return type ? { url, type } : null;
  };

  const finishLearnItem = () => {
    const L = learn.current;
    mediaTotals.current.watched += L.played; mediaTotals.current.source += L.duration; mediaTotals.current.readSeconds += L.readSeconds; mediaTotals.current.muted += L.mutedPlayed || 0;
    if (S.learnIndex < learnSources.length - 1) upd({ learnIndex: S.learnIndex + 1 }); else advance({ learned: true });
  };

  const submit = async (state = S) => {
    setStatus({ state: 'sending', error: '', result: null });
    const { rpc, row } = buildSubmission({ S: state, classes, sources, stats: tracker.snapshot(), mediaTotals: mediaTotals.current, code: state.code, pauseAnswers: answersPayload(learnSources, pauseAnswers) });
    try {
      const result = await onSubmit({ rpc, row });
      if (result && result.ok === false) { setStatus({ state: 'error', error: result.error || 'That did not send. Please try again.', result: null }); return; }
      setStatus({ state: 'done', error: '', result: { ...(result || {}), row } });
      if (store) { finished.current = true; clearProgress(store); }
      advance({ closer: CLOSERS[Math.floor(Math.random() * CLOSERS.length)] });
    } catch (e) { setStatus({ state: 'error', error: e.message || 'That did not send. Please try again.', result: null }); }
  };

  /* ----- testing tools: skip a step, fill it in, or go back ----- */
  const sampleFill = () => {
    const days = S.days || 2;
    const picks = S.picks.length === sourcesNeeded(days) ? S.picks : Array.from({ length: sourcesNeeded(days) }, (_, i) => available[i % available.length]);
    const ids = S.sourceIds.length ? S.sourceIds : resolvePicks(picks);
    const text = 'I noticed that doing small things for others brings a quiet peace to my day and I want more of it.';
    return { name: S.name || 'Test Student', cls: S.cls || classes[0]?.id || '', days, settled: true, picks, sourceIds: ids, learned: true,
      truth: S.truth || 'If we act on what the Lord asks, then He will prepare a way for us.', where: S.where || (learnSources[0]?.reference || 'A sample moment · 0:11'),
      understanding: S.understanding || text, text: S.text || text, voiceSeconds: S.mode === 'voice' ? Math.max(S.voiceSeconds, voiceSecondsNeeded(days)) : 0, word: S.word || (STYLES[S.styleOffset % 3] === 'word' ? 'Peace' : ''),
      inv: S.inv || 'serve', commit: S.commit || 'my little brother with his reading', bless: S.bless || 'help me be kinder at home' };
  };
  const skipStep = () => {
    if (step === 'done') return;
    if (step === 'commit') { const filled = { ...S, ...sampleFill() }; setS(filled); submit(filled); return; }  // submit what was just filled in, not the older state
    setS((s) => ({ ...s, ...sampleFill(), step: s.step + 1, learnIndex: 0 }));
  };

  /* ----- screens ----- */
  // One stable component, so the heading is not torn down and rebuilt on every keystroke elsewhere on the screen.
  const Heading = React.useMemo(() => ({ children }) => <h2 className="mw-h" tabIndex={-1} ref={headingRef}>{children}</h2>, []);
  const clsObj = classes.find((c) => c.id === S.cls);

  const beginScreen = (() => {
    const ok = S.name.trim() && S.cls && S.days && S.settled && (!clsObj?.requires_code || S.code.trim());
    return (
      <>
        <p className="mw-eyebrow">Alta Seminary makeup work</p>
        <Heading>Let's make up the time</Heading>
        <p className="mw-sub">Take a quiet moment first. Ask for help to notice what God wants you to know today.</p>
        <div className="mw-field"><label htmlFor="mw-name">Your first name</label><input id="mw-name" type="text" autoComplete="given-name" value={S.name} onChange={(e) => upd({ name: e.target.value })} /></div>
        <div><div className="mw-lbl" id="mw-cl">Your class</div><div className="mw-row" role="group" aria-labelledby="mw-cl">{classes.map((c) => <button key={c.id} className="mw-chip" aria-pressed={S.cls === c.id} onClick={() => upd({ cls: c.id })}>{c.name}</button>)}</div></div>
        {clsObj?.requires_code && <div className="mw-field"><label htmlFor="mw-code">Class code from your teacher</label><input id="mw-code" type="text" autoComplete="off" value={S.code} onChange={(e) => upd({ code: e.target.value })} /></div>}
        <div><div className="mw-lbl" id="mw-dl">Days you missed</div><div className="mw-row" role="group" aria-labelledby="mw-dl">{[1, 2, 3, 4].map((d) => <button key={d} className="mw-chip" aria-pressed={S.days === d} onClick={() => upd({ days: d })}>{d === 4 ? '4 or more' : d}</button>)}</div></div>
        <div className="mw-row" style={{ alignItems: 'center' }}><button className="mw-cta" disabled={!ok} onClick={() => { if (takeNotesHint(store)) setNotesHint(true); advance(); }}>{S.settled ? 'Begin' : 'Take a moment…'}</button>{sound.supported && !sound.prefs.on && <button className="mw-ghost" onClick={() => sound.update({ on: true })}>Turn on quiet music</button>}</div>
        <p className="mw-fine">{S.days ? `About ${estimateMinutes(S.days)} minutes, start to finish.` : `About ${RULES.minutesPerDay} minutes for each day you missed.`}</p>
      </>
    );
  })();

  const pick = (g) => {
    sound.play('tick');
    if (n === 1) { upd({ picks: [g], sourceIds: resolvePicks([g]) }); setTimeout(() => advance({ sourceIds: resolvePicks([g]) }), 220); return; }
    if (S.picks.length < n) setS((s) => (s.picks.length < n ? { ...s, picks: [...s.picks, g] } : s)); else setToast('All picked. Tap a number to take one off.');
  };
  const surprise = () => { sound.play('tick'); setS((s) => { const picks = [...s.picks]; while (picks.length < n) picks.push(available[Math.floor(Math.random() * available.length)]); return { ...s, picks }; }); };
  const chooseScreen = (
    <>
      <p className="mw-eyebrow">Choose how to learn</p>
      <Heading>{n === 1 ? 'How do you want to learn today?' : `Pick ${n} ways to learn`}</Heading>
      <p className="mw-sub">{n === 1 ? 'Pick one.' : `You missed ${S.days >= 4 ? '4 or more days' : S.days + ' days'}, so pick ${n}. Tap the same one again to study it more than once. Tap a number to take it off.`}</p>
      {available.length === 0 && <p className="mw-err">No lessons are available yet.</p>}
      <div className="mw-opts">
        {available.map((g) => {
          const G = GROUPS[g]; const pos = S.picks.map((x, i) => (x === g ? i + 1 : 0)).filter(Boolean);
          return (
            <div className="mw-cardwrap" key={g}>
              <button className="mw-opt" onClick={() => pick(g)}>
                <svg viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: G.icon }} /><b>{G.label}</b><span>{G.desc}</span>
              </button>
              <span className="mw-badges">{pos.map((p) => <button key={p} className="mw-bd" aria-label={`Remove pick ${p}: ${G.label}`} onClick={() => { sound.play('untick'); setS((s) => ({ ...s, picks: s.picks.filter((_, i) => i !== p - 1) })); }}>{p}</button>)}</span>
            </div>
          );
        })}
        {available.length > 1 && n > 1 && (
          <div className="mw-cardwrap"><button className="mw-opt" onClick={surprise}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /></svg><b>Surprise me</b><span>We fill the rest.</span></button></div>
        )}
      </div>
      {n > 1 && <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <button className="mw-cta" disabled={S.picks.length !== n} onClick={() => advance({ sourceIds: resolvePicks(S.picks) })}>Continue</button>
        <span className="mw-fine">{S.picks.length} of {n} picked</span>
      </div>}
    </>
  );

  const learnScreen = (() => {
    if (!cur) return <><Heading>Nothing to study</Heading><p className="mw-err">That lesson is no longer available.</p></>;
    const g = GROUPS[groupOf(cur.kind)]; const media = mediaFor(cur); const isAV = AV_KINDS.includes(cur.kind);
    const hints = g.listen; const hint = (cur.guide_line || '').trim() || hints[(S.learnIndex + S.styleOffset) % hints.length];
    const thumb = thumbnailFor(cur); const fallback = paintingFor(cur.id || cur.title);
    return (
      <>
        <div className="mw-lhead">
          {cur.show_images && <img className="mw-lthumb" src={thumb.src} alt="" loading="lazy" title={thumb.painting ? paintingCredit(thumb.painting) : undefined}
            onError={(e) => { if (!e.currentTarget.dataset.fell) { e.currentTarget.dataset.fell = '1'; e.currentTarget.src = fallback.src; } }} />}
          <div className="mw-lhead-text">
            <p className="mw-eyebrow">{g.label}{learnSources.length > 1 ? ` · ${S.learnIndex + 1} of ${learnSources.length}` : ''}</p>
            <Heading>{cur.title}</Heading>
            {byline(cur) && <p className="mw-fine">{byline(cur)}</p>}
          </div>
        </div>
        <p className="mw-quote">{hint}</p>
        {isAV ? (media ? (
          <MediaStage key={cur.id + S.learnIndex} src={cur} mediaUrl={media.url} mediaType={media.type} cites={cites} answers={pauseAnswers} onAnswer={answerPause} drafts={pauseDrafts} onDraft={draftPause} resume={resumeFor(cur, S.learnIndex)} registerMedia={(fn) => { mediaCollect.current = fn; }} fieldProps={tracker.fieldProps}
            onCite={(c) => { sound.play('cite'); setCites((x) => (x.some((y) => y.sourceId === c.sourceId && Math.round(y.seconds) === Math.round(c.seconds)) ? x.filter((y) => !(y.sourceId === c.sourceId && Math.round(y.seconds) === Math.round(c.seconds))) : [...x, c])); }}
            onProgress={({ played, duration, done, playing, mutedPlayed }) => { sound.duck(!!playing); learn.current.played = played; learn.current.duration = duration; learn.current.mutedPlayed = mutedPlayed || 0; if (done !== learn.current.done) { learn.current.done = done; setLearnDone(done); } }} />
        ) : <p className="mw-err">This video or audio address is not one we can play. An admin can fix it.</p>) : (
          <Reader key={cur.id + S.learnIndex} src={cur} answers={pauseAnswers} onAnswer={answerPause} drafts={pauseDrafts} onDraft={draftPause} startSeconds={resumeFor(cur, S.learnIndex)?.readSeconds || 0} fieldProps={tracker.fieldProps} onSeconds={(t) => { learn.current.readSeconds = t; }} onDone={(d) => { if (d !== learn.current.done) { learn.current.done = d; setLearnDone(d); } }} />
        )}
        {isAV && <p className="mw-fine">Tap “Cite” on a line of the transcript when something stands out. You can use it in a moment.</p>}
        {learnDone && <button className="mw-cta" onClick={finishLearnItem}>{S.learnIndex < learnSources.length - 1 ? `Next: ${GROUPS[groupOf(learnSources[S.learnIndex + 1].kind)].label}` : 'Continue'}</button>}
      </>
    );
  })();

  const whereChips = [
    ...cites.map((c) => ({ label: timestampRef(c.title, c.seconds), seconds: Math.round(c.seconds) })),
    ...learnSources.filter((x) => x.reference).map((x) => ({ label: x.reference, seconds: null })),
  ];
  const truthScreen = (() => {
    const ok = wordCount(S.truth) >= RULES.minTruthWords && S.where.trim().length >= RULES.minWhereChars;
    return (
      <>
        <p className="mw-eyebrow">Find a truth</p>
        <Heading>{learnSources.length > 1 ? 'What is one truth that ran through it all?' : 'What is one truth you found?'}</Heading>
        <p className="mw-sub">A truth is a doctrine or a principle. Try “If we…, then…”.</p>
        <div className="mw-field"><label htmlFor="mw-truth">The truth, in your words</label><textarea id="mw-truth" placeholder="If we…, then…" value={S.truth} {...tracker.fieldProps('truth')} onChange={(e) => { tracker.fieldProps('truth').onChange(e); upd({ truth: e.target.value }); }} /></div>
        <div className="mw-field"><label htmlFor="mw-where">Where did you find it?</label>
          {whereChips.length > 0 && <div className="mw-row">{whereChips.map((c) => <button key={c.label} className="mw-chip" aria-pressed={S.where === c.label} onClick={() => upd({ where: c.label, whereSeconds: c.seconds })}>{c.label}</button>)}</div>}
          <input id="mw-where" type="text" value={S.where} placeholder={whereChips.length ? 'or type where' : 'Which one, and about where?'} onChange={(e) => upd({ where: e.target.value, whereSeconds: null })} />
        </div>
        <div><button className="mw-cta" disabled={!ok} onClick={() => advance()}>Continue</button></div>
      </>
    );
  })();

  const style = STYLES[S.styleOffset % 3];
  const voiceParts = React.useRef(restored ? restored.voiceParts : { under: 0, feel: 0 });   // seconds spoken for each of the two answers
  voicePartsRef.current = voiceParts;
  const spokenSeconds = (key) => (n) => { voiceParts.current[key] = n; upd({ voiceSeconds: voiceParts.current.under + voiceParts.current.feel }); };
  const append = (key) => (t) => setS((s) => ({ ...s, [key]: s[key] ? `${s[key]} ${t}` : t }));
  const clear = (key) => () => setS((s) => ({ ...s, [key]: '' }));
  const switchMode = (mode) => { if (mode === S.mode) return; voiceParts.current = { under: 0, feel: 0 }; upd({ mode, understanding: '', text: '', voiceSeconds: 0 }); };
  const canSpeak = speechSupported();
  const understandScreen = (() => {
    const need = wordsNeeded(S.days);
    const voice = S.mode === 'voice';
    const okText = canAdvance(S) && (style !== 'word' || S.word);
    const hint = okText ? 'That is a good start.'
      : style === 'word' && !S.word ? 'Pick a word first.'
        : voice ? (S.voiceSeconds < voiceSecondsNeeded(S.days) ? `Answer both out loud, about ${voiceSecondsNeeded(S.days)} seconds or more.` : 'Say a little more in each answer.')
          : `About ${need} words in each box. Pasting is turned off.`;
    const wordChips = style === 'word' && <div className="mw-row">{WORDS.map((w) => <button key={w} className="mw-chip" aria-pressed={S.word === w} onClick={() => upd({ word: w })}>{w}</button>)}</div>;
    const starter = style === 'sentence' && <p style={{ fontWeight: 700, margin: '0 0 4px' }}>{STARTERS[S.styleOffset % 3]}</p>;
    return (
      <>
        <p className="mw-eyebrow">Understand and feel</p>
        <Heading>Why does this truth matter?</Heading>
        <p className="mw-sub">{voice ? 'Two short answers, out loud.' : 'Two short answers in your own words. Pasting is turned off.'}</p>
        {canSpeak && (
          <div className="mw-row" role="group" aria-label="How to answer">
            <button className="mw-chip" aria-pressed={!voice} onClick={() => switchMode('text')}>Write it</button>
            <button className="mw-chip" aria-pressed={voice} onClick={() => switchMode('voice')}>Say it</button>
          </div>
        )}
        {voice ? (
          <>
            <VoiceAnswer id="mw-vunder" label="How could this truth help someone your age?" value={S.understanding} onAppend={append('understanding')} onClear={clear('understanding')}
              seconds={voiceParts.current.under} onSeconds={spokenSeconds('under')} onListening={(on) => sound.duck(on)} />
            <VoiceAnswer id="mw-vfeel" label={FEEL_HEAD[style]} value={S.text} onAppend={append('text')} onClear={clear('text')}
              seconds={voiceParts.current.feel} onSeconds={spokenSeconds('feel')} onListening={(on) => sound.duck(on)}>{wordChips}{starter}</VoiceAnswer>
            <p className="mw-fine">Your browser turns your voice into words. We keep only the words and how long you spoke, never a recording. Some browsers send your voice to their maker to do this.</p>
          </>
        ) : (
          <>
            <div className="mw-field"><label htmlFor="mw-under">How could this truth help someone your age?</label>
              <textarea id="mw-under" placeholder="It could help them…" value={S.understanding} {...tracker.fieldProps('under')} onChange={(e) => { tracker.fieldProps('under').onChange(e); upd({ understanding: e.target.value }); }} /></div>
            <div className="mw-field"><label htmlFor="mw-feel">{FEEL_HEAD[style]}</label>
              {wordChips}{starter}
              <textarea id="mw-feel" placeholder={style === 'word' ? 'Because…' : 'In your own words…'} value={S.text} {...tracker.fieldProps('feel')} onChange={(e) => { tracker.fieldProps('feel').onChange(e); upd({ text: e.target.value }); }} /></div>
          </>
        )}
        <p className="mw-fine" aria-live="polite">{hint}</p>
        <div><button className="mw-cta" disabled={!okText} onClick={() => advance()}>Continue</button></div>
      </>
    );
  })();

  const commitScreen = (() => {
    const inv = INVITES.find((i) => i.k === S.inv);
    const ok = S.inv && S.commit.trim().length >= RULES.minCommitChars && S.bless.trim().length >= RULES.minBlessChars;
    return (
      <>
        <p className="mw-eyebrow">Apply the truth</p>
        <Heading>What will you do because of what you learned?</Heading>
        <div className="mw-opts" role="group" aria-label="Kind of invitation">
          {INVITES.map((i) => <button key={i.k} className="mw-inv" aria-pressed={S.inv === i.k} onClick={() => upd({ inv: i.k })}><svg viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: i.icon }} /><b>{i.t}</b><span>{i.d}</span></button>)}
        </div>
        {inv && (
          <>
            <div><div className="mw-lbl" id="mw-cs">{inv.start}</div><input id="mw-commit" type="text" aria-labelledby="mw-cs" autoComplete="off" value={S.commit} onChange={(e) => upd({ commit: e.target.value })} placeholder="…" /></div>
            <div className="mw-field"><label htmlFor="mw-bless">How will doing this bless your life?</label><input id="mw-bless" type="text" autoComplete="off" value={S.bless} onChange={(e) => upd({ bless: e.target.value })} placeholder="It will help me…" /></div>
          </>
        )}
        {status.state === 'error' && <p className="mw-err" role="alert">{status.error}</p>}
        <div><button className="mw-cta" disabled={!ok || status.state === 'sending'} onClick={() => submit()}>{status.state === 'sending' ? 'Sending…' : 'Finish'}</button></div>
      </>
    );
  })();

  const doneScreen = (() => {
    const row = status.result?.row; if (!row) return null;
    const effort = analyzeEffort({ mode: row.mode, text: row.response, voiceSeconds: row.voice_seconds, stats: { pastes: row.paste_attempts, jumps: row.sudden_jumps, activeMs: row.active_seconds * 1000, typedChars: row.typed_chars, leaves: row.page_leaves, watchedSeconds: row.watched_seconds, sourceSeconds: row.source_seconds, mutedSeconds: row.muted_seconds } });
    const email = composeTeacherEmail(row);
    return (
      <>
        <p className="mw-eyebrow">All done</p>
        <Heading>Well done, {S.name.trim()}.</Heading>
        <p className="mw-sub">{S.closer}</p>
        {testMode && status.result?.saved === false && <p className="mw-fine">Test run: nothing was saved.</p>}
        <div className="mw-keep"><small>Your invitation</small><p>{row.commitment}</p><div className="mw-fine">{row.blessing ? `It will bless my life: ${row.blessing}` : ''}</div></div>
        <div className="mw-row"><button className="mw-ghost" onClick={async () => { try { await navigator.clipboard.writeText(PASS_ON); setToast('Copied. Send it to someone.'); } catch { setToast(PASS_ON); } }}>Pass it on: copy an invitation for a friend</button></div>
        {notes.trim() && <div className="mw-row"><button className="mw-ghost" onClick={async () => { try { await navigator.clipboard.writeText(notes); setToast('Copied your notes.'); } catch { setToast('Copying is not available here.'); } }}>Copy my notes</button></div>}
        <details className="mw-recp"><summary>What your teacher receives</summary>
          <dl>
            <dt>Student</dt><dd>{row.student_name} · {row.class_name}</dd>
            <dt>Covers</dt><dd>{row.days_total} day{row.days_total > 1 ? 's' : ''}</dd>
            <dt>Learned by</dt><dd>{row.source_titles.join(' · ')}</dd>
            <dt>Truth found</dt><dd>{row.truth} <span className="mw-fine">({row.truth_ref})</span></dd>
            {row.pause_answers?.length > 0 && <><dt>Questions</dt><dd>{row.pause_answers.map((a, i) => <div key={i}><span className="mw-fine">{a.question}</span><br />{a.answer}</div>)}</dd></>}
            <dt>Their words</dt><dd>{row.response}{row.mode === 'voice' && <span className="mw-fine"> (spoken, {formatDuration(row.voice_seconds)})</span>}</dd>
            <dt>Active time</dt><dd>{formatDuration(row.active_seconds)}</dd>
            {row.source_seconds > 0 && <><dt>Played</dt><dd>{formatDuration(row.watched_seconds)} of {formatDuration(row.source_seconds)}</dd><dt>Sound</dt><dd>{row.muted_seconds >= 10 ? `The player's sound was off for ${formatDuration(row.muted_seconds)}` : 'On'}</dd></>}
            <dt>Paste attempts</dt><dd>{row.paste_attempts}</dd>
            <dt>Signal</dt><dd><span className={`mw-flag ${effort.ok ? 'ok' : 'look'}`}>{effort.label}</span> <span className="mw-fine">{effort.reasons.join(' ')}</span></dd>
          </dl>
        </details>
        {testMode && <details className="mw-recp"><summary>Test only: the email the teacher would get</summary><pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: '10px 0 0' }}><strong>{email.subject}</strong>{'\n\n'}{email.text}</pre></details>}
        <button className="mw-ghost" style={{ alignSelf: 'flex-start' }} onClick={restart}>Start over</button>
      </>
    );
  })();

  const screens = { begin: beginScreen, choose: chooseScreen, learn: learnScreen, truth: truthScreen, understand: understandScreen, commit: commitScreen, done: doneScreen };
  const wide = step === 'learn' && cur && AV_KINDS.includes(cur.kind);
  // Pictures are off unless a lesson turns them on: its own page shows them, and so do the steps that follow while
  // the student is working from a lesson that has them. The first two steps (before any lesson) never do.
  const showArt = step === 'learn' ? !!cur?.show_images : ['truth', 'understand', 'commit', 'done'].includes(step) && learnSources.some((x) => x.show_images);

  return (
    <div ref={stageRef} className={`mw-stage${phone ? ' phone' : ''}${full ? ' full' : ''}`} onPointerDown={sound.wake}>
      <Scene stage={stageRef} stepRaw={stepRaw} page={full} />
      <div className="mw-tbar"><img src={logo.src} alt="Alta Seminary" /><div className="mw-tools"><NotesButton open={notesOpen} hasNotes={!!notes.trim()} hint={notesHint} onToggle={() => { setNotesHint(false); setNotesOpen((o) => !o); }} /><SoundControl sound={sound} /></div></div>
      <RidgeProgress stepRaw={stepRaw} />
      <div className="mw-body"><section className={`mw-card${wide ? ' wide' : ''}`} key={`${S.step}-${S.learnIndex}`}>{showArt && <StepArt step={step} short={wide} />}{screens[step]}
        {store && step !== 'done' && hasProgress(S, notes) && (
          <p className="mw-fine mw-saved">Your place is saved on this device. <button type="button" className="mw-link" onClick={() => (confirmReset ? restart() : setConfirmReset(true))}>{confirmReset ? 'Tap again to erase it all and start over' : 'Start over'}</button></p>
        )}
      </section></div>
      <div className="mw-headfade" aria-hidden="true" />
      <NotesPanel open={notesOpen} value={notes} onChange={setNotes} onClose={() => setNotesOpen(false)} onCopied={setToast} saved={!!store} />
      <div className={`mw-toast${toast ? ' show' : ''}`} role="status">{toast}</div>
      {skipTools && (
        <div className="mw-skip" role="group" aria-label="Testing tools">
          <span>Testing</span>
          <button onClick={goBack} disabled={S.step === 0}>Back</button>
          <button onClick={() => setS((s) => ({ ...s, ...sampleFill() }))}>Fill in</button>
          <button onClick={skipStep} disabled={step === 'done'}>Skip step</button>
        </div>
      )}
    </div>
  );
}
