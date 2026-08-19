import React from 'react';
import { supabaseBrowser } from '../lib/supabase/browser-client';
import { Input } from '../design-system/components/forms/Input.jsx';
import { Button } from '../design-system/components/forms/Button.jsx';
import { Card } from '../design-system/components/core/Card.jsx';

// Landing page for invite-email links. Supabase's client detects the invite
// token in the URL automatically (detectSessionInUrl, on by default) and
// establishes a temporary session — this form just needs to set a real password.
export function SetPasswordForm() {
  const [checking, setChecking] = React.useState(true);
  const [hasSession, setHasSession] = React.useState(false);
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);

  React.useEffect(() => {
    supabaseBrowser.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
      setChecking(false);
    });
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    const { error: updateError } = await supabaseBrowser.auth.updateUser({ password });
    setSubmitting(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDone(true);
    setTimeout(() => { window.location.href = '/admin'; }, 1200);
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-neutral-900)' }}>
      <div style={{ width: 380 }}>
        <Card title="Set your password">
          {checking ? (
            <p style={{ color: 'var(--text-secondary)' }}>Checking your invite link…</p>
          ) : !hasSession ? (
            <p style={{ color: 'var(--color-error)' }}>
              This invite link is invalid or has expired. Ask another admin to send a new invite.
            </p>
          ) : done ? (
            <p style={{ color: 'var(--color-success)' }}>Password set — taking you to the admin dashboard…</p>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <Input label="New password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
              <Input label="Confirm password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} error={error || undefined} />
              <Button variant="primary" disabled={submitting}>
                {submitting ? 'Saving…' : 'Set password & continue'}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
