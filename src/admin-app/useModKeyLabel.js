import React from 'react';

// `navigator` doesn't exist during Astro's build-time server render of a
// client:load component -- read it in an effect (client-only), not inline
// in render, or `astro build` fails with "navigator is not defined".
// Shared by every screen that shows a Cmd/Ctrl-style shortcut hint.
export function useModKeyLabel() {
  const [label, setLabel] = React.useState('Ctrl');
  React.useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.platform.includes('Mac')) setLabel('⌘');
  }, []);
  return label;
}
