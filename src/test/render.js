import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

// Renders a component the way the browser does (client-side, into a real
// DOM) and hands back the container. The default `renderToString` path used
// for server HTML behaves differently for some style props, so this is the
// one to use when a bug only appears once React renders in the browser.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

export async function renderInBrowser(element) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(element); });
  return { container, unmount: () => act(async () => root.unmount()) };
}

export { React };
