// The hub as an app on your phone (docs/shared/PWA.md) — the real module, loaded by pwa.js after the first paint
// (load + idle), so nothing here competes with the course desk's first screen. window.StashPWA — install at the right moment, the offline outbox, kept files, things shared in from other apps,
// push ("Dana added Lecture 5"), haptics. Every piece of UI has a quiet default here (in the hub's tokens); the page can
// take any of them over (StashPWA.configure({ ui: { install: false, … } }) + the on… hooks). Rules: pwa-core.js.
import { Outbox } from "./core.js";
import { InstallMoment, platformOf, FileShelf, queueSummary, sharedPlan } from "./pwa-core.js";

const root = document.documentElement;
const platform = platformOf(navigator.userAgent, navigator.maxTouchPoints);
const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
root.classList.toggle("pwa-standalone", standalone); // (pwa.js sets these early too, for the first paint)
root.dataset.platform = platform;
// Automated runs (tests, screenshots) stay deterministic: no sheet opens by itself unless ?pwa=demo.
const automated = navigator.webdriver === true && new URLSearchParams(location.search).get("pwa") !== "demo";

// Defaults agreed with the hub's design (HUB-DESIGN.md): the hub's own status line shows the outbox (no chip here).
// Push (server side: hub-backend-sec, functions/push-send): the hub sets vapidPublicKey (not secret) and pushSave /
// pushDelete, which call the RPCs save_push_subscription / delete_push_subscription through supabase-js. Without
// them (the local dev server only) pwa.js falls back to GET push-api/key + POST push-api/subscribe.
const config = { ui: { install: true, queue: false, shared: true, push: true }, vapidPublicKey: null, pushEndpoint: null, courses: [],
                 suggestedCourse: null, pushSave: null, pushDelete: null };
const listeners = { installable: [], queue: [], shared: [], update: [] };
const emit = (k, v) => listeners[k].forEach(cb => { try { cb(v) } catch (e) { console.error(e) } });

// ——— Small stores ———
const ls = {
  get(k, d) { try { const v = localStorage.getItem("stash.pwa." + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("stash.pwa." + k, JSON.stringify(v)); } catch {} },
};
function idb(store, mode, work) {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) return reject(new Error("no-idb"));
    const open = indexedDB.open("stash-pwa", 1);
    open.onupgradeneeded = () => {
      const db = open.result;
      for (const s of ["shared", "outbox", "desk"]) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: s === "outbox" ? "clientId" : "id" });
    };
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction(store, mode), req = work(tx.objectStore(store));
      tx.oncomplete = () => resolve(req?.result); tx.onerror = () => reject(tx.error);
    };
  });
}

// ——— Service worker ———
let registration = null;
// Automated runs skip the service worker too (its first install fetches the page's files while tests are measuring
// motion); the PWA's own tests opt in with ?pwa=demo.
if ("serviceWorker" in navigator && isSecureContext && !automated) {
  navigator.serviceWorker.register("sw.js", { scope: "./" }).then(reg => {
    registration = reg;
    const watch = w => w?.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) emit("update", w); });
    watch(reg.installing);
    reg.addEventListener("updatefound", () => watch(reg.installing));
  }).catch(() => {});
  navigator.serviceWorker.addEventListener("message", e => {
    if (e.data?.type === "flush") queue.flush();
    if (e.data?.type === "open" && e.data.url) location.href = e.data.url;
  });
}

// ——— Install at the right moment ———
let deferredPrompt = null;
const visits = ls.get("visits", 0) + 1; ls.set("visits", visits);
const startedAt = Math.round(performance.timeOrigin || Date.now()); // when the page started, not this late module
addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferredPrompt = e; considerInstall(); });
addEventListener("appinstalled", () => { ls.set("installed", true); hide("install"); });

function installState() {
  return { visits, firstSeenAt: ls.get("firstSeen", startedAt), lastOfferedAt: ls.get("lastOffered", null), dismissals: ls.get("dismissals", 0),
           installed: ls.get("installed", false), standalone, platform, canPrompt: !!deferredPrompt, moments: ls.get("moments", 0),
           secondsOnPage: (Date.now() - startedAt) / 1000 };
}
ls.set("firstSeen", ls.get("firstSeen", startedAt));

