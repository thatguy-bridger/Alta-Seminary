import React from "react";
let counter = 0;
export function Input({label,placeholder,type="text",value,onChange,helpText,error}) {
  const id = React.useMemo(() => `input-${++counter}`, []);
  return (
    <div className="field">
      {label && <label htmlFor={id}>{label}</label>}
      {/* stopPropagation: same reasoning as Select.jsx -- prevents a click
          inside a canvas-nested settings field from being picked up as the
          start of a block drag by dnd-kit's wrapper listeners. */}
      <input id={id} className="input" style={error?{borderColor:"var(--color-error)"}:undefined} type={type} placeholder={placeholder} value={value} onChange={onChange} onPointerDown={(e) => e.stopPropagation()} aria-invalid={error?true:undefined} aria-describedby={error||helpText?`${id}-hint`:undefined} />
      {error ? <span id={`${id}-hint`} style={{fontSize:"var(--fs-caption)",color:"var(--color-error)"}}>{error}</span> : helpText ? <span id={`${id}-hint`} style={{fontSize:"var(--fs-caption)",color:"var(--text-muted)"}}>{helpText}</span> : null}
    </div>
  );
}
