import React from "react";
let counter = 0;
export function Select({label,options=[],value,onChange}) {
  const id = React.useMemo(() => `select-${++counter}`, []);
  return (
    <div className="field">
      {label && <label htmlFor={id}>{label}</label>}
      {/* stopPropagation: this can render inside a draggable canvas block
          (e.g. Carousel/Columns nested settings) whose wrapper carries
          dnd-kit's pointer listeners -- without this, opening/choosing an
          option bubbles a pointerdown up to the wrapper and the block
          starts "dragging" right after you make a selection. */}
      <select id={id} className="select" value={value} onChange={onChange} onPointerDown={(e) => e.stopPropagation()}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
