import React from 'react';
import { supabaseBrowser } from '../lib/supabase/browser-client';
import { Input } from '../design-system/components/forms/Input.jsx';
import { Button } from '../design-system/components/forms/Button.jsx';
import { Card } from '../design-system/components/core/Card.jsx';
import logo from '../assets/alta-seminary-logo.png';

export function LoginForm() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const { error: signInError } = await supabaseBrowser.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (signInError) {
      setError('Incorrect email or password.');
      return;
    }
    window.location.href = '/admin';
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-neutral-900)' }}>
      <div style={{ width: 380 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-6)' }}>
          <img src={logo.src} alt="Alta Seminary" height={48} style={{ display: 'block', width: 'auto' }} />
        </div>
        <Card title="Admin Sign In">
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@altaseminary.org" />
            <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" error={error || undefined} />
            {/* Button.jsx renders a plain <button>, which defaults to type="submit" inside a <form> */}
            <Button variant="primary" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
