// The hub page on the REAL Stash server (docs/shared/WEB-HUB.md "Live mode"). Off unless the page is opened with
// ?live=1 (remembered in this browser; ?live=0 turns it off): then index.html swaps its made-up courses for the ones
// this browser is a member of on the server, and its Add / sticker / delete / join / leave go there. The same server
// functions as the Mac app (backend/supabase/shared.sql), so what one adds shows on the other within ~20 seconds.
// Publishable key only — row-level security guards; never a secret key (SupabaseBackend refuses one).
import { SupabaseBackend } from "./backend.js";
import { Presence } from "./core.js";

export const SERVER = Object.freeze({
  url: "https://gvxouyoucqojpghqzuks.supabase.co",
  publishableKey: "sb_publishable_PomoWbTbDphGFReApvWYIA_GHWqam62",
  // Web push (new things + dates-card reminders): the VAPID public key once functions/push-send is deployed with its
  // keys (GO-LIVE.md Part 6). Empty = no push on the page.
  vapidPublicKey: "",
});

const KINDS = { text: "note", link: "link", image: "photo", file: "pdf" };

/** "now", "5 min", "3 h", "Wed", "12 Oct" — the strings the sheets show. */
export function agoOf(iso, now = Date.now()) {
  const s = (now - new Date(iso).getTime()) / 1000;
  if (!(s >= 60)) return "now";
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  const d = new Date(iso);
  if (s < 6 * 86400) return d.toLocaleDateString("en", { weekday: "short" });
  return d.toLocaleDateString("en", { day: "numeric", month: "short" });
}

const sizeOf = b => b > 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB";

/** A server row → the shape the page draws. Pure; `people` maps person id → name, `me` is this person's id. */
export function itemFrom(row, { people, me, lastSeen, mine = [], ME = "You" }) {
  const kind = KINDS[row.kind];
  if (!kind) return null;
  const it = {
    id: row.id, cid: row.client_id, live: true, kind, week: row.week ?? null,
    title: row.title || (kind === "note" ? "" : row.file_path?.split("/").pop() || ""),
    by: row.added_by === me ? ME : (people.get(row.added_by) || "Someone"),
    ago: agoOf(row.created_at), createdAt: row.created_at, at: row.added_by === me ? 0 : Date.parse(row.created_at) || 0,
    isNew: !!lastSeen && row.added_by !== me && new Date(row.created_at) > new Date(lastSeen),
    stickers: Object.fromEntries((row.stickers || []).map((n, i) => [i + 1, n]).filter(([, n]) => n > 0)),
    mine, filePath: row.file_path, fileType: row.file_type, pinned: !!row.pinned,
  };
  if (kind === "note") it.text = row.body || row.title || "";
  if (kind === "link") { it.url = row.url; try { it.dom = new URL(row.url).hostname.replace(/^www\./, ""); } catch { it.dom = row.url; } it.title ||= it.dom; }
  if (kind === "pdf") it.meta = `${((row.title || "").split(".").pop() || "FILE").slice(0, 5).toUpperCase()} · ${sizeOf(row.file_size || 0)}`;
  if (kind === "photo") it.meta = sizeOf(row.file_size || 0);
  if (row.due_at) {
    const d = new Date(row.due_at);
    it.due = d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }) + " · " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    it.dueAt = row.due_at; it.dueTitle = row.due_title || it.title; it.dueSort = (d.getTime() - Date.now()) / 864e5;
  }
  return it;
}

