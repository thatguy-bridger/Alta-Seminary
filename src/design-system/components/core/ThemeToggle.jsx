import React from "react";

const ORDER = ["light", "dark", "auto"];
const LABEL = { light: "Light", dark: "Dark", auto: "Auto" };

const ICONS = {
  light: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2" x2="12" y2="4" />
      <line x1="12" y1="20" x2="12" y2="22" />
      <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" />
      <line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
      <line x1="2" y1="12" x2="4" y2="12" />
      <line x1="20" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="19.07" x2="6.34" y2="17.66" />
      <line x1="17.66" y1="6.34" x2="19.07" y2="4.93" />
    </svg>
  ),
  dark: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  ),
  auto: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a10 10 0 0 1 0 20Z" fill="currentColor" stroke="none" />
    </svg>
  ),
};

export function ThemeToggle() {
  const [mode, setMode] = React.useState("auto");
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    if (window.AltaTheme) setMode(window.AltaTheme.get());
  }, []);

  function cycle() {
    const next = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length];
    setMode(next);
    if (typeof window !== "undefined" && window.AltaTheme) window.AltaTheme.set(next);
  }

  const displayMode = mounted ? mode : "auto";

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <button
        onClick={cycle}
        aria-label={`Theme: ${LABEL[displayMode]}. Click to switch.`}
        title={`Theme: ${LABEL[displayMode]}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          borderRadius: "var(--radius-pill)",
          border: "1px solid var(--border-default)",
          background: "var(--surface-card)",
          color: "var(--text-primary)",
          cursor: "pointer",
          transition: "background var(--duration-fast), border-color var(--duration-fast)",
        }}
      >
        {ICONS[displayMode]}
      </button>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--fs-caption)", color: "var(--text-muted)" }}>
        {LABEL[displayMode]}
      </span>
    </div>
  );
}
