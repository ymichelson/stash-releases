// The hub's service worker (docs/shared/PWA.md). Classic script (Safari's module workers are too new to rely on).
// - The page and its files: cached, so the course desk opens offline; the page itself is network-first (3 s), so a
//   new version arrives as soon as you're online.
// - Kept files (`__files/<key>`, put there by pwa.js when you open one): served from the cache only.
// - Android share sheet → "Share to Stash": the shared files/text are stored (IndexedDB) and the hub opens to add them.
// - Push: "Dana added a file in Algorithms" (opt-in; no file titles; the payload is encrypted end to end).
// - The backend (Supabase), the nearby/push test servers and anything outside the scope: never touched here.
// Routes mirror pwa-core.js `routeFor` (tested there): keep the two in step.

const VERSION = "hub-pwa-11-5d151c3e";  // 27 Oct: Hebrew pass (Heebo font, Hebrew manifest); hub-pwa-9: course-ui.js + schools.js (join or start a course); hub-pwa-8: syllabus.js (the syllabus reader); hub-pwa-7: Profile → Your data (download / delete); hub-pwa-6: launch QA (offline posts, PDF first pages)
const SHELL = `stash-hub-shell-${VERSION}`, RUNTIME = "stash-hub-runtime-1", FILES = "stash-hub-files-1";
const SHELL_FILES = ["./", "./index.html", "./hub.js", "./vendor/supabase-js-2.45.4.min.js", "./core.js", "./backend.js", "./live.js", "./profile-ui.js", "./dates-ui.js", "./syllabus.js", "./course-ui.js", "./schools.js", "./coursematch.js", "./pdftext.js", "./pdfthumb.js", "./pwa.js", "./pwa-main.js", "./pwa-core.js", "./nearby/nearby.js",
  "./vendor/qrcode-generator-1.4.4.js", "./manifest.webmanifest", "./manifest.he.webmanifest", "./vendor/fonts/heebo-hebrew-wght-5.3.0.woff2", "./icons/icon-192.png", "./icons/apple-touch-icon.png"];
const RUNTIME_MAX = 150;

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    // One missing file must not stop the rest (e.g. a renamed asset); each is fetched fresh, bypassing the HTTP cache.
    await Promise.all(SHELL_FILES.map(u => cache.add(new Request(u, { cache: "reload" })).catch(() => {})));
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name.startsWith("stash-hub-shell-") && name !== SHELL) await caches.delete(name);
    await self.clients.claim();
  })());
});

// The page asks for an update to take over now ("A new version is ready · Reload").
self.addEventListener("message", event => {
  if (event.data?.type === "skip-waiting") self.skipWaiting();
});

function route(request) {
  const scope = self.registration.scope, url = new URL(request.url);
  if (request.method === "POST" && url.href === new URL("share-target", scope).href) return "share-target";
  if (request.method !== "GET") return "network";
  if (url.origin !== new URL(scope).origin || !url.href.startsWith(scope)) return "network";
  if (url.pathname.includes("/__files/")) return "files";
  if (url.pathname.includes("/nearby-api/") || url.pathname.includes("/push-api/")) return "network";
  if (request.mode === "navigate") return "page";
  return "asset";
}

self.addEventListener("fetch", event => {
  const request = event.request;
  switch (route(request)) {
    case "share-target": event.respondWith(receiveShare(request)); return;
    case "page": event.respondWith(page(request)); return;
    case "asset": event.respondWith(asset(request, event)); return;
    case "files": event.respondWith(caches.open(FILES).then(c => c.match(request)).then(r => r || new Response("Not kept offline", { status: 404 }))); return;
    default: return; // straight to the network
  }
});

/** Network first (3 s), else the cached page (any query string), else a plain offline note. */
async function page(request) {
  const cache = await caches.open(SHELL);
  try {
    const response = await Promise.race([fetch(request), new Promise((_, no) => setTimeout(() => no(new Error("slow")), 3000))]);
    // only the hub itself becomes the offline page (not nearby/ or poster/ under the same scope: 27 Oct review)
    const path = new URL(request.url).pathname, scope = new URL(self.registration.scope).pathname;
    if (response.ok && (path === scope || path === scope + "index.html")) cache.put("./index.html", response.clone()).catch(() => {});
    return response;
  } catch {
    return (await cache.match("./index.html")) || (await cache.match("./")) ||
      new Response(await pushLang() === "he"
        ? "<!doctype html><html lang=he dir=rtl><meta name=viewport content='width=device-width'><p style='font:16px/1.6 system-ui;padding:24px'>אין חיבור, והעמוד עוד לא נשמר במכשיר. צריך לפתוח אותו פעם אחת עם חיבור.</p>"
        : "<!doctype html><meta name=viewport content='width=device-width'><p style='font:16px system-ui;padding:24px'>You're offline, and this page hasn't been saved yet. Open it once while online.</p>",
        { headers: { "content-type": "text/html; charset=utf-8" } });
  }
}

