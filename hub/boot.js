// The first script on the hub page, and the only one no service worker ever caches (sw.js sends it to the network).
// It makes sure the page's scripts come from the same version as the page (28 Oct 2026: after a publish, phones that
// had the hub open before got the NEW index.html with the OLD cached backend.js — blocked by the new page's rules —
// and saw "Can't reach Stash right now" until a reload).
// The controlling service worker is asked its version; one from an older publish (or one too old to answer) is
// removed with its caches, and the page reloads once, hidden, from the network. scripts/hub/publish-web.sh stamps
// VERSION with the commit, the same stamp as sw.js.
(() => {
  "use strict";
  const VERSION = "hub-pwa-13-6d03e82f";
  const sw = navigator.serviceWorker, controller = sw?.controller;
  if (!controller || !window.caches || !window.MessageChannel) return;   // first visit, or no service worker: nothing to mix
  const asked = new Promise(resolve => {
    const ch = new MessageChannel();
    ch.port1.onmessage = e => resolve(e.data?.version || null);
    try { controller.postMessage({ type: "version" }, [ch.port2]); } catch { resolve(null); }
    setTimeout(() => resolve(null), 600);   // workers before hub-pwa-13 don't answer
  });
  asked.then(async version => {
    if (version === VERSION) { try { sessionStorage.removeItem("stash-boot"); } catch {} return; }
    try { if (sessionStorage.getItem("stash-boot") === VERSION) return; sessionStorage.setItem("stash-boot", VERSION); } catch { return; }   // once, never a loop
    document.documentElement.style.visibility = "hidden";   // the old scripts may have started: don't show what they draw
    try {
      await Promise.all((await sw.getRegistrations()).map(r => r.unregister()));
      for (const name of await caches.keys()) if (name.startsWith("stash-hub-shell-") || name.startsWith("stash-hub-runtime-")) await caches.delete(name);
    } catch {}
    location.reload();
  });
})();
