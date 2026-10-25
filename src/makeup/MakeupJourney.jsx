import React from 'react';
import './journey.css';
import logo from '../assets/alta-seminary-logo.png';
import { withBase } from '../lib/url.js';
import {
  STEPS, RULES, initialState, canAdvance, sourcesNeeded, wordsNeeded, voiceSecondsNeeded, estimateMinutes, wordCount,
} from './journey.js';
import { GROUPS, groupOf, AV_KINDS, WORDS, STARTERS, STYLES, FEEL_HEAD, INVITES, CLOSERS, PASS_ON } from './content.js';
import { TILE_URLS, SUN_TOP, paletteAt, duotoneFor, rollScene, lerp, hex, mixc } from './scene.js';
import { mediaKind } from './media.js';
import { activeIndex, formatTimestamp, timestampRef, playedFraction } from './transcript.js';
import { useMediaPlayer } from './useMediaPlayer.js';
import { useEffortTracker } from './useEffortTracker.js';
import { analyzeEffort, formatDuration } from './effort.js';
import { buildSubmission } from './submission.js';
import { composeTeacherEmail } from './teacherEmail.js';
import { silentWavUrl } from './sampleContent.js';

const N = STEPS.length;
const WATCHED_ENOUGH = 0.75;
const RIDGE_PTS = [[0, 22], [9, 12], [17, 18], [27, 5], [37, 16], [46, 9], [57, 19], [68, 4], [79, 14], [88, 8], [100, 15]];

/* ---------- the mountain scene ---------- */
function Scene({ stage, stepRaw }) {
  const uid = React.useId().replace(/:/g, '');
  const [layers] = React.useState(() => rollScene());
  const sunRef = React.useRef(null);
  const stripRefs = React.useRef([]);
  const filterRefs = React.useRef([]);
  const cur = React.useRef(null);
  const raf = React.useRef(0);

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
    const set = (cols) => cols.forEach(([D, L], i) => {
      const f2 = filterRefs.current[i]; if (!f2) return;
      const d = hex(D), l = hex(L);
      ['R', 'G', 'B'].forEach((ch, k) => f2.querySelector('feFunc' + ch).setAttribute('tableValues', (d[k] / 255).toFixed(3) + ' ' + (l[k] / 255).toFixed(3)));
    });
    const run = (n) => {
      const u = reduce ? 1 : Math.min(1, (n - start) / 1200);
      set(target.map((pair, i) => pair.map((c, k) => mixc(from[i][k], c, u))));
      if (u < 1) raf.current = requestAnimationFrame(run); else cur.current = target;
    };
    raf.current = requestAnimationFrame(run);
    return () => cancelAnimationFrame(raf.current);
  }, [stepRaw, layers, stage]);

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
            <div className="fill" style={{ height: l.bottom + 26, background: 'rgb(76,76,76)' }} />
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

/* ---------- learning: reading, and video/audio with a live transcript ---------- */
function Reader({ src, onDone, onSeconds }) {
  const text = src.body || '';
  const need = Math.max(20, Math.ceil((wordCount(text) / 200) * 60 * 0.6));
  const [t, setT] = React.useState(0);
  React.useEffect(() => { const id = setInterval(() => setT((x) => x + 1), 1000); return () => clearInterval(id); }, []);
  const done = t >= need;
  React.useEffect(() => { onSeconds(t); if (done) onDone(true); }, [t, done]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <div className="mw-reader" onCopy={(e) => e.preventDefault()} onContextMenu={(e) => e.preventDefault()}>
        {src.reference && <div className="ref">{src.reference}</div>}
        {text ? <p>{text}</p> : <p>Open your scriptures to {src.reference || 'the passage'} and read it slowly.</p>}
      </div>
      <div className="mw-stay"><span>{done ? 'Thank you for staying with it' : 'Read slowly. We will wait with you.'}</span><div className="mw-meter"><b style={{ width: Math.min(100, (t / need) * 100) + '%' }} /></div></div>
    </>
  );
}

