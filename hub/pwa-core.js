// The hub as an app on your phone (docs/shared/PWA.md) — the rules, pure: no DOM, no network, tested in
// site/hub/test/pwa.test.mjs. pwa.js (the page) and sw.js (the service worker) follow them.

/** When to offer "Put Stash on your Home Screen": at a useful moment, never nagging. */
export const InstallMoment = Object.freeze({
  /** Not in the first moments of the very first visit. */
  minSecondsOnPage: 20,
  /** At most once a day. */
  minHoursBetween: 24,
  /** Two "Not now"s and it never asks again. */
  maxDismissals: 2,

  /**
   * @param {{visits:number, firstSeenAt:number, lastOfferedAt:number|null, dismissals:number, installed:boolean,
   *          standalone:boolean, platform:"ios"|"android"|"desktop"|"other", canPrompt:boolean, moments:number,
   *          secondsOnPage:number}} s
   * `moments` counts useful things done: a file opened, something added. `canPrompt` = the browser gave us its
   * install prompt (Chromium) — on iPhone there is none, we explain the Share → Add to Home Screen steps instead.
   */
  shouldOffer(s, now) {
    if (s.installed || s.standalone) return { offer: false, why: "already-installed" };
    if (s.platform === "desktop" || s.platform === "other") return { offer: false, why: "not-a-phone" };
    if (s.platform === "android" && !s.canPrompt) return { offer: false, why: "no-prompt" };
    if (s.dismissals >= this.maxDismissals) return { offer: false, why: "said-no" };
    if (s.lastOfferedAt != null && now - s.lastOfferedAt < this.minHoursBetween * 3600e3) return { offer: false, why: "today" };
    if (s.secondsOnPage < this.minSecondsOnPage && s.moments === 0) return { offer: false, why: "too-soon" };
    if (s.visits >= 2 || s.moments >= 1) return { offer: true, why: s.moments >= 1 ? "after-something-useful" : "second-visit" };
    return { offer: false, why: "first-visit" };
  },
});

/** Which device a user agent is (only to choose the right install steps — never stored or sent). */
export function platformOf(ua = "", maxTouchPoints = 0) {
  if (/iPhone|iPod/.test(ua) || (/iPad|Macintosh/.test(ua) && maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  if (/Macintosh|Windows|Linux|CrOS/.test(ua)) return "desktop";
  return "other";
}

/** Recently opened files kept for offline use: newest first, at most `maxItems` and `maxBytes`. */
export class FileShelf {
  constructor(entries = [], { maxItems = 40, maxBytes = 150 * 1024 * 1024 } = {}) {
    this.entries = entries.map(e => ({ ...e }));
    this.maxItems = maxItems; this.maxBytes = maxBytes;
  }
  /** Opened (or re-opened) now: to the front. Returns the keys to evict from the cache. */
  touch(key, bytes, now) {
    if (!(bytes > 0) || bytes > this.maxBytes) return { kept: false, evict: [] };
    this.entries = this.entries.filter(e => e.key !== key);
    this.entries.unshift({ key, bytes, at: now });
    const evict = [];
    let total = 0;
    this.entries = this.entries.filter((e, i) => {
      total += e.bytes;
      if (i >= this.maxItems || total > this.maxBytes) { evict.push(e.key); return false; }
      return true;
    });
    return { kept: true, evict };
  }
  has(key) { return this.entries.some(e => e.key === key); }
  get totalBytes() { return this.entries.reduce((s, e) => s + e.bytes, 0); }
}

/** The service worker's way for each request. */
export function routeFor(request, scope) {
  const url = new URL(request.url);
  if (request.method === "POST" && url.href === new URL("share-target", scope).href) return "share-target";
  if (request.method !== "GET") return "network";
  if (url.origin !== new URL(scope).origin || !url.href.startsWith(scope)) return "network"; // the backend, CDNs
  if (url.pathname.includes("/__files/")) return "files";            // a kept file (cache only)
  if (url.pathname.includes("/nearby-api/") || url.pathname.includes("/push-api/")) return "network";
  if (url.pathname.endsWith("/boot.js")) return "network";            // the page's version check: always the newest
  if (request.mode === "navigate") return "page";                     // network first, the cached page when offline
  return "asset";                                                     // cached at once, refreshed behind
}

/** What the "waiting to send" chip says, from the outbox's items. */
export function queueSummary(items, now) {
  const waiting = items.filter(i => i.state === "waiting").length;
  const sending = items.filter(i => i.state === "sending").length;
  const failed = items.filter(i => i.state === "failed").length;
  const justSent = items.filter(i => i.state === "sent" && now - (i.sentAt ?? 0) < 4000).length;
  let label = "";
  if (sending) label = waiting + sending > 1 ? `Sending ${waiting + sending}…` : "Sending…";
  else if (waiting) label = waiting > 1 ? `${waiting} waiting to send` : "Waiting to send";
  else if (failed) label = failed > 1 ? `${failed} couldn’t be sent` : "Couldn’t be sent";
  else if (justSent) label = justSent > 1 ? `${justSent} sent` : "Sent";
  return { waiting, sending, failed, justSent, label, show: label !== "" };
}

/** A shared-in item (Android share sheet → the hub): what can be added, what can't and why. */
export function sharedPlan(shared, { maxFileBytes = 50 * 1024 * 1024 } = {}) {
  const ok = [], refused = [];
  for (const f of shared.files ?? []) {
    if (!(f.size > 0)) refused.push({ name: f.name, why: "empty" });
    else if (f.size > maxFileBytes) refused.push({ name: f.name, why: "tooBig" });
    else ok.push({ kind: "file", name: f.name, size: f.size, type: f.type });
  }
  const link = [shared.url, shared.text].map(s => String(s ?? "").trim()).find(s => /^https?:\/\/\S+$/i.test(s));
  if (link) ok.push({ kind: "link", url: link, title: String(shared.title ?? "").trim() || link });
  else {
    const text = [shared.title, shared.text].map(s => String(s ?? "").trim()).filter(Boolean).join("\n");
    if (text && !(shared.files ?? []).length) ok.push({ kind: "note", text: text.slice(0, 100_000) });
  }
  return { ok, refused };
}
