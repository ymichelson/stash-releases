// The web hub's connection to Stash's server — the same Supabase functions the Mac app calls (backend/supabase/shared.sql),
// as a browser device (p_platform = 'web'). Two backends with one shape:
//   * PretendBackend: the made-up class, in memory (the prototype, and whenever no server is configured)
//   * SupabaseBackend: the real server (only once shared.sql is applied and the page is given the project URL + the
//     PUBLISHABLE key — never a secret key; row-level security does the guarding)
// Contract test: site/hub/test/backend.test.mjs checks every function and parameter name here against shared.sql.

import { CatchUp, CourseCode, ICSImport, Outbox, ProgressThrottle, sha256Hex } from "./core.js";

/** Every server function the web calls, with its parameters in order (checked against shared.sql by the tests). */
export const RPC = Object.freeze({
  shared_register: ["p_platform", "p_app_version"],
  preview_space: ["p_code", "p_platform"],
  join_space: ["p_code", "p_my_name", "p_platform", "p_via", "p_find_token"],
  add_material: ["s", "p_client_id", "p_kind", "p_title", "p_body", "p_url", "p_course", "p_file_name", "p_file_size",
                 "p_file_type", "p_file_sha256", "p_has_thumb", "p_ocr_text", "p_added_from", "p_replaces", "p_fills",
                 "p_due_at", "p_due_title"],
  set_due: ["p_material", "p_due_at", "p_due_title"],
  material_ready: ["p_material"],
  delete_material: ["p_material"],
  report_material: ["p_material", "p_reason", "p_to_team"],
  leave_space: ["s", "p_take_mine"],
  mark_seen: ["s", "p_opened"],
  move_material: ["p_material", "p_course", "p_pinned", "p_clear_course", "p_week"],
  find_courses: ["p_university", "p_query", "p_term", "p_platform"],
  create_course: ["p_name", "p_my_name", "p_code", "p_term", "p_term_starts", "p_university", "p_findable", "p_class",
                  "p_instructor", "p_platform", "p_join_policy"],
  set_course_details: ["s", "p_name", "p_code", "p_term", "p_term_starts", "p_university", "p_findable", "p_instructor", "p_cover",
                       "p_join_policy"],
  class_courses: ["p_class"],
  invite_code: ["s", "p_renew", "p_open", "p_expires_in_days"],
  set_week_title: ["s", "p_week", "p_title"],
  react: ["p_material", "p_sticker"],
  note_save: ["p_material"],
  unreact: ["p_material", "p_sticker"],
  hide_person: ["s", "p_person", "p_hide"],
  set_info: ["s", "p_id", "p_kind", "p_role", "p_name", "p_email", "p_hours", "p_url", "p_sort"],
  delete_info: ["p_id"],
  save_event: ["s", "p_id", "p_kind", "p_title", "p_starts_at", "p_ends_at", "p_all_day", "p_location", "p_repeat_until"],
  delete_event: ["p_id"],
  import_events: ["s", "p_events"],
  space_pulse: ["s"],
  claim_pair_code: ["p_code", "p_platform"],
  save_push_subscription: ["p_endpoint", "p_p256dh", "p_auth", "p_courses"],
  delete_push_subscription: ["p_endpoint"],
  set_push_zone: ["p_endpoint", "p_tz", "p_lang"],
  set_reminders: ["s", "p_on"],
  make_pair_code: [],
  set_my_name: ["s", "p_name"],
  set_my_look: ["p_color", "p_photo"],     // migration 20261026_shared_profile (until it's applied: "not available")
  space_looks: ["s"],
  delete_me: ["p_confirm"],
});

/** Tables the web reads directly (row-level security decides what comes back). */
export const TABLES = Object.freeze(["spaces", "space_courses", "space_materials", "universities", "space_reactions",
                                     "space_week_titles", "space_info", "space_events", "space_hides"]);
/** Members: only these columns are readable (the People sheet shows names and roles, nothing else). */
export const MEMBER_COLUMNS = Object.freeze(["space_id", "person_id", "display_name", "role"]);

/** Picks the backend: the real one only when configured. */
export function createBackend(config = {}) {
  return config.url && config.publishableKey ? new SupabaseBackend(config) : new PretendBackend(config.seed);
}

