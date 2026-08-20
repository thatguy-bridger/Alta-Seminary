import React from 'react';
import { EditableText } from '../admin-app/builder/EditableText.jsx';
import { textStyleToCss } from '../admin-app/builder/textStyle.js';
import { Input } from '../design-system/components/forms/Input.jsx';
import { Textarea } from '../design-system/components/forms/Textarea.jsx';
import { Button } from '../design-system/components/forms/Button.jsx';

const emptyForm = { name: '', email: '', phone: '', message: '', honeypot: '' };

// Matches the 2-minute window enforced server-side by
// enforce_contact_rate_limit() (0014_contact_form_rate_limit.sql) -- this is
// just the friendly front-line version so a visitor sees a plain message
// instead of a raw database error if they try to send twice quickly.
const COOLDOWN_MS = 2 * 60 * 1000;
const LAST_SUBMIT_KEY = 'alta-contact-last-submit';

export function ContactFormBlock({ heading, successMessage, headingStyle, editable, onFieldChange }) {
  const [form, setForm] = React.useState(emptyForm);
  const [status, setStatus] = React.useState('idle'); // idle | submitting | done | error | invalid | cooldown

  React.useEffect(() => {
    if (editable) return;
    const last = Number(localStorage.getItem(LAST_SUBMIT_KEY) || 0);
    if (Date.now() - last < COOLDOWN_MS) setStatus('cooldown');
  }, [editable]);

  function patch(key, value) { setForm((f) => ({ ...f, [key]: value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.honeypot) return; // silently drop -- a real visitor never fills this field
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setStatus('invalid');
      return;
    }
    setStatus('submitting');
    const { supabaseBrowser } = await import('../lib/supabase/browser-client');
    const { error } = await supabaseBrowser.from('contact_submissions').insert({
      name: form.name, email: form.email, phone: form.phone || null, message: form.message,
    });
    if (error) {
      console.error('contact submission failed:', error.message);
      setStatus(error.message.includes('wait a moment') ? 'cooldown' : 'error');
      return;
    }
    localStorage.setItem(LAST_SUBMIT_KEY, String(Date.now()));
    setForm(emptyForm);
    setStatus('done');
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {(editable || heading) && (
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-heading)', margin: '0 0 var(--space-5)', textAlign: 'center', color: 'var(--text-primary)', ...textStyleToCss(headingStyle) }}>
          {editable ? (
            <EditableText value={heading} onCommit={(v) => onFieldChange('heading', v)} placeholder="Heading" styleValue={headingStyle} onStyleChange={(s) => onFieldChange('headingStyle', s)} />
          ) : heading}
        </h2>
      )}

      {editable ? (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--fs-small)' }}>
          Live contact form (name / email / phone / message) -- shown here as a preview only; visitors submit it on the published page.
        </p>
      ) : status === 'done' ? (
        <p style={{ textAlign: 'center', color: 'var(--color-success)', fontFamily: 'var(--font-sans)' }}>
          {successMessage || "Thanks — we'll be in touch soon."}
        </p>
      ) : status === 'cooldown' ? (
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>
          You already sent a message a moment ago — thanks for your patience while we catch up. Try again in a couple minutes.
        </p>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Input label="Name" value={form.name} onChange={(e) => patch('name', e.target.value)} error={status === 'invalid' && !form.name.trim() ? 'Required' : undefined} />
          <Input label="Email" type="email" value={form.email} onChange={(e) => patch('email', e.target.value)} error={status === 'invalid' && !form.email.trim() ? 'Required' : undefined} />
          <Input label="Phone (optional)" value={form.phone} onChange={(e) => patch('phone', e.target.value)} />
          <Textarea label="Message" value={form.message} onChange={(e) => patch('message', e.target.value)} rows={5} error={status === 'invalid' && !form.message.trim() ? 'Required' : undefined} />
          <input
            type="text"
            name="company"
            value={form.honeypot}
            onChange={(e) => patch('honeypot', e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
          />
          {status === 'error' && (
            <p style={{ color: 'var(--color-error)', fontSize: 'var(--fs-small)' }}>Something went wrong sending your message. Please try again.</p>
          )}
          <Button variant="primary" disabled={status === 'submitting'}>
            {status === 'submitting' ? 'Sending…' : 'Send message'}
          </Button>
        </form>
      )}
    </div>
  );
}
