import React from 'react';
import { Dialog } from '../design-system/components/core/Dialog.jsx';
import { Input } from '../design-system/components/forms/Input.jsx';
import { Button } from '../design-system/components/forms/Button.jsx';
import { MediaLibraryPicker } from './MediaLibraryPicker.jsx';

// Shared "add an image" entry point for ImageUploadField (side panel) and
// EditableImage (click-to-replace on canvas) -- one small menu instead of a
// single Upload button, offering every source: the file picker (which on
// phones/tablets already surfaces the device's own Photos library --
// there's no separate "device photo library" integration needed, the OS
// handles that), pasting an image URL, or reusing something already
// uploaded elsewhere on the site.
export function ImageSourceMenu({ onFile, onUrl, onExisting, disabled, label = 'Upload image', multiple = false, hideFileOption = false }) {
  const [open, setOpen] = React.useState(false);
  const [urlDialogOpen, setUrlDialogOpen] = React.useState(false);
  const [libraryOpen, setLibraryOpen] = React.useState(false);
  const [urlValue, setUrlValue] = React.useState('');
  const inputRef = React.useRef(null);
  const menuRef = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    function onClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  function handleUrlSubmit(e) {
    e.preventDefault();
    if (!urlValue.trim()) return;
    onUrl(urlValue.trim());
    setUrlValue('');
    setUrlDialogOpen(false);
  }

  return (
    // stopPropagation: this can render inside a draggable canvas block (any
    // Image field, or the autofill/replace controls elsewhere) whose
    // wrapper carries dnd-kit's drag listeners -- without it, opening this
    // menu or picking an option bubbles a pointerdown up to the wrapper and
    // starts a reorder drag right after the click, same as a plain <select> would.
    <div ref={menuRef} onPointerDown={(e) => e.stopPropagation()} style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen((o) => !o)} disabled={disabled}>
        {disabled ? 'Uploading…' : label}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 50,
            background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-md)', minWidth: 200, overflow: 'hidden',
          }}
        >
          {!hideFileOption && <MenuItem onClick={() => { setOpen(false); inputRef.current?.click(); }}>Upload from computer</MenuItem>}
          <MenuItem onClick={() => { setOpen(false); setUrlDialogOpen(true); }}>Paste an image URL</MenuItem>
          <MenuItem onClick={() => { setOpen(false); setLibraryOpen(true); }}>Choose an existing image</MenuItem>
        </div>
      )}

      {!hideFileOption && (
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple={multiple}
          style={{ display: 'none' }}
          onChange={(e) => { onFile(multiple ? e.target.files : e.target.files?.[0]); e.target.value = ''; }}
        />
      )}

      <Dialog open={urlDialogOpen} title="Paste an image URL" onClose={() => setUrlDialogOpen(false)}>
        <form onSubmit={handleUrlSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', minWidth: 320 }}>
          <Input
            label="Image URL"
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            placeholder="https://example.com/photo.jpg"
          />
          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setUrlDialogOpen(false)}>Cancel</Button>
            <Button variant="primary" disabled={!urlValue.trim()}>Add</Button>
          </div>
        </form>
      </Dialog>

      <MediaLibraryPicker
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onSelect={(url) => { setLibraryOpen(false); onExisting(url); }}
      />
    </div>
  );
}

function MenuItem({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left', padding: 'var(--space-3)', border: 'none',
        background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)', color: 'var(--text-primary)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-sunken)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
    >
      {children}
    </button>
  );
}
