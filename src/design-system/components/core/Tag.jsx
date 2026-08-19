import React from "react";
export function Tag({children,onRemove}) {
  return <span className="tag">{children}{onRemove && <button onClick={onRemove} style={{border:"none",background:"none",cursor:"pointer",color:"var(--text-muted)"}}>×</button>}</span>;
}
