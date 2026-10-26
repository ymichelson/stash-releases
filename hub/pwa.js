// The hub as an app on your phone (docs/shared/PWA.md): <script type="module" src="pwa.js"></script>.
// This file is deliberately tiny and imports nothing: it sets the standalone classes for the first paint, then — after
// the page has loaded and the browser is idle — adds the manifest link and loads the real module (pwa-main.js: the
// service worker, install hint, outbox, push…). Until then window.StashPWA is a stand-in that remembers every call
// (StashPWA.setCourses(…), StashPWA.queue.onChange(…), …) and replays them, in order, once the module is there; calls
// that return something get a promise of it. So nothing about the PWA competes with the course desk's first screen.
const root = document.documentElement;
const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const ua = navigator.userAgent;
const platform = /iPhone|iPod/.test(ua) || (/iPad|Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? "ios"
  : /Android/.test(ua) ? "android" : /Macintosh|Windows|Linux|CrOS/.test(ua) ? "desktop" : "other";
root.classList.toggle("pwa-standalone", standalone);
root.dataset.platform = platform;

const pending = [];
let real = null;
const at = (obj, path) => path.reduce((o, k) => o?.[k], obj);
function call(path, args) {
  const fn = at(real, path), self = at(real, path.slice(0, -1));
  return typeof fn === "function" ? fn.apply(self, args) : fn;
}
/** A stand-in for `StashPWA.<path>`: calling it is remembered (or forwarded once the real module is in). */
function standIn(path) {
  return new Proxy(function () {}, {
    get(_, key) {
      if (key === "then" || typeof key === "symbol") return undefined; // not a promise
      if (real) return at(real, [...path, key]);
      // Plain facts that are cheap to know now.
      if (path.length === 0 && key === "platform") return platform;
      if (path.length === 0 && key === "standalone") return standalone;
      if (path.length === 0 && key === "ready") return ready;
      if (path.join(".") === "queue" && key === "items") return [];
      if (path.join(".") === "push" && (key === "available" || key === "supported")) return false;
      if (path.join(".") === "push" && key === "state") return "default";
      return standIn([...path, key]);
    },
    apply(_, __, args) {
      if (real) return call(path, args);
      return new Promise((resolve, reject) => pending.push({ path, args, resolve, reject }));
    },
  });
}

let markReady;
const ready = new Promise(r => { markReady = r; });
window.StashPWA = standIn([]);

function start() {
  // The manifest and the Home Screen icon only matter for installing: add them now, not during the first paint.
  for (const [rel, href] of [["manifest", "manifest.webmanifest"], ["apple-touch-icon", "icons/apple-touch-icon.png"]]) {
    if (!document.querySelector(`link[rel="${rel}"]`)) {
      const l = document.createElement("link"); l.rel = rel; l.href = href; document.head.append(l);
    }
  }
  import("./pwa-main.js").then(m => {
    real = m.api;
    window.StashPWA = real;
    for (const p of pending.splice(0)) { try { p.resolve(call(p.path, p.args)); } catch (e) { p.reject(e); } }
    markReady(real);
  }).catch(e => console.warn("Stash PWA didn't load", e));
}
// 1.5 s after load, then when the browser is idle: well clear of the first screen and the first taps (a person's
// first ⌘K or tap right after opening never shares the main thread with this). Calls made before are kept (above).
const idle = window.requestIdleCallback || (fn => setTimeout(fn, 200));
const later = () => setTimeout(() => idle(start, { timeout: 3000 }), 1500);
if (document.readyState === "complete") later(); else addEventListener("load", later, { once: true });