/** Never over a dialog, the item view or ⌘K: wait until the page is calm. */
const busy = () => !!document.querySelector('dialog[open], [role="dialog"]:not(.spwa), [aria-modal="true"], .scrim, .panel, .cmdk, [data-open-item]');
function considerInstall() {
  if (automated) return false;
  const d = InstallMoment.shouldOffer(installState(), Date.now());
  if (!d.offer) return false;
  if (busy()) { setTimeout(considerInstall, 8000); return false; }
  ls.set("lastOffered", Date.now());
  emit("installable", { platform, prompt: !!deferredPrompt });
  if (config.ui.install) showInstall();
  return true;
}
setTimeout(considerInstall, InstallMoment.minSecondsOnPage * 1000 + 500);

// ——— Offline outbox (IndexedDB; core.js Outbox rules: backoff, permanent failures, Undo) ———
const queue = (() => {
  let outbox = new Outbox([]), sender = null, flushing = false, ready = null;
  ready = idb("outbox", "readonly", s => s.getAll()).then(items => {
    outbox = new Outbox(items || []); outbox.recoverAfterLaunch(Date.now()); changed(false);
  }).catch(() => {});
  async function persist() {
    try { await idb("outbox", "readwrite", s => { s.clear(); for (const i of outbox.items) if (i.state !== "sent" || Date.now() - (i.sentAt ?? 0) < 60_000) s.put(i); }); } catch {}
  }
  function changed(save = true) {
    const sum = queueSummary(outbox.items, Date.now());
    emit("queue", { ...sum, items: outbox.items.map(i => ({ clientId: i.clientId, state: i.state, title: i.draft?.title, failure: i.failure })) });
    if (config.ui.queue) showQueue(sum);
    if (save) persist();
  }
  return {
    /** Queue something to add: { space, course, kind: "file"|"link"|"note", title, blob?, url?, text? }. Returns its id. */
    async add(draft) {
      await ready;
      const id = outbox.enqueue(draft, draft.space ?? null, draft.course ?? null, Date.now());
      changed(); haptic("success"); noteMoment("add");
      if (navigator.onLine) this.flush(); else registration?.sync?.register("stash-outbox").catch(() => {});
      return id;
    },
    /** The page's way of really sending one: async (item) => materialId; throw { failure: "tooBig" | … } to fail it. */
    setSender(fn) { sender = fn; this.flush(); },
    async flush() {
      await ready;
      if (!sender || flushing || !navigator.onLine) return;
      flushing = true;
      try {
        for (const item of outbox.due(Date.now())) {
          outbox.markSending(item.clientId); changed(false);
          try { const id = await sender(item); outbox.markSent(item.clientId, id); item.sentAt = Date.now(); haptic("success"); }
          catch (e) { outbox.markFailed(item.clientId, e?.failure || "network", Date.now()); }
          changed();
        }
      } finally { flushing = false; }
      setTimeout(() => changed(false), 4200); // "Sent" fades
    },
    cancel(id) { const ok = outbox.cancel(id); changed(); return ok; },
    retry() { outbox.retryNow(Date.now()); this.flush(); },
    get items() { return outbox.items.map(i => ({ ...i })); },
    onChange(cb) { listeners.queue.push(cb); changed(false); },
  };
})();
addEventListener("online", () => queue.flush());
document.addEventListener("visibilitychange", () => { if (!document.hidden) queue.flush(); });

