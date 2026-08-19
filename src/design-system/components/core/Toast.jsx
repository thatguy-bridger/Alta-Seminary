import React from "react";
export function Toast({children,tone="neutral"}) {
  return <div className="toast">{children}</div>;
}
