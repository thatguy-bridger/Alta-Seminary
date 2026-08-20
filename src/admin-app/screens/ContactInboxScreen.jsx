import React from 'react';
import { supabaseBrowser } from '../../lib/supabase/browser-client';
import { Card } from '../../design-system/components/core/Card.jsx';
import { Badge } from '../../design-system/components/core/Badge.jsx';
import { Tabs } from '../../design-system/components/core/Tabs.jsx';
import { TrashIcon } from '../icons.jsx';
import { useConfirm } from '../ConfirmProvider.jsx';

const FILTERS = { New: 'new', Read: 'read', Archived: 'archived' };
const STATUS_TONE = { new: 'info', read: 'neutral', archived: 'neutral' };

export function ContactInboxScreen() {
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = React.useState('New');
  const [rows, setRows] = React.useState(null);

  async function load() {
    const { data } = await supabaseBrowser
      .from('contact_submissions')
      .select('*')
      .eq('status', FILTERS[activeTab])
      .order('created_at', { ascending: false });
    setRows(data || []);
  }

  React.useEffect(() => { setRows(null); load(); }, [activeTab]);

  async function setStatus(row, status) {
    await supabaseBrowser.from('contact_submissions').update({ status }).eq('id', row.id);
    load();
  }

  async function handleDelete(row) {
    if (!(await confirm(`Delete this message from "${row.name}"? This can't be undone.`, { title: 'Delete message?', confirmLabel: 'Delete', danger: true }))) return;
    await supabaseBrowser.from('contact_submissions').delete().eq('id', row.id);
    load();
  }

  return (
    <Card title="Contact Submissions">
      <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-small)', marginTop: 0 }}>
        Messages sent through the Contact Form block on the public site.
      </p>
      <Tabs tabs={Object.keys(FILTERS)} active={activeTab} onChange={setActiveTab} />
      <div style={{ marginTop: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {rows === null ? (
          <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>
        ) : rows.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-small)' }}>No {activeTab.toLowerCase()} messages.</p>
        ) : (
          rows.map((row) => (
            <div key={row.id} style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)' }}>{row.name}</div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)', color: 'var(--text-muted)' }}>
                    <a href={`mailto:${row.email}`} style={{ color: 'inherit' }}>{row.email}</a>
                    {row.phone && <> · {row.phone}</>}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)' }}>
                    {new Date(row.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              </div>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-body)', color: 'var(--text-secondary)', margin: 'var(--space-3) 0' }}>
                {row.message}
              </p>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                {row.status !== 'new' && (
                  <button className="btn btn-outline btn-sm" onClick={() => setStatus(row, 'new')}>Mark unread</button>
                )}
                {row.status !== 'read' && (
                  <button className="btn btn-outline btn-sm" onClick={() => setStatus(row, 'read')}>Mark read</button>
                )}
                {row.status !== 'archived' && (
                  <button className="btn btn-outline btn-sm" onClick={() => setStatus(row, 'archived')}>Archive</button>
                )}
                <button onClick={() => handleDelete(row)} title="Delete" style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', color: 'var(--color-error)', marginLeft: 'auto' }}>
                  <TrashIcon />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