// ——— Real server ———
export class SupabaseBackend {
  constructor({ url, publishableKey, supabase }) {
    if (/^sb_secret_|service_role/.test(publishableKey)) throw new Error("Never put a secret key in the page.");
    this.url = url; this.key = publishableKey; this._sb = supabase ?? null;
    this.outbox = new Outbox();
    this.cursors = new Map(); this.materials = new Map(); this.me = null;
  }

  async client() {
    if (this._sb) return this._sb;
    // Pinned ESM build from jsDelivr (the only script the page loads from outside).
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm");
    this._sb = createClient(this.url, this.key, { auth: { persistSession: true, storageKey: "stash.web.session" } });
    return this._sb;
  }

  async rpc(name, ...args) {
    const params = Object.fromEntries(RPC[name].map((p, i) => [p, args[i]]).filter(([, v]) => v !== undefined));
    const { data, error } = await (await this.client()).rpc(name, params);
    if (error) throw Object.assign(new Error(error.message), { code: error.code });
    return data;
  }

  /** First visit: this browser becomes an anonymous device (Turnstile goes in front of this once it's set up). */
  async signIn() {
    const sb = await this.client();
    const { data } = await sb.auth.getSession();
    if (!data.session) {
      const { error } = await sb.auth.signInAnonymously();
      if (error) throw error;
    }
    this.me = await this.rpc("shared_register", "web", "web-1");
    return this.me;
  }

  /** A new course (the web hub's test setup and the round-trip script; people normally join one made on a Mac). */
  async createCourse(name, myName, { term = null, code = null } = {}) {
    return (await this.rpc("create_course", name, myName, code, term, undefined, undefined, false, undefined, undefined, "web"))?.[0] ?? null;
  }
  /** Removes this device's person and everything it made (the throwaway test devices clean up with this). */
  deleteMe() { return this.rpc("delete_me", "DELETE"); }

  async preview(code) { return (await this.rpc("preview_space", code, "web"))?.[0] ?? null; }
  async join(code, name) { return (await this.rpc("join_space", code, name, "web", "link"))?.[0] ?? null; }
  /** Join a course found by its code (the one-time token from find_course; no code needed). */
  async joinFound(token, name) { return (await this.rpc("join_space", null, name, "web", "find", token))?.[0] ?? null; }

  /** Your courses and their shelves: the sidebar ("Your courses", grouped under each class). */
  async mySpaces() {
    const sb = await this.client();
    const { data, error } = await sb.from("spaces")
      .select("id,kind,name,parent_id,course_code,term,term_starts,cover,university_id,findable,members_can_invite,purged_seq,deleted_at");
    if (error) throw error;
    return data;
  }

  /** The People sheet: names and roles only. */
  async people(space) {
    const sb = await this.client();
    const { data, error } = await sb.from("space_members").select(MEMBER_COLUMNS.join(",")).eq("space_id", space);
    if (error) throw error;
    return data;
  }

  async weekTitles(space) {
    const sb = await this.client();
    const { data, error } = await sb.from("space_week_titles").select("week,title").eq("space_id", space);
    if (error) throw error;
    return new Map(data.map(r => [r.week, r.title]));
  }

  /** Your own stickers in a course (counts come on each material's row). */
  async myStickers(space) {
    const sb = await this.client();
    const { data, error } = await sb.from("space_reactions").select("material_id,sticker,space_materials!inner(space_id)")
      .eq("space_materials.space_id", space);
    if (error) throw error;
    const mine = new Map();
    for (const r of data) mine.set(r.material_id, [...(mine.get(r.material_id) ?? []), r.sticker]);
    return mine;
  }

  /** Everything after the cursor, in change order. Reloads when the Mac was offline past the 7-day tombstones. */
  async catchUp(space, purgedSeq = 0) {
    const sb = await this.client();
    let cursor = this.cursors.get(space) ?? 0;
    if (CatchUp.needsReload(cursor, purgedSeq)) { cursor = 0; this.materials.set(space, new Map()); }
    const { data, error } = await sb.from("space_materials").select("*").eq("space_id", space).gt("seq", cursor).order("seq").limit(500);
    if (error) throw error;
    const result = CatchUp.merge(this.materials.get(space) ?? new Map(), cursor, data, this.me);
    this.materials.set(space, result.materials);
    this.cursors.set(space, result.cursor);
    return result;
  }

