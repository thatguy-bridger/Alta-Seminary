import React from 'react';
import { supabaseBrowser } from '../../lib/supabase/browser-client';
import { Card } from '../../design-system/components/core/Card.jsx';
import { Badge } from '../../design-system/components/core/Badge.jsx';
import { Button } from '../../design-system/components/forms/Button.jsx';
import { Toast } from '../../design-system/components/core/Toast.jsx';
import { withBase } from '../../lib/url.js';

const GITHUB_OWNER = 'thatguy-bridger';
const GITHUB_REPO = 'Alta-Seminary';

const STATUS_TONE = { ok: 'success', warn: 'warning', error: 'error', info: 'info', checking: 'neutral' };
const STATUS_LABEL = { ok: 'Healthy', warn: 'Needs attention', error: 'Broken', info: 'Info', checking: 'Checking…' };

// This is a developer-facing panel (checks reach into GitHub's API and raw
// Supabase tables that don't matter for day-to-day publishing), but any
// admin can end up here -- every DiagnosticItem below explains itself in
// plain language via its own "What is this?" toggle.
//
// No "deploy pipeline"/"force redeploy" check here anymore -- the site
// moved from GitHub Pages (needed a rebuild-and-redeploy step on every
// publish) to Vercel server rendering (reads straight from the database on
// each request, so there's nothing to trigger or wait on). Vercel itself
// auto-deploys on every git push; check its own dashboard for that history.
export function DiagnosticsScreen() {
  const [checks, setChecks] = React.useState({});
  const [toast, setToast] = React.useState(null);
  const [scanResult, setScanResult] = React.useState(null);
  const [scanning, setScanning] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);

  function setCheck(id, patch) {
    setChecks((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  React.useEffect(() => {
    runAllChecks();
  }, []);

  async function ghRuns(workflow) {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${workflow}/runs?per_page=5`);
    if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);
    const data = await res.json();
    return data.workflow_runs || [];
  }

  async function runAllChecks() {
    setCheck('sweep', { status: 'checking' });
    setCheck('env', { status: 'checking' });
    setCheck('db', { status: 'checking' });
    setCheck('backlog', { status: 'checking' });
    setCheck('publishSignal', { status: 'checking' });
    setCheck('media', { status: 'checking' });
    setCheck('site', { status: 'checking' });

    // Scheduled-content sweep cron
    ghRuns('sweep-scheduled.yml').then((runs) => {
      const latest = runs[0];
      if (!latest) return setCheck('sweep', { status: 'warn', detail: 'No sweep runs found yet -- has the workflow file been pushed?', runs: [] });
      const status = latest.conclusion === 'success' ? 'ok' : latest.status !== 'completed' ? 'warn' : 'error';
      setCheck('sweep', {
        status, runs,
        detail: `Latest: ${latest.conclusion || latest.status} · ${new Date(latest.created_at).toLocaleString()}`,
      });
    }).catch((err) => setCheck('sweep', { status: 'error', detail: `Couldn't reach GitHub: ${err.message}` }));

    // Build-time env vars (client-visible values only -- both are meant to be public, see .env.example)
    const url = import.meta.env.PUBLIC_SUPABASE_URL;
    const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
    setCheck('env', {
      status: url && key ? 'ok' : 'error',
      detail: url && key ? `URL and key are both set (${url}).` : 'PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY is missing from this build.',
    });

    // Live DB connectivity
    supabaseBrowser.from('site_settings').select('id').limit(1).then(({ error }) => {
      setCheck('db', { status: error ? 'error' : 'ok', detail: error ? error.message : 'Reached Supabase and read a row just now.' });
    });

    // Scheduled items stuck in the past (sweep should have caught these)
    const now = new Date().toISOString();
    Promise.all([
      supabaseBrowser.from('pages').select('title, publish_at').eq('status', 'scheduled').lt('publish_at', now),
      supabaseBrowser.from('blog_posts').select('title, publish_at').eq('status', 'scheduled').lt('publish_at', now),
    ]).then(([pages, posts]) => {
      const overdue = [...(pages.data || []), ...(posts.data || [])];
      setCheck('backlog', {
        status: overdue.length > 0 ? 'warn' : 'ok',
        detail: overdue.length > 0
          ? `${overdue.length} item(s) scheduled to publish in the past, still not live: ${overdue.map((o) => o.title).join(', ')}.`
          : 'Nothing is stuck.',
      });
    });

    // Most recent publish -- informational, not pass/fail
    supabaseBrowser.from('publish_events').select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle().then(({ data }) => {
      setCheck('publishSignal', {
        status: 'info',
        detail: data ? `Last publish event: ${new Date(data.created_at).toLocaleString()}.` : 'No publish events recorded yet.',
      });
    });

    // Media library tracking
    supabaseBrowser.from('media_library').select('id', { count: 'exact', head: true }).then(({ count }) => {
      setCheck('media', { status: 'info', detail: `${count ?? 0} image(s) tracked in the reuse library.` });
    });

    // Is the live site actually reachable right now
    fetch(withBase('/'), { method: 'HEAD', cache: 'no-store' }).then((res) => {
      setCheck('site', { status: res.ok ? 'ok' : 'error', detail: `Homepage responded ${res.status}.` });
    }).catch((err) => setCheck('site', { status: 'error', detail: `Couldn't reach the site: ${err.message}` }));
  }

  async function handleScan() {
    setScanning(true);
    setScanResult(null);
    try {
      const [{ data: pages }, { data: posts }, { data: routes }] = await Promise.all([
        supabaseBrowser.from('public_pages').select('title, published_blocks'),
        supabaseBrowser.from('public_blog_posts').select('title, published_blocks'),
        fetch(withBase('/routes.json')).then((r) => (r.ok ? r.json() : [])),
      ]);
      const knownRoutes = new Set(routes);
      const images = new Map(); // url -> [sourceTitle, ...]
      const internalLinks = new Map();
      const externalLinks = new Map();

      function walk(node, sourceTitle) {
        if (Array.isArray(node)) { node.forEach((n) => walk(n, sourceTitle)); return; }
        if (node && typeof node === 'object') {
          for (const [key, val] of Object.entries(node)) {
            if (typeof val === 'string' && val) {
              if (/image|photo|avatar|background/i.test(key) && /^https?:\/\//.test(val)) {
                if (!images.has(val)) images.set(val, []);
                images.get(val).push(sourceTitle);
              } else if (/^(link|href)$/i.test(key)) {
                const bucket = val.startsWith('/') || val.startsWith(withBase('/')) ? internalLinks : /^https?:\/\//.test(val) ? externalLinks : null;
                if (bucket) {
                  if (!bucket.has(val)) bucket.set(val, []);
                  bucket.get(val).push(sourceTitle);
                }
              }
            } else {
              walk(val, sourceTitle);
            }
          }
        }
      }
      [...(pages || []), ...(posts || [])].forEach((row) => walk(row.published_blocks, row.title));

      const imageChecks = await Promise.all(
        [...images.entries()].map(([url, sources]) => checkImage(url).then((ok) => ({ url, sources, ok })))
      );
      const brokenImages = imageChecks.filter((r) => !r.ok);

      const brokenInternalLinks = [...internalLinks.entries()]
        .map(([url, sources]) => ({ url, sources }))
        .filter(({ url }) => {
          const clean = url.replace(withBase(''), '').split('?')[0].split('#')[0];
          const normalized = clean.length > 1 && clean.endsWith('/') ? clean.slice(0, -1) : clean;
          return !knownRoutes.has(normalized) && normalized !== '';
        });

      setScanResult({
        imagesChecked: imageChecks.length,
        brokenImages,
        brokenInternalLinks,
        externalLinkCount: externalLinks.size,
      });
    } catch (err) {
      setToast({ tone: 'error', text: 'Scan failed: ' + err.message });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setScanning(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const tables = ['pages', 'blog_posts', 'directories', 'directory_entries', 'directory_field_definitions', 'gallery_albums', 'gallery_photos', 'calendar_events', 'site_settings'];
      const results = await Promise.all(tables.map((t) => supabaseBrowser.from(t).select('*')));
      const bundle = {};
      tables.forEach((t, i) => { bundle[t] = results[i].data || []; });
      bundle._exportedAt = new Date().toISOString();
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `alta-seminary-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setToast({ tone: 'error', text: 'Export failed: ' + err.message });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-display)', margin: '0 0 var(--space-2)' }}>Diagnostics</h2>
      <p style={{ color: 'var(--text-secondary)', marginTop: 0, fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)', maxWidth: 640 }}>
        A developer-facing status panel for the website, its database, and its build pipeline. Nothing here is needed
        for day-to-day publishing -- come here if something seems broken and you want to know what, or if support
        asks you to check something. Every item explains itself below its status if you're not sure what it means.
      </p>
      <div style={{ margin: 'var(--space-4) 0' }}>
        <Button variant="outline" size="sm" onClick={runAllChecks}>↻ Re-run all checks</Button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <DiagnosticItem
          id="sweep" check={checks.sweep} title="Scheduled-publish sweep"
          explanation="A separate automatic job that runs every 15 minutes, checking for anything scheduled to publish or unpublish and doing it. If this is broken, scheduled publishing silently won't happen -- content will just stay in draft past its scheduled time. This requires a one-time setup (a database migration and an Edge Function) that's easy to miss."
        >
          {checks.sweep?.runs?.length > 0 && <RunList runs={checks.sweep.runs} />}
        </DiagnosticItem>

        <DiagnosticItem
          id="env" check={checks.env} title="Site configuration"
          explanation="The site needs to know which Supabase project to talk to. These two values get baked in whenever Vercel builds the site (on every push). If either is missing, the entire site breaks -- pages would show no content at all."
        />

        <DiagnosticItem
          id="db" check={checks.db} title="Database connection"
          explanation="A live check, right now, that this browser can actually reach and read from the database. If this fails, check whether the Supabase project is paused (free-tier projects pause after a week of no activity) or whether the URL/key above are wrong."
        />

        <DiagnosticItem
          id="backlog" check={checks.backlog} title="Stuck scheduled content"
          explanation="Anything that was scheduled to publish (or unpublish) at a time that's already passed, but is still sitting there unchanged. If anything shows up here, it almost always means the Scheduled-publish sweep above isn't running -- fix that first."
        />

        <DiagnosticItem
          id="publishSignal" check={checks.publishSignal} title="Last publish activity"
          explanation="Purely informational -- the last time anything was actually published (not just edited). Useful for sanity-checking that the publish pipeline is genuinely being used/exercised, not just configured."
        />

        <DiagnosticItem
          id="media" check={checks.media} title="Image library"
          explanation="How many uploaded images are tracked for the 'choose an existing image' picker. Purely informational."
        />

        <DiagnosticItem
          id="site" check={checks.site} title="Site reachability"
          explanation="A live check, right now, that the public homepage actually responds. Confirms the last successful deploy is actually being served."
        />
      </div>

      <h3 style={{ fontFamily: 'var(--font-display)', margin: 'var(--space-8) 0 var(--space-3)' }}>Tools</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 'var(--fw-bold)' }}>Check for broken images & links</div>
              <InfoToggle text="Scans every published page and announcement for image and internal-link references, and checks whether each one actually loads. External links (to other websites) are listed but not verified, since browsers can't reliably check other sites' status from here. Read-only -- doesn't change anything." />
            </div>
            <Button variant="outline" size="sm" disabled={scanning} onClick={handleScan}>
              {scanning ? 'Scanning…' : 'Run scan'}
            </Button>
          </div>
          {scanResult && <ScanResults result={scanResult} />}
        </Card>

        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 'var(--fw-bold)' }}>Download a full content backup</div>
              <InfoToggle text="Downloads every page, announcement, directory entry, gallery item, event, and site setting as one JSON file -- an independent backup, separate from Supabase itself. Read-only -- doesn't change anything." />
            </div>
            <Button variant="outline" size="sm" disabled={exporting} onClick={handleExport}>
              {exporting ? 'Preparing…' : 'Download backup'}
            </Button>
          </div>
        </Card>
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 'var(--space-6)', right: 'var(--space-6)' }}>
          <Toast tone={toast.tone}>{toast.text}</Toast>
        </div>
      )}
    </div>
  );
}

function checkImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => resolve(false), 8000);
    img.onload = () => { clearTimeout(timer); resolve(true); };
    img.onerror = () => { clearTimeout(timer); resolve(false); };
    img.src = url;
  });
}

function InfoToggle({ text }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{ marginTop: 4 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-link)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)' }}
      >
        {open ? 'Hide details' : 'What is this?'}
      </button>
      {open && <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', maxWidth: 520 }}>{text}</p>}
    </div>
  );
}

function DiagnosticItem({ check, title, explanation, children }) {
  const status = check?.status || 'checking';
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)' }}>{title}</span>
            <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
          </div>
          {check?.detail && (
            <p style={{ margin: 'var(--space-2) 0 0', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)' }}>{check.detail}</p>
          )}
          <InfoToggle text={explanation} />
          {children}
        </div>
      </div>
    </Card>
  );
}

function RunList({ runs }) {
  return (
    <div style={{ marginTop: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 4 }}>
      {runs.slice(0, 5).map((run) => (
        <a
          key={run.id}
          href={run.html_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono, monospace)', fontSize: 'var(--fs-caption)', color: 'var(--text-link)', textDecoration: 'none' }}
        >
          <span>{run.conclusion || run.status}</span>
          <span>{new Date(run.created_at).toLocaleString()}</span>
        </a>
      ))}
    </div>
  );
}

function ScanResults({ result }) {
  const clean = result.brokenImages.length === 0 && result.brokenInternalLinks.length === 0;
  return (
    <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-subtle)' }}>
      {clean ? (
        <p style={{ color: 'var(--color-success)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)' }}>
          Checked {result.imagesChecked} image(s) and every internal link -- nothing broken.
        </p>
      ) : (
        <>
          {result.brokenImages.length > 0 && (
            <div style={{ marginBottom: 'var(--space-3)' }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 'var(--fw-bold)', color: 'var(--color-error)', fontSize: 'var(--fs-small)' }}>
                {result.brokenImages.length} broken image(s)
              </div>
              {result.brokenImages.map((img) => (
                <div key={img.url} style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                  {img.url} — used on: {img.sources.join(', ')}
                </div>
              ))}
            </div>
          )}
          {result.brokenInternalLinks.length > 0 && (
            <div>
              <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 'var(--fw-bold)', color: 'var(--color-error)', fontSize: 'var(--fs-small)' }}>
                {result.brokenInternalLinks.length} broken internal link(s)
              </div>
              {result.brokenInternalLinks.map((link) => (
                <div key={link.url} style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                  {link.url} — used on: {link.sources.join(', ')}
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {result.externalLinkCount > 0 && (
        <p style={{ marginTop: 'var(--space-3)', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)' }}>
          {result.externalLinkCount} external link(s) found, not automatically checked.
        </p>
      )}
    </div>
  );
}
