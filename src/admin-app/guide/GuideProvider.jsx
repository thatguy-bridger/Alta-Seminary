import React from 'react';
import { Dialog } from '../../design-system/components/core/Dialog.jsx';
import { Switch } from '../../design-system/components/forms/Switch.jsx';
import { Button } from '../../design-system/components/forms/Button.jsx';
import { SLIDES, slideIndex } from './guideContent.js';

const GuideContext = React.createContext({ openGuide: () => {}, helpVisible: true });
export const useGuide = () => React.useContext(GuideContext);

const SEEN_KEY = 'alta-admin-guide-seen';
const readSeen = () => { try { return localStorage.getItem(SEEN_KEY) === '1'; } catch { return true; } };
const HIDDEN_KEY = 'alta-admin-help-hidden';
const readHidden = () => { try { return localStorage.getItem(HIDDEN_KEY) === '1'; } catch { return false; } };
const writeHidden = (v) => { try { localStorage.setItem(HIDDEN_KEY, v ? '1' : '0'); } catch { /* not remembered */ } };
const markSeen = () => { try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* private window: just show it again next time */ } };

// Holds the guide for the whole admin: any (i) button or menu link calls
// openGuide(slideId). Also shows a one-time "new here?" invitation.
export function GuideProvider({ children }) {
  const [index, setIndex] = React.useState(null); // null = closed
  const [showInvite, setShowInvite] = React.useState(false);
  // "Show help buttons": off hides every (i) button and the new-admin invitation.
  // The Guide link in the menu always stays, so it can be switched back on.
  const [helpVisible, setHelpVisibleState] = React.useState(true);

  React.useEffect(() => {
    setHelpVisibleState(!readHidden());
    setShowInvite(!readSeen() && !readHidden());
  }, []);

  function setHelpVisible(v) {
    setHelpVisibleState(v);
    writeHidden(!v);
    if (!v) setShowInvite(false);
  }

  const openGuide = React.useCallback((slideId) => {
    markSeen();
    setShowInvite(false);
    setIndex(slideId ? slideIndex(slideId) : 0);
  }, []);

  function dismissInvite() { markSeen(); setShowInvite(false); }

  const slide = index === null ? null : SLIDES[index];
  const last = index === SLIDES.length - 1;

  return (
    <GuideContext.Provider value={{ openGuide, showInvite: showInvite && helpVisible, dismissInvite, helpVisible, setHelpVisible }}>
      {children}
      <Dialog open={!!slide} wide title={slide ? slide.title : ''} onClose={() => setIndex(null)}>
        {slide && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}>
            <p style={{ margin: 0, fontSize: 'var(--fs-body)', color: 'var(--text-secondary)' }}>{slide.what}</p>
            <ol style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', lineHeight: 1.5 }}>
              {slide.steps.map((s) => <li key={s}>{s}</li>)}
            </ol>
            {slide.tip && (
              <p style={{ margin: 0, padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', background: 'var(--surface-sunken)', fontSize: 'var(--fs-small)' }}>
                <strong>Tip:</strong> {slide.tip}
              </p>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-muted)' }} aria-live="polite">Slide {index + 1} of {SLIDES.length}</span>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <Button variant="ghost" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}>Back</Button>
                {last
                  ? <Button variant="primary" onClick={() => setIndex(null)}>Done</Button>
                  : <Button variant="primary" onClick={() => setIndex((i) => i + 1)}>Next</Button>}
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontSize: 'var(--fs-small)', color: 'var(--text-secondary)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border-subtle)' }}>
              <Switch checked={helpVisible} onChange={(e) => setHelpVisible(e.target.checked)} />
              Show the (i) help buttons around the admin. You can always reopen this guide from the menu.
            </label>
            <div role="tablist" aria-label="Guide slides" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
              {SLIDES.map((s, i) => (
                <button
                  key={s.id}
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`${s.title} (slide ${i + 1})`}
                  onClick={() => setIndex(i)}
                  style={{ width: 10, height: 10, padding: 0, borderRadius: '50%', border: 'none', cursor: 'pointer', background: i === index ? 'var(--brand-secondary)' : 'var(--border-strong)' }}
                />
              ))}
            </div>
          </div>
        )}
      </Dialog>
    </GuideContext.Provider>
  );
}
