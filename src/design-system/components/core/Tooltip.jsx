import React from "react";
export function Tooltip({label,children}) {
  return <span className="tooltip">{children}<span className="bubble">{label}</span></span>;
}