/** Cached at once, refreshed in the background (stale-while-revalidate); the runtime cache keeps ≤ 150 entries. */
async function asset(request, event) {
  const shell = await caches.open(SHELL), runtime = await caches.open(RUNTIME);
  const cached = (await shell.match(request, { ignoreSearch: true })) || (await runtime.match(request));
  const refresh = fetch(request).then(async response => {
    if (response.ok && response.type === "basic") {
      const into = (await shell.match(request, { ignoreSearch: true })) ? shell : runtime;
      await into.put(request, response.clone());
      if (into === runtime) trim(runtime);
    }
    return response;
  }).catch(() => null);
  if (cached) { event.waitUntil(refresh); return cached; }
  return (await refresh) || new Response("", { status: 504 });
}

async function trim(cache) {
  const keys = await cache.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - RUNTIME_MAX))) await cache.delete(k);
}

// ——— Share Target (Android, installed app): store, then open the hub to add it ———

async function receiveShare(request) {
  try {
    const form = await request.formData();
    const files = form.getAll("files").filter(f => f && typeof f === "object" && "size" in f);
    const item = {
      id: crypto.randomUUID(), at: Date.now(),
      title: String(form.get("title") || ""), text: String(form.get("text") || ""), url: String(form.get("url") || ""),
      files: files.map(f => ({ name: f.name || "Shared file", type: f.type || "application/octet-stream", size: f.size, blob: f })),
    };
    await idb("shared", "readwrite", store => store.put(item));
    return Response.redirect(new URL(`./?shared=${item.id}`, self.registration.scope).href, 303);
  } catch {
    return Response.redirect(new URL("./?shared=failed", self.registration.scope).href, 303);
  }
}

// The same tiny IndexedDB as pwa.js ("stash-pwa": shared · outbox · desk).
function idb(storeName, mode, work) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("stash-pwa", 1);
    open.onupgradeneeded = () => {
      const db = open.result;
      for (const s of ["shared", "outbox", "desk"]) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: s === "outbox" ? "clientId" : "id" });
    };
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction(storeName, mode);
      const result = work(tx.objectStore(storeName));
      tx.oncomplete = () => resolve(result?.result);
      tx.onerror = () => reject(tx.error);
    };
  });
}

// ——— Push (functions/push-send): {title: "Stash", body: "Dana added a file in Algorithms", url: "/hub/?space=<id>"} —
// no file titles on the lock screen (it is public); one notification per course page (tag = its url). ———

self.addEventListener("push", event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data?.text() }; }
  const title = String(data.title || "Stash").slice(0, 80);
  event.waitUntil(pushLang().then(l => {
  const body = (l === "he" ? pushHebrew(String(data.body || "Something new in your course")) : String(data.body || "Something new in your course")).slice(0, 160);
  return self.registration.showNotification(title, {
    body, tag: String(data.tag || safeURL(data.url)), renotify: false,
    icon: new URL("icons/icon-192.png", self.registration.scope).href,
    badge: new URL("icons/icon-192.png", self.registration.scope).href,
    data: { url: safeURL(data.url) },
  }); }));
});

/** The page's language (More → Language, else the phone's): the page keeps it in Cache Storage for this worker. */
async function pushLang() {
  try { const r = await (await caches.open("stash-prefs")).match("lang"); if (r) return (await r.text()) === "he" ? "he" : "en"; } catch {}
  return /^(he|iw)\b/i.test(self.navigator?.language || "") ? "he" : "en";
}
/** The server writes new-thing pushes in English ("Dana added a file in Algorithms"); on a Hebrew phone they read
 *  "Algorithms: קובץ חדש מ־Dana". Gender-neutral on purpose. Date reminders already come in Hebrew from the server. */
const PUSH_HE_KIND = { "a file": "קובץ חדש", "a picture": "תמונה חדשה", "a link": "קישור חדש", "a request": "בקשה חדשה", "a note": "פתק חדש" };
function pushHebrew(body) {
  const m = /^(.+) added (a file|a picture|a link|a request|a note) in (.+)$/s.exec(body);
  if (m) return `${m[3]}: ${PUSH_HE_KIND[m[2]]}${m[1] === "Someone" ? "" : (/^[A-Za-z0-9]/.test(m[1]) ? " מ־" : " מ") + m[1]}`;
  return body === "Something new in your course" ? "יש משהו חדש בקורס" : body;
}

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = event.notification.data?.url || self.registration.scope;
  event.waitUntil((async () => {
    for (const c of await self.clients.matchAll({ type: "window", includeUncontrolled: true })) {
      if (c.url.startsWith(self.registration.scope)) { await c.focus(); c.postMessage({ type: "open", url: target }); return; }
    }
    await self.clients.openWindow(target);
  })());
});

/** A push may only open a page of the hub itself. */
function safeURL(u) {
  try { const url = new URL(u, self.registration.scope); return url.href.startsWith(self.registration.scope) ? url.href : self.registration.scope; }
  catch { return self.registration.scope; }
}

// ——— Back online (Android Background Sync): ask the open page to send what's waiting ———
self.addEventListener("sync", event => {
  if (event.tag !== "stash-outbox") return;
  event.waitUntil(self.clients.matchAll({ type: "window" }).then(cs => cs.forEach(c => c.postMessage({ type: "flush" }))));
});
