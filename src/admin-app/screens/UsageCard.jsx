import React from 'react';
import { supabaseBrowser } from '../../lib/supabase/browser-client';
import { Card } from '../../design-system/components/core/Card.jsx';
import { AREAS, RANGES, summarizeUsage } from './usageModel.js';

const small = { fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)', margin: 0 };
const th = { textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: 'var(--fs-caption)', padding: '2px 8px 2px 0' };
const td = { padding: '3px 8px 3px 0', fontSize: 'var(--fs-small)', verticalAlign: 'top' };
const chip = (on) => ({ padding: '4px 12px', borderRadius: 999, border: `1px solid ${on ? 'var(--brand-secondary)' : 'var(--border-default)'}`, background: on ? 'var(--brand-secondary)' : 'var(--surface-card)', color: on ? 'var(--text-on-secondary)' : 'var(--text-primary)', cursor: 'pointer', font: 'inherit', fontSize: 'var(--fs-small)' });

function Trend({ daily }) {
  const max = Math.max(1, ...daily.map((d) => d.visitors));
  const w = 100 / Math.max(daily.length, 1);
  return (
    <svg role="img" aria-label="Visitors each day" viewBox="0 0 100 30" preserveAspectRatio="none" style={{ width: '100%', height: 70, display: 'block' }}>
      {daily.map((d, i) => <rect key={d.day} x={i * w + w * 0.12} width={w * 0.76} y={30 - (d.visitors / max) * 28} height={Math.max((d.visitors / max) * 28, d.visitors ? 0.6 : 0.2)} fill="var(--brand-secondary)" opacity={d.visitors ? 1 : 0.25}><title>{`${d.day}: ${d.visitors} visitor${d.visitors === 1 ? '' : 's'}`}</title></rect>)}
    </svg>
  );
}

// Anonymous usage: how many people, which pages and features are used most, where visits start, and the usual paths.
export function UsageCard() {
  const [area, setArea] = React.useState('site');
  const [days, setDays] = React.useState(30);
  const [state, setState] = React.useState({ status: 'loading', data: null, error: '' });
  React.useEffect(() => {
    let live = true;
    setState({ status: 'loading', data: null, error: '' });
    supabaseBrowser.rpc('admin_usage_summary', { p_area: area, p_days: days }).then(({ data, error }) => {
      if (!live) return;
      if (error) setState({ status: 'error', data: null, error: error.message });
      else setState({ status: 'ready', data, error: '' });
    });
    return () => { live = false; };
  }, [area, days]);
  const m = state.status === 'ready' ? summarizeUsage(state.data, area) : null;
  return (
    <Card title="Who uses the site">
      <p style={small}>Anonymous counts only: a random code kept on each device, the pages and features used, and when. No names, emails or IP addresses, nothing a student writes, and nothing from browsers that ask not to be tracked. Kept for 13 months.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: 'var(--space-3) 0' }}>
        <div role="group" aria-label="Part of the site" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {AREAS.map((a) => <button key={a.value} type="button" aria-pressed={area === a.value} style={chip(area === a.value)} onClick={() => setArea(a.value)}>{a.label}</button>)}
        </div>
        <div role="group" aria-label="How far back" style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          {RANGES.map((r) => <button key={r.value} type="button" aria-pressed={days === r.value} style={chip(days === r.value)} onClick={() => setDays(r.value)}>{r.label}</button>)}
        </div>
      </div>
      {state.status === 'loading' && <p style={small} role="status">Counting…</p>}
      {state.status === 'error' && <p style={{ ...small, color: 'var(--color-error)' }} role="alert">Couldn't read the numbers: {state.error}</p>}
      {m && m.empty && <p style={small}>Nothing counted here yet. Numbers appear as people use the site.</p>}
      {m && !m.empty && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-5)', flexWrap: 'wrap' }}>
            {m.tiles.map((t) => <div key={t.label}><div style={{ fontSize: 'var(--fs-h3, 1.5rem)', fontWeight: 700, lineHeight: 1.1 }}>{t.value}</div><div style={small}>{t.label}{t.note ? ` (${t.note})` : ''}</div></div>)}
          </div>
          <div><Trend daily={m.daily} /><p style={small}>{m.trend}</p></div>
          {m.funnel.length > 0 && (
            <div><strong style={{ fontSize: 'var(--fs-small)' }}>How far students get</strong>
              {m.funnel.map((f) => (
                <div key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-small)', margin: '3px 0' }}>
                  <span style={{ width: 170 }}>{f.name}</span>
                  <span style={{ flex: 1, height: 8, background: 'var(--surface-sunken)', borderRadius: 4 }}><span style={{ display: 'block', height: 8, width: `${f.share}%`, background: 'var(--brand-secondary)', borderRadius: 4 }} /></span>
                  <span style={{ width: 70, textAlign: 'right' }}>{f.count} · {f.share}%</span>
                </div>
              ))}
            </div>
          )}
          {m.top.length > 0 && (
            <div><strong style={{ fontSize: 'var(--fs-small)' }}>{area === 'makeup' ? 'Most used' : 'Most visited'}</strong>
              <table style={{ borderCollapse: 'collapse', width: '100%' }}><thead><tr><th style={th}>{area === 'makeup' ? 'What' : 'Page'}</th><th style={th}>Times</th><th style={th}>People</th></tr></thead>
                <tbody>{m.top.map((t) => <tr key={t.name}><td style={td}>{t.name}</td><td style={td}>{t.count}</td><td style={td}>{t.visitors}</td></tr>)}</tbody></table></div>
          )}
          {m.entries.length > 0 && (
            <div><strong style={{ fontSize: 'var(--fs-small)' }}>Where visits start</strong>
              <table style={{ borderCollapse: 'collapse' }}><tbody>{m.entries.map((t) => <tr key={t.name}><td style={td}>{t.name}</td><td style={td}>{t.count}</td></tr>)}</tbody></table></div>
          )}
          {m.paths.length > 0 && (
            <div><strong style={{ fontSize: 'var(--fs-small)' }}>Usual paths</strong>
              <table style={{ borderCollapse: 'collapse' }}><tbody>{m.paths.map((t) => <tr key={`${t.from}>${t.to}`}><td style={td}>{t.from}</td><td style={td} aria-hidden="true">→</td><td style={td}>{t.to}</td><td style={td}>{t.count}</td></tr>)}</tbody></table></div>
          )}
        </div>
      )}
    </Card>
  );
}
