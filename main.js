// Runs in the PAGE's JS world (manifest "world": "MAIN") so it can wrap window.open,
// HTMLElement.click and listen to the Navigation API. It has no chrome.* access;
// bridge.js (isolated world) talks to it through DOM CustomEvents.
(() => {
  if (window.__pbrInstalled) return;
  Object.defineProperty(window, '__pbrInstalled', { value: true });

  let enabled = true; // block by default until bridge.js reports this site's setting
  const CFG = '__pbr_cfg', LOG = '__pbr_log';

  document.addEventListener(CFG, (e) => {
    try { enabled = !!JSON.parse(e.detail).enabled; } catch {}
  });
  const report = (kind, url) => {
    try {
      document.dispatchEvent(new CustomEvent(LOG, {
        detail: JSON.stringify({ kind, url: String(url).slice(0, 300) })
      }));
    } catch {}
  };

  // ---------- helpers ----------
  // Rough "same site" check (eTLD+1 approximation, handles co.uk-style suffixes).
  const SLD = new Set(['co', 'com', 'org', 'net', 'gov', 'edu', 'ac']);
  const siteOfHost = (host) => {
    const p = host.split('.');
    const n = p.length >= 3 && SLD.has(p[p.length - 2]) && p[p.length - 1].length === 2 ? 3 : 2;
    return p.slice(-n).join('.');
  };
  const SELF = siteOfHost(location.hostname);
  const siteOf = (u) => {
    try { const h = new URL(u, location.href).hostname; return h ? siteOfHost(h) : SELF; }
    catch { return SELF; }
  };

  // ---------- real user-gesture tracking ----------
  const INTERACTIVE = 'a[href],button,input,select,textarea,summary,label,' +
    '[role="button"],[role="link"],[role="menuitem"]';
  let last = { t: 0, interactive: false, href: '' };
  const note = (e) => {
    if (!e.isTrusted) return;
    const el = e.target instanceof Element ? e.target : null;
    const a = el && el.closest('a[href]');
    last = {
      t: Date.now(),
      interactive: !!(el && el.closest(INTERACTIVE)) || e.type === 'keydown' || e.type === 'submit',
      href: a ? a.href : ''
    };
  };
  ['pointerdown', 'mousedown', 'touchend', 'click', 'auxclick', 'keydown', 'submit']
    .forEach((t) => addEventListener(t, note, true));

  const fresh = (ms) =>
    Date.now() - last.t < ms && (!navigator.userActivation || navigator.userActivation.isActive);

  // ---------- pop-ups ----------
  const allowOpen = (url) => {
    if (!enabled) return true;
    if (!fresh(1000)) return false;                                    // no real gesture
    if (last.href && siteOf(url) !== siteOf(last.href)) return false;  // click-under: link + extra popup
    return siteOf(url) === SELF || last.interactive;                   // invisible overlay / click hijack
  };

  const nativeOpen = window.open;
  window.open = function open(url, ...rest) {
    const target = url == null || url === '' ? 'about:blank' : String(url);
    if (allowOpen(target)) return nativeOpen.call(this, url, ...rest);
    report('popup', target);
    return null; // same result a browser gives for a blocked popup
  };

  const isBlankLink = (el) => el instanceof HTMLAnchorElement && /^_blank$/i.test(el.target);

  const nativeClick = HTMLElement.prototype.click;
  HTMLElement.prototype.click = function click() {
    if (enabled && isBlankLink(this) && !allowOpen(this.href)) { report('popup-link', this.href); return; }
    return nativeClick.apply(this, arguments);
  };

  const nativeDispatch = EventTarget.prototype.dispatchEvent;
  EventTarget.prototype.dispatchEvent = function dispatchEvent(ev) {
    if (enabled && ev && ev.type === 'click' && !ev.isTrusted && isBlankLink(this) && !allowOpen(this.href)) {
      report('popup-link', this.href);
      return false;
    }
    return nativeDispatch.apply(this, arguments);
  };

  // ---------- redirects ----------
  // location.href/assign/replace can't be wrapped (unforgeable), so we cancel them
  // via the Navigation API (Chromium 102+). Only script-initiated, cross-site, cancelable ones.
  const allowNav = (to) =>
    fresh(1500) && last.interactive && (!last.href || siteOf(to) === siteOf(last.href));

  if (window.navigation && navigation.addEventListener) {
    navigation.addEventListener('navigate', (e) => {
      if (!enabled || !e.cancelable || e.userInitiated || e.hashChange || e.downloadRequest !== null) return;
      if (e.destination.sameDocument || e.navigationType === 'traverse' || e.navigationType === 'reload') return;
      const to = e.destination.url;
      if (siteOf(to) === SELF || allowNav(to)) return;
      e.preventDefault();
      report('redirect', to);
    });
  }

  // <meta http-equiv="refresh" content="0;url=..."> to another site
  const scanMeta = (n) => {
    if (n.nodeType !== 1 || !n.matches || !n.matches('meta[http-equiv="refresh" i]')) return;
    const m = /url\s*=\s*['"]?([^'";\s]+)/i.exec(n.getAttribute('content') || '');
    if (enabled && m && siteOf(m[1]) !== SELF) { n.remove(); report('meta-refresh', m[1]); }
  };
  new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach(scanMeta)))
    .observe(document, { childList: true, subtree: true });
})();