export async function startLive(hub) {
  const { S, esc, ic, say, render, course, openPanel, closeAll, ME, store } = hub;
  const backend = new SupabaseBackend(SERVER);
  const spaces = new Map();   // course id → { people: Map, lastSeen, mineStickers }
  let timer = null, busy = false;
  let looksOn = null;         // profile colours/photos: null = not known yet, false = the server doesn't have them yet

  const failText = e => {
    const m = String(e?.message || e);
    if (e?.code === "unreadable_picture") return m;
    if (/Failed to fetch|NetworkError|offline|Load failed/i.test(m)) return "No connection. Try again when you’re back online.";
    if (/slow down/i.test(m)) return "Slow down a little — try again in a minute.";
    return m;
  };
  const sig = c => [...c.items, ...c.files].map(i => `${i.id}|${JSON.stringify(i.stickers)}|${i.week}|${i.title}|${i.sending ? 1 : 0}`).join(",") + `#${c.people}`;

  function block(html) { S.liveBlock = () => { document.title = "Stash"; hub.$("#course").innerHTML = html; hub.$("#bottombar").style.display = "none"; }; render(); }

  // ——— loading the courses ———
  async function load() {
    block(`<div class="course-top" aria-busy="true" aria-label="Loading your courses"><div class="sk sk-cover sk-pulse"></div><div class="sk sk-line sk-pulse"></div></div>`);
    try { await backend.signIn(); await refreshSpaces(true); await live.profile.load().catch(() => {}); }
    catch (e) { return block(`<div class="empty" style="padding-top:12vh"><h2>Can’t reach Stash right now</h2><p>${esc(failText(e))}</p><div class="acts"><button class="btn primary" data-act="live-retry">Try again</button></div></div>`); }
    S.liveBlock = null;
    S.current = S.courses.some(c => c.id === S.current) ? S.current : S.courses[0]?.id;
    render();
    const want = new URLSearchParams(location.search).get("code");
    if (want) lookup(want);
    schedule();
  }

  async function refreshSpaces(first) {
    // A class made on the Mac ("Create a class") is shown like a course: the Mac adds to it directly.
    const mine = (await backend.mySpaces()).filter(s => !s.deleted_at && (s.kind === "course" || s.kind === "class"));
    const old = new Map(S.courses.map(c => [c.id, c]));
    const next = mine.map(sp => {
      const c = old.get(sp.id) ?? { id: sp.id, items: [], files: [], weekTitles: {}, names: [], people: 1, invite: "", week: 1, lastVisit: "", uni: "", shelf: null };
      return Object.assign(c, { name: sp.name, code: sp.course_code || "", term: sp.term || "", termStarts: sp.term_starts || null, cover: (sp.cover ?? 0) % 10, purged: sp.purged_seq || 0 });
    });
    S.courses = next;
    await Promise.all(next.map(c => syncSpace(c, !old.has(c.id))));
  }

  // light = after a poke: only the changes (one request); names, week titles, the code and your own stickers wait for the
  // 15 s check, unless someone new adds something (a busy class pokes every few seconds — docs/shared/STRESS-2026-10-26.md).
  async function syncSpace(c, initial, light = false) {
    const before = sig(c);
    let st = spaces.get(c.id);
    if (!st) { st = { people: new Map(), lastSeen: null, mineStickers: new Map() }; spaces.set(c.id, st); }
    if (initial) { try { st.lastSeen = await backend.seen(c.id, true); } catch {} }
    if (!light || !st.loaded) { await syncMeta(c, st); light = false; }
    const res = await backend.catchUp(c.id, c.purged);
    if (light && res.arrivals.some(r => !st.people.has(r.added_by))) await syncMeta(c, st);
    return syncItems(c, st, res, initial, before, light);
  }

  async function syncMeta(c, st) {
    const [members, titles, stick, events] = await Promise.all([
      backend.people(c.id).catch(() => []), backend.weekTitles(c.id).catch(() => new Map()), backend.myStickers(c.id).catch(() => new Map()),
      backend.calendar(c.id).catch(() => null)]);
    if (events) c.events = events;   // the course calendar: Essentials and Coming up read it (dates-ui.js adds to it)
    st.people = new Map(members.map(p => [p.person_id, p.display_name]));
    st.myName = members.find(p => p.person_id === backend.me)?.display_name ?? null;
    st.mineStickers = stick;
    c.people = Math.max(1, members.length);
    c.allNames = members.filter(p => p.person_id !== backend.me).map(p => ({ name: p.display_name, role: p.role }));
    c.names = c.allNames.map(p => p.name).slice(0, 2);
    c.myName = members.find(p => p.person_id === backend.me)?.display_name || "";
    c.myRole = members.find(p => p.person_id === backend.me)?.role || "member";
    if (looksOn !== false) {   // colour or photo per person (migration 20261026_shared_profile); keyed by the name the page shows
      const lk = await backend.looks(c.id).catch(() => undefined);
      if (lk === null) looksOn = false;
      else if (lk) { looksOn = true; c.looks = new Map(members.filter(p => lk.has(p.person_id)).map(p => [p.person_id === backend.me ? ME : p.display_name, lk.get(p.person_id)])); }
    }
    const owner = members.find(p => p.role === "owner");
    c.owner = owner ? (owner.person_id === backend.me ? ME : owner.display_name) : "";
    c.weekTitles = Object.fromEntries([...titles]);
    try { c.invite = (await backend.inviteCode(c.id))?.code || c.invite; } catch { /* a member who may not invite */ }
    st.loaded = true;
  }

  async function syncItems(c, st, res, initial, before, light) {
    const rows = [...res.materials.values()].filter(r => r.ready && !r.hidden && !r.deleted_at)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const all = rows.map(r => itemFrom(r, { people: st.people, me: backend.me, lastSeen: st.lastSeen, mine: st.mineStickers.get(r.id) || [], ME })).filter(Boolean);

    const weeks = all.map(i => i.week).filter(w => w != null);
    const weekNow = weeks.length ? Math.max(...weeks) : 1;
    c.week = initial ? weekNow : Math.max(c.week, weekNow);
    for (const i of all) i.week ??= c.week;
    c.weekTitles[c.week] ??= "";

    await signImages(all);
    const known = new Map([...c.items, ...c.files].map(i => [i.id, i]));
    const sending = c.items.filter(i => i.sending && i.live);
    for (const o of sending) { const m = all.find(x => x.cid === o.cid); if (m) { o.id = m.id; o.sending = false; } }   // the row got here before the upload call returned
    const stillSending = sending.filter(o => o.sending);
    const keep = i => { const o = known.get(i.id); if (!o) return i; return Object.assign(o, { stickers: i.stickers, mine: light ? o.mine : i.mine, title: i.title, text: i.text, week: i.week, ago: i.ago, src: o.src || i.src, due: i.due, dueAt: i.dueAt, dueTitle: i.dueTitle, dueSort: i.dueSort, pinned: i.pinned }); };
    const arrivals = initial ? [] : all.filter(i => !known.has(i.id) && !sending.some(o => o.cid === i.cid));
    c.items = [...stillSending, ...all.filter(i => !i.pinned).map(keep)];
    c.files = all.filter(i => i.pinned).map(keep);
    return { arrivals, removed: res.removed, changed: before !== sig(c) };
  }

  async function signImages(items) {
    const need = items.filter(i => i.kind === "photo" && i.filePath && !i.src);
    if (!need.length) return;
    try {
      const { data } = await (await backend.client()).storage.from("spaces").createSignedUrls(need.map(i => i.filePath), 3600);
      for (const d of data || []) { const i = need.find(x => x.filePath === d.path); if (i && d.signedUrl) i.src = d.signedUrl; }
    } catch { /* the sheet shows without its picture; the next check tries again */ }
  }

  // ——— staying up to date (every 15 s while the page is open; a refresh when you come back to it) ———
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(async () => { if (!document.hidden) await poll(); schedule(); }, document.hidden ? 120_000 : 15_000);
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden && S.courses.length) poll(); });

  async function poll({ only = null, light = false } = {}) {
    if (busy || hub.$(".panel")) { if (light) pokeMissed = true; return; }   // never redraw under an open sheet
    busy = true;
    try {
      const cur = course();
      for (const c of [...S.courses]) {
        if (only && c.id !== only) continue;
        const { arrivals, removed, changed } = await syncSpace(c, false, light);
        if (c !== cur || S.view !== "course") { if (changed) hub.renderSide(); continue; }
        const grid = hub.$("#grid-now");
        const fly = c.items.filter(i => arrivals.some(a => a.id === i.id));
        if (fly.length && !removed.length && grid && fly.every(i => i.week === c.week)) {
          c.items = c.items.filter(x => !fly.includes(x));
          for (const i of fly.reverse()) hub.addItem(i);       // flies in with "Omer added …"
          hub.renderSide();
        } else if (changed) render();
      }
    } catch { /* offline: the next check tries again */ }
    busy = false;
    if (pokeMissed) { pokeMissed = false; poke(); }
  }

  // ——— instant: the server pokes the course on screen when something in it changes (shared.sql space_broadcast) ———
  // A burst of pokes (five people adding at once; a photo pokes twice) becomes one light check, at most one every
  // 1.5 s; the 15 s check above stays as the safety net (no socket, other courses' badges).
  let pokeTimer = null, pokeLast = 0, pokeMissed = false, pokeStop = null, pokeFor = null;
  function poke() {
    if (pokeTimer || !pokeFor) return;
    pokeTimer = setTimeout(async () => { pokeTimer = null; pokeLast = Date.now(); await poll({ only: pokeFor, light: true }); },
                           Math.max(250, 1500 - (Date.now() - pokeLast)));
  }
  function followPokes(c) {
    const want = c && !document.hidden ? c.id : null;
    if (want === pokeFor) return;
    pokeStop?.then(stop => stop?.()); pokeStop = null; pokeFor = want;
    if (want) pokeStop = backend.pokes(want, poke).catch(() => null);   // no Realtime: the 15 s check still runs
  }

  // ——— who's here now (Realtime Presence on the course channel; docs/shared/PRESENCE-REMINDERS.md) ———
  // Only in the course on screen, only while the page is in front: hidden or closed = gone at once. "Show me as here"
  // off = this device sends nothing (it still sees who's here). People you hid are never shown.
  let here = null, hereFor = null, hereBusy = Promise.resolve();
  const myPayload = id => Presence.payload(backend.me, spaces.get(id)?.myName, null, hub.showHere());
  let sent = "";
  function followHere(c) {
    const want = c && !document.hidden ? c.id : null;
    if (want === hereFor) {   // same course: send again only when what we send changed (a render is not news)
      const p = want ? myPayload(want) : null, key = JSON.stringify(p);
      if (here && key !== sent) { sent = key; here.set(p); }
      return;
    }
    hereFor = want;
    hereBusy = hereBusy.then(async () => {
      here?.stop(); here = null;
      for (const x of S.courses) if (x.present?.length) { x.present = []; }
      hub.renderPresence();
      if (!want || hereFor !== want) return;
      try {
        const hidden = await backend.myHides(want).catch(() => new Set());
        const h = await backend.here(want, myPayload(want), state => {
          const cc = S.courses.find(x => x.id === want); if (!cc) return;
          cc.present = Presence.people(state, { me: backend.me, members: spaces.get(want)?.people ?? new Map(), hidden });
          if (course()?.id === want) hub.renderPresence();
        });
        if (hereFor === want) here = h; else h.stop();
        sent = JSON.stringify(myPayload(want));
      } catch { /* no Realtime: no circles; everything else works */ }
    });
  }
  hub.hooks.course = c => { followHere(c); followPokes(c); };
  hub.hooks.showHere = () => followHere(S.view === "class" ? null : course());
  document.addEventListener("visibilitychange", () => { const c = S.view === "class" ? null : course(); followHere(c); followPokes(c); });
  addEventListener("pagehide", () => { here?.set(null); });
  if (SERVER.vapidPublicKey) hub.pwa?.(P => P.configure({ vapidPublicKey: SERVER.vapidPublicKey, pushSave: r => backend.savePush(r), pushDelete: e => backend.deletePush(e) }));
  hub.hooks.reminders = (c, on) => { backend.setReminders(c.id, on).catch(() => { /* the server switch isn't there yet: kept on this device */ }); };

  // ——— the page's actions ———
  async function send(it, c, wk, due) {
    const tmp = it.id;
    try {
      let row;
      if (it.kind === "photo" || it.kind === "pdf") row = await backend.shareFile(c.id, it.file, null, it.cid, undefined, it.title);
      else if (it.kind === "link") row = await backend.share(c.id, { kind: "link", title: it.title, url: it.url }, null, it.cid);
      else row = await backend.share(c.id, { kind: "text", body: it.text }, null, it.cid);
      if (!row?.id) throw new Error("The server didn’t answer.");
      if (it.cancelled) { await backend.remove(row.id); c.items = c.items.filter(x => x !== it); return; }
      if (wk && wk !== c.week) await backend.moveToWeek(row.id, wk).catch(() => {});
      if (due) await backend.setDue(row.id, new Date(due).toISOString(), it.dueTitle || null).catch(() => {});
      if (c.items.some(x => x !== it && x.id === row.id)) { c.items = c.items.filter(x => x !== it); render(); return; }   // a check got there first
      if (S.undo === tmp) S.undo = row.id;
      it.id = row.id; it.sending = false; it.ago = "now";
      const el = hub.$(`.sheet[data-id="${CSS.escape(tmp)}"]`);
      if (el) el.outerHTML = hub.sheet(it); else render();
    } catch (e) {
      c.items = c.items.filter(x => x !== it); render();
      say(`<span>${ic("warn", "s")}</span><span>Couldn’t send “${esc(it.title || "your note")}”. ${esc(failText(e))}</span>`, 7000);
    }
  }

  const live = {
    send,
    setDue: (it, at, title) => backend.setDue(it.id, new Date(at).toISOString(), title),   // "Add to Essentials?" (essentials-ui.js)
    /** "Found 6 dates — add them?" → Add (dates-ui.js): the ticked rows, already in import_events' shape. */
    async importDates(c, events) { await backend.importEvents(c.id, events); c.events = await backend.calendar(c.id).catch(() => c.events); },
    async sticker(it, sid, on) { try { await backend.sticker(it.id, sid, on); } catch (e) { say(`<span>${esc(failText(e))}</span>`, 4000); } },
    async remove(it) {
      if (it.sending) { it.cancelled = true; return; }
      try { await backend.remove(it.id); } catch (e) { say(`<span>${esc(failText(e))}</span>`, 4000); }
    },
    async report(id) { try { await backend.report(id, null); } catch { /* quiet */ } },
    async newCode(c) { try { return (await backend.inviteCode(c.id, true))?.code || c.invite; } catch (e) { say(`<span>${esc(failText(e))}</span>`, 4000); return c.invite; } },
    async leave(c) {
      try { await backend.leave(c.id); } catch (e) { say(`<span>${esc(failText(e))}</span>`, 4000); return; }
      S.courses = S.courses.filter(x => x !== c); S.current = S.courses[0]?.id; closeAll(true); render();
    },
    async forget() {
      for (const c of [...S.courses]) { try { await backend.leave(c.id); } catch { /* already out */ } }
      try { await (await backend.client()).auth.signOut(); } catch { /* quiet */ }
      for (const k of Object.keys(localStorage)) if (k.startsWith("stash.web") || k.startsWith("sb-")) localStorage.removeItem(k);
      S.courses = []; closeAll(true); render();
    },
    /** Open (or save) a file or photo: a signed link that works for 10 minutes, never a public one.
     *  iPhone: Save hands the file to the share sheet ("Save to Files", "Save Image"); a download link there only opens it. */
    async open(it, download, share = true) {
      if (!it?.filePath) return;
      if (download && share && hub.shareSave()) return shareFile(it);
      const tab = download ? null : window.open("about:blank", "_blank");   // opened inside the tap, or iPhone blocks it
      try {
        const url = await backend.fileURL(it.filePath);
        if (!download) { if (tab) tab.location.href = url; else location.href = url; return; }
        const blob = await (await fetch(url)).blob();
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = it.title || "file"; document.body.append(a); a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
        say(`<span>Saved to this device.</span>`, 2000);
      } catch (e) { tab?.close(); say(`<span>${esc(failText(e))}</span>`, 4000); }
    },
    lookup,
    // ——— Profile (optional): profile-ui.js ———
    profile: {
      /** Your colour/photo; sets S.looksOn (false while the server doesn't have looks yet). */
      async load() {
        const look = await backend.myLook().catch(() => null);
        S.looksOn = look !== null && looksOn !== false; S.myLook = look && (look.color != null || look.photo) ? look : null;
        return S.myLook;
      },
      async setLook(color, photo) {
        await backend.setMyLook(color, photo);
        S.myLook = color != null || photo ? { color, photo } : null;
        for (const c of S.courses) { c.looks ??= new Map(); if (S.myLook) c.looks.set(ME, S.myLook); else c.looks.delete(ME); }
        render();
      },
      /** Rename in every course (only = one course id). Returns [{name, ok, taken}] per course touched. */
      async rename(name, ids) {
        const out = [];
        for (const id of ids) {
          const c = S.courses.find(x => x.id === id); if (!c) continue;
          try { await backend.setMyName(id, name); c.myName = name; out.push({ name: c.name, ok: true }); }
          catch (e) { out.push({ name: c.name, ok: false, taken: e.code === "23505" || /pick another name|duplicate/i.test(e.message) }); }
        }
        if (out.some(r => r.ok)) { store.set("liveName", name); await refreshSpaces(false).catch(() => {}); render(); }
        return out;
      },
      pairCode: () => backend.pairCode(),
      /** Typing another device's code: this browser becomes that person (its courses move over). */
      async claim(code) {
        const status = await backend.link(code);
        if (status === "linked") {
          await backend.whoAmI(); backend.cursors.clear(); backend.materials.clear(); spaces.clear(); looksOn = null;
          await refreshSpaces(true); await live.profile.load();
          S.current = S.courses.some(c => c.id === S.current) ? S.current : S.courses[0]?.id; render();
        }
        return status;
      },
    },
  };

  // ——— Save on iPhone: the share sheet with the file itself ———
  // Safari only lets share() run straight after a tap, so the file is fetched when its sheet opens (prepare) and is
  // usually ready by the time Save is tapped; if not, it's fetched then and a second tap shares it.
  const files = new Map();   // item id → Promise<File>
  function prepare(it) {
    if (!it?.filePath) return null;
    if (!files.has(it.id)) {
      const p = (async () => {
        const blob = await (await fetch(await backend.fileURL(it.filePath))).blob();
        const ext = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/heic": "heic", "image/webp": "webp" }[blob.type];
        const name = ext && !/\.[a-z0-9]{2,5}$/i.test(it.title || "") ? `${it.title || "file"}.${ext}` : (it.title || "file");
        return new File([blob], name, { type: blob.type || "application/octet-stream" });
      })();
      p.catch(() => files.delete(it.id));   // a failed fetch is tried again on the next tap
      files.set(it.id, p);
    }
    return files.get(it.id);
  }
  async function shareFile(it) {
    let file;
    try { file = await prepare(it); } catch (e) { say(`<span>${esc(failText(e))}</span>`, 4000); return; }
    if (!navigator.canShare?.({ files: [file] })) return live.open(it, true, false);
    try { await navigator.share({ files: [file] }); }
    catch (e) {
      if (e?.name === "AbortError") return;   // closed the share sheet: nothing to say
      if (e?.name === "NotAllowedError") return say(`<span>Ready — tap <b>Save to Files</b> again.</span>`, 4000);
      say(`<span>${esc(failText(e))}</span>`, 4000);
    }
  }
  hub.hooks.openItem = it => { if (hub.shareSave() && it.filePath) prepare(it)?.catch(() => {}); };

  // ——— joining ———
  async function lookup(raw) {
    const code = String(raw || "").replace(/[^a-z0-9]/gi, "").toUpperCase();
    let p = null;
    try { p = await backend.preview(code); } catch (e) { say(`<span>${esc(failText(e))}</span>`, 5000); return; }
    if (!p || p.status !== "ok") {
      const why = { expired: "That code has expired. Ask for a new one.", closed: "That course isn’t taking new people.", invalid: "That code doesn’t match a course. Check it and try again." };
      return openPanel(`${hub.head("Join a course")}<div class="p-body"><p style="margin:0;color:var(--ink2)">${esc(why[p?.status] || why.invalid)}</p></div>`, { w: 420, label: "Join a course" });
    }
    if (p.already_member) { const c = S.courses.find(x => x.invite === code); if (c) { S.current = c.id; closeAll(true); render(); } return; }
    openPanel(`${hub.head(`Join ${esc(p.name)}?`)}<form data-live-join="${esc(code)}"><div class="p-body">
      <p style="margin:0 0 14px;color:var(--ink2)">${esc(String(p.people ?? ""))} ${Number(p.people) === 1 ? "person" : "people"}${p.owner_name ? ` · started by ${esc(p.owner_name)}` : ""}${p.needs_approval ? " · the owner approves new people" : ""}</p>
      <div class="field" style="margin-top:0"><label for="f-name">Your name in this course</label><input class="input" id="f-name" name="name" maxlength="40" value="${esc(store.get("liveName", ""))}" autocomplete="given-name" autofocus required></div>
      <p class="live-err" role="alert" style="color:var(--ink2);font-size:13px;margin:10px 0 0"></p></div>
      <div class="p-foot"><button class="btn quiet" type="button" data-act="close">Cancel</button><span class="grow"></span><button class="btn primary" type="submit">Join</button></div></form>`, { w: 420, label: `Join ${p.name}` });
  }

  document.addEventListener("submit", async e => {
    const f = e.target.closest("[data-live-join]"); if (!f) return;
    e.preventDefault();
    const name = String(new FormData(f).get("name") || "").trim(), err = hub.$(".live-err", f);
    if (!name) return;
    const btn = hub.$('button[type="submit"]', f); btn.disabled = true;
    try {
      const r = await backend.join(f.dataset.liveJoin, name);
      const msg = { name_taken: "Someone in this course already uses that name. Try another.", too_many_tries: "Too many tries. Wait a few minutes and try again.",
                    full: "This course is full.", blocked: "You can’t join this course.", expired: "That code has expired.", invalid: "That code doesn’t match a course." };
      if (r?.status === "joined" || r?.status === "requested") {
        store.set("liveName", name);
        if (store.get("profileHint", "") !== "done") store.set("profileHint", "show");   // "Make it yours · Profile", once
        if (r.status === "requested") { closeAll(); say(`<span>${ic("check", "s")}</span><span>Asked to join. You’ll be in once the owner says yes.</span>`, 6000); return; }
        await refreshSpaces(false);
        S.current = r.space_id; store.set("course", S.current); S.welcome = true;
        closeAll(true); history.replaceState(null, "", `?c=${S.current}`); render(); return;
      }
      err.textContent = msg[r?.status] || "Something went wrong. Try again."; btn.disabled = false;
    } catch (ex) { err.textContent = failText(ex); btn.disabled = false; }
  });
  document.addEventListener("click", e => { if (e.target.closest('[data-act="live-retry"]')) load(); });

  hub.live = live;
  await load();
}
