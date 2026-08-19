import React from "react";
let counter = 0;

// Deliberately minimal: a plain textarea, not a full WYSIWYG editor. Keeps the
// page builder's rich-text fields simple and fast to ship; if admins later find
// this too limiting, upgrade to a real rich-text library then (see build plan).
export function Textarea({label,placeholder,value,onChange,helpText,error,rows=5}) {
  const id = React.useMemo(() => `textarea-${++counter}`, []);
  return (
    <div className="field">
      {label && <label htmlFor={id}>{label}</label>}
      <textarea
        id={id}
        className="input"
        style={{resize:"vertical",fontFamily:"inherit",...(error?{borderColor:"var(--color-error)"}:{})}}
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        aria-invalid={error?true:undefined}
        aria-describedby={error||helpText?`${id}-hint`:undefined}
      />
      {error ? <span id={`${id}-hint`} style={{fontSize:"var(--fs-caption)",color:"var(--color-error)"}}>{error}</span> : helpText ? <span id={`${id}-hint`} style={{fontSize:"var(--fs-caption)",color:"var(--text-muted)"}}>{helpText}</span> : null}
    </div>
  );
}
