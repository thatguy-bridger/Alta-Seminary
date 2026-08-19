import React from 'react';
import { BLOCK_REGISTRY, LAYOUT_FIELDS, DEFAULT_LAYOUT, isInlineField } from '../../blocks/registry.js';
import { Input } from '../../design-system/components/forms/Input.jsx';
import { Select } from '../../design-system/components/forms/Select.jsx';
import { Switch } from '../../design-system/components/forms/Switch.jsx';
import { Card } from '../../design-system/components/core/Card.jsx';

// The Directory Teaser's "Pull from" field can't use a static options list --
// admins add/remove directories themselves (see DirectoryScreen.jsx) -- so it
// fetches the live catalog instead of reading a fixed registry.js options array.
function DirectorySelectField({ field, value, onChange }) {
  const [directories, setDirectories] = React.useState(null);

  React.useEffect(() => {
    let active = true;
    import('../../lib/supabase/browser-client').then(({ supabaseBrowser }) =>
      supabaseBrowser.from('directories').select('slug, name').order('sort_order').then(({ data }) => {
        if (active) setDirectories(data || []);
      })
    );
    return () => { active = false; };
  }, []);

  const options = directories === null
    ? [{ value: value ?? '', label: 'Loading…' }]
    : directories.map((d) => ({ value: d.slug, label: d.name }));

  return <Select key={field.key} label={field.label} value={value ?? ''} options={options} onChange={(e) => onChange(field.key, e.target.value)} />;
}

// Same live-catalog pattern as DirectorySelectField, but for the Photo
// Gallery block's "Show photos from" field -- albums are admin-managed rows
// (GalleryScreen.jsx), not a fixed registry.js options list. Always offers
// an "All albums" choice in addition to whatever albums currently exist.
function AlbumSelectField({ field, value, onChange }) {
  const [albums, setAlbums] = React.useState(null);

  React.useEffect(() => {
    let active = true;
    import('../../lib/supabase/browser-client').then(({ supabaseBrowser }) =>
      supabaseBrowser.from('gallery_albums').select('id, name').order('sort_order').then(({ data }) => {
        if (active) setAlbums(data || []);
      })
    );
    return () => { active = false; };
  }, []);

  const options = albums === null
    ? [{ value: value ?? 'all', label: 'Loading…' }]
    : [{ value: 'all', label: 'All albums' }, ...albums.map((a) => ({ value: a.id, label: a.name }))];

  return <Select key={field.key} label={field.label} value={value ?? 'all'} options={options} onChange={(e) => onChange(field.key, e.target.value)} />;
}

// Deliberately secondary now: text/image content is click-to-edit directly on
// the canvas (EditableCanvas.jsx). This panel only holds style/layout choices
// and the rare field that can't be edited inline (e.g. a link URL).
// Exported so CarouselBlock.jsx can render the same non-inline "settings"
// fields for whatever block type a slide is nested as.
export function renderField(field, value, onChange) {
  switch (field.kind) {
    case 'text':
      return <Input key={field.key} label={field.label} value={value ?? ''} onChange={(e) => onChange(field.key, e.target.value)} />;
    case 'select':
      return <Select key={field.key} label={field.label} value={value ?? ''} options={field.options} onChange={(e) => onChange(field.key, e.target.value)} />;
    case 'directory-select':
      return <DirectorySelectField key={field.key} field={field} value={value} onChange={onChange} />;
    case 'album-select':
      return <AlbumSelectField key={field.key} field={field} value={value} onChange={onChange} />;
    case 'toggle':
      return (
        <label key={field.key} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-small)', color: 'var(--text-primary)' }}>
          <Switch checked={!!value} onChange={(e) => onChange(field.key, e.target.checked)} />
          {field.label}
        </label>
      );
    default:
      return null;
  }
}

export function BlockConfigPanel({ block, onChange }) {
  if (!block) {
    return (
      <Card title="Style">
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>Select a block to edit its style. Text and images are click-to-edit directly on the page.</p>
      </Card>
    );
  }

  const def = BLOCK_REGISTRY[block.type];
  if (!def) return null;
  const layout = { ...DEFAULT_LAYOUT, ...block.layout };

  function setProp(key, value) {
    onChange({ ...block, props: { ...block.props, [key]: value } });
  }
  function setLayout(key, value) {
    onChange({ ...block, layout: { ...layout, [key]: value } });
  }

  const styleFields = def.fields.filter((f) => !isInlineField(f)).filter((f) => !f.showIf || f.showIf(block.props));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <Card title={`${def.label} — Layout`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {LAYOUT_FIELDS.map((field) => renderField(field, layout[field.key], setLayout))}
        </div>
      </Card>
      {styleFields.length > 0 && (
        <Card title="Style">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {styleFields.map((field) => renderField(field, block.props[field.key], setProp))}
          </div>
        </Card>
      )}
    </div>
  );
}