function MediaStage({ src, mediaUrl, mediaType, cites, onCite, onProgress, skipEnabled }) {
  const duration = src.duration_seconds || 0;
  const p = useMediaPlayer({ url: mediaUrl, type: mediaType, durationHint: duration });
  const segs = src.transcript || [];
  const total = p.duration || duration;
  const idx = activeIndex(segs, p.time);
  const listRef = React.useRef(null);
  const lineRefs = React.useRef([]);
  const done = playedFraction(p.played, total) >= WATCHED_ENOUGH;

  React.useEffect(() => { onProgress({ played: p.played, duration: total, done }); }, [p.played, total, done]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { // keep the spoken line in view inside the transcript box, without moving the page
    const box = listRef.current, el = lineRefs.current[idx];
    if (box && el) box.scrollTop = Math.max(0, el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2);
  }, [idx]);

  const citedAt = new Set(cites.filter((c) => c.sourceId === src.id).map((c) => Math.round(c.seconds)));
  return (
    <>
      <div className="mw-split two">
        <div className="mw-media">
          {mediaType === 'audio' ? (
            <audio ref={p.mediaRef} src={mediaUrl} controls preload="metadata" aria-label={src.title} />
          ) : mediaType === 'video' ? (
            <div className="frame"><video ref={p.mediaRef} src={mediaUrl} controls playsInline preload="metadata" aria-label={src.title} /></div>
          ) : (
            <div className="frame"><div ref={p.hostRef} /></div>
          )}
        </div>
        <div className="mw-tx" ref={listRef} role="region" aria-label="Transcript">
          <h3>Transcript</h3>
          {segs.map((s, i) => (
            <div key={i} ref={(el) => { lineRefs.current[i] = el; }} className={`mw-line${i === idx ? ' on' : ''}${citedAt.has(Math.round(s.start)) ? ' cited' : ''}`}
              role="button" tabIndex={0} aria-current={i === idx ? 'true' : undefined}
              onClick={() => { p.seek(s.start); p.play(); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); p.seek(s.start); p.play(); } }}>
              <span className="t">{formatTimestamp(s.start)}</span>
              <span>{s.text}</span>
              <button type="button" className="mw-cite" onClick={(e) => { e.stopPropagation(); onCite({ sourceId: src.id, title: src.title, seconds: s.start }); }} aria-label={`Cite ${formatTimestamp(s.start)}`}>
                {citedAt.has(Math.round(s.start)) ? 'Cited' : 'Cite'}
              </button>
            </div>
          ))}
        </div>
      </div>
      {p.error && <p className="mw-err" role="alert">{p.error}</p>}
      <div className="mw-stay">
        <span>{done ? 'Thank you for staying with it' : `Played ${formatDuration(p.played)} of ${formatDuration(total)}. Skipping ahead does not count.`}</span>
        <div className="mw-meter"><b style={{ width: Math.min(100, playedFraction(p.played, total) / WATCHED_ENOUGH * 100) + '%' }} /></div>
      </div>
    </>
  );
}

