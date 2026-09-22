import React from "react";

// Per-browser only (localStorage via text-size-init.js, same pattern as
// ThemeToggle.jsx/theme-init.js) -- never written to the database, so it
// only ever affects the person who set it, on the device they set it on.
// Steps through window.AltaTextSize.STEPS (0.9/1/1.1/1.25/1.4), which drive
// --text-scale in typography.css -- every --fs-* token multiplies by it, so
// this one control resizes every bit of type across the whole site (public
// pages AND the admin app both load the same tokens) without touching any
// individual font-size declaration.
export function TextSizeToggle() {
  const [steps, setSteps] = React.useState([1]);
  const [scale, setScale] = React.useState(1);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    if (window.AltaTextSize) {
      setSteps(window.AltaTextSize.STEPS);
      setScale(window.AltaTextSize.get());
    }
  }, []);

  function step(direction) {
    const idx = steps.indexOf(scale);
    const next = steps[Math.min(steps.length - 1, Math.max(0, idx + direction))];
    setScale(next);
    if (window.AltaTextSize) window.AltaTextSize.set(next);
  }

  const displayScale = mounted ? scale : 1;
  const atMin = displayScale <= steps[0];
  const atMax = displayScale >= steps[steps.length - 1];

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          borderRadius: "var(--radius-pill)",
          border: "1px solid var(--border-default)",
          background: "var(--surface-card)",
          overflow: "hidden",
        }}
      >
        <button
          onClick={() => step(-1)}
          disabled={atMin}
          aria-label="Decrease text size"
          title="Decrease text size"
          style={textSizeBtnStyle(atMin, 12)}
        >
          A
        </button>
        <div style={{ width: 1, alignSelf: "stretch", background: "var(--border-default)" }} />
        <button
          onClick={() => step(1)}
          disabled={atMax}
          aria-label="Increase text size"
          title="Increase text size"
          style={textSizeBtnStyle(atMax, 16)}
        >
          A
        </button>
      </div>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--fs-caption)", color: "var(--text-muted)" }}>
        Text size
      </span>
    </div>
  );
}

function textSizeBtnStyle(disabled, fontSize) {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 36,
    border: "none",
    background: "transparent",
    color: disabled ? "var(--text-muted)" : "var(--text-primary)",
    fontFamily: "var(--font-sans)",
    fontWeight: "var(--fw-bold)",
    fontSize,
    cursor: disabled ? "default" : "pointer",
  };
}