// ——— Kept files: open once online, open again offline ———
const files = {
  shelf: new FileShelf(ls.get("shelf", [])),
  key: k => new URL(`__files/${encodeURIComponent(k)}`, location.href).href,
  /** Keep a file you opened (material id + its signed URL or a Blob). */
  async keep(key, source) {
    if (!("caches" in window)) return false;
    try {
      const response = source instanceof Blob ? new Response(source, { headers: { "content-type": source.type || "application/octet-stream" } }) : await fetch(source);
      if (!response.ok) return false;
      const blob = await response.clone().blob();
      const { kept, evict } = this.shelf.touch(key, blob.size, Date.now());
      const cache = await caches.open("stash-hub-files-1");
      for (const k of evict) await cache.delete(this.key(k));
      if (kept) await cache.put(this.key(key), new Response(blob, { headers: { "content-type": blob.type } }));
      ls.set("shelf", this.shelf.entries);
      noteMoment("open");
      return kept;
    } catch { return false; }
  },
  /** A URL that works offline for a kept file, or null. */
  async url(key) {
    if (!("caches" in window) || !this.shelf.has(key)) return null;
    const hit = await (await caches.open("stash-hub-files-1")).match(this.key(key));
    return hit ? URL.createObjectURL(await hit.blob()) : null;
  },
};

// ——— The desk, for offline: the page saves its last view of a course ———
const desk = {
  save: (courseId, data) => idb("desk", "readwrite", s => s.put({ id: courseId, data, at: Date.now() })).catch(() => {}),
  load: courseId => idb("desk", "readonly", s => s.get(courseId)).catch(() => null),
};

// ——— Shared in from another app (Android share sheet → "Stash") ———
async function takeShared() {
  const id = new URLSearchParams(location.search).get("shared");
  if (!id) return;
  history.replaceState(null, "", location.pathname + location.hash);
  if (id === "failed") { toast("That couldn’t be shared — try again from the app"); return; }
  let item = null;
  try { item = await idb("shared", "readonly", s => s.get(id)); await idb("shared", "readwrite", s => s.delete(id)); } catch {}
  if (!item) return;
  const plan = sharedPlan({ ...item, files: item.files.map(f => ({ name: f.name, size: f.size, type: f.type })) });
  // The course to preselect: the one whose class is on now, else the last one opened (the hub tells us).
  const suggested = typeof config.suggestedCourse === "function" ? config.suggestedCourse() : config.suggestedCourse;
  const payload = { ...plan, files: item.files, course: suggested ?? ls.get("lastCourse", null) };
  if (listeners.shared.length) emit("shared", payload);
  else if (config.ui.shared) showShared(payload);
}
// This module arrives after the load event (pwa.js waits for it), so look now.
if (document.readyState === "complete") setTimeout(takeShared, 0); else addEventListener("load", () => setTimeout(takeShared, 50));