  /** The course's one Realtime channel (space:<id>), shared by everything that listens on it: pokes, upload progress
   *  and who's here (Presence). Opened on first use, closed when the last listener stops. */
  async channel(space) {
    const sb = await this.client();
    this.channels = this.channels ?? new Map();
    let ch = this.channels.get(space);
    if (ch) return ch;
    const on = { changed: new Set(), progress: new Set(), presence: new Set() };
    ch = sb.channel(`space:${space}`, { config: { private: true, presence: { key: String(this.me ?? "web") } } })
      .on("broadcast", { event: "changed" }, () => on.changed.forEach(f => f()))
      .on("broadcast", { event: "progress" }, ({ payload }) => on.progress.forEach(f => f(payload)))
      .on("presence", { event: "sync" }, () => on.presence.forEach(f => f(ch.presenceState())));
    ch.stash = { on, here: null, subscribed: false };
    ch.subscribe(status => {
      ch.stash.subscribed = status === "SUBSCRIBED";
      if (ch.stash.subscribed && ch.stash.here) ch.track(ch.stash.here);
    });
    this.channels.set(space, ch);
    return ch;
  }
  release(space) {
    const ch = this.channels?.get(space);
    if (!ch || [...Object.values(ch.stash.on)].some(s => s.size)) return;
    this.channels.delete(space);
    this._sb?.removeChannel(ch);
  }

  /** Live: pokes ("space X changed" → pull), upload progress from others, and who's adding what (Presence).
   *  Falls back to polling (20 s visible, 2 min hidden) if the socket fails. */
  async watch(space, onPoke, { onProgress = () => {}, onPresence = null } = {}) {
    const ch = await this.channel(space);
    ch.stash.on.changed.add(onPoke); ch.stash.on.progress.add(onProgress);
    if (onPresence) ch.stash.on.presence.add(onPresence);
    let timer = null;
    const poll = () => { clearTimeout(timer); timer = setTimeout(async () => { await onPoke(); poll(); }, document.hidden ? 120_000 : 20_000); };
    poll();
    return () => {
      clearTimeout(timer);
      ch.stash.on.changed.delete(onPoke); ch.stash.on.progress.delete(onProgress); if (onPresence) ch.stash.on.presence.delete(onPresence);
      this.release(space);
    };
  }

  /** Who's here now: this device says it's here with `payload` ({p, n, c} from core.js Presence.payload, or null to
   *  stay unseen) and hears who else is (onState gets supabase-js presenceState()). Returns {set(payload), stop()}. */
  async here(space, payload, onState) {
    const ch = await this.channel(space);
    ch.stash.on.presence.add(onState);
    const set = p => {
      ch.stash.here = p ?? null;
      if (!ch.stash.subscribed) return;
      if (p) ch.track(p); else ch.untrack();
    };
    set(payload);
    if (ch.stash.subscribed) onState(ch.presenceState());
    return { set, stop: () => { set(null); ch.stash.on.presence.delete(onState); this.release(space); } };
  }
  /** People you hid in a course (your own rows): they aren't shown as here. */
  async myHides(space) {
    const sb = await this.client();
    const { data, error } = await sb.from("space_hides").select("hidden_person").eq("space_id", space);
    if (error) throw error;
    return new Set(data.map(r => r.hidden_person));
  }
  /** Reminders on/off for a course (the server's web push reminders; the Mac keeps its own switch). */
  setReminders(space, on) { return this.rpc("set_reminders", space, !!on); }
  /** Web push: this device's address (pwa-main.js pushSave/pushDelete) and its time zone + language for reminders. */
  async savePush({ endpoint, p256dh, auth, courses }) {
    await this.rpc("save_push_subscription", endpoint, p256dh, auth, courses ?? null);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    await this.rpc("set_push_zone", endpoint, tz, document.documentElement.lang === "he" ? "he" : "en").catch(() => {});
    return true;
  }
  deletePush(endpoint) { return this.rpc("delete_push_subscription", endpoint); }

  /** Share text or a link (files go through shareFile). Safe to retry: the client id makes it idempotent. */
  async share(space, draft, course = null, clientId = crypto.randomUUID()) {
    const row = (await this.rpc("add_material", space, clientId, draft.kind, draft.title ?? null, draft.body ?? null,
                                draft.url ?? null, course, undefined, undefined, undefined, undefined, undefined,
                                undefined, "web"))?.[0];
    return row;
  }

