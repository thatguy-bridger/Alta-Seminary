import React from 'react';
import { supabaseBrowser } from '../../lib/supabase/browser-client';
import { Card } from '../../design-system/components/core/Card.jsx';
import { Badge } from '../../design-system/components/core/Badge.jsx';
import { Tabs } from '../../design-system/components/core/Tabs.jsx';
import { Button } from '../../design-system/components/forms/Button.jsx';
import { Toast } from '../../design-system/components/core/Toast.jsx';
import { HistoryDetails } from '../history/HistoryDetails.jsx';

const PAGE_SIZE = 50;

// Groups mirror the admin nav sections in AdminShell.jsx, minus Contact
// (inbound submissions aren't instrumented -- see 0010_change_history.sql).
const FILTERS = {
  All: null,
  Pages: ['pages'],
  Announcements: ['blog_posts'],
  Directory: ['directory_entries', 'directories', 'directory_field_definitions'],
  Gallery: ['gallery_albums', 'gallery_photos'],
  Events: ['calendar_events'],
  Team: ['admin_profiles'],
  Settings: ['site_settings'],
  Errors: ['deploy'],
};

const TABLE_LABELS = {
  pages: 'Page',
  blog_posts: 'Announcement',
  directory_entries: 'Directory entry',
  directories: 'Directory',
  directory_field_definitions: 'Directory field',
  gallery_albums: 'Gallery album',
  gallery_photos: 'Gallery photo',
  calendar_events: 'Event',
  site_settings: 'Site settings',
  admin_profiles: 'Admin',
  deploy: 'Site deploy',
};

const ACTION_LABELS = { insert: 'Created', update: 'Updated', delete: 'Deleted', undo: 'Undone', error: 'Failed' };
const ACTION_TONES = { insert: 'success', update: 'info', delete: 'error', undo: 'warning', error: 'error' };

function formatWhen(iso) {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function signatureOf(row) {
  return row.changed_by_name || row.changed_by_email || 'Unknown admin';
}

export function HistoryScreen() {
  const [filter, setFilter] = React.useState('All');
  const [rows, setRows] = React.useState(null);
  const [hasMore, setHasMore] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [undoingId, setUndoingId] = React.useState(null);
  const [toast, setToast] = React.useState(null);

  async function load(offset = 0, append = false) {
    let query = supabaseBrowser
      .from('change_log')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    const tables = FILTERS[filter];
    if (tables) query = query.in('table_name', tables);

    const { data, error } = await query;
    if (error) {
      setToast({ tone: 'error', text: 'Could not load history: ' + error.message });
      return;
    }
    setRows((prev) => (append ? [...(prev || []), ...data] : data));
    setHasMore(data.length === PAGE_SIZE);
  }

  React.useEffect(() => {
    setRows(null);
    load(0, false);
  }, [filter]);

  async function handleLoadMore() {
    setLoadingMore(true);
    await load(rows.length, true);
    setLoadingMore(false);
  }

  async function handleUndo(row) {
    const label = row.record_label || TABLE_LABELS[row.table_name] || row.table_name;
    if (!window.confirm(`Undo this change to "${label}"? This restores it to how it was before.`)) return;
    setUndoingId(row.id);
    const { error } = await supabaseBrowser.rpc('undo_change', { p_change_id: row.id });
    setUndoingId(null);
    if (error) {
      setToast({ tone: 'error', text: 'Could not undo: ' + error.message });
      return;
    }
    setToast({ tone: 'success', text: `Reverted "${label}."` });
    setRows(null);
    load(0, false);
    setTimeout(() => setToast(null), 4000);
  }

  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-display)', margin: '0 0 var(--space-4)' }}>History</h2>
      <p style={{ color: 'var(--text-secondary)', marginTop: 0, fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)' }}>
        Every change admins make, with who made it and when. Undo restores a change to how it was before.
      </p>

      <Tabs tabs={Object.keys(FILTERS)} active={filter} onChange={setFilter} />

      <div style={{ marginTop: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {rows === null ? (
          <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>
        ) : rows.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-small)' }}>No changes recorded yet.</p>
        ) : (
          rows.map((row) => (
            <Card key={row.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                    <Badge tone={ACTION_TONES[row.action]}>{ACTION_LABELS[row.action]}</Badge>
                    <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)' }}>
                      {TABLE_LABELS[row.table_name] || row.table_name}
                      {row.record_label ? `: ${row.record_label}` : ''}
                    </span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)', color: 'var(--text-muted)' }}>
                    <span title={new Date(row.created_at).toLocaleString()}>{formatWhen(row.created_at)}</span>
                    {' · '}
                    {signatureOf(row)}
                  </div>
                  {row.action === 'undo' && (
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)' }}>
                      Reverted an earlier change.
                    </div>
                  )}
                  {row.reverted_by_change_id && (
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)' }}>
                      Reverted.
                    </div>
                  )}
                </div>
                {row.action !== 'undo' && row.action !== 'error' && !row.reverted_by_change_id && (
                  <Button variant="ghost" size="sm" disabled={undoingId === row.id} onClick={() => handleUndo(row)}>
                    {undoingId === row.id ? 'Undoing…' : 'Undo'}
                  </Button>
                )}
              </div>
              {(row.before_data || row.after_data) && (
                <details style={{ marginTop: 'var(--space-3)' }}>
                  <summary style={{ cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-link)' }}>
                    Details
                  </summary>
                  <HistoryDetails row={row} />
                </details>
              )}
            </Card>
          ))
        )}
      </div>

      {hasMore && (
        <div style={{ marginTop: 'var(--space-4)' }}>
          <Button variant="ghost" disabled={loadingMore} onClick={handleLoadMore}>
            {loadingMore ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 'var(--space-6)', right: 'var(--space-6)' }}>
          <Toast tone={toast.tone}>{toast.text}</Toast>
        </div>
      )}
    </div>
  );
}
