// One shared scroll listener (not one per block on the page) that every
// BlockWrapper.jsx instance reads from to know which way to glide in from --
// down the page -> enters from below (translateY positive), back up the
// page -> enters from above (translateY negative), so a re-triggered reveal
// (see BlockWrapper.jsx) reads as "following the scroll" instead of always
// sliding up regardless of which way you're actually moving.
let lastY = 0;
let direction = 'down';
let started = false;

function start() {
  if (started || typeof window === 'undefined') return;
  started = true;
  lastY = window.scrollY;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    if (y !== lastY) direction = y > lastY ? 'down' : 'up';
    lastY = y;
  }, { passive: true });
}

export function getScrollDirection() {
  start();
  return direction;
}