  /** Share a file: the row first (everyone sees "Name is adding …" at once), then the upload with progress
   *  (Presence says who's adding, Broadcast carries progress at most once a second), then material_ready. */
  async shareFile(space, file, course = null, clientId = crypto.randomUUID(), onLocalProgress = () => {}, title = null) {
    file = await withoutPhotoDetails(file);   // no GPS / camera / dates in a photo (SharedImages on the Mac)
    const sha = await sha256(file);
    const kind = file.type.startsWith("image/") ? "image" : "file";
    const row = (await this.rpc("add_material", space, clientId, kind, title || file.name, null, null, course, file.name, file.size,
                                file.type || null, sha, false, null, "web"))?.[0];
    if (!row || row.duplicate_of || row.existed) return row;
    const channel = this.channels?.get(space);
    channel?.track({ ...(channel.stash?.here ?? {}), activity: "adding", material: row.id, title: file.name });
    const throttle = new ProgressThrottle();
    await this.upload(row.file_path, file, (sent, total) => {
      onLocalProgress(sent / total);
      if (throttle.shouldSend(sent / total, Date.now()))
        channel?.send({ type: "broadcast", event: "progress", payload: { material: row.id, sent, total } });
    });
    await this.rpc("material_ready", row.id);
    if (channel?.stash?.here) channel.track(channel.stash.here); else channel?.untrack();
    return row;
  }

