import React from "react";
export function Card({title,children,footer}) {
  return (
    <div className="card">
      {title && <h3 style={{margin:"0 0 12px",fontFamily:"var(--font-display)",fontSize:"var(--fs-subheading)",color:"var(--text-primary)"}}>{title}</h3>}
      <div>{children}</div>
      {footer && <div style={{marginTop:16,paddingTop:16,borderTop:"1px solid var(--border-subtle)"}}>{footer}</div>}
    </div>
  );
}
