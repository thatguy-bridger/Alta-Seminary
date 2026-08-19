import React from "react";
export function Radio({label,name,checked,onChange}) {
  return <label className="radio"><input type="radio" name={name} checked={checked} onChange={onChange} />{label}</label>;
}
