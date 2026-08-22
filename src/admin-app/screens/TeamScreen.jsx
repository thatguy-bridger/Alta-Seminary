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
    // admin_directory (not admin_profiles directly) -- a view joining in the
    // handful of auth.users columns Supabase's own Users table shows
    // (created date, last sign-in, confirmed status, sign-in method) that
    // otherwise aren't reachable from the browser client at all. See
    // 0021_admin_directory_view.sql.
    const { data, error } = await supabaseBrowser
      .from('admin_directory')
      .select('id, email, display_name, invited_at, created_at, last_sign_in_at, confirmed, provider')
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
          // overflow-x here, not the page -- this table is genuinely wider
          // than it needs to wrap, and nothing sticky lives inside it, so a
          // local scrollbar on just this box is the right call rather than
          // squeezing every column down to illegibility.
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)', whiteSpace: 'nowrap' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: 'var(--fs-caption)', textTransform: 'uppercase', letterSpacing: 'var(--ls-caption)' }}>
                  <th style={thStyle}>Admin</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Sign-in method</th>
                  <th style={thStyle}>Created</th>
                  <th style={thStyle}>Last sign-in</th>
                  <th style={thStyle}>Invited</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((a) => (
                  <tr key={a.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <td style={tdStyle}>
                      <div style={{ color: 'var(--text-primary)', fontWeight: 'var(--fw-bold)' }}>{a.display_name || '—'}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-caption)' }}>{a.email}</div>
                    </td>
                    <td style={tdStyle}>
                      <Badge tone={a.confirmed ? 'success' : 'warning'}>{a.confirmed ? 'Confirmed' : 'Invite pending'}</Badge>
                    </td>
                    <td style={tdStyle}>{a.provider}</td>
                    <td style={tdStyle}>{a.created_at ? new Date(a.created_at).toLocaleDateString() : '—'}</td>
                    <td style={tdStyle}>{a.last_sign_in_at ? new Date(a.last_sign_in_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Never'}</td>
                    <td style={tdStyle}>{a.invited_at ? new Date(a.invited_at).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

const thStyle = { padding: 'var(--space-2) var(--space-3)', fontWeight: 'var(--fw-bold)' };
const tdStyle = { padding: 'var(--space-3)', verticalAlign: 'top' };
