import React from 'react';
import { EditableText } from '../admin-app/builder/EditableText.jsx';
import { RichText } from './richText.jsx';
import { textStyleToCss } from '../admin-app/builder/textStyle.js';

function newItem() {
  return { id: crypto.randomUUID(), question: '', answer: '' };
}

export function FaqBlock({ heading, items, headingStyle, editable, onFieldChange }) {
  const list = Array.isArray(items) && items.length > 0 ? items : editable ? [newItem()] : [];

  function updateItem(i, patch) {
    onFieldChange('items', list.map((it, ii) => (ii === i ? { ...it, ...patch } : it)));
  }
  function addItem() {
    onFieldChange('items', [...list, newItem()]);
  }
  function removeItem(i) {
    if (list.length <= 1) return;
    onFieldChange('items', list.filter((_, ii) => ii !== i));
  }

  if (!editable && list.length === 0) return null;

  return (
    <div>
      {(editable || heading) && (
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-heading)', margin: '0 0 var(--space-5)', textAlign: 'center', color: 'var(--text-primary)', ...textStyleToCss(headingStyle) }}>
          {editable ? (
            <EditableText value={heading} onCommit={(v) => onFieldChange('heading', v)} placeholder="Heading (optional)" styleValue={headingStyle} onStyleChange={(s) => onFieldChange('headingStyle', s)} />
          ) : heading}
        </h2>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', maxWidth: 720, margin: '0 auto' }}>
        {list.map((item, i) => (
          <div key={item.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            {editable ? (
              <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                  <div style={{ flex: 1, fontFamily: 'var(--font-sans)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)' }}>
                    <EditableText value={item.question} onCommit={(v) => updateItem(i, { question: v })} placeholder={`Question ${i + 1}`} />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    disabled={list.length <= 1}
                    style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: list.length <= 1 ? 'default' : 'pointer', fontSize: 'var(--fs-caption)' }}
                  >
                    Remove
                  </button>
                </div>
                <div style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-secondary)' }}>
                  <EditableText value={item.answer} onCommit={(v) => updateItem(i, { answer: v })} placeholder="Answer" multiline as="div" />
                </div>
              </div>
            ) : (
              <details>
                <summary
                  style={{
                    padding: 'var(--space-4)', cursor: 'pointer', listStyle: 'none',
                    fontFamily: 'var(--font-sans)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)',
                  }}
                >
                  {item.question}
                </summary>
                <div style={{ padding: '0 var(--space-4) var(--space-4)', fontFamily: 'var(--font-sans)', color: 'var(--text-secondary)' }}>
                  <RichText text={item.answer} />
                </div>
              </details>
            )}
          </div>
        ))}
        {editable && (
          <button type="button" onClick={addItem} className="btn btn-outline btn-sm" style={{ alignSelf: 'flex-start' }}>
            + Add question
          </button>
        )}
      </div>
    </div>
  );
}
