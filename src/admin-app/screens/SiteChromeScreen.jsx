import React from 'react';
import { supabaseBrowser } from '../../lib/supabase/browser-client';
import { Card } from '../../design-system/components/core/Card.jsx';
import { Button } from '../../design-system/components/forms/Button.jsx';
import { Input } from '../../design-system/components/forms/Input.jsx';
import { Switch } from '../../design-system/components/forms/Switch.jsx';
import { Toast } from '../../design-system/components/core/Toast.jsx';
import { ImageUploadField } from '../ImageUploadField.jsx';
import { normalizeChrome, validateChrome } from '../../lib/siteChrome.js';
import { withBase } from '../../lib/url.js';

// Edits the site-wide header and footer. Required parts can't be saved blank
// (see validateChrome); the public site also falls back to defaults, so a
// bad database value can never produce an empty header/footer.
export function SiteChromeScreen() {
  const [chrome, setChrome] = React.useState(null);
  const [saving, setSaving] = React.useState(false);
  const [toast, setToast] = React.useState(null);
  const [showErrors, setShowErrors] = React.useState(false);

  React.useEffect(() => {
    supabaseBrowser.from('site_settings').select('site_chrome').eq('id', true).maybeSingle().then(({ data }) => {
      setChrome(normalizeChrome(data?.site_chrome));
    });
  }, []);

  if (!chrome) return <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>;

  const errors = validateChrome(chrome);
  const err = (k) => (showErrors ? errors[k] : undefined);
  const setHeader = (p) => setChrome((c) => ({ ...c, header: { ...c.header, ...p } }));
  const setFooter = (p) => setChrome((c) => ({ ...c, footer: { ...c.footer, ...p } }));
  const setLink = (i, p) => setFooter({ links: chrome.footer.links.map((l, j) => (j === i ? { ...l, ...p } : l)) });

  const setSocial = (i, p) => setFooter({ social: chrome.footer.social.map((l, j) => (j === i ? { ...l, ...p } : l)) });

  async function save() {
    if (Object.keys(errors).length) { setShowErrors(true); return; }
    setSaving(true);
    const { error } = await supabaseBrowser.from('site_settings').update({ site_chrome: chrome, updated_at: new Date().toISOString() }).eq('id', true);
    setSaving(false);
    setToast(error ? { tone: 'error', text: `Couldn't save: ${error.message}` } : { tone: 'success', text: 'Saved. The live site updates on its next rebuild.' });
    setTimeout(() => setToast(null), 5000);
  }

  const row = { display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' };
  const label = { display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)', color: 'var(--text-primary)' };
  const hint = { margin: 0, fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-caption)', color: 'var(--text-muted)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <p style={{ margin: 0 }}><a href={withBase('/admin/pages')}>← Back to Pages</a></p>

      <Card title="Header">
        <div style={row}>
          <p style={hint}>The navigation links come from your pages (use “Show in nav” on the Pages list).</p>
          <ImageUploadField label="Logo (leave empty to use the built-in logo)" value={chrome.header.logoUrl} onChange={(url) => setHeader({ logoUrl: url || '' })} pathPrefix="site/header" aspect={4} />
          <Input label="Logo description (required)" value={chrome.header.logoAlt} onChange={(e) => setHeader({ logoAlt: e.target.value })} error={err('header.logoAlt')} />
          <label style={label}><Switch checked={chrome.header.bannerOn} onChange={(e) => setHeader({ bannerOn: e.target.checked })} /> Show an announcement bar above the header</label>
          {chrome.header.bannerOn && (
            <>
              <Input label="Bar message (required when on)" value={chrome.header.bannerText} onChange={(e) => setHeader({ bannerText: e.target.value })} error={err('header.bannerText')} />
              <Input label="Bar link (optional)" value={chrome.header.bannerUrl} placeholder="/enrollment or https://…" onChange={(e) => setHeader({ bannerUrl: e.target.value })} error={err('header.bannerUrl')} />
            </>
          )}
          <label style={label}><Switch checked={chrome.header.showSearch} onChange={(e) => setHeader({ showSearch: e.target.checked })} /> Show site search</label>
          <label style={label}><Switch checked={chrome.header.showTextSize} onChange={(e) => setHeader({ showTextSize: e.target.checked })} /> Show text-size buttons</label>
          <label style={label}><Switch checked={chrome.header.showThemeToggle} onChange={(e) => setHeader({ showThemeToggle: e.target.checked })} /> Show light/dark toggle</label>
        </div>
      </Card>

      <Card title="Footer">
        <div style={row}>
          <Input label="Footer text (required)" value={chrome.footer.text} onChange={(e) => setFooter({ text: e.target.value })} error={err('footer.text')} />
          <p style={hint}>Write {'{year}'} wherever the current year should appear.</p>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)' }}>
            Address / contact details (optional)
            <textarea className="input" rows={3} value={chrome.footer.about} onChange={(e) => setFooter({ about: e.target.value })} placeholder={'e.g. 123 Main St, Alta, UT\n(801) 555-0100'} style={{ fontFamily: 'inherit' }} />
          </label>
          <h4 style={{ margin: 0, fontFamily: 'var(--font-sans)' }}>Links (at least one)</h4>
          {err('footer.links') && <p style={{ ...hint, color: 'var(--color-error)' }}>{err('footer.links')}</p>}
          {chrome.footer.links.map((l, i) => (
            <div key={i} style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 160px' }}><Input label="Label" value={l.label} onChange={(e) => setLink(i, { label: e.target.value })} error={err(`footer.links.${i}.label`)} /></div>
              <div style={{ flex: '2 1 220px' }}><Input label="Link" value={l.url} placeholder="/contact or https://…" onChange={(e) => setLink(i, { url: e.target.value })} error={err(`footer.links.${i}.url`)} /></div>
              <Button variant="ghost" size="sm" disabled={chrome.footer.links.length <= 1} onClick={() => setFooter({ links: chrome.footer.links.filter((_, j) => j !== i) })}>Remove</Button>
            </div>
          ))}
          <div><Button variant="outline" size="sm" onClick={() => setFooter({ links: [...chrome.footer.links, { label: '', url: '' }] })}>+ Add link</Button></div>
          <h4 style={{ margin: 0, fontFamily: 'var(--font-sans)' }}>Social links (optional)</h4>
          {chrome.footer.social.map((l, i) => (
            <div key={i} style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 160px' }}><Input label="Name" value={l.label} placeholder="Instagram" onChange={(e) => setSocial(i, { label: e.target.value })} error={err(`footer.social.${i}.label`)} /></div>
              <div style={{ flex: '2 1 220px' }}><Input label="Link" value={l.url} placeholder="https://…" onChange={(e) => setSocial(i, { url: e.target.value })} error={err(`footer.social.${i}.url`)} /></div>
              <Button variant="ghost" size="sm" onClick={() => setFooter({ social: chrome.footer.social.filter((_, j) => j !== i) })}>Remove</Button>
            </div>
          ))}
          <div><Button variant="outline" size="sm" onClick={() => setFooter({ social: [...chrome.footer.social, { label: '', url: '' }] })}>+ Add social link</Button></div>
        </div>
      </Card>

      <div><Button variant="primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save header & footer'}</Button></div>
      {showErrors && Object.keys(errors).length > 0 && <p style={{ ...hint, color: 'var(--color-error)' }}>Fix the highlighted fields to save.</p>}
      {toast && <Toast tone={toast.tone}>{toast.text}</Toast>}
    </div>
  );
}
