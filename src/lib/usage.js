// Simple, anonymous usage counting (see migration 0050 for exactly what is kept). A random visitor code lives on the device, a
// random visit code lives for the tab; events are sent in small batches. Nothing is sent if the browser asks not to be tracked.
const VISITOR_KEY = 'alta-visitor';
const code = () => { const a = new Uint8Array(12); (globalThis.crypto || window.crypto).getRandomValues(a); return [...a].map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, 24); };

// "/events/2026-spring?x=1" -> "/events/2026-spring"; ids that are long codes become :id; never anything personal in a path.
export function cleanPath(path) {
  let p = String(path || '/').split('#')[0].split('?')[0].trim() || '/';
  if (!p.startsWith('/')) p = '/' + p;
  p = p.replace(/\/+$/, '') || '/';
  p = p.split('/').map((seg) => (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg) || /^[0-9a-z]{24,}$/i.test(seg) ? ':id' : seg)).join('/');
  p = p.replace(/[^A-Za-z0-9:_./+@-]/g, '-');
  return p.slice(0, 120) || '/';
}

export const optedOut = (nav = globalThis.navigator) => !nav || nav.doNotTrack === '1' || nav.doNotTrack === 'yes' || nav.globalPrivacyControl === true || nav.webdriver === true;

const safeName = (n) => String(n || '').toLowerCase().replace(/[^a-z0-9:_./+@-]/g, '-').slice(0, 120);

export function createTracker({ area, send, storage, session, nav, later = (fn, ms) => setTimeout(fn, ms) }) {
  if (optedOut(nav)) return { view() {}, step() {}, action() {}, flush() {}, off: true };
  let visitor = null;
  try { visitor = storage?.getItem(VISITOR_KEY) || null; if (!visitor) { visitor = code(); storage?.setItem(VISITOR_KEY, visitor); } } catch { visitor = visitor || code(); }
  const visit = session || code();
  let queue = [], timer = null;
  const flush = () => { clearTimeout(timer); timer = null; if (!queue.length) return; const batch = queue; queue = []; try { send(batch); } catch { /* counting is never worth breaking a page */ } };
  const add = (kind, name, from) => {
    queue.push({ v: visitor, s: visit, a: area, k: kind, n: kind === 'view' ? cleanPath(name) : safeName(name), ...(from ? { f: cleanPath(from) } : {}) });
    if (queue.length >= 15) flush(); else if (!timer) timer = later(flush, 1500);
  };
  return { view: (path, from) => add('view', path, from), step: (name) => add('step', name), action: (name) => add('action', name), flush };
}

// The browser's real sender: one small request to the database function. keepalive lets it finish while a page is closing.
export function browserSend(url, anon, fetcher = globalThis.fetch) {
  return (events) => fetcher(`${url}/rest/v1/rpc/log_usage`, {
    method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json', apikey: anon, Authorization: `Bearer ${anon}` }, body: JSON.stringify({ p_events: events }),
  }).catch(() => {});
}

// One tracker per tab for a given area, made on first use.
const made = {};
export function usageFor(area) {
  if (made[area]) return made[area];
  const url = import.meta.env.PUBLIC_SUPABASE_URL, anon = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
  let storage = null, session = null;
  try { storage = window.localStorage; } catch { /* no storage: a new code each visit */ }
  try { session = window.sessionStorage.getItem('alta-visit') || (window.sessionStorage.setItem('alta-visit', code()), window.sessionStorage.getItem('alta-visit')); } catch { /* fine */ }
  made[area] = url && anon ? createTracker({ area, send: browserSend(url, anon), storage, session, nav: navigator }) : { view() {}, step() {}, action() {}, flush() {}, off: true };
  if (typeof window !== 'undefined') { window.addEventListener('pagehide', () => made[area].flush()); document.addEventListener('visibilitychange', () => { if (document.hidden) made[area].flush(); }); }
  return made[area];
}

// A page view for the page being looked at, with the page it came from if that was this site.
export function trackPageView() {
  const path = location.pathname;
  const area = path.startsWith('/admin') ? 'admin' : 'site';
  let from = null;
  try { if (document.referrer && new URL(document.referrer).origin === location.origin) from = new URL(document.referrer).pathname; } catch { /* no referrer */ }
  usageFor(area).view(path, from);
}
