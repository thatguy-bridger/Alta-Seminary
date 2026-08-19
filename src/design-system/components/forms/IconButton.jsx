import React from "react";
export function IconButton({icon,label,onClick}) {
  return <button className="icon-btn" aria-label={label} onClick={onClick}>{icon}</button>;
}