  /** Storage upload with real progress (XMLHttpRequest reports it; supabase-js's upload doesn't). */
  async upload(path, file, onProgress) {
    const sb = await this.client();
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${this.url}/storage/v1/object/spaces/${path.split("/").map(encodeURIComponent).join("/")}`);
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.setRequestHeader("apikey", this.key);
      xhr.setRequestHeader("x-upsert", "false");
      if (file.type) xhr.setRequestHeader("Content-Type", file.type);
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded, e.total); };
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? (onProgress(file.size, file.size), resolve()) : reject(new Error(`upload ${xhr.status}`)));
      xhr.onerror = () => reject(new Error("offline"));
      xhr.send(file);
    });
  }

  async fileURL(path) {
    const { data, error } = await (await this.client()).storage.from("spaces").createSignedUrl(path, 600);
    if (error) throw error;
    return data.signedUrl;
  }

  /** University + 3+ letters of the name or the number → up to 8 cards, each with its own one-time find_token. */
  async findCourses(university, query, term = null) {
    return ((await this.rpc("find_courses", university, query, term, "web")) ?? []);
  }
  /** Course info (contacts, office hours, links) and the calendar: members read, owner/helpers write. */
  async courseInfo(space) {
    const sb = await this.client();
    const { data, error } = await sb.from("space_info").select("id,kind,role,name,email,hours,url,sort").eq("space_id", space).order("sort");
    if (error) throw error;
    return data;
  }
  async calendar(space) {
    const sb = await this.client();
    const { data, error } = await sb.from("space_events").select("id,kind,title,starts_at,ends_at,all_day,location,repeat_until,source")
      .eq("space_id", space).order("starts_at");
    if (error) throw error;
    return data;
  }
  saveInfo(space, e) { return this.rpc("set_info", space, e.id ?? null, e.kind, e.role ?? null, e.name ?? null, e.email ?? null, e.hours ?? null, e.url ?? null, e.sort ?? 0); }
  deleteInfo(id) { return this.rpc("delete_info", id); }
  saveEvent(space, e) { return this.rpc("save_event", space, e.id ?? null, e.kind, e.title, e.starts_at, e.ends_at ?? null, !!e.all_day, e.location ?? null, e.repeat_until ?? null); }
  deleteEvent(id) { return this.rpc("delete_event", id); }
  /** Import an .ics file's text (from a file, or fetched by the page itself): parsed here, only the kept fields are sent. */
  async importCalendar(space, icsText) {
    const { events, skipped } = ICSImport.parse(icsText);
    const saved = await this.rpc("import_events", space, events.filter(e => e.uid));
    return { saved, skipped: skipped + events.filter(e => !e.uid).length };
  }
  async pulse(space) { return (await this.rpc("space_pulse", space))?.[0] ?? null; }
  /** "Coming up": the adder (or a teacher) sets or clears a date. */
  setDue(material, dueAt, title = null) { return this.rpc("set_due", material, dueAt, title); }
  classCourses(space) { return this.rpc("class_courses", space); }
  /** Press a sticker: the counts change at once (StickerCounts.toggled); the server's answer is the truth. */
  sticker(material, id, on) { return this.rpc(on ? "react" : "unreact", material, id); }
  /** Quick Save / Save counts toward "Saved by N" (once per person; who saved is never readable). */
  noteSave(material) { return this.rpc("note_save", material); }
  moveToWeek(material, week) { return this.rpc("move_material", material, undefined, undefined, undefined, week); }
  titleWeek(space, week, title) { return this.rpc("set_week_title", space, week, title); }
  hide(space, person, hide = true) { return this.rpc("hide_person", space, person, hide); }
  inviteCode(space, renew = false) { return this.rpc("invite_code", space, renew).then(r => r?.[0] ?? null); }
  remove(material) { return this.rpc("delete_material", material); }
  report(material, reason) { return this.rpc("report_material", material, reason ?? null, false); }
  leave(space) { return this.rpc("leave_space", space, false); }
  /** Returns when you last looked before now (null the first time): "3 new since Tuesday". */
  seen(space, opened) { return this.rpc("mark_seen", space, !!opened); }
  link(code) { return this.rpc("claim_pair_code", code, "web"); }

  // ——— Profile (optional) ———
  /** Your name in one course (names are per course; "everywhere" is one call per course). */
  setMyName(space, name) { return this.rpc("set_my_name", space, name); }
  /** A code for your other device (10 minutes): typed there, that device becomes you. */
  async pairCode() { return await this.rpc("make_pair_code"); }
  /** After linking, this browser may be a different person: ask again. */
  async whoAmI() { this.me = await this.rpc("shared_register", "web", "web-1"); return this.me; }
  /** Colour and photo: null when the server doesn't have them yet (migration not applied). */
  async myLook() {
    const sb = await this.client();
    const { data, error } = await sb.from("people").select("look_color,look_photo").limit(1);
    if (error) return null;
    return { color: data?.[0]?.look_color ?? null, photo: data?.[0]?.look_photo ?? null };
  }
  setMyLook(color, photo) { return this.rpc("set_my_look", color ?? null, photo ?? null); }
  /** person id → {color, photo}; null when the server doesn't have looks yet. */
  async looks(space) {
    try { return new Map(((await this.rpc("space_looks", space)) ?? []).map(r => [r.person_id, { color: r.color, photo: r.photo }])); }
    catch (e) { if (e.code === "PGRST202" || e.code === "42883" || /Could not find the function/i.test(e.message)) return null; throw e; }
  }
}

async function sha256(file) {
  if (!crypto.subtle) return sha256Hex(new Uint8Array(await file.arrayBuffer()));   // plain-http LAN page
  const buf = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

// ——— Made-up class (no server) ———
export class PretendBackend {
  constructor(seed = {}) {
    this.space = { id: "pretend-alg", kind: "course", name: seed.name ?? "Algorithms", parent_id: null, course_code: "CS 2041",
                   term: "Spring 2027", term_starts: null, cover: 0, university_id: 1, findable: true, purged_seq: 0 };
    this.mine = new Map();
    this.rows = (seed.rows ?? []).map((r, i) => ({ seq: i + 1, ready: true, hidden: false, deleted_at: null, space_id: this.space.id, ...r }));
    this.cursor = 0; this.materials = new Map(); this.me = "me";
  }
  async signIn() { return this.me; }
  async preview() { return { status: "ok", name: this.space.name, kind: "course", people: 38, owner_name: "Maya", needs_approval: false, already_member: false }; }
  async join() { return { status: "joined", space_id: this.space.id }; }
  async mySpaces() { return [this.space]; }
  async catchUp() {
    const changes = this.rows.filter(r => r.seq > this.cursor);
    const result = CatchUp.merge(this.materials, this.cursor, changes, this.me);
    this.materials = result.materials; this.cursor = result.cursor;
    return result;
  }
  async watch(_space, onPoke) { const t = setInterval(onPoke, 15_000); return () => clearInterval(t); }
  /** The demo's classmates: add a row as if someone else shared it. */
  arrive(row) { this.rows.push({ seq: this.rows.length + 1, ready: true, hidden: false, deleted_at: null, space_id: this.space.id, ...row }); }
  async share(_space, draft) {
    const id = crypto.randomUUID();
    this.rows.push({ id, seq: this.rows.length + 1, ready: true, hidden: false, deleted_at: null, space_id: this.space.id,
                     added_by: this.me, created_at: new Date().toISOString(), ...draft });
    return { id, existed: false, duplicate_of: null };
  }
  async shareFile(space, file) { return this.share(space, { kind: file.type.startsWith("image/") ? "image" : "file", title: file.name, file_size: file.size }); }
  async fileURL() { return null; }
  async findCourses(_university, query) {
    const q = String(query ?? "").trim().toLowerCase();
    if (q.length < 3) return [{ status: "too_short" }];
    const hit = CourseCode.normalized(q) === CourseCode.normalized(this.space.course_code) || this.space.name.toLowerCase().includes(q);
    return hit ? [{ status: "ok", name: this.space.name, course_code: this.space.course_code, instructor: "Prof. Levi", term: this.space.term,
                    cover: this.space.cover, university: "Tel Aviv University", shelf: null, people: "10+", join_policy: "open",
                    needs_approval: false, already_member: false, find_token: "pretend-token" }] : [];
  }
  async setDue(material, dueAt, title) { const r = this.rows.find(x => x.id === material); if (r) { r.due_at = dueAt; r.due_title = title; } }
  async joinFound() { return { status: "joined", space_id: this.space.id }; }
  async people() { return [{ display_name: "Maya", role: "owner" }, { display_name: "Omer", role: "member" }]; }
  async weekTitles() { return new Map(); }
  async myStickers() { return new Map([...this.mine].map(([k, v]) => [k, [...v]])); }
  async sticker(material, id, on) {
    const row = this.rows.find(r => r.id === material); if (!row) return null;
    const mine = this.mine.get(material) ?? new Set();
    const had = mine.has(id);
    const counts = row.stickers ?? [0, 0, 0, 0];
    if (on && !had) { mine.add(id); counts[id - 1] += 1; }
    if (!on && had) { mine.delete(id); counts[id - 1] = Math.max(0, counts[id - 1] - 1); }
    this.mine.set(material, mine);
    row.stickers = counts; row.seq = Math.max(...this.rows.map(x => x.seq)) + 1;
    return counts;
  }
  async moveToWeek(material, week) { const r = this.rows.find(x => x.id === material); if (r) { r.week = week; r.seq = Math.max(...this.rows.map(x => x.seq)) + 1; } }
  async titleWeek() { return "set"; }
  async hide() {}
  async inviteCode() { return { code: "K7Q4MZ", open: true, expires_at: null }; }
  async classCourses() { return []; }
  async remove(id) {
    const r = this.rows.find(x => x.id === id);
    if (r) { r.deleted_at = new Date().toISOString(); r.seq = Math.max(...this.rows.map(x => x.seq)) + 1; }
  }
  async report() {}
  async leave() {}
  async seen() {}
  async link() { return "linked"; }
}

/** A photo goes up without its hidden details (GPS location, camera model, dates): re-drawn on a canvas, which keeps
 *  only the pixels, turned the right way up. A picture the browser can't draw is refused (GIFs go as they are). */
export const PHOTO_MAX_PIXELS = 4096;   // same as the Mac's SharedImages.maxPixels
export async function withoutPhotoDetails(file) {
  if (!file?.type?.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") return file;
  // Never the original photo: a browser that can't re-draw it, or a picture it can't read, is refused.
  const refuse = () => { throw Object.assign(new Error("This picture can’t be shared. Save it again as JPEG or PNG and try."), { code: "unreadable_picture" }); };
  if (typeof createImageBitmap !== "function" || typeof OffscreenCanvas !== "function") refuse();
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    // At most 4096 px on the long side (QA-47): iPhone Safari can't draw a 24 MP canvas, and uploads get much smaller.
    const scale = Math.min(1, PHOTO_MAX_PIXELS / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
    const canvas = new OffscreenCanvas(w, h);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const type = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await canvas.convertToBlob({ type, quality: 0.92 });
    const name = type === "image/jpeg" ? file.name.replace(/\.(heic|heif|webp|png|jpe?g)$/i, "") + ".jpg" : file.name;
    return new File([blob], name, { type, lastModified: file.lastModified });
  } catch { refuse(); }
}
