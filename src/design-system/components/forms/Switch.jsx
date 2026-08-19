import React from "react";
export function Switch({checked,onChange,label}) {
  return (
    <label className="switch" aria-label={label}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className="track"></span>
      <span className="thumb"></span>
    </label>
  );
}
