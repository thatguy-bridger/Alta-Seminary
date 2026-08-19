import React from "react";
let counter = 0;
export function Select({label,options=[],value,onChange}) {
  const id = React.useMemo(() => `select-${++counter}`, []);
  return (
    <div className="field">
      {label && <label htmlFor={id}>{label}</label>}
      <select id={id} className="select" value={value} onChange={onChange}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
