ThemeToggle — three-way Light / Dark / Auto switch controlling `data-theme` on `<html>`, persisted to localStorage.

```jsx
<ThemeToggle />
```

Requires `theme-init.js` (loaded once in `<head>`) for persistence and to avoid a flash of the wrong theme; without it the toggle still works but only affects local component state, not the page's `data-theme` attribute.