// ——— Push ———
const push = {
  get supported() { return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window; },
  /** iPhone allows web push only once the hub is on the Home Screen (iOS 16.4+). */
  get available() { return this.supported && (platform !== "ios" || standalone); },
  get state() { return !this.supported ? "unsupported" : Notification.permission; },
  /** Turn on "tell me when someone adds to these courses" — call from a tap. */
  async enable(courses = []) {
    if (!this.available) return { ok: false, why: platform === "ios" ? "add-to-home-screen-first" : "unsupported" };
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return { ok: false, why: permission };
    const reg = registration || await navigator.serviceWorker.ready;
    const key = config.vapidPublicKey || await fetch("push-api/key").then(r => r.ok ? r.text() : null).catch(() => null);
    if (!key) return { ok: false, why: "no-server-key" };
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64url(key) });
    const json = sub.toJSON();
    // courses: null = all of my spaces (the server drops ids I'm not in).
    const record = { endpoint: json.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth, courses: courses?.length ? courses : null };
    const ok = config.pushSave
      ? await Promise.resolve(config.pushSave(record)).then(r => r !== false).catch(() => false)
      : await fetch(config.pushEndpoint || "push-api/subscribe", { method: "POST", headers: { "content-type": "application/json" },
                                                                  body: JSON.stringify({ subscription: json, courses }) }).then(r => r.ok).catch(() => false);
    if (!ok) await sub.unsubscribe().catch(() => {});
    ls.set("pushOn", ok);
    return { ok };
  },
  async disable() {
    const reg = registration || await navigator.serviceWorker?.ready;
    const sub = await reg?.pushManager.getSubscription();
    if (sub && config.pushDelete) await Promise.resolve(config.pushDelete(sub.endpoint)).catch(() => {});
    await sub?.unsubscribe(); ls.set("pushOn", false);
  },
};
function b64url(s) {
  const pad = "=".repeat((4 - s.length % 4) % 4), raw = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

// ——— Haptics (Android: vibrate; iPhone 18+: the system switch's tap — Safari has no vibrate) ———
let switchInput = null;
function haptic(kind = "light") {
  if (reduce) return;
  if (navigator.vibrate) { navigator.vibrate(kind === "success" ? [8, 40, 12] : 8); return; }
  if (platform === "ios") {
    if (!switchInput) {
      const label = document.createElement("label");
      label.setAttribute("aria-hidden", "true");
      label.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-9px;top:-9px";
      switchInput = document.createElement("input"); switchInput.type = "checkbox"; switchInput.setAttribute("switch", "");
      label.append(switchInput); document.body.append(label);
    }
    switchInput.parentElement.click();
  }
}

/** kind: "open" (a file opened), "add" (something added), "save" (something kept/saved). */
function noteMoment(kind = "open") {
  ls.set("moments", ls.get("moments", 0) + 1);
  setTimeout(considerInstall, 1200);
  // Notifications: only once they've added or saved something — and never on the first open after installing.
  if ((kind === "add" || kind === "save") && standalone && standaloneOpen > 1 && config.ui.push) {
    setTimeout(() => showPushOffer(config.courses[0]?.name || "your courses"), 1500);
  }
}
const standaloneOpen = standalone ? (ls.set("standaloneOpens", ls.get("standaloneOpens", 0) + 1), ls.get("standaloneOpens", 1)) : 0;

// ——— Default UI (quiet, in the hub's tokens; transform + opacity only; Reduce Motion: fades) ———
const css = `
.spwa{position:fixed;left:50%;z-index:60;width:min(440px,calc(100% - 24px));translate:-50% 0;
  bottom:calc(84px + env(safe-area-inset-bottom));background:var(--sheet,#FFFEFB);color:var(--ink,#202427);
  border-radius:16px;box-shadow:0 0 0 1px var(--hair,rgba(32,36,39,.09)),0 12px 32px rgba(0,0,0,.14);
  padding:16px 16px 14px;font:400 15px/1.4 var(--font,-apple-system,system-ui,sans-serif);
  animation:spwa-in var(--spring-dur,460ms) var(--spring,cubic-bezier(.2,.9,.25,1.08)) both}
.spwa.out{animation:spwa-out .18s ease-out both}
@keyframes spwa-in{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes spwa-out{to{opacity:0;transform:translateY(10px)}}
@media (prefers-reduced-motion: reduce){.spwa{animation:spwa-fade .15s ease-out both}.spwa.out{animation:spwa-fadeout .15s both}}
@keyframes spwa-fade{from{opacity:0}to{opacity:1}} @keyframes spwa-fadeout{to{opacity:0}}
.spwa b{font-weight:500}.spwa p{margin:4px 0 0;color:var(--ink2,#646A73);font-size:14px}
.spwa .row{display:flex;gap:10px;align-items:center}.spwa .grow{flex:1;min-width:0}
.spwa img{width:44px;height:44px;border-radius:10px;flex:none}
.spwa .acts{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}
.spwa button{font:500 15px/1 inherit;min-height:40px;padding:0 16px;border-radius:10px;border:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
.spwa .primary{background:var(--primary,#202427);color:var(--on-primary,#fff)}
.spwa .quiet{background:transparent;color:var(--ink2,#646A73)}
.spwa .share{display:inline-block;vertical-align:-3px;width:16px;height:18px}
.spwa-chip{position:fixed;z-index:59;left:50%;translate:-50% 0;bottom:calc(84px + env(safe-area-inset-bottom));
  background:var(--sheet,#FFFEFB);color:var(--ink,#202427);border-radius:999px;padding:8px 14px;font:500 13px/1 var(--font,system-ui);
  box-shadow:0 0 0 1px var(--hair,rgba(32,36,39,.09)),0 6px 18px rgba(0,0,0,.10);display:flex;gap:8px;align-items:center;
  transition:opacity .2s ease-out,transform .2s cubic-bezier(.23,1,.32,1)}
.spwa-chip[hidden]{display:flex!important;opacity:0;transform:translateY(8px);pointer-events:none}
.spwa-chip button{border:0;background:none;font:inherit;color:var(--sky-ink,#345EA0);text-decoration:underline;padding:0;cursor:pointer}
.spwa-list{display:grid;gap:8px;margin-top:12px}
.spwa-list button{text-align:start;background:var(--well,#EDE9E1);color:var(--ink,#202427);min-height:44px}`;
let styled = false;
function ensureStyle() { if (styled) return; styled = true; const s = document.createElement("style"); s.textContent = css; document.head.append(s); }
const shown = {};
function hide(k) { const el = shown[k]; if (!el) return; delete shown[k]; el.classList.add("out"); setTimeout(() => el.remove(), reduce ? 150 : 200); }
/** A sheet. `role`: "dialog" (named by its first <b> heading, QA-44) or "status" (the install hint, a toast: not
 *  modal, named by `label`). */
let sheetIds = 0;
function sheet(k, html, wire, { role = "dialog", label = null, inPlace = false } = {}) {
  if (inPlace && shown[k]) { shown[k].innerHTML = html; wire?.(shown[k]); return shown[k]; }   // new content, no second slide-in
  ensureStyle(); hide(k);
  const el = document.createElement("div"); el.className = "spwa";
  el.setAttribute("role", role);
  if (role === "status") el.setAttribute("aria-live", "polite");
  el.innerHTML = html;
  const heading = el.querySelector("b");
  if (label) el.setAttribute("aria-label", label);
  else if (heading) { heading.id = heading.id || `spwa-h${++sheetIds}`; el.setAttribute("aria-labelledby", heading.id); }
  document.body.append(el); shown[k] = el; wire?.(el); return el;
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const shareGlyph = `<svg class="share" viewBox="0 0 16 18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 11V1.5M4.5 4.8 8 1.5l3.5 3.3M5 7.5H3.2a1 1 0 0 0-1 1v7.3a1 1 0 0 0 1 1h9.6a1 1 0 0 0 1-1V8.5a1 1 0 0 0-1-1H11"/></svg>`;

function showInstall() {
  const ios = platform === "ios";
  // One line + "Not now", no picture (HUB-DESIGN.md); Android also gets "Add" for its real install prompt.
  sheet("install", `<div class="row"><div class="grow">${ios ? `Put Stash on your Home Screen: tap ${shareGlyph} Share, then <b>Add to Home Screen</b>.` : "Put Stash on your Home Screen — it opens like an app."}</div>
    <button class="quiet" data-no>Not now</button>${ios ? "" : `<button class="primary" data-install>Add</button>`}</div>`,
  el => {
    el.querySelector("[data-no]").onclick = () => { ls.set("dismissals", ls.get("dismissals", 0) + 1); hide("install"); };
    el.querySelector("[data-install]")?.addEventListener("click", async () => {
      hide("install");
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice.catch(() => ({ outcome: "dismissed" }));
      if (outcome === "accepted") ls.set("installed", true); else ls.set("dismissals", ls.get("dismissals", 0) + 1);
      deferredPrompt = null;
    });
  }, { role: "status", label: "Put Stash on your Home Screen" });
}

let chip = null;
function showQueue(sum) {
  ensureStyle();
  if (!chip) {
    chip = document.createElement("div"); chip.className = "spwa-chip"; chip.setAttribute("role", "status"); chip.hidden = true;
    document.body.append(chip);
  }
  chip.hidden = !sum.show;
  if (sum.show) chip.innerHTML = `<span>${esc(sum.label)}</span>${sum.failed && !sum.waiting && !sum.sending ? `<button data-retry>Try again</button>` : ""}`;
  chip.querySelector("[data-retry]")?.addEventListener("click", () => queue.retry());
}

let sharedPayload = null;   // the share waiting for "which course?" — redrawn when the course list arrives (live courses load after)
function showShared(payload, inPlace = false) {
  sharedPayload = payload;
  const files = payload.files || [], n = payload.ok.length;
  if (!n) { toast(payload.refused.length ? "That’s too big to add (50 MB at most)" : "Nothing to add"); return; }
  const what = n === 1 ? esc(payload.ok[0].name || payload.ok[0].title || "this") : `${n} things`;
  // The suggested course first (the one on now, else the last opened).
  const courses = [...config.courses].sort((a, b) => (b.id === payload.course) - (a.id === payload.course));
  sheet("shared", `<b>Add ${what} to which course?</b>${payload.refused.length ? `<p>${payload.refused.length} too big to add (50 MB at most).</p>` : ""}
    <div class="spwa-list">${courses.length ? courses.map(c => `<button data-course="${esc(c.id)}">${esc(c.name)}</button>`).join("") : `<p>Join a course first, then share again.</p>`}</div>
    <div class="acts"><button class="quiet" data-no>Cancel</button></div>`, el => {
    el.querySelector("[data-no]").onclick = () => { sharedPayload = null; hide("shared"); };
    el.querySelectorAll("[data-course]").forEach(b => b.onclick = () => {
      sharedPayload = null; hide("shared");
      const course = b.dataset.course, space = courses.find(c => c.id === course)?.space ?? null;
      for (const o of payload.ok) {
        const blob = o.kind === "file" ? files.find(f => f.name === o.name)?.blob : null;
        queue.add({ space, course, kind: o.kind, title: o.name || o.title || o.text?.slice(0, 60), blob, url: o.url, text: o.text });
      }
    });
  }, { inPlace });
}

function showPushOffer(courseName) {
  if (automated) return false;
  if (!push.available || push.state !== "default" || ls.get("pushAsked", false)) return false;
  ls.set("pushAsked", true);
  sheet("push", `<b>Tell me when someone adds to ${esc(courseName)}?</b><p>Like “Dana added Lecture 5”. Only for your courses; turn it off any time.</p>
    <div class="acts"><button class="quiet" data-no>Not now</button><button class="primary" data-ok>Turn on</button></div>`, el => {
    el.querySelector("[data-no]").onclick = () => hide("push");
    el.querySelector("[data-ok]").onclick = async () => { hide("push"); const r = await push.enable(config.courses.map(c => c.id)); toast(r.ok ? "On — you’ll hear when something’s added" : "Couldn’t turn it on"); };
  });
  return true;
}

function toast(text) {
  const el = sheet("toast", `<span>${esc(text)}</span>`, null, { role: "status", label: text });
  setTimeout(() => { if (shown.toast === el) hide("toast"); }, 2600);
}

// Once it's on the Home Screen, offer notifications once (on iPhone that's the only place web push exists).
// Dev server only (a private address, port 8787: trying it on your own phone): offer notifications soon after opening
// from the Home Screen, so push can be tried before the hub wires its add/save moments.
const devServer = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|localhost$|127\.)/.test(location.hostname) && location.port === "8787";
if (standalone && devServer) setTimeout(() => { if (config.ui.push) showPushOffer(config.courses[0]?.name || "your courses"); }, 4000);

export const api = Object.freeze({
  platform, standalone,
  configure(c = {}) { Object.assign(config, c, { ui: { ...config.ui, ...(c.ui || {}) } }); },
  setCourses(list) {
    config.courses = Array.isArray(list) ? list : [];
    if (sharedPayload && shown.shared) showShared(sharedPayload, true);   // the sheet was asked before the courses were known
  },
  /** The course to preselect for things shared in: an id, or a function returning one ("on now", else last opened). */
  suggestCourse(c) { config.suggestedCourse = c; },
  /** Remember the course last opened (the fallback suggestion). */
  openedCourse(id) { ls.set("lastCourse", id); },
  /** Something useful just happened (a file opened, something added): a good moment to offer the Home Screen. */
  noteMoment,
  offerInstall: considerInstall,
  offerPush: showPushOffer,
  onInstallable(cb) { listeners.installable.push(cb); },
  onShared(cb) { listeners.shared.push(cb); },
  onUpdate(cb) { listeners.update.push(cb); },
  /** A new version is waiting: take it now. */
  update() { registration?.waiting?.postMessage({ type: "skip-waiting" }); navigator.serviceWorker?.addEventListener("controllerchange", () => location.reload(), { once: true }); },
  queue, files, desk, push, haptic, toast,
});