/* ---------- the journey ---------- */
export function MakeupJourney({ classes, sources, onSubmit, skipTools = false, phone = false, testMode = false }) {
  const stageRef = React.useRef(null);
  const headingRef = React.useRef(null);
  const [S, setS] = React.useState(() => ({ ...initialState(), picks: [], word: '', code: '', closer: '', styleOffset: Math.floor(Math.random() * 3) }));
  const [cites, setCites] = React.useState([]);
  const [toast, setToast] = React.useState('');
  const [status, setStatus] = React.useState({ state: 'idle', error: '', result: null });
  const mediaTotals = React.useRef({ watched: 0, source: 0, readSeconds: 0 });
  const learn = React.useRef({ done: false, played: 0, duration: 0, readSeconds: 0 });
  const [learnDone, setLearnDone] = React.useState(false);
  const tracker = useEffortTracker({ onBlocked: (kind) => setToast(kind === 'drop' ? 'Dropping text is turned off here.' : kind === 'paste' ? 'Pasting is turned off. Write it in your own words.' : '') });
  const upd = (patch) => setS((s) => ({ ...s, ...patch }));
  const sampleUrls = React.useRef({});

  const step = STEPS[S.step];
  const n = sourcesNeeded(S.days);
  const learnSources = S.sourceIds.map((id) => sources.find((x) => x.id === id)).filter(Boolean);
  const cur = learnSources[S.learnIndex];
  const stepRaw = S.step + (step === 'learn' && learnSources.length > 1 ? (S.learnIndex / learnSources.length) * 0.9 : 0);

  React.useEffect(() => { headingRef.current && headingRef.current.focus({ preventScroll: true }); }, [S.step, S.learnIndex]);
  React.useEffect(() => { if (!toast) return undefined; const id = setTimeout(() => setToast(''), 2600); return () => clearTimeout(id); }, [toast]);
  React.useEffect(() => { // the quiet moment before "Begin"
    if (step !== 'begin' || S.settled) return undefined;
    const id = setTimeout(() => upd({ settled: true }), RULES.settleSeconds * 1000); return () => clearTimeout(id);
  }, [step, S.settled]);
  React.useEffect(() => { learn.current = { done: false, played: 0, duration: 0, readSeconds: 0 }; setLearnDone(false); }, [S.learnIndex, S.step]);

  const available = Object.keys(GROUPS).filter((g) => sources.some((x) => groupOf(x.kind) === g));
  const advance = (patch = {}) => setS((s) => ({ ...s, ...patch, step: Math.min(N - 1, s.step + 1) }));
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
    mediaTotals.current.watched += L.played; mediaTotals.current.source += L.duration; mediaTotals.current.readSeconds += L.readSeconds;
    if (S.learnIndex < learnSources.length - 1) upd({ learnIndex: S.learnIndex + 1 }); else advance({ learned: true });
  };

  const submit = async () => {
    setStatus({ state: 'sending', error: '', result: null });
    const { rpc, row } = buildSubmission({ S, classes, sources, stats: tracker.snapshot(), mediaTotals: mediaTotals.current, code: S.code });
    try {
      const result = await onSubmit({ rpc, row });
      if (result && result.ok === false) { setStatus({ state: 'error', error: result.error || 'That did not send. Please try again.', result: null }); return; }
      setStatus({ state: 'done', error: '', result: { ...(result || {}), row } });
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
      understanding: S.understanding || text, text: S.text || text, word: S.word || (STYLES[S.styleOffset % 3] === 'word' ? 'Peace' : ''),
      inv: S.inv || 'serve', commit: S.commit || 'my little brother with his reading', bless: S.bless || 'help me be kinder at home' };
  };
  const skipStep = () => {
    if (step === 'done') return;
    if (step === 'commit') { setS((s) => ({ ...s, ...sampleFill() })); setTimeout(submit, 0); return; }
    setS((s) => ({ ...s, ...sampleFill(), step: step === 'learn' ? s.step + 1 : s.step + 1, learnIndex: 0 }));
  };

  /* ----- screens ----- */
  const Heading = ({ children }) => <h2 className="mw-h" tabIndex={-1} ref={headingRef}>{children}</h2>;
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
        <div><button className="mw-cta" disabled={!ok} onClick={() => advance()}>{S.settled ? 'Begin' : 'Take a moment…'}</button></div>
        <p className="mw-fine">{S.days ? `About ${estimateMinutes(S.days)} minutes, start to finish.` : `About ${RULES.minutesPerDay} minutes for each day you missed.`}</p>
      </>
    );
  })();

  const pick = (g) => {
    if (n === 1) { upd({ picks: [g], sourceIds: resolvePicks([g]) }); setTimeout(() => advance({ sourceIds: resolvePicks([g]) }), 220); return; }
    if (S.picks.length < n) upd({ picks: [...S.picks, g] }); else setToast('All picked. Tap a number to take one off.');
  };
  const surprise = () => { const picks = [...S.picks]; while (picks.length < n) picks.push(available[Math.floor(Math.random() * available.length)]); upd({ picks }); };
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
              <span className="mw-badges">{pos.map((p) => <button key={p} className="mw-bd" aria-label={`Remove pick ${p}: ${G.label}`} onClick={() => upd({ picks: S.picks.filter((_, i) => i !== p - 1) })}>{p}</button>)}</span>
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
    const hints = g.listen; const hint = hints[(S.learnIndex + S.styleOffset) % hints.length];
    return (
      <>
        <p className="mw-eyebrow">{g.label}{learnSources.length > 1 ? ` · ${S.learnIndex + 1} of ${learnSources.length}` : ''}</p>
        <Heading>{cur.title}</Heading>
        <p className="mw-quote">{hint}</p>
        {isAV ? (media ? (
          <MediaStage key={cur.id + S.learnIndex} src={cur} mediaUrl={media.url} mediaType={media.type} cites={cites}
            onCite={(c) => { setCites((x) => (x.some((y) => y.sourceId === c.sourceId && Math.round(y.seconds) === Math.round(c.seconds)) ? x.filter((y) => !(y.sourceId === c.sourceId && Math.round(y.seconds) === Math.round(c.seconds))) : [...x, c])); }}
            onProgress={({ played, duration, done }) => { learn.current.played = played; learn.current.duration = duration; if (done !== learn.current.done) { learn.current.done = done; setLearnDone(done); } }} />
        ) : <p className="mw-err">This video or audio address is not one we can play. An admin can fix it.</p>) : (
          <Reader key={cur.id + S.learnIndex} src={cur} onSeconds={(t) => { learn.current.readSeconds = t; }} onDone={(d) => { if (d !== learn.current.done) { learn.current.done = d; setLearnDone(d); } }} />
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
  const understandScreen = (() => {
    const need = wordsNeeded(S.days);
    const okText = wordCount(S.understanding) >= need && wordCount(S.text) >= need && (style !== 'word' || S.word);
    const hint = !okText ? (style === 'word' && !S.word ? 'Pick a word first.' : `About ${need} words in each box. Pasting is turned off.`) : 'That is a good start.';
    return (
      <>
        <p className="mw-eyebrow">Understand and feel</p>
        <Heading>Why does this truth matter?</Heading>
        <p className="mw-sub">Two short answers in your own words. Pasting is turned off.</p>
        <div className="mw-field"><label htmlFor="mw-under">How could this truth help someone your age?</label>
          <textarea id="mw-under" placeholder="It could help them…" value={S.understanding} {...tracker.fieldProps('under')} onChange={(e) => { tracker.fieldProps('under').onChange(e); upd({ understanding: e.target.value }); }} /></div>
        <div className="mw-field"><label htmlFor="mw-feel">{FEEL_HEAD[style]}</label>
          {style === 'word' && <div className="mw-row">{WORDS.map((w) => <button key={w} className="mw-chip" aria-pressed={S.word === w} onClick={() => upd({ word: w })}>{w}</button>)}</div>}
          {style === 'sentence' && <p style={{ fontWeight: 700, margin: '0 0 4px' }}>{STARTERS[S.styleOffset % 3]}</p>}
          <textarea id="mw-feel" placeholder={style === 'word' ? 'Because…' : 'In your own words…'} value={S.text} {...tracker.fieldProps('feel')} onChange={(e) => { tracker.fieldProps('feel').onChange(e); upd({ text: e.target.value }); }} /></div>
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
        <div><button className="mw-cta" disabled={!ok || status.state === 'sending'} onClick={submit}>{status.state === 'sending' ? 'Sending…' : 'Finish'}</button></div>
      </>
    );
  })();

  const doneScreen = (() => {
    const row = status.result?.row; if (!row) return null;
    const effort = analyzeEffort({ mode: row.mode, text: row.response, voiceSeconds: row.voice_seconds, stats: { pastes: row.paste_attempts, jumps: row.sudden_jumps, activeMs: row.active_seconds * 1000, typedChars: row.typed_chars, leaves: row.page_leaves, watchedSeconds: row.watched_seconds, sourceSeconds: row.source_seconds } });
    const email = composeTeacherEmail(row);
    return (
      <>
        <p className="mw-eyebrow">All done</p>
        <Heading>Well done, {S.name.trim()}.</Heading>
        <p className="mw-sub">{S.closer}</p>
        {testMode && status.result?.saved === false && <p className="mw-fine">Test run: nothing was saved.</p>}
        <div className="mw-keep"><small>Your invitation</small><p>{row.commitment}</p><div className="mw-fine">{row.blessing ? `It will bless my life: ${row.blessing}` : ''}</div></div>
        <div className="mw-row"><button className="mw-ghost" onClick={async () => { try { await navigator.clipboard.writeText(PASS_ON); setToast('Copied. Send it to someone.'); } catch { setToast(PASS_ON); } }}>Pass it on: copy an invitation for a friend</button></div>
        <details className="mw-recp"><summary>What your teacher receives</summary>
          <dl>
            <dt>Student</dt><dd>{row.student_name} · {row.class_name}</dd>
            <dt>Covers</dt><dd>{row.days_total} day{row.days_total > 1 ? 's' : ''}</dd>
            <dt>Learned by</dt><dd>{row.source_titles.join(' · ')}</dd>
            <dt>Truth found</dt><dd>{row.truth} <span className="mw-fine">({row.truth_ref})</span></dd>
            <dt>Their words</dt><dd>{row.response}</dd>
            <dt>Active time</dt><dd>{formatDuration(row.active_seconds)}</dd>
            {row.source_seconds > 0 && <><dt>Played</dt><dd>{formatDuration(row.watched_seconds)} of {formatDuration(row.source_seconds)}</dd></>}
            <dt>Paste attempts</dt><dd>{row.paste_attempts}</dd>
            <dt>Signal</dt><dd><span className={`mw-flag ${effort.ok ? 'ok' : 'look'}`}>{effort.label}</span> <span className="mw-fine">{effort.reasons.join(' ')}</span></dd>
          </dl>
        </details>
        {testMode && <details className="mw-recp"><summary>Test only: the email the teacher would get</summary><pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: '10px 0 0' }}><strong>{email.subject}</strong>{'\n\n'}{email.text}</pre></details>}
        <button className="mw-ghost" style={{ alignSelf: 'flex-start' }} onClick={() => { mediaTotals.current = { watched: 0, source: 0, readSeconds: 0 }; setCites([]); setStatus({ state: 'idle', error: '', result: null }); setS({ ...initialState(), picks: [], word: '', code: '', closer: '', styleOffset: Math.floor(Math.random() * 3) }); }}>Start over</button>
      </>
    );
  })();

  const screens = { begin: beginScreen, choose: chooseScreen, learn: learnScreen, truth: truthScreen, understand: understandScreen, commit: commitScreen, done: doneScreen };
  const wide = step === 'learn' && cur && AV_KINDS.includes(cur.kind);

  return (
    <div ref={stageRef} className={`mw-stage${phone ? ' phone' : ''}`}>
      <Scene stage={stageRef} stepRaw={stepRaw} />
      <div className="mw-tbar"><img src={logo.src} alt="Alta Seminary" /></div>
      <RidgeProgress stepRaw={stepRaw} />
      <div className="mw-body"><section className={`mw-card${wide ? ' wide' : ''}`} key={`${S.step}-${S.learnIndex}`}>{screens[step]}</section></div>
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
