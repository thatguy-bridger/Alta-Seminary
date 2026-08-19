import React from "react";
export function Badge({tone="neutral",children}) {
  const cls = tone==="neutral" ? "badge" : "badge badge-"+tone;
  return <span className={cls}>{children}</span>;
}
