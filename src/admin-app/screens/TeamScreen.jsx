import React from 'react';
import { supabaseBrowser } from '../../lib/supabase/browser-client';
import { Input } from '../../design-system/components/forms/Input.jsx';
import { Button } from '../../design-system/components/forms/Button.jsx';
import { Card } from '../../design-system/components/core/Card.jsx';
import { Badge } from '../../design-system/components/core/Badge.jsx';
import { Toast } from '../../design-system/components/core/Toast.jsx';

export function TeamScreen() {
  const [admins, setAdmins] = React.useState(null);
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [inviting, setInviting] = React.useState(false);
  const [message, setMessage] = React.useState(null); // { tone, text }

  async function loadAdmins() {
    const { data, error } = await supabaseBrowser
      .from('admin_profiles')
      .select('id, email, display_name, invited_at')
      .order('invited_at', { ascending: true });
    if (!error) setAdmins(data);
  }

  React.useEffect(() => {
    loadAdmins();
  }, []);

  async function handleInvite(e) {
    e.preventDefault();
    setMessage(null);
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.split(/\s+/).length < 2) {
      setMessage({ tone: 'error', text: 'Enter their first and last name.' });
      return;
    }
    setInviting(true);
    const { data, error } = await supabaseBrowser.functions.invoke('invite-admin', {
      body: { email, name: trimmedName },
    });
    setInviting(false);
    if (error || data?.error) {
      setMessage({ tone: 'error', text: data?.error || 'Could not send the invite.' });
      return;
    }
    setMessage({ tone: 'success', text: `Invite sent to ${trimmedName} (${email}).` });
    setName('');
    setEmail('');
    loadAdmins();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', maxWidth: 640 }}>
      <Card title="Invite a new admin">
        <form onSubmit={handleInvite} style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <Input label="Full name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teacher@churchofjesuschrist.org" />
          </div>
          <Button variant="primary" disabled={inviting || !email || !name}>
            {inviting ? 'Sending…' : 'Send invite'}
          </Button>
        </form>
        {message && (
          <div style={{ marginTop: 'var(--space-4)' }}>
            <Toast tone={message.tone}>{message.text}</Toast>
          </div>
        )}
      </Card>

      <Card title="Current admins">
        {admins === null ? (
          <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>
        ) : admins.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>No admins yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {admins.map((a) => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}>
                  {a.display_name ? (
                    <>
                      {a.display_name} <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-small)' }}>({a.email})</span>
                    </>
                  ) : (
                    a.email
                  )}
                </span>
                <Badge>{new Date(a.invited_at).toLocaleDateString()}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
