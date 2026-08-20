import React from 'react';
import { Dialog } from '../design-system/components/core/Dialog.jsx';
import { Button } from '../design-system/components/forms/Button.jsx';

// Replaces window.confirm()/window.alert() everywhere in the admin with a
// real on-brand modal instead of the browser's native (unstyleable,
// blocking, easy-to-miss-behind-the-window) prompt. One shared Dialog
// instance mounted once in AdminShell -- every screen calls the two hooks
// below instead of reaching for window.confirm/alert directly.
const ConfirmContext = React.createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = React.useState(null);

  const confirm = React.useCallback((message, opts = {}) => {
    return new Promise((resolve) => {
      setState({
        mode: 'confirm', message, resolve,
        title: opts.title ?? 'Are you sure?',
        confirmLabel: opts.confirmLabel ?? 'Confirm',
        cancelLabel: opts.cancelLabel ?? 'Cancel',
        danger: opts.danger ?? false,
      });
    });
  }, []);

  const alertUser = React.useCallback((message, opts = {}) => {
    return new Promise((resolve) => {
      setState({
        mode: 'alert', message, resolve,
        title: opts.title ?? 'Notice',
        confirmLabel: opts.confirmLabel ?? 'OK',
      });
    });
  }, []);

  function settle(result) {
    state?.resolve(result);
    setState(null);
  }

  // Enter confirms -- except for danger (delete-style) dialogs, where a
  // stray Enter keypress shouldn't be able to trigger something
  // irreversible. Escape is already handled by Dialog itself.
  function onKeyDown(e) {
    if (e.key === 'Enter' && !state.danger) {
      e.preventDefault();
      settle(true);
    }
  }

  return (
    <ConfirmContext.Provider value={{ confirm, alertUser }}>
      {children}
      {state && (
        <div onKeyDown={onKeyDown}>
          <Dialog open title={state.title} onClose={() => settle(false)}>
            <p style={{ color: 'var(--text-secondary)', marginTop: 0, whiteSpace: 'pre-wrap' }}>{state.message}</p>
            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
              {state.mode === 'confirm' && (
                <Button variant="ghost" onClick={() => settle(false)}>{state.cancelLabel}</Button>
              )}
              <Button variant="primary" onClick={() => settle(true)}>{state.confirmLabel}</Button>
            </div>
          </Dialog>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

// Returns an async confirm(message, opts?) -> Promise<boolean>, replacing
// window.confirm. opts: { title, confirmLabel, cancelLabel, danger }.
export function useConfirm() {
  const ctx = React.useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx.confirm;
}

// Returns an async alertUser(message, opts?) -> Promise<void>, replacing
// window.alert. opts: { title, confirmLabel }.
export function useAlert() {
  const ctx = React.useContext(ConfirmContext);
  if (!ctx) throw new Error('useAlert must be used within ConfirmProvider');
  return ctx.alertUser;
}
