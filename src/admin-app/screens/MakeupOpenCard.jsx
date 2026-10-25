import React from 'react';
import { supabaseBrowser } from '../../lib/supabase/browser-client';
import { Card } from '../../design-system/components/core/Card.jsx';
import { Button } from '../../design-system/components/forms/Button.jsx';
import { Switch } from '../../design-system/components/forms/Switch.jsx';
import { withBase } from '../../lib/url.js';
import { InfoButton } from '../guide/InfoButton.jsx';
import { emailMessage } from '../../makeup/review.js';

const small = { fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)', margin: 0 };
const STUDENT_PATH = '/makeup-work/start';

// The on/off switch, and everything an admin needs to open Makeup Work to students: the link, whether it is ready, and email.
export function MakeupOpenCard({ enabled, setEnabled, activeClasses, shownLessons, flash, msg }) {
  const [emailMsg, setEmailMsg] = React.useState('');
  const link = `${window.location.origin}${withBase(STUDENT_PATH)}`;
  const ready = activeClasses > 0 && shownLessons > 0;

  async function toggle(on) {
    setEnabled(on);
    const { error } = await supabaseBrowser.from('site_settings').update({ makeup_work_enabled: on }).eq('id', true);
    if (error) { setEnabled(!on); flash(`Couldn't save: ${error.message}`); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(link); flash('Link copied.'); } catch { flash(link); }
  }
  async function testEmail() {
    setEmailMsg('Sending…');
    const { data, error } = await supabaseBrowser.functions.invoke('makeup-notify', { body: { test: true } });
    const status = data?.status || (error ? 'error' : '');
    setEmailMsg(status === 'sent' ? `Sent to ${data.to}. Check that inbox (and spam).` : emailMessage(status, data?.error || error?.message));
  }

  return (
    <Card title={<>Makeup Work <InfoButton feature="makeup" /></>}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontFamily: 'var(--font-sans)' }}>
        <Switch checked={enabled} onChange={(e) => toggle(e.target.checked)} />
        Makeup Work is open to students
      </label>

      {enabled ? (
        <div style={{ marginTop: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <p style={{ ...small, color: 'var(--text-secondary)' }}>Students go to this address. It is not in the site menu, so share it or add a button for it on your Makeup Work page.</p>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
            <code style={{ fontSize: 'var(--fs-small)', wordBreak: 'break-all' }}>{link}</code>
            <Button variant="outline" size="sm" onClick={copy}>Copy link</Button>
            <a className="btn btn-outline btn-sm" href={link} target="_blank" rel="noopener" style={{ textDecoration: 'none' }}>Open it</a>
          </div>
        </div>
      ) : (
        <p style={{ ...small, marginTop: 'var(--space-3)' }}>It is off. Anyone who opens the student link sees "Makeup Work is not open right now", and nothing can be submitted.</p>
      )}

      <ul style={{ ...small, listStyle: 'none', padding: 0, margin: 'var(--space-3) 0 0', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <li style={{ color: activeClasses > 0 ? 'var(--color-success)' : 'var(--color-warning)' }}>{activeClasses > 0 ? '✓' : '!'} {activeClasses > 0 ? `${activeClasses} active class${activeClasses > 1 ? 'es' : ''}` : 'Add at least one class below, or students will see "not ready yet"'}</li>
        <li style={{ color: shownLessons > 0 ? 'var(--color-success)' : 'var(--color-warning)' }}>{shownLessons > 0 ? '✓' : '!'} {shownLessons > 0 ? `${shownLessons} lessons shown to students` : 'No lessons are shown to students yet'}</li>
        {enabled && !ready && <li style={{ color: 'var(--color-warning)' }}>Students cannot start until both are ready.</li>}
      </ul>

      <details style={{ marginTop: 'var(--space-3)' }}>
        <summary style={{ cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Email to teachers</summary>
        <div style={{ ...small, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', paddingTop: 'var(--space-2)' }}>
          <p style={small}>Each time a student finishes, their teacher is emailed. Until email is set up, submissions are still saved here and marked "Not emailed". One-time setup:</p>
          <ol style={{ margin: 0, paddingLeft: '1.2em' }}>
            <li>Create a free account at resend.com and verify the address or domain you will send from.</li>
            <li>Copy the API key Resend gives you.</li>
            <li>In Supabase, open Edge Functions, then Secrets, and add <code>RESEND_API_KEY</code> (the key) and <code>MAKEUP_FROM</code> (for example <code>Alta Seminary &lt;makeup@yourdomain.org&gt;</code>).</li>
            <li>Come back here and press the button below. It sends one test email to your own address.</li>
          </ol>
          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
            <Button variant="outline" size="sm" onClick={testEmail}>Send me a test email</Button>
            {emailMsg && <span role="status">{emailMsg}</span>}
          </div>
        </div>
      </details>

      <div style={{ marginTop: 'var(--space-3)' }}><a className="btn btn-secondary btn-sm" href={withBase('/admin/makeup-work/test')} style={{ textDecoration: 'none' }}>Try the student experience →</a></div>
      {msg && <p role="status" style={{ ...small, marginTop: 'var(--space-3)' }}>{msg}</p>}
    </Card>
  );
}
