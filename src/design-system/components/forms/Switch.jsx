import React from "react";
export function Switch({checked,onChange,label}) {
  return (
    <label className="switch" aria-label={label}>
      {/* stopPropagation: same reasoning as Select.jsx -- prevents toggling
          a canvas-nested settings switch from being picked up as the start
          of a block drag by dnd-kit's wrapper listeners. */}
      <input type="checkbox" checked={checked} onChange={onChange} onPointerDown={(e) => e.stopPropagation()} />
      <span className="track"></span>
      <span className="thumb"></span>
    </label>
  );
}
