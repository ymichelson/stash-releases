// Nearby — "X is nearby · Join" for the hub's pages (docs/shared/NEARBY.md, HUB-DESIGN.md §4.8). PROTOTYPE.
//
//   <script src="nearby/nearby.js"></script>
//   const stop = window.stashNearby.onSharing(list => …, { courses: ["Algorithms"] });
//
// `list` = up to 3 people sharing a course invite near you right now, newest first, the courses you named first:
//   [{ id, name: "Dana", course: "Algorithms", code: "K7Q4MZ", joinURL: "…?code=K7Q4MZ" }]
// `code` is a short-lived nearby code (nearby_invite: 15 minutes, ≤ 60 joins), never the course's main code.
// Called again whenever it changes (also with [] when they stop). This page only LISTENS: it never shows itself to
// anyone, never joins by itself (Join must open the normal join confirm), and only runs while the page is open — it
// pauses when the tab is hidden. Signalling: the same stub server as nearby/index.html (`/nearby-api/`), or, with no
// server, the browser's other tabs. In production: the Supabase Realtime room (NEARBY.md "Backend").
(() => {
  "use strict";
  if (window.stashNearby) return;
  const MAX = 3, STALE = 15000;
  const randomID = () => { const a = "abcdefghjkmnpqrstuvwxyz23456789", r = crypto.getRandomValues(new Uint8Array(10)); return [...r].map(x => a[x % a.length]).join("") };
  const clean = (s, n) => (String(s || "").replace(/[\u0000-\u001f‎‏‪-‮⁦-⁩]/g, " ").replace(/\s+/g, " ").trim().slice(0, n));
  const code6 = s => { const c = String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); return /^[A-HJ-NP-Z2-9]{6}$/.test(c) ? c : null };

  // Join opens the join page (QA-06): <site>/join/?code=…, found from this script's own address
  // (<site>/hub/nearby/nearby.js), so it works on the hub, the join page and the stub server alike.
  const scriptURL = document.currentScript?.src || location.href;
  const joinURL = code => new URL(`../../join/?code=${code}`, scriptURL).href;
  const listeners = new Set();
  const sharers = new Map(); // id → { name, course, code, seen }
  let me = randomID(), signal = null, timer = null, last = "";

  async function connect() {
    let server = false;
    // The public site (GitHub Pages) has no stub server: asking there only logs a 404 on every page load.
    if (location.protocol.startsWith("http") && !location.hostname.endsWith("github.io")) { try { server = (await fetch("/nearby-api/ping", { cache: "no-store" })).ok } catch {} }
    if (server) {
      const es = new EventSource(`/nearby-api/events?id=${me}&room=auto`);
      es.onmessage = e => { try { const { from, msg } = JSON.parse(e.data); onSignal(from, msg) } catch {} };
      signal = {
        send: (msg, to) => fetch("/nearby-api/send", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ room: "auto", from: me, to, msg }) }).catch(() => {}),
        close: () => es.close(),
      };
      await new Promise(r => { es.onopen = r; setTimeout(r, 3000) });
    } else if ("BroadcastChannel" in window) {
      const bc = new BroadcastChannel("stash-nearby:auto");
      bc.onmessage = e => { const { from, to, msg } = e.data || {}; if (from !== me && (!to || to === me)) onSignal(from, msg) };
      signal = { send: (msg, to) => bc.postMessage({ from: me, to, msg }), close: () => bc.close() };
    } else return;
    // A hidden "hello" so sharers answer with theirs; this page is never listed anywhere.
    signal.send({ type: "hello", name: "", platform: "web", visible: false, reply: true });
  }

  function onSignal(from, msg) {
    if (!msg || !/^[a-z0-9]{10}$/.test(from)) return;
    if (msg.type === "bye") { sharers.delete(from); return emit() }
    if (msg.type !== "hello") return;
    const code = code6(msg.sharing?.code), course = clean(msg.sharing?.course, 60);
    if (msg.visible && code && course) sharers.set(from, { name: clean(msg.name, 24) || "Someone", course, code, seen: Date.now() });
    else sharers.delete(from);
    emit();
  }

  let prefer = [];
  function emit() {
    const now = Date.now();
    for (const [id, s] of sharers) if (now - s.seen > STALE) sharers.delete(id);
    const mine = c => prefer.some(p => p.toLowerCase() === c.toLowerCase()) ? 0 : 1;
    const list = [...sharers.entries()]
      .sort(([, a], [, b]) => mine(a.course) - mine(b.course) || b.seen - a.seen)
      .slice(0, MAX)
      .map(([id, s]) => ({ id, name: s.name, course: s.course, code: s.code, joinURL: joinURL(s.code) }));
    const key = JSON.stringify(list.map(({ id, course, code }) => [id, course, code]));
    if (key === last) return;
    last = key;
    for (const cb of listeners) { try { cb(list) } catch (e) { console.error(e) } }
  }

  function start() {
    if (signal || document.hidden) return;
    connect().then(() => { timer = setInterval(() => { signal?.send({ type: "hello", name: "", platform: "web", visible: false, reply: true }); emit() }, 5000) });
  }
  function pause() {
    clearInterval(timer); timer = null;
    signal?.send({ type: "bye" }); signal?.close?.(); signal = null;
    sharers.clear(); emit();
    me = randomID(); // a new ID each time the page comes back
  }
  document.addEventListener("visibilitychange", () => document.hidden ? pause() : listeners.size && start());
  addEventListener("pagehide", () => signal?.send({ type: "bye" }));

  window.stashNearby = {
    /** Calls `cb(list)` now-ish and whenever the nearby sharers change. Returns a function that stops listening. */
    onSharing(cb, options = {}) {
      prefer = Array.isArray(options.courses) ? options.courses.map(String) : prefer;
      listeners.add(cb);
      start();
      setTimeout(() => { last = ""; emit() }, 0);
      return () => { listeners.delete(cb); if (!listeners.size) pause() };
    },
  };
})();
