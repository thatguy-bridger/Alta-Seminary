import React from "react";
export function Button({variant="primary",size="md",disabled=false,icon=null,children,onClick}) {
  const cls = ["btn","btn-"+variant, size==="sm"?"btn-sm":size==="lg"?"btn-lg":""].filter(Boolean).join(" ");
  return <button className={cls} disabled={disabled} onClick={onClick}>{icon}{children}</button>;
}
