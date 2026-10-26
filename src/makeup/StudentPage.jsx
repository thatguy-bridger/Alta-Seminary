import React from 'react';
import './journey.css';
import logo from '../assets/alta-seminary-logo.png';
import { withBase } from '../lib/url.js';
import { supabaseBrowser } from '../lib/supabase/browser-client';
import { MakeupJourney } from './MakeupJourney.jsx';
import { AV_KINDS } from './content.js';
import { mediaKind } from './media.js';

// What students can use: text lessons, and video or audio only if it has a transcript and an address the player understands.
export const isUsableForStudents = (s) => (AV_KINDS.includes(s.kind) ? !!(s.transcript?.length && mediaKind(s.embed_url)) : !!s.body);

// Decides what the student page shows. The database has the last word: while Makeup Work is off, the
// student views are empty and submit_makeup() refuses, whatever this page does.
export async function loadStudentData(client) {
  try {
    const open = await client.rpc('makeup_work_open');
    if (open.error) return { state: 'error' };
    if (!open.data) return { state: 'closed' };
    const [c, s] = await Promise.all([client.from('public_makeup_classes').select('*'), client.from('public_makeup_sources').select('*')]);
    if (c.error || s.error) return { state: 'error' };
    const sources = (s.data || []).filter(isUsableForStudents);
    if (!(c.data || []).length || !sources.length) return { state: 'empty' };
    return { state: 'ready', classes: c.data, sources };
  } catch {
    return { state: 'error' };
  }
}

export async function submitMakeup(client, rpc) {
  const { data, error } = await client.rpc('submit_makeup', rpc);
  if (error) return { ok: false, error: error.message };
  // Tell the teacher. Best effort and never in the student's way: the submission is already saved, and the admin can resend.
  try { Promise.resolve(client.functions.invoke('makeup-notify', { body: { submission_id: data } })).catch(() => {}); } catch { /* saved already */ }
  return { ok: true, saved: true, id: data };
}

const MESSAGES = {
  closed: ['Makeup Work is not open right now.', 'Please check with your teacher.'],
  empty: ['Makeup Work is not ready yet.', 'Please check with your teacher.'],
  error: ['We could not load Makeup Work.', 'Check your connection and try again in a moment.'],
};

function Quiet({ state }) {
  const [title, hint] = MESSAGES[state];
  return (
    <div className="mw-stage full" style={{ display: 'grid', placeItems: 'center', padding: 24 }}>
      <section className="mw-card" style={{ maxWidth: 480, textAlign: 'center', alignItems: 'center' }}>
        <img src={logo.src} alt="Alta Seminary" style={{ height: 44, margin: '0 auto 8px' }} />
        <h1 className="mw-h" style={{ fontSize: 24 }}>{title}</h1>
        <p className="mw-sub">{hint}</p>
        <p><a className="mw-ghost" href={withBase('/makeup-work')} style={{ display: 'inline-block', textDecoration: 'none' }}>Back to Makeup Work</a></p>
      </section>
    </div>
  );
}

export function StudentPage() {
  const [data, setData] = React.useState({ state: 'loading' });
  React.useEffect(() => { let live = true; loadStudentData(supabaseBrowser).then((d) => { if (live) setData(d); }); return () => { live = false; }; }, []);
  if (data.state === 'loading') return <div className="mw-stage full" aria-busy="true" />;
  if (data.state !== 'ready') return <Quiet state={data.state} />;
  return <MakeupJourney full persist classes={data.classes} sources={data.sources} onSubmit={({ rpc }) => submitMakeup(supabaseBrowser, rpc)} />;
}
