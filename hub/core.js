// The web hub's rules — the same as the Mac's StashCore/SharedCore.swift (and the Windows port), case for case, so a
// class behaves the same in a browser, on a Mac and on Windows. Pure functions, no network, no DOM.
// Tests: site/hub/test/core.test.mjs (node --test), mirroring Tests/StashCoreTests/SharedCoreTests.swift.

// ——— Plain-http pages (the Mac's LAN test server): browsers leave out crypto.randomUUID and crypto.subtle there ———
/** A random v4 UUID from getRandomValues, which every page has. */
export function uuid() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
if (typeof crypto !== "undefined" && !crypto.randomUUID) crypto.randomUUID = uuid;

/** SHA-256 of bytes as hex, without crypto.subtle (files ≤ 50 MB, so the bit length fits in 53 bits). */
export function sha256Hex(bytes) {
  const K = new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
  const H = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
  const l = bytes.length, padded = new Uint8Array(((l + 9 + 63) >> 6) << 6);
  padded.set(bytes); padded[l] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 4, (l * 8) >>> 0); dv.setUint32(padded.length - 8, Math.floor(l / 2 ** 29));
  const W = new Uint32Array(64), r = (x, n) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < padded.length; o += 64) {
    for (let i = 0; i < 16; i++) W[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) W[i] = (W[i-16] + (r(W[i-15],7) ^ r(W[i-15],18) ^ (W[i-15] >>> 3)) + W[i-7] + (r(W[i-2],17) ^ r(W[i-2],19) ^ (W[i-2] >>> 10))) >>> 0;
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (r(e,6) ^ r(e,11) ^ r(e,25)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) >>> 0;
      const t2 = ((r(a,2) ^ r(a,13) ^ r(a,22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  }
  return [...H].map(x => x.toString(16).padStart(8, "0")).join("");
}

// ——— Limits (same numbers as backend/supabase/shared.sql) ———
export const Limits = Object.freeze({
  maxMembers: 200,
  quotaBytes: 2 * 1024 * 1024 * 1024,
  maxFileBytes: 50 * 1024 * 1024,
  autoDownloadBytes: 25 * 1024 * 1024,
  maxTextLength: 100_000,
  maxNameLength: 40,
  classCodeLifetimeDays: 14,
  minimumAge: 16,
});

// ——— Invite codes: six letters/digits without look-alikes, typed any way ———
export const InviteCode = Object.freeze({
  alphabet: "ABCDEFGHJKLMNPQRSTUVWXYZ23456789",
  length: 6,
  normalize(typed) {
    const kept = String(typed ?? "").toUpperCase().replace(/[\s\-‐‑‒–—._]/g, "");
    if (kept.length !== this.length) return null;
    for (const ch of kept) if (!this.alphabet.includes(ch)) return null;
    return kept;
  },
  display(code) {
    const c = this.normalize(code);
    return c ? `${c.slice(0, 3)}‑${c.slice(3)}` : code;
  },
});

// ——— Links ———
export const SharedLink = Object.freeze({
  webBase: "https://ymichelson.github.io/stash-releases/j/",
  inviteHosts: new Set(["ymichelson.github.io"]),
  pathPrefix: "/stash-releases/j",
  webURL(code) { const c = InviteCode.normalize(code); return c ? this.webBase + "?c=" + c : null; }, // a real page; …/j/CODE works through Pages' 404 page
  appURL(code) { const c = InviteCode.normalize(code); return c ? "stash://join?code=" + c : null; },
  /** The code in an invite link (web …/j/CODE, …/j/#CODE, …/j/?c=CODE, or stash://join?code=CODE), else null. */
  codeIn(link) {
    const t = String(link ?? "").trim();
    if (t.length > 300) return null;
    let u;
    try { u = new URL(t); } catch { return null; }
    if (u.protocol === "stash:") {
      if ((u.hostname || u.pathname.replace(/^\/+/, "")).toLowerCase() !== "join") return null;
      return InviteCode.normalize(u.searchParams.get("code"));
    }
    if (u.protocol !== "https:" || !this.inviteHosts.has(u.hostname.toLowerCase()) || !u.pathname.startsWith(this.pathPrefix)) return null;
    const tail = u.pathname.slice(this.pathPrefix.length).replace(/^\/+|\/+$/g, "");
    if (tail) return tail.includes("/") ? null : InviteCode.normalize(tail);
    if (u.hash) { const c = InviteCode.normalize(u.hash.slice(1)); if (c) return c; }
    return InviteCode.normalize(u.searchParams.get("c"));
  },
});

// ——— Names ———
// Invisible and direction-changing characters (look-alike names such as "\u202EnahtanoJ"), removed exactly like the
// server's clean_text and SharedDisplayName.isInvisible.
const INVISIBLE = /[\u0001-\u001F\u007F-\u009F\u00AD\u061C\u115F\u1160\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2069\u3164\uFEFF\uFFA0]/g;
export const DisplayName = Object.freeze({
  clean(typed) {
    const t = String(typed ?? "").replace(INVISIBLE, "").trim().split(/\s+/).filter(Boolean).join(" ");
    if (!t || [...t].length > Limits.maxNameLength) return null;
    return t;
  },
});

// ——— What may be shared (the browser never sees the clipboard; this guards what people type or paste) ———
const secretPatterns = [
  /\bsk-[A-Za-z0-9_-]{20,}/, /\bsk-ant-[A-Za-z0-9_-]{20,}/, /\bAKIA[0-9A-Z]{16}\b/, /\bghp_[A-Za-z0-9]{36}\b/,
  /\bxox[abpr]-[A-Za-z0-9-]{10,}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /\b(?:password|passwd|pwd)\s*[:=]\s*\S+/i,
];
const looksSecret = t => secretPatterns.some(p => p.test(String(t ?? "")));
export const SharePlan = Object.freeze({
  /** "secret" | "tooLong" | "empty" | null (fine). */
  refusalForText(text) {
    const t = String(text ?? "");
    if (!t.trim()) return "empty";
    if (t.length > Limits.maxTextLength) return "tooLong";
    if (secretPatterns.some(p => p.test(t))) return "secret";
    return null;
  },
  refusalForFile(size) {
    if (!(size > 0)) return "missingFile";
    return size > Limits.maxFileBytes ? "tooBig" : null;
  },
  isWebLink(url) {
    try { const u = new URL(String(url).trim()); return (u.protocol === "https:" || u.protocol === "http:") && String(url).length <= 2000; }
    catch { return false; }
  },
  messages: {
    secret: "Passwords and keys are never shared.", tooLong: "This text is too long to share (100,000 characters at most).",
    tooBig: "Files up to 50 MB can be shared.", empty: "There’s nothing to share.", missingFile: "The file isn’t there anymore.",
  },
});

// ——— Catching up by the space's change number (seq), never by clocks ———
export const CatchUp = Object.freeze({
  needsReload(cursor, purgedSeq) { return cursor > 0 && cursor < purgedSeq; },
  isVisible(m) { return m.ready && !m.hidden && !m.deleted_at; },
  /** Applies a page of rows (any order, duplicates OK). me = this person. Returns { materials, cursor, arrivals, removed }. */
  merge(current, cursor, changes, me) {
    const materials = new Map(current);
    const arrivals = [], removed = [];
    let next = cursor;
    for (const row of [...changes].sort((a, b) => a.seq - b.seq)) {
      next = Math.max(next, row.seq);
      const old = materials.get(row.id);
      if (old && old.seq > row.seq) continue;
      const wasVisible = old ? this.isVisible(old) : false;
      if (row.deleted_at || (row.hidden && row.added_by !== me)) {
        if (old) { materials.delete(row.id); removed.push(row.id); }
        continue;
      }
      materials.set(row.id, row);
      if (!wasVisible && this.isVisible(row) && row.added_by !== me) arrivals.push(row);
    }
    return { materials, cursor: next, arrivals, removed };
  },
});

// ——— The send queue (IndexedDB in the page keeps it; a retry never duplicates: client ids) ———
export class Outbox {
  constructor(items = []) { this.items = items.map(i => ({ ...i })); }
  static backoff(attempt) { return [5, 30, 120, 600][attempt - 1] ?? 3600; }
  static permanent = new Set(["notMember", "spaceDeleted", "onlyTeachers", "spaceFull", "tooBig", "refused"]);
  enqueue(draft, space, course, now, clientId = crypto.randomUUID()) {
    if (this.items.some(i => i.clientId === clientId)) return clientId;
    this.items.push({ clientId, space, course, draft, queuedAt: now, state: "waiting", attempts: 0, nextTry: now, failure: null, materialId: null });
    return clientId;
  }
  due(now) { return this.items.filter(i => i.state === "waiting" && i.nextTry <= now).sort((a, b) => a.queuedAt - b.queuedAt); }
  #find(id) { return this.items.find(i => i.clientId === id); }
  markSending(id) { const i = this.#find(id); if (i && i.state === "waiting") i.state = "sending"; }
  markSent(id, materialId) { const i = this.#find(id); if (i) Object.assign(i, { state: "sent", materialId, failure: null }); }
  markFailed(id, failure, now) {
    const i = this.#find(id);
    if (!i || i.state === "cancelled") return;
    i.attempts += 1; i.failure = failure;
    if (Outbox.permanent.has(failure)) i.state = "failed";
    else { i.state = "waiting"; i.nextTry = now + Outbox.backoff(i.attempts) * 1000; }
  }
  /** Undo: true when it never reached the server. */
  cancel(id) {
    const i = this.#find(id);
    if (!i) return false;
    if (i.state === "waiting" || i.state === "failed") { i.state = "cancelled"; return true; }
    return false;
  }
  retryNow(now) { for (const i of this.items) if (i.state === "waiting") i.nextTry = now; }
  recoverAfterLaunch(now) { for (const i of this.items) if (i.state === "sending") { i.state = "waiting"; i.nextTry = now; } }
  prune(now) {
    const day = 86_400_000;
    this.items = this.items.filter(i =>
      (i.state === "sent" || i.state === "cancelled") ? now - i.queuedAt <= day
      : i.state === "failed" ? now - i.queuedAt <= 7 * day : true);
  }
  get waitingCount() { return this.items.filter(i => i.state === "waiting" || i.state === "sending").length; }
}

// ——— Arrival notes ———
export function arrivalNotice(arrivals, spaces, quiet = false) {
  if (quiet) return null;
  const wanted = arrivals.filter(m => {
    const s = spaces.get(m.space_id);
    if (!s || s.notify === "off") return false;
    if (s.notify === "teachers") return ["owner", "helper"].includes(s.people.get(m.added_by)?.role);
    return true;
  });
  if (!wanted.length) return null;
  const first = wanted[0], space = spaces.get(first.space_id), ids = new Set(wanted.map(m => m.space_id));
  const title = first.title || (first.body ? first.body.slice(0, 80) : "Untitled");
  if (wanted.length === 1) {
    return { headline: `${space.people.get(first.added_by)?.name ?? "Someone"} added ${title}`,
             detail: space.courses?.get(first.course_id) ?? space.name, materialId: first.id, spaceId: space.id, count: 1 };
  }
  if (ids.size === 1) return { headline: `${wanted.length} new in ${space.name}`, detail: null, materialId: null, spaceId: space.id, count: wanted.length };
  return { headline: `${wanted.length} new in ${ids.size} courses`, detail: null, materialId: null, spaceId: null, count: wanted.length };
}

// ——— Courses (CourseCode, CourseWeek, CourseBuckets, CourseSearch, CourseCard, CourseCover in SharedCore) ———
export const CourseCode = Object.freeze({
  maxLength: 20,
  /** Matched like the server's norm_code: "cs-2041" = "CS 2041" = "CS2041". */
  normalized(code) { return String(code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, ""); },
});

export const CourseWeek = Object.freeze({
  last: 30,
  /** Week 1 starts on the term start; 0 = before term; at most 30; null without a term start. Dates are "YYYY-MM-DD"
   *  or Date (local day). */
  number(day, termStarts) {
    if (!termStarts) return null;
    const d = n => { const x = typeof n === "string" ? new Date(n + "T12:00:00") : new Date(n); return Date.UTC(x.getFullYear(), x.getMonth(), x.getDate()); };
    const days = Math.round((d(day) - d(termStarts)) / 86_400_000);
    return Math.min(this.last, Math.max(0, Math.floor(days / 7) + 1));
  },
  label(week) { return week === 0 ? "Before term" : `Week ${week}`; },
});

export const CourseBuckets = Object.freeze({
  people(n) { return n < 10 ? "under 10" : n < 50 ? "10+" : n < 200 ? "50+" : "200"; },
  peopleWords(bucket) { return bucket === "under 10" ? "fewer than 10 students" : `${bucket} students`; },
  things(n) { return n <= 0 ? "0" : n < 10 ? "1+" : n < 20 ? "10+" : n < 40 ? "20+" : "40+"; },
});

export const CourseSearch = Object.freeze({
  minimumLetters: 3, maxResults: 8, perHour: 30, perDay: 100, tokenMinutes: 10,
  canSearch(university, query) { return university != null && university !== "" && String(query ?? "").trim().length >= 3; },
});

export const CourseCover = Object.freeze({
  names: ["cover-01-ribbon", "cover-02-torn-edge", "cover-03-sheet-stack", "cover-04-folded-corner", "cover-05-bookmark",
          "cover-06-binder-edge", "cover-07-ink-loop", "cover-08-grid-corner", "cover-09-ruled-strip", "cover-10-stamp-circle"],
  name(cover) { return this.names[Math.min(Math.max(cover ?? 0, 0), this.names.length - 1)]; },
  /** "code · term · university", skipping what's missing. */
  detail(code, term, university) { return [code, term, university].map(x => String(x ?? "").trim()).filter(Boolean).join(" · "); },
});

/** A find_courses card: "CS 2041 · Prof. Levi" and "Spring 2027 · 10+ students", and what its button says. */
const joinDots = parts => parts.map(x => String(x ?? "").trim()).filter(Boolean).join(" · ");
export function courseCardLines(card) {
  return { number: joinDots([card.course_code, card.instructor]), term: joinDots([card.term, CourseBuckets.peopleWords(card.people)]) };
}
export function courseCardAction(card) {
  if (card.already_member) return "Open";
  if (card.join_policy === "code") return "Join with Code";
  return card.join_policy === "request" || card.needs_approval ? "Ask to Join" : "Join";
}

/** "Coming up": the next dated things, soonest first (SharedComingUp). */
export function comingUp(materials, now = new Date(), limit = 2) {
  return materials.filter(m => m.due_at && new Date(m.due_at) >= now && !m.deleted_at && m.ready !== false && !m.hidden)
    .sort((a, b) => new Date(a.due_at) - new Date(b.due_at)).slice(0, limit);
}

// ——— Stickers: counts for everyone, your own for you, never who (SharedSticker / StickerCounts) ———
export const STICKERS = Object.freeze([
  { id: 1, word: "Thanks", art: "sticker-01-thumbs-up" }, { id: 2, word: "Got it", art: "sticker-02-check" },
  { id: 3, word: "Same question", art: "sticker-04-question" }, { id: 4, word: "Helpful", art: "sticker-06-light-bulb" }]);

export class StickerCounts {
  constructor(counts = [0, 0, 0, 0], mine = []) {
    this.counts = Array.isArray(counts) && counts.length === 4 ? counts.map(n => Math.max(0, n | 0)) : [0, 0, 0, 0];
    this.mine = new Set(mine);
  }
  get total() { return this.counts.reduce((a, b) => a + b, 0); }
  count(id) { return this.counts[id - 1]; }
  /** Up to two for the sheet's label: the most used first (ties in the tray's order). */
  get shown() { return [1, 2, 3, 4].filter(id => this.count(id) > 0).sort((a, b) => this.count(b) - this.count(a)).slice(0, 2); }
  /** Press: on if off, off if on — at once; the server's answer (react/unreact return the counts) replaces it. */
  toggled(id) {
    const next = new StickerCounts(this.counts, this.mine);
    if (next.mine.has(id)) { next.mine.delete(id); next.counts[id - 1] = Math.max(0, next.counts[id - 1] - 1); }
    else { next.mine.add(id); next.counts[id - 1] += 1; }
    return next;
  }
}

// ——— New since your last visit (SharedNewSince) ———
export const NewSince = Object.freeze({
  isNew(m, since, me) {
    if (!since) return false;
    return new Date(m.created_at) > new Date(since) && m.added_by !== me && m.ready !== false && !m.hidden && !m.deleted_at;
  },
  count(materials, since, me) { return materials.filter(m => this.isNew(m, since, me)).length; },
  when(since, now = new Date(), locale = "en") {
    const day = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const s = new Date(since), days = Math.round((day(now) - day(s)) / 86_400_000);
    if (days <= 0) return "earlier today";
    if (days === 1) return "yesterday";
    return days < 7 ? s.toLocaleDateString(locale, { weekday: "long" }) : s.toLocaleDateString(locale, { month: "short", day: "numeric" });
  },
});

export function findMessage(status) {
  return ({ none: "No course with that code at your university. Check the code, or ask someone in it for the link.",
            too_many_tries: "Too many tries. Wait a little and try again." })[status] ?? "Something went wrong. Try again.";
}

// ——— Join answers, in people's words ———
export function joinMessage(status, name) {
  const it = name ? `“${name}”` : "this class";
  const It = it[0].toUpperCase() + it.slice(1);
  return ({
    ok: `Ready to join ${it}.`, joined: `You’re in ${it}.`, already: `You’re already in ${it}.`,
    requested: `Asked to join ${it}. You’ll be let in when a teacher says yes.`,
    invalid: "That code doesn’t match a class. Check the letters and try again.",
    expired: "This invite has expired. Ask for a new link or code.", closed: "This invite was turned off. Ask for a new link or code.",
    full: `${It} is full.`, blocked: `You can’t join ${it}.`, name_taken: `Someone in ${it} already uses that name. Try another.`,
    too_many_tries: "Too many tries. Wait a few minutes and try again.",
    needs_code: `${It} is joined with its code. Ask someone in it for the link.`, gone: `${It} can’t be found anymore.`,
  })[status] ?? "Something went wrong. Try again.";
}

// ——— Live: others' uploads in progress, and the uploader's throttle (SharedLiveUploads / SharedProgressThrottle) ———
export class LiveUploads {
  static staleAfter = 120_000;
  static graceForNew = 60_000;
  constructor() { this.progress = new Map(); }
  ingest(material, fraction, now) {
    const f = Math.min(Math.max(fraction, 0), 1), old = this.progress.get(material);
    if (old && old.fraction > f) { old.updatedAt = now; return; }
    this.progress.set(material, { fraction: f, updatedAt: now });
  }
  finish(material) { this.progress.delete(material); }
  /** Others' rows still uploading, newest first: [{ material, fraction|null }]. */
  inProgress(rows, me, now) {
    return rows.filter(m => !m.ready && !m.hidden && !m.deleted_at && m.added_by !== me && m.file_path)
      .map(m => {
        const p = this.progress.get(m.id);
        if (p) return now - p.updatedAt <= LiveUploads.staleAfter ? { material: m, fraction: p.fraction } : null;
        return now - Date.parse(m.created_at) <= LiveUploads.graceForNew ? { material: m, fraction: null } : null;
      })
      .filter(Boolean)
      .sort((a, b) => Date.parse(b.material.created_at) - Date.parse(a.material.created_at));
  }
}

export class ProgressThrottle {
  constructor() { this.last = null; }
  shouldSend(fraction, now) {
    if (!this.last) { this.last = { fraction, now }; return true; }
    if (fraction >= 1 && this.last.fraction < 1) { this.last = { fraction, now }; return true; }
    if (now - this.last.now < 1000 || fraction - this.last.fraction < 0.02) return false;
    this.last = { fraction, now };
    return true;
  }
}

// ——— Course info and calendar (SharedCalendar.swift; shared.sql space_info / space_events / import_events) ———
export const CourseInfoRules = Object.freeze({
  maxEntries: 40,
  isEmail(s) { const t = String(s ?? "").trim(); return t.length <= 120 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t); },
  isLink(s) { const t = String(s ?? "").trim(); if (!t.startsWith("https://") || t.length > 2000) return false; try { return !!new URL(t).host; } catch { return false; } },
  problem(e) {
    if (e.kind === "person") {
      const n = String(e.name ?? "").trim();
      if (!n) return "Add a name.";
      if ([...n].length > 80) return "That name is too long.";
      if (e.email && !this.isEmail(e.email)) return "That doesn’t look like an email address.";
      if ([...String(e.hours ?? "")].length > 120) return "Office hours are too long.";
      return null;
    }
    return this.isLink(e.url) ? null : "Links start with https://";
  },
});

export const CourseEvents = Object.freeze({
  maxPerCourse: 500,
  guessKind(title) {
    const t = String(title ?? "").toLowerCase(), has = w => w.some(x => t.includes(x));
    if (has(["exam", "midterm", "final", "quiz", "test", "מבחן", "בוחן", "מועד"])) return "exam";
    if (has(["due", "deadline", "submission", "submit", "homework", "assignment", "הגשה", "הגשת", "להגיש", "תרגיל בית", "שיעורי בית", "מטלה"])) return "deadline";
    if (has(["tutorial", "recitation", "lab", "section", "תרגול", "מעבדה"])) return "tutorial";
    if (has(["lecture", "class", "הרצאה", "שיעור"])) return "lecture";
    return "other";
  },
  /** Every time an event happens between two dates (weekly slots repeat until repeat_until). */
  occurrences(e, from, to) {
    const start = new Date(e.starts_at);
    if (!e.repeat_until) return start >= from && start <= to ? [start] : [];
    const last = new Date(String(e.repeat_until).slice(0, 10) + "T23:59:59");
    const out = []; let d = start, n = 0;
    while (d <= (to < last ? to : last) && n < 200) { if (d >= from) out.push(d); d = new Date(d.getTime()); d.setDate(d.getDate() + 7); n++; }
    return out;
  },
  /** What's on now: start ≤ now < end (an hour without an end), never all-day; a lesson beats office hours. */
  now(events, at = new Date()) {
    at = new Date(at);
    const lesson = k => ["lecture", "tutorial", "exam"].includes(k);
    let best = null;
    for (const e of events) {
      if (e.all_day) continue;
      const start = new Date(e.starts_at), length = Math.max(60_000, e.ends_at ? new Date(e.ends_at) - start : 3_600_000);
      const s = this.occurrences(e, new Date(at.getTime() - length), at).at(-1);
      if (!s || !(s <= at && at < s.getTime() + length)) continue;
      const found = { event: e, startsAt: s, endsAt: new Date(s.getTime() + length) };
      if (!best || (lesson(e.kind) !== lesson(best.event.kind) ? lesson(e.kind) : s > best.startsAt)) best = found;
    }
    return best;
  },
  upcoming(events, now = new Date(), days = 14, limit = 5) {
    const to = new Date(now.getTime() + days * 86_400_000);
    return events.flatMap(e => this.occurrences(e, now, to).map(at => ({ event: e, at }))).sort((a, b) => a.at - b.at).slice(0, limit);
  },
});

/** The UTC moment for a wall-clock time in a time zone (no library: Intl tells the zone's offset). */
function zonedToUTC(y, mo, d, h, mi, s, tz) {
  let t = Date.UTC(y, mo - 1, d, h, mi, s);
  for (let i = 0; i < 2; i++) {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit",
      day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(t)).map(x => [x.type, x.value]));
    const shown = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
    t += Date.UTC(y, mo - 1, d, h, mi, s) - shown;
  }
  return new Date(t);
}

/** An .ics calendar file read on the device: VEVENTs only, title + times + location + UID + a weekly repeat. Never
 *  descriptions, attendees or organizers; titles that look like a secret are left out. */
export const ICSImport = Object.freeze({
  parse(text, defaultZone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
    const lines = [];
    for (const raw of String(text ?? "").replace(/\r\n?/g, "\n").split("\n")) {
      if ((raw.startsWith(" ") || raw.startsWith("\t")) && lines.length) lines[lines.length - 1] += raw.slice(1); else lines.push(raw);
    }
    const events = []; let skipped = 0, cur = null;
    for (const line of lines) {
      if (line === "BEGIN:VEVENT") { cur = {}; continue; }
      if (line === "END:VEVENT") {
        const e = cur && this.event(cur, defaultZone);
        if (e && events.length < CourseEvents.maxPerCourse) events.push(e); else if (cur) skipped++;
        cur = null; continue;
      }
      const c = line.indexOf(":"); if (!cur || c < 0) continue;
      const [name, ...ps] = line.slice(0, c).split(";"); const params = {};
      for (const p of ps) { const i = p.indexOf("="); if (i > 0) params[p.slice(0, i).toUpperCase()] = p.slice(i + 1); }
      if (!cur[name.toUpperCase()]) cur[name.toUpperCase()] = { params, value: line.slice(c + 1) };
    }
    return { events, skipped };
  },
  event(p, zone) {
    const title = p.SUMMARY ? this.unescape(p.SUMMARY.value).trim() : "";
    const start = p.DTSTART && this.date(p.DTSTART.value, p.DTSTART.params, zone);
    if (!title || !start || looksSecret(title)) return null;
    let end = p.DTEND ? this.date(p.DTEND.value, p.DTEND.params, zone)?.at : null;
    if (!end && p.DURATION) { const s = this.duration(p.DURATION.value); if (s) end = new Date(start.at.getTime() + s * 1000); }
    let location = p.LOCATION ? this.unescape(p.LOCATION.value).trim() : null;
    if (!location || looksSecret(location)) location = null;
    const uid = p.UID?.value.trim() || null;
    return { kind: CourseEvents.guessKind(title), title: [...title].slice(0, 120).join(""), starts_at: start.at.toISOString(),
             ends_at: end && end >= start.at ? end.toISOString() : null, all_day: start.allDay,
             location: location ? [...location].slice(0, 120).join("") : null,
             repeat_until: p.RRULE ? this.weeklyUntil(p.RRULE.value, start.at, zone) : null, uid: uid ? uid.slice(0, 300) : null };
  },
  date(v, params = {}, zone) {
    const d = String(v).trim().replace(/[^0-9TZ]/g, "");
    if ((params.VALUE || "").toUpperCase() === "DATE" || /^\d{8}$/.test(d)) {
      return { at: zonedToUTC(+d.slice(0, 4), +d.slice(4, 6), +d.slice(6, 8), 0, 0, 0, zone), allDay: true };
    }
    const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(d); if (!m) return null;
    const [, y, mo, dd, h, mi, s, z] = m.map((x, i) => (i > 0 && i < 7 ? +x : x));
    if (z === "Z") return { at: new Date(Date.UTC(y, mo - 1, dd, h, mi, s)), allDay: false };
    return { at: zonedToUTC(y, mo, dd, h, mi, s, (params.TZID || zone).replace(/"/g, "")), allDay: false };
  },
  duration(s) {
    const m = /^\+?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(String(s).trim()); if (!m) return null;
    const total = (+m[1] || 0) * 604800 + (+m[2] || 0) * 86400 + (+m[3] || 0) * 3600 + (+m[4] || 0) * 60 + (+m[5] || 0);
    return total || null;
  },
  weeklyUntil(rule, start, zone) {
    const p = Object.fromEntries(rule.split(";").map(x => x.split("=")).filter(x => x.length === 2).map(([k, v]) => [k.toUpperCase(), v]));
    if ((p.FREQ || "").toUpperCase() !== "WEEKLY" || (p.INTERVAL || "1") !== "1") return null;
    if (p.UNTIL) { const d = this.date(p.UNTIL, {}, zone); return d ? d.at.toISOString().slice(0, 10) : null; }
    if (+p.COUNT > 1) return new Date(start.getTime() + 7 * (p.COUNT - 1) * 86_400_000).toISOString().slice(0, 10);
    return null;
  },
  unescape(s) { return s.replace(/\\[nN]/g, " ").replace(/\\,/g, ",").replace(/\;/g, ";").replace(/\\\\/g, "\\"); },
});

/** The panel's mini view (CoursePulse.ordered): busiest first. */
export function orderPulse(list) {
  return [...list].sort((a, b) => ((b.uploading > 0) - (a.uploading > 0)) || (b.new_count - a.new_count)
    || (new Date(b.last_added_at ?? 0) - new Date(a.last_added_at ?? 0)));
}

/** "a few" below 3, so it never says exactly one or two people are here. The server's here_now is null for 1–2. */
export const hereWords = n => (n == null ? "a few" : n <= 0 ? "0" : n < 3 ? "a few" : String(n));

// ——— The smarter hub (SharedSmart.swift), all on the device ———

const hasWord = (t, w) => new RegExp("(?:^|[^\\p{L}])" + w.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&") + "(?:[^\\p{L}]|$)", "u").test(t);
const stripExt = name => String(name ?? "").replace(/\.[A-Za-z0-9]{1,5}$/, "");

export const SmartNames = Object.freeze({
  /** "Lecture 5.pdf" → {kind: "lecture", number: 5} · "HW4" → homework 4 · "סיכום" → summary. */
  parse(name) {
    const t = " " + stripExt(name).toLowerCase().replace(/[_-]/g, " ") + " ";
    const pat = w => "(?:^|[^\\p{L}])" + (/^[\u05D0-\u05EA]/.test(w) ? "[והבלמשכ]{0,2}" : "") + w.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    // The first numbered lesson in the name wins; at the same place the longer word wins.
    const numbered = [["tutorial", ["tutorial", "tut", "recitation", "rec", "exercise class", "lab", "תרגול", "מעבדה"]],
                      ["lecture", ["lecture", "lec", "הרצאה", "שיעור"]],
                      ["homework", ["homework", "hw", "assignment", "exercise", "ex", "problem set", "pset", "ps", "תרגיל", "מטלה", 'ש"ב', "שיעורי בית"]],
                      ["exam", ["exam", "quiz", "midterm", "מבחן", "בוחן"]]];
    let best = null;
    for (const [kind, words] of numbered) for (const w of words) {
      const m = new RegExp(pat(w) + "\\s*[#.]?\\s*0*(\\d{1,2})(?!\\d)", "u").exec(t);
      if (m && (!best || m.index < best.at || (m.index === best.at && w.length > best.length))) best = { at: m.index, length: w.length, kind, n: +m[1] };
    }
    if (best) return { kind: best.kind, number: best.n };
    const has = words => words.some(w => new RegExp(pat(w) + "(?:[^\\p{L}]|$)", "u").test(t));
    // "final" alone is usually "final version": only "final exam" (and "finals") count as an exam.
    if (has(["exam", "midterm", "final exam", "finals", "quiz", "moed", "מבחן", "בוחן", "מועד"])) return { kind: "exam", number: null };
    if (has(["tutorial", "recitation", "תרגול"])) return { kind: "tutorial", number: null };
    if (has(["lecture", "slides", "הרצאה", "מצגת"])) return { kind: "lecture", number: null };
    if (has(["homework", "assignment", "exercise", "hw", "תרגיל", "מטלה"])) return { kind: "homework", number: null };
    if (has(["summary", "notes", "cheat sheet", "formula sheet", "סיכום", "דף נוסחאות"])) return { kind: "summary", number: null };
    return { kind: null, number: null };
  },
  /** Solutions and answer sheets never get a "Due" chip. */
  isSolution(name) {
    const t = " " + stripExt(name).toLowerCase().replace(/[_-]/g, " ") + " ";
    return ["solution", "solutions", "answers", "answer key", "sol", "פתרון", "פתרונות", "תשובות"].some(w =>
      new RegExp("(?:^|[^\\p{L}])" + (/^[\u05D0-\u05EA]/.test(w) ? "[והבלמשכ]{0,2}" : "") + w + "(?:[^\\p{L}]|$)", "u").test(t));
  },
  // Only what a camera, a phone, a screenshot tool or a scanner names things — never a title someone typed.
  generic: [/^IMG[_-]?\d+/i, /^PXL_\d{8}/i, /^DSC[_N]?\d+/i, /^DCIM/i, /^Photo[ _-]?\d/i, /^image\d*$/i, /^Screen ?shot/i, /^Screenshot/i,
            /^צילום מסך/, /^WhatsApp (Image|Video|Document)/i, /^IMG-\d{8}-WA/i, /^Scan[ _-]?\d*/i, /^CamScanner/i, /^\d{8}[_ ]\d{6}/],
  isGeneric(name) { const t = stripExt(name).trim(); return !t || this.generic.some(r => r.test(t)); },   // ".pdf" alone too (QA-43)
  tidy(name) {
    let t = stripExt(name).replace(/_/g, " ").replace(/(?<=\p{L})-(?=\p{L})/gu, " ").replace(/\s+/g, " ").trim();
    return t || String(name ?? "");
  },
  tidyTitle(s) {
    let t = String(s ?? "").trim();
    for (const p of ["Microsoft Word - ", "Microsoft PowerPoint - ", "PowerPoint Presentation", "Microsoft Word "]) if (t.startsWith(p)) t = t.slice(p.length);
    return t.replace(/\.(docx?|pptx?|pdf|tex)$/i, "").replace(/\s+/g, " ").trim();
  },
  usable(t) {
    const n = [...t].length;
    return n >= 3 && n <= 120 && !this.isGeneric(t) && /\p{L}/u.test(t) && !["untitled", "slide 1", "title", "presentation", "ללא שם"].includes(t.toLowerCase());
  },
  /** {name} for a real or PDF title; {parts: {kind, event, at}} for "Board · Lecture 5 · Tue 14:10". */
  title({ fileName, isImage, pdfTitle = null, firstHeading = null, at, eventDuring = null }) {
    if (!this.isGeneric(fileName)) return { name: this.tidy(fileName) };
    for (const c of [pdfTitle, firstHeading]) { if (c != null) { const t = this.tidyTitle(c); if (this.usable(t)) return { name: t }; } }
    const lower = String(fileName).toLowerCase();
    const kind = lower.includes("screen") || lower.includes("צילום מסך") ? "screenshot" : lower.includes("scan") ? "scan"
      : isImage ? (eventDuring ? "board" : "photo") : "document";
    return { parts: { kind, event: eventDuring, at } };
  },
  english(p, timeZone) {
    const word = { board: "Board photo", photo: "Photo", screenshot: "Screenshot", scan: "Scan", document: "Document" }[p.kind] ?? "Photo";
    const f = new Intl.DateTimeFormat("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone });
    const parts = Object.fromEntries(f.formatToParts(new Date(p.at)).map(x => [x.type, x.value]));
    return [word, p.event, `${parts.weekday} ${parts.hour}:${parts.minute}`].filter(Boolean).join(" · ");
  },
});

const KIND_WORD = { lecture: "Lecture", tutorial: "Tutorial", homework: "Homework", exam: "Exam", summary: "Summary" };

/** Where a new upload belongs (SmartFiling): {week, kind, number, reason: "name"|"calendar"|"date", label}. */
export const SmartFiling = Object.freeze({
  guess(name, at, termStarts, events) {
    at = new Date(at);
    const parsed = SmartNames.parse(name);
    const uploadWeek = CourseWeek.number(at, termStarts);
    const out = (week, kind, number, reason) => ({ week, kind, number, reason, label: kind ? (number != null ? `${KIND_WORD[kind]} ${number}` : KIND_WORD[kind]) : null });
    const now = this.happening(at, events, termStarts);   // during a lecture or tutorial the slot wins
    if (now) return out(uploadWeek, now.event.kind, now.number, "calendar");
    if (parsed.kind && parsed.number != null && (parsed.kind === "lecture" || parsed.kind === "tutorial") && termStarts) {
      const starts = new Date(typeof termStarts === "string" ? termStarts + "T00:00:00" : termStarts);
      const times = events.filter(e => e.kind === parsed.kind && e.repeat_until)
        .flatMap(e => CourseEvents.occurrences(e, starts, new Date(8.64e15))).sort((a, b) => a - b);
      const n = parsed.number;
      if (n >= 1 && n <= times.length) {
        let week = CourseWeek.number(times[n - 1], termStarts);
        if (week != null && uploadWeek != null && week > uploadWeek) week = uploadWeek;
        return out(week, parsed.kind, n, "name");
      }
      if (uploadWeek != null) return out(Math.min(n, uploadWeek), parsed.kind, n, "name");
    }
    return out(uploadWeek, parsed.kind, parsed.number, parsed.kind ? "name" : "date");
  },
  /** The lesson going on (10 min before to 30 min after), and which one it is. */
  happening(at, events, termStarts) {
    at = new Date(at);
    for (const e of events) {
      if (e.kind !== "lecture" && e.kind !== "tutorial") continue;
      const length = e.ends_at ? new Date(e.ends_at) - new Date(e.starts_at) : 7_200_000;
      const from = termStarts ? new Date(typeof termStarts === "string" ? termStarts + "T00:00:00" : termStarts) : new Date(e.starts_at);
      const times = CourseEvents.occurrences(e, from, new Date(at.getTime() + 600_000));
      const i = times.findLastIndex(t => at >= t.getTime() - 600_000 && at <= t.getTime() + length + 1_800_000);
      if (i >= 0) {
        const all = events.filter(x => x.kind === e.kind).flatMap(x => CourseEvents.occurrences(x, from, times[i]));
        return { event: e, number: Math.max(1, all.length) };
      }
    }
    return null;
  },
});

const linkKey = s => {
  try {
    const u = new URL(String(s).trim());
    for (const k of [...u.searchParams.keys()]) if (k.toLowerCase().startsWith("utm_") || ["fbclid", "gclid", "si"].includes(k.toLowerCase())) u.searchParams.delete(k);
    const q = u.searchParams.toString();
    return u.hostname.toLowerCase().replace(/^www\./, "") + u.pathname.replace(/\/+$/, "") + (q ? "?" + q : "");
  } catch { return String(s).toLowerCase(); }
};
const titleOf = m => m.title || (m.body ? String(m.body).slice(0, 80) : "") || m.url || (m.file_path ? m.file_path.split("/").pop() : "") || "Untitled";

/** The same thing twice shows once (SharedDuplicates): {shown, alsoAdded: Map(id → [person ids])}. */
export const Duplicates = Object.freeze({
  keys(m) {
    const out = [];
    if (m.file_sha256) out.push("sha:" + m.file_sha256);
    if (m.kind === "link" && m.url) out.push("url:" + linkKey(m.url));
    if ((m.kind === "file" || m.kind === "image") && m.file_size > 0) out.push(`name:${SmartNames.tidy(titleOf(m)).toLowerCase()}#${m.file_size}`);
    return out;
  },
  fold(materials) {
    const first = new Map(), also = new Map(), hidden = new Set();
    for (const m of [...materials].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))) {
      const keys = this.keys(m);
      if (!keys.length) continue;
      const f = keys.map(k => first.get(k)).find(f => f && !(f.file_sha256 && m.file_sha256 && f.file_sha256 !== m.file_sha256));
      if (f) {
        if (m.added_by && m.added_by !== f.added_by && !(also.get(f.id) ?? []).includes(m.added_by)) also.set(f.id, [...(also.get(f.id) ?? []), m.added_by]);
        hidden.add(m.id);
      } else for (const k of keys) if (!first.has(k)) first.set(k, m);
    }
    return { shown: materials.filter(m => !hidden.has(m.id)), alsoAdded: also };
  },
});

const BUCKETS = ["lectures", "tutorials", "homework", "exams", "photos", "links", "notes", "files"];
/** "4 new: 2 lecture files, a homework sheet, a photo" (SinceLastVisit) — counted, never names. */
export const SinceLastVisit = Object.freeze({
  bucket(m) {
    const k = SmartNames.parse(titleOf(m)).kind;
    if (k === "lecture") return "lectures"; if (k === "tutorial") return "tutorials"; if (k === "homework") return "homework"; if (k === "exam") return "exams";
    return { image: "photos", link: "links", text: "notes", request: "notes", file: "files" }[m.kind] ?? "files";
  },
  make(materials, since, me, deadlines = [], now = new Date()) {
    const fresh = materials.filter(m => NewSince.isNew(m, since, me));
    if (!fresh.length) return null;
    const counts = new Map();
    for (const m of fresh) { const b = this.bucket(m); counts.set(b, (counts.get(b) ?? 0) + 1); }
    const buckets = [...counts].sort((a, b) => b[1] - a[1] || BUCKETS.indexOf(a[0]) - BUCKETS.indexOf(b[0])).slice(0, 3).map(([bucket, count]) => ({ bucket, count }));
    const soon = deadlines.filter(d => new Date(d.at) >= now && new Date(d.at) <= new Date(now.getTime() + 7 * 86_400_000)).sort((a, b) => new Date(a.at) - new Date(b.at));
    return { total: fresh.length, buckets, nextDeadline: soon[0] ?? null };
  },
  english(s) {
    const w = { lectures: ["lecture file", "lecture files"], tutorials: ["tutorial", "tutorials"], homework: ["homework sheet", "homework sheets"],
                exams: ["exam paper", "exam papers"], photos: ["photo", "photos"], links: ["link", "links"], notes: ["note", "notes"], files: ["file", "files"] };
    return `${s.total} new: ` + s.buckets.map(b => (b.count === 1 ? `a ${w[b.bucket][0]}` : `${b.count} ${w[b.bucket][1]}`)).join(", ");
  },
});

const CONCEPTS = [
  ["exam", "test", "midterm", "final", "quiz", "מבחן", "בוחן", "מועד"],
  ["homework", "hw", "assignment", "exercise", "problem", "pset", "תרגיל", "מטלה", "שיעורי"],
  ["lecture", "slides", "lec", "class", "הרצאה", "מצגת", "שקפים", "שיעור"],
  ["tutorial", "recitation", "tut", "תרגול"],
  ["solution", "solutions", "answers", "answer", "פתרון", "פתרונות", "תשובות"],
  ["summary", "notes", "cheatsheet", "סיכום", "סיכומים"],
  ["board", "whiteboard", "blackboard", "לוח"],
  ["syllabus", "סילבוס"],
  ["formula", "formulas", "נוסחאות", "נוסחה"],
  ["deadline", "due", "submission", "הגשה", "להגיש"],
  ["recording", "video", "zoom", "הקלטה", "וידאו"],
];

let conceptMap = null;
const wordCache = new Map(), matchCache = new Map();

/** Search inside names, notes, PDF/photo text and who added it, in English and Hebrew (SmartSearch). */
export const SmartSearch = Object.freeze({
  normalize(s) {
    const finals = { "ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ" };
    return String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-֑ͯ-ׇ]/g, "").normalize("NFC").replace(/[ךםןףץ]/g, c => finals[c]);
  },
  words(s) {
    return this.normalize(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean).map(w => (w.endsWith("s") && w.length > 4 && w.charCodeAt(0) < 128 ? w.slice(0, -1) : w));
  },
  stripPrefix(w) { let t = w; while ([...t].length >= 4 && "והבלמשכ".includes(t[0])) t = t.slice(1); return t; },
  conceptOf(w) {
    conceptMap ??= new Map(CONCEPTS.flatMap((ws, i) => ws.map(x => [SmartSearch.normalize(x), i])));
    return conceptMap.get(w) ?? conceptMap.get(this.stripPrefix(w));
  },
  distance(a, b) {
    a = [...a]; b = [...b];
    if (!a.length || !b.length) return Math.max(a.length, b.length);
    const d = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
    return d[a.length][b.length];
  },
  match(q, d) {
    if (q === d) return 1;
    const sq = this.stripPrefix(q);
    if (sq === this.stripPrefix(d) && [...sq].length >= 2) return 0.9;
    const a = this.conceptOf(q), b = this.conceptOf(d);
    if (a != null && a === b) return 0.8;
    if ([...q].length >= 3 && (d.startsWith(q) || this.stripPrefix(d).startsWith(q))) return 0.7;
    if ([...q].length >= 5 && Math.abs([...q].length - [...d].length) <= 1 && this.distance(q, d) <= 1) return 0.5;
    return 0;
  },
  /** Each text split into its distinct words once; each (typed, document) word pair scored once (QA-41). */
  uniqueWords(raw) {
    if (!raw) return [];
    let w = wordCache.get(raw);
    if (!w) { w = [...new Set(this.words(raw))]; if (wordCache.size > 1500) wordCache.clear(); wordCache.set(raw, w); }
    return w;
  },
  cachedMatch(q, d) {
    if (q === d) return 1;
    const key = q + "\u0000" + d;
    let m = matchCache.get(key);
    if (m === undefined) { m = this.match(q, d); if (matchCache.size > 300_000) matchCache.clear(); matchCache.set(key, m); }
    return m;
  },
  /** {score, field: "title"|"body"|"text"|"person", snippet} or null. Every word must be found somewhere. */
  hit(query, { title = "", body = null, text = null, person = null } = {}) {
    const terms = this.words(query);
    if (!terms.length) return null;
    const fields = [["title", title, 3], ["body", body, 2], ["text", text, 1.2], ["person", person, 1]].map(([f, raw, w]) => ({ f, raw, w, toks: this.uniqueWords(raw) }));
    let total = 0, best = null;
    for (const term of terms) {
      let termBest = 0;
      for (const { f, raw, w, toks } of fields) {
        let s = 0; for (const t of toks) { if (s >= 1) break; s = Math.max(s, this.cachedMatch(term, t)); }
        if (s * w > termBest) { termBest = s * w; if (!best || s * w > best.s) best = { f, s: s * w, raw }; }
      }
      if (termBest <= 0) return null;
      total += termBest;
    }
    const snippet = best.f === "body" || best.f === "text" ? this.snippet(terms, best.raw ?? "") : null;
    return { score: total, field: best.f, snippet };
  },
  /** ⌘K: items {id, title, body, person, domain, text, isNew, created_at} → [{item, hit}], new first, then the exact
   *  title (or its start), then newest. */
  palette(query, items, limit = 8) {
    const q = this.words(query).join(" ");
    if (!q) return [];
    return items.flatMap(i => {
      const body = [i.body, i.domain].filter(Boolean).join(" ");
      const hit = this.hit(query, { title: i.title, body: body || null, text: i.text, person: i.person });
      if (!hit) return [];
      const t = this.words(i.title).join(" ");
      return [{ item: i, hit, exact: t === q || t.startsWith(q) }];
    }).sort((a, b) => (!!b.item.isNew - !!a.item.isNew) || (b.exact - a.exact) || (new Date(b.item.created_at) - new Date(a.item.created_at)))
      .slice(0, limit).map(({ item, hit }) => ({ item, hit }));
  },
  snippet(terms, raw) {
    const n = this.normalize(raw);
    if ([...n].length !== [...raw].length) return null;
    const N = [...n], R = [...raw];
    for (const t of terms) {
      let i = n.indexOf(t); if (i < 0) i = n.indexOf(this.stripPrefix(t)); if (i < 0) continue;
      const at = [...n.slice(0, i)].length, len = [...(n.indexOf(t) >= 0 ? t : this.stripPrefix(t))].length;
      const s = Math.max(0, at - 30), e = Math.min(N.length, at + len + 40);
      return (s > 0 ? "…" : "") + R.slice(s, e).join("").replace(/\s+/g, " ").trim() + (e < N.length ? "…" : "");
    }
    return null;
  },
});

/** "Due tomorrow" on the sheet a deadline is about (DeadlineHint), at most 3 days away. Days count in `timeZone`. */
export const DeadlineHint = Object.freeze({
  find(title, deadlines, now = new Date(), timeZone) {
    const mine = SmartNames.parse(title);
    if ((mine.kind !== "homework" && mine.kind !== "exam") || SmartNames.isSolution(title)) return null;
    const soon = deadlines.filter(d => new Date(d.at) >= now && new Date(d.at) <= new Date(now.getTime() + 3 * 86_400_000)).sort((a, b) => new Date(a.at) - new Date(b.at));
    const day = d => { const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(d)).map(x => [x.type, x.value])); return Date.UTC(+p.year, +p.month - 1, +p.day); };
    for (const d of soon) {
      const theirs = SmartNames.parse(d.title);
      const sameKind = theirs.kind === mine.kind || (theirs.kind == null && mine.kind === "homework");
      if (!sameKind || !(mine.number === theirs.number || (mine.number == null && theirs.number == null && mine.kind === "exam"))) continue;
      return { title: d.title, at: new Date(d.at), daysLeft: Math.round((day(d.at) - day(now)) / 86_400_000), isExam: mine.kind === "exam" };
    }
    return null;
  },
  english(h, timeZone) {
    const word = h.isExam ? "Exam" : "Due";
    if (h.daysLeft <= 0) return `${word} today ` + new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone }).format(h.at);
    if (h.daysLeft === 1) return `${word} tomorrow`;
    return `${word} ` + new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone }).format(h.at);
  },
});

/** Text inside a file before it's shared (SharedOCR): ≤ 20,000 characters, no secrets, no lines with phone, ID or
 *  student numbers (photographed attendance sheets, grade lists). */
export const SharedOCR = Object.freeze({
  maxCharacters: 20_000,
  personal: [/(?:\+?972[\s-]?|\b0)(?:[2-9]|5\d)[\s-]?\d{3}[\s-]?\d{4}\b/, /\+\d{1,3}[\s-]?\(?\d{2,4}\)?[\s-]?\d{3,4}[\s-]?\d{3,4}\b/,
             /(?<!\d)\d{9}(?!\d)/, /(?<!\d)\d{3}[-\s]\d{3}[-\s]\d{3}(?!\d)/,
             /(?:student|ת\.?ז|תעודת זהות|מספר סטודנט|id)\s*(?:no\.?|number|#|:)?\s*\d{5,}/i,
             /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/],   // e-mail addresses (class lists, QA-48)
  clean(text) {
    if (SharePlan.refusalForText(text)) return null;
    const kept = String(text ?? "").split(/\r?\n/).filter(l => !this.personal.some(r => r.test(l))).map(l => l.trim()).filter(Boolean).join("\n");
    return kept ? [...kept].slice(0, this.maxCharacters).join("") : null;
  },
});

// ——— Essentials (SharedEssentials.swift; docs/shared/HUB-DIRECTION.md §1; cases in test/essentials-cases.json) ———
// Up to three cards at the top of a course — Next exam, Due, Next class — from dated materials (due_at / due_title,
// "Exam · Room 204"), the calendar (space_events), the timetable (space_lessons); Course info one tap away.
// EssentialsNotice spots an exam or deadline in what people add and only ever *suggests* it ("Add to Essentials?").
const tzParts = (d, timeZone) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", minute: "numeric", second: "numeric", weekday: "short" }).formatToParts(new Date(d)).map(x => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, mi: +p.minute, s: +p.second, wd: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday) };
};
const dayNo = (y, m, d) => Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
const daysApart = (a, b, tz) => { const x = tzParts(a, tz), y = tzParts(b, tz); return dayNo(y.y, y.m, y.d) - dayNo(x.y, x.m, x.d); };
const addDaysIn = (d, n, tz) => { const p = tzParts(d, tz); return zonedToUTC(p.y, p.m, p.d + n, p.h, p.mi, p.s, tz); };
const startOfDayIn = (d, tz, plus = 0) => { const p = tzParts(d, tz); return zonedToUTC(p.y, p.m, p.d + plus, 0, 0, 0, tz); };
const blank = s => (s == null || String(s).trim() === "" ? null : String(s));
const rxAll = (pattern, s) => [...s.matchAll(new RegExp(pattern, "g"))].map(m => ({ at: m.index, groups: [...m].map(g => g ?? null) }));
const rxFirst = (pattern, s) => rxAll(pattern, s)[0] ?? null;
const rxHas = (pattern, s) => new RegExp(pattern).test(s);

const EN_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], HE_DAYS = ["יום א׳", "יום ב׳", "יום ג׳", "יום ד׳", "יום ה׳", "יום ו׳", "שבת"];
const EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const Essentials = Object.freeze({
  examDays: 180, dueDays: 60, classDays: 14, classLength: 3_600_000,
  slots: ["exam", "due", "class"],
  /** [{slot, title, at, allDay, place, isNow, materialId|eventId|lessonId}] in slot order; past ones drop off; at the same
   *  moment the calendar beats a pinned item, which beats any other item. Rows as the server sends them. */
  pick({ materials = [], events = [], lessons = [] }, now = new Date(), timeZone) {
    now = new Date(now);
    const best = new Map();
    const consider = (c, rank) => {
      const days = c.slot === "exam" ? this.examDays : c.slot === "due" ? this.dueDays : this.classDays;
      if (c.at > new Date(now.getTime() + days * 86_400_000)) return;
      const b = best.get(c.slot);
      if (b && (b.card.at < c.at || (+b.card.at === +c.at && b.rank <= rank))) return;
      best.set(c.slot, { card: c, rank });
    };
    for (const m of materials) {
      if (m.ready === false || m.hidden || m.deleted_at || !m.due_at) continue;
      const at = new Date(m.due_at), { title, place } = this.split(m.due_title ?? SmartNames.tidy(m.title ?? ""));
      const p = tzParts(at, timeZone), allDay = p.h === 0 && p.mi === 0;
      if (this.end(at, allDay, 0, timeZone) <= now) continue;
      consider({ slot: SmartNames.parse(title).kind === "exam" ? "exam" : "due", title, at, allDay, place, isNow: false, materialId: m.id }, m.pinned ? 1 : 2);
    }
    for (const e of events) {
      const slot = { exam: "exam", deadline: "due", lecture: "class", tutorial: "class" }[e.kind];
      if (!slot) continue;
      const start = new Date(e.starts_at), length = e.ends_at ? new Date(e.ends_at) - start : slot === "class" ? this.classLength : 0;
      const at = this.next(start, length, !!e.all_day, e.repeat_until, now, timeZone);
      if (!at) continue;
      consider({ slot, title: e.title, at, allDay: !!e.all_day, place: blank(e.location), isNow: slot === "class" && !e.all_day && at <= now, eventId: e.id }, 0);
    }
    for (const l of lessons) {
      const start = new Date(l.starts_at), length = l.ends_at ? new Date(l.ends_at) - start : this.classLength;
      const at = this.next(start, length, false, null, now, timeZone);
      if (!at) continue;
      const title = blank(l.title) ?? (l.number != null ? `Class ${l.number}` : "Class");
      consider({ slot: "class", title, at, allDay: false, place: null, isNow: at <= now, lessonId: l.id }, 1);
    }
    return this.slots.map(s => best.get(s)?.card).filter(Boolean);
  },
  next(start, length, allDay, repeatUntil, now, tz) {
    const last = repeatUntil ? (([y, m, d]) => zonedToUTC(y, m, d + 1, 0, 0, 0, tz))(String(repeatUntil).slice(0, 10).split("-").map(Number)) : null;
    let d = start;
    for (let i = 0; i < 400; i++) {
      if (last && d >= last) return null;
      if (this.end(d, allDay, length, tz) > now) return d;
      if (!repeatUntil) return null;
      d = addDaysIn(d, 7, tz);
    }
    return null;
  },
  end(d, allDay, length, tz) { return allDay ? startOfDayIn(d, tz, 1) : new Date(new Date(d).getTime() + Math.max(0, length)); },
  /** "Exam · Room 204": what set_due saves (≤ 60, shared.sql due_title), and back. */
  dueTitle(title, place) { return [...[title, blank(place)].filter(Boolean).join(" · ")].slice(0, 60).join(""); },
  split(dueTitle) {
    const t = String(dueTitle ?? "").trim(), i = t.indexOf(" · ");
    if (i < 0) return { title: t || "Due", place: null };
    return { title: t.slice(0, i).trim() || "Due", place: blank(t.slice(i + 3).trim()) };
  },
  label(slot, lang = "en") {
    const he = lang === "he";
    return slot === "exam" ? (he ? "המבחן הבא" : "Next exam") : slot === "due" ? (he ? "להגשה" : "Due") : (he ? "השיעור הבא" : "Next class");
  },
  /** "now" · "today" · "tomorrow" · "in 5 days" · "in 2 weeks". */
  soon(c, now = new Date(), timeZone, lang = "en") {
    const he = lang === "he", days = daysApart(now, c.at, timeZone);
    if (c.isNow) return he ? "עכשיו" : "now";
    if (days <= 0) return he ? "היום" : "today";
    if (days === 1) return he ? "מחר" : "tomorrow";
    if (days <= 13) return he ? (days === 2 ? "בעוד יומיים" : `בעוד ${days} ימים`) : `in ${days} days`;
    const w = Math.floor(days / 7);
    return he ? (w === 2 ? "בעוד שבועיים" : `בעוד ${w} שבועות`) : `in ${w} weeks`;
  },
  /** "Exam in 5 days" — the folio header's line. */
  headline(c, now = new Date(), timeZone, lang = "en") { return `${c.title} ${this.soon(c, now, timeZone, lang)}`; },
  /** Exam "Thu 12 Nov · 9:00 · Room 204" · Due "Homework 4 · Thu" · Class "Tue 10:00 · Room 204" / "Now · Room 118". */
  line(c, now = new Date(), timeZone, lang = "en") {
    const he = lang === "he", days = daysApart(now, c.at, timeZone), p = tzParts(c.at, timeZone);
    const time = c.allDay ? null : `${p.h}:${String(p.mi).padStart(2, "0")}`;
    const full = he ? `${HE_DAYS[p.wd]} ${p.d}/${p.m}` : `${EN_DAYS[p.wd]} ${p.d} ${EN_MONTHS[p.m - 1]}`;
    const word = days <= 0 ? (he ? "היום" : "Today") : days === 1 ? (he ? "מחר" : "Tomorrow") : days <= 6 ? (he ? HE_DAYS : EN_DAYS)[p.wd]
      : he ? `${p.d}/${p.m}` : `${p.d} ${EN_MONTHS[p.m - 1]}`;
    const parts = c.slot === "exam" ? [full, time, c.place]
      : c.slot === "due" ? [c.title, word + (days <= 0 && time ? ` ${time}` : ""), c.place]
      : c.isNow ? [he ? "עכשיו" : "Now", c.place] : [[word, time].filter(Boolean).join(" "), c.place];
    return parts.map(blank).filter(Boolean).join(" · ");
  },
  /** {lecturer, email, hours, links: [label]} from space_info rows; null when there's nothing. */
  info(entries = []) {
    const sorted = [...entries].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
    const people = sorted.filter(e => e.kind === "person"), who = people.find(e => e.role === "lecturer") ?? people[0];
    const links = sorted.filter(e => e.kind === "link").map(e => blank(e.name) ?? (() => { try { return new URL(e.url).host; } catch { return null; } })()).filter(Boolean);
    if (!who && !links.length) return null;
    return { lecturer: blank(who?.name), email: blank(who?.email), hours: blank(who?.hours), links };
  },
});

const N = {
  due: String.raw`(?<![a-z])(due|deadline|submit|submission|hand in|turn in)(?![a-z])|(?<![א-ת])[והבל]{0,2}(הגשה|הגשת|להגיש)(?![א-ת])`,
  exam: String.raw`(?<![a-z])(exams?|midterms?|final exam|finals|quiz|quizzes|test|moed)(?![a-z])|(?<![א-ת])[והבלמשכ]{0,2}(מבחן|מבחנים|בוחן|מועד)(?![א-ת])`,
  homework: String.raw`(?<![a-z])(homework|hw|assignment|problem set|pset|essay|lab report)(?![a-z])|(?<![a-z])(exercise|ex|project)\s*#?\s*\d|(?<![א-ת])[והבלמשכ]{0,2}(תרגיל בית|מטלה|ש"ב|שיעורי בית)(?![א-ת])|(?<![א-ת])[והבלמשכ]{0,2}תרגיל\s*(?:מס['׳]?\s*)?\d`,
  cue: String.raw`(?<![a-z])(by|until|before|no later than)(?![a-z])|(?<![א-ת])(עד|לא יאוחר)(?![א-ת])`,
  month: String.raw`(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)`,
};
const EN_NAMES = { homework: "Homework", hw: "Homework", assignment: "Assignment", exercise: "Exercise", ex: "Exercise", "problem set": "Problem set",
                   pset: "Problem set", project: "Project", essay: "Essay", "lab report": "Lab report", lab: "Lab" };
const MONTH_KEYS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const HE_MONTHS = { ינואר: 1, פברואר: 2, מרץ: 3, מרס: 3, אפריל: 4, מאי: 5, יוני: 6, יולי: 7, אוגוסט: 8, ספטמבר: 9, אוקטובר: 10, נובמבר: 11, דצמבר: 12 };
const HE_WEEKDAYS = { ראשון: 0, א: 0, שני: 1, ב: 1, שלישי: 2, ג: 2, רביעי: 3, ד: 3, חמישי: 4, ה: 4, שישי: 5, ו: 5 };
const EN_PLACES = { "lecture hall": "Lecture hall", room: "Room", rm: "Room", "rm.": "Room", hall: "Hall", auditorium: "Auditorium", aud: "Auditorium",
                    "aud.": "Auditorium", classroom: "Classroom", building: "Building", bldg: "Building", "bldg.": "Building" };

export const EssentialsNotice = Object.freeze({
  maxText: 4000,
  /** A material row: its note, file name and text read from the picture or PDF. Null when it already has a date. */
  findIn(row, now = new Date(), timeZone) {
    if (row.due_at) return null;
    return this.find([row.body, row.ocr_text].filter(s => s != null).join("\n"), row.title ?? row.file_path?.split("/").pop() ?? null, now, timeZone);
  },
  /** {slot: "exam"|"due", title, at, allDay, place} — the soonest upcoming exam or deadline one sentence names with a date. */
  find(text, title = null, now = new Date(), timeZone) {
    now = new Date(now);
    const raw = [...String(text ?? "")].slice(0, this.maxText).join("");
    if (!raw) return null;
    const pieces = raw.split(/\n+|[;!?]\s+|\.\s+(?=[A-Zא-ת])/).filter(Boolean).map(p => p.toLowerCase());
    const titleKind = title != null ? SmartNames.parse(title).kind : null;
    let found = null;
    for (const p of pieces) { const s = this.suggestion(p, title, titleKind, now, timeZone); if (s && (!found || s.at < found.at)) found = s; }
    return found;
  },
  suggestion(p, title, titleKind, now, tz) {
    let slot;
    if (rxHas(N.due, p)) slot = "due";
    else if (rxHas(N.exam, p)) slot = "exam";
    else if (rxHas(N.homework, p)) slot = "due";
    else if ((titleKind === "exam" || titleKind === "homework") && rxHas(N.cue, p)) slot = titleKind === "exam" ? "exam" : "due";
    else return null;
    const day = this.date(p, now, tz);
    if (!day) return null;
    const time = this.clock(p), allDay = !time;
    const at = zonedToUTC(day.y, day.m, day.d, time?.h ?? (slot === "due" ? 23 : 0), time?.m ?? (slot === "due" ? 59 : 0), 0, tz);
    const ends = slot === "exam" && allDay ? addDaysIn(at, 1, tz) : at;
    if (ends <= now || at > new Date(now.getTime() + 400 * 86_400_000)) return null;
    const name = slot === "exam" ? this.examTitle(p, title) : this.dueTitle(p, title, titleKind);
    return { slot, title: name, at, allDay, place: this.place(p) };
  },
  examTitle(p, title) {
    if (rxHas(String.raw`(?<![a-z])midterms?(?![a-z])`, p)) return "Midterm";
    if (rxHas(String.raw`(?<![a-z])(final exam|finals)(?![a-z])`, p)) return "Final exam";
    const q = rxFirst(String.raw`(?<![a-z])quiz\s*#?\s*0*(\d{1,2})(?!\d|[/.:]\d)`, p);
    if (q) return `Quiz ${q.groups[1]}`;
    if (rxHas(String.raw`(?<![a-z])quiz(?![a-z])`, p)) return "Quiz";
    const moed = rxFirst(String.raw`(?<![a-z])moed\s+([ab])(?![a-z])|(?<![א-ת])מועד\s+([אב])(?![א-ת])`, p);
    if (moed) return moed.groups[1] ? `Moed ${moed.groups[1].toUpperCase()}` : `מועד ${moed.groups[2]}׳`;
    const he = rxFirst(String.raw`(?<![א-ת])[והבלמשכ]{0,2}(מבחן|בוחן)(?:\s+(אמצע|סופי)|\s*(?:מס['׳]?\s*)?0*(\d{1,2})(?!\d|[/.:]\d))?(?![א-ת])`, p);
    if (he) return [he.groups[1], he.groups[2] ?? he.groups[3]].filter(Boolean).join(" ");
    if (/[א-ת]/.test(p)) return "מבחן";
    if (!rxHas(N.exam, p) && title != null) return SmartNames.tidy(title);
    return "Exam";
  },
  dueTitle(p, title, titleKind) {
    let g = rxFirst(String.raw`(?<![a-z])(homework|hw|assignment|exercise|problem set|pset|project|essay|lab report|lab|ex)\s*#?\s*0*(\d{1,2})(?!\d)`, p);
    if (g) return `${EN_NAMES[g.groups[1]]} ${g.groups[2]}`;
    g = rxFirst(String.raw`(?<![א-ת])[והבלמשכ]?(תרגיל בית|תרגיל|מטלה|ש"ב|שיעורי בית)(?:\s*(?:מס['׳]?\s*|#)?0*(\d{1,2})(?!\d))?`, p);
    if (g) return [g.groups[1] === 'ש"ב' ? "שיעורי בית" : g.groups[1], g.groups[2]].filter(Boolean).join(" ");
    g = rxFirst(String.raw`(?<![a-z])(homework|hw|assignment|project|essay|lab report|problem set)(?![a-z])`, p);
    if (g) return EN_NAMES[g.groups[1]];
    if (titleKind === "homework" && title != null) return SmartNames.tidy(title);
    return /[א-ת]/.test(p) ? "הגשה" : "Due";
  },
  /** Every written or numeric date in a sentence, in reading order (not checked yet). */
  explicit(p) {
    const explicit = [], year = s => (s == null ? null : +s < 100 ? 2000 + +s : +s);
    for (const g of rxAll(String.raw`(?<!\d)(\d{1,2})(?:st|nd|rd|th)?(?:\s+of)?\s+` + N.month + String.raw`\.?(?:,?\s+(\d{4}))?(?![a-z])`, p))
      explicit.push({ at: g.at, y: year(g.groups[3]), m: MONTH_KEYS.indexOf(g.groups[2].slice(0, 3)) + 1, d: +g.groups[1] });
    for (const g of rxAll(String.raw`(?<![a-z])` + N.month + String.raw`\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?![\d:])(?:,?\s+(\d{4})(?!\d))?`, p))
      explicit.push({ at: g.at, y: year(g.groups[3]), m: MONTH_KEYS.indexOf(g.groups[1].slice(0, 3)) + 1, d: +g.groups[2] });
    for (const g of rxAll(String.raw`(?<!\d)(\d{1,2})\s*[בל]?-?\s*(ינואר|פברואר|מרץ|מרס|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)(?:\s+(\d{4}))?`, p))
      explicit.push({ at: g.at, y: year(g.groups[3]), m: HE_MONTHS[g.groups[2]], d: +g.groups[1] });
    for (const pattern of [String.raw`(?<![\d/.:])(\d{1,2})/(\d{1,2})(?:/(\d{4}|\d{2}))?(?!/?\d)`,
                           String.raw`(?<![\d.:])(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})(?!\d)`,
                           String.raw`(?:^|:\s*|(?<![a-z])(?:on|by|until|due|date|before|sun|mon|tue|wed|thu|fri|sat)[a-z]*\.?,?\s+|(?<![א-ת])(?:ב|עד|ל|ה|בתאריך)\s?-?\s?|['׳]\s+|[–—-]\s+)(\d{1,2})\.(\d{1,2})(?!\.?\d)`]) {
      for (const g of rxAll(pattern, p)) {
        const a = +g.groups[1], b = +g.groups[2], [d, m] = b > 12 && a <= 12 ? [b, a] : [a, b];
        explicit.push({ at: g.at, y: g.groups.length > 3 ? year(g.groups[3]) : null, m, d });
      }
    }
    return explicit.sort((a, b) => a.at - b.at);
  },
  /** A written or numeric date first (12/11 = 12 Nov unless that can't be), then a weekday, then today/tomorrow. A date
   *  already past (up to 60 days back) means nothing to add; further back is next year's. */
  date(p, now, tz) {
    const explicit = this.explicit(p);
    const today = tzParts(now, tz);
    const valid = (y, m, d) => m >= 1 && m <= 12 && d >= 1 && d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
    const e = explicit.find(x => valid(x.y ?? today.y, x.m, x.d));
    if (e) {
      if (e.y != null) return { y: e.y, m: e.m, d: e.d };
      const ahead = dayNo(today.y, e.m, e.d) - dayNo(today.y, today.m, today.d);
      if (ahead >= 0) return { y: today.y, m: e.m, d: e.d };
      return ahead < -60 && valid(today.y + 1, e.m, e.d) ? { y: today.y + 1, m: e.m, d: e.d } : null;
    }
    const shifted = n => { const x = new Date(Date.UTC(today.y, today.m - 1, today.d + n)); return { y: x.getUTCFullYear(), m: x.getUTCMonth() + 1, d: x.getUTCDate() }; };
    const weekdays = [
      ...rxAll(String.raw`(?<![a-z])(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tues|tue|wed|thurs|thur|thu|fri)(?![a-z])`, p)
        .map(g => ({ at: g.at, wd: ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].indexOf(g.groups[1].slice(0, 3)) })),
      ...rxAll(String.raw`(?<![א-ת])[בל]?יום\s+(ראשון|שני|שלישי|רביעי|חמישי|שישי|א|ב|ג|ד|ה|ו)(?![א-ת])`, p).map(g => ({ at: g.at, wd: HE_WEEKDAYS[g.groups[1]] })),
    ].sort((a, b) => a.at - b.at);
    if (weekdays.length) { const ahead = (weekdays[0].wd - today.wd + 7) % 7; return shifted(ahead === 0 ? 7 : ahead); }
    const rel = [...rxAll(String.raw`(?<![a-z])(today|tonight|tomorrow)(?![a-z])`, p), ...rxAll(String.raw`(?<![א-ת])[ול]?(היום|מחרתיים|מחר)(?![א-ת])`, p)].sort((a, b) => a.at - b.at);
    if (rel.length) return shifted({ today: 0, tonight: 0, tomorrow: 1, היום: 0, מחר: 1, מחרתיים: 2 }[rel[0].groups[1]]);
    return null;
  },
  /** The first written or numeric date, past or not: a missing year is the one that puts it nearest to now (a syllabus's
   *  "Week 1 (25/10)", "the semester ends 22/1"). */
  explicitDate(p, now, tz) {
    const today = tzParts(now, tz), valid = (y, m, d) => m >= 1 && m <= 12 && d >= 1 && d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
    for (const e of this.explicit(p)) {
      if (e.y != null) { if (valid(e.y, e.m, e.d)) return { y: e.y, m: e.m, d: e.d }; continue; }
      const t = dayNo(today.y, today.m, today.d), y = [today.y - 1, today.y, today.y + 1].filter(y => valid(y, e.m, e.d))
        .sort((a, b) => Math.abs(dayNo(a, e.m, e.d) - t) - Math.abs(dayNo(b, e.m, e.d) - t))[0];
      if (y != null) return { y, m: e.m, d: e.d };
    }
    return null;
  },
  /** "9:00", "2pm", "at 9", "בשעה 10", "noon"; the first one wins. A bare "at 2" / "בשעה 2" is the afternoon. */
  clock(p) {
    const found = [];
    const ampm = (h, s) => (s == null ? h : s.startsWith("p") ? (h < 12 ? h + 12 : h) : h === 12 ? 0 : h);
    const afternoon = h => (h >= 1 && h <= 6 ? h + 12 : h >= 7 && h <= 23 ? h : null);
    for (const g of rxAll(String.raw`(?<![\d:./])([01]?\d|2[0-3]):([0-5]\d)(?!\d)(?:\s*(am|pm|a\.m\.|p\.m\.))?`, p)) found.push({ at: g.at, h: ampm(+g.groups[1], g.groups[3]), m: +g.groups[2] });
    for (const g of rxAll(String.raw`(?<![\d:./])(1[0-2]|0?[1-9])\s*(am|pm|a\.m\.|p\.m\.)(?![a-z])`, p)) found.push({ at: g.at, h: ampm(+g.groups[1], g.groups[2]), m: 0 });
    for (const g of rxAll(String.raw`(?<![a-z])at\s+(\d{1,2})(?![\d:./]|\s*(?:am|pm|a\.m\.|p\.m\.))`, p)) { const h = afternoon(+g.groups[1]); if (h != null) found.push({ at: g.at, h, m: 0 }); }
    for (const g of rxAll(String.raw`בשעה\s*(\d{1,2})(?::([0-5]\d))?(?!\d)`, p)) { const h = afternoon(+g.groups[1]); if (h != null) found.push({ at: g.at, h, m: g.groups[2] != null ? +g.groups[2] : 0 }); }
    for (const g of rxAll(String.raw`(?<![a-z])noon(?![a-z])`, p)) found.push({ at: g.at, h: 12, m: 0 });
    found.sort((a, b) => a.at - b.at);
    return found.length ? { h: found[0].h, m: found[0].m } : null;
  },
  /** "Room 204", "Building 32, Room 101", "חדר 118", else Zoom / Moodle / Online. */
  place(p) {
    const places = [
      ...rxAll(String.raw`(?<![a-z])(lecture hall|room|rm\.?|hall|auditorium|aud\.?|classroom|building|bldg\.?)\s*#?\s*([a-z]?\d{1,4}[a-z]?(?:[-/]\d{1,4})?)(?!\d)`, p)
        .map(g => ({ at: g.at, label: `${EN_PLACES[g.groups[1]]} ${g.groups[2].toUpperCase()}` })),
      ...rxAll(String.raw`(?<![א-ת])[בל]?(חדר|כיתה|אולם|בניין|בנין)\s*(?:מס['׳]?\s*)?(\d{1,4}(?:[-/]\d{1,4})?)(?!\d)`, p)
        .map(g => ({ at: g.at, label: `${g.groups[1] === "בנין" ? "בניין" : g.groups[1]} ${g.groups[2]}` })),
    ].sort((a, b) => a.at - b.at);
    const building = s => s.startsWith("Building") || s.startsWith("בניין");
    const joined = [places.find(x => building(x.label))?.label, places.find(x => !building(x.label))?.label].filter(Boolean);
    if (joined.length) return joined.join(", ");
    if (rxHas(String.raw`(?<![a-z])zoom(?![a-z])|(?<![א-ת])בזום(?![א-ת])`, p)) return "Zoom";
    if (rxHas(String.raw`(?<![a-z])moodle(?![a-z])|(?<![א-ת])[בל]?מודל(?![א-ת])`, p)) return "Moodle";
    if (rxHas(String.raw`(?<![a-z])online(?![a-z])|אונליין|מקוון`, p)) return "Online";
    return null;
  },
});

// ——— Dates from a syllabus, a calendar or a pasted list (SharedDateImport.swift; cases in test/dates-cases.json) ———
// The whole text is read on the device: exams, quizzes, what's due (English + Hebrew, 12/11 = 12 Nov, "Week 5", "Thursday
// of week 4") and the weekly class times ("Lectures: Sunday 10:00–12:00, Room 204"). It only ever *suggests*: the page
// shows "Found 6 dates — add them?" with a tick per row, and nothing is saved until Add (import_events, with a made-up
// UID per date so the same syllabus again updates instead of doubling).
const DI = {
  week: String.raw`(?<![a-z])(?:week|wk)\.?\s*#?\s*(\d{1,2})(?!\d)|(?<![א-ת])[בלש]?שבוע\s*(?:מס['׳]?\s*)?(\d{1,2})(?!\d)`,
  every: String.raw`(?<![a-z])(every|each|weekly)(?![a-z])|(?<![א-ת])(כל|מדי)(?![א-ת])`,
  cls: String.raw`(?<![a-z])(lectures?|class(?:es)?|tutorials?|recitations?|labs?|sections?|seminars?|meets|meetings?)(?![a-z])|(?<![א-ת])[ובה]?(הרצאות|הרצאה|תרגולים|תרגול|שיעורים|שיעור|מעבדות|מעבדה|סמינר|סדנה)(?![א-ת])`,
  office: String.raw`(?<![a-z])office hours?(?![a-z])|שעות קבלה|שעת קבלה`,
  range: String.raw`(?<![\d:./])([01]?\d|2[0-3])(?::([0-5]\d))?\s*(?:[-–—]|to|עד)\s*([01]?\d|2[0-3])(?::([0-5]\d))?(?![\d/.]|:\d)`,
  term: String.raw`(?<![a-z])(semester|term|classes|course)(?![a-z])|סמסטר|הלימודים|הקורס`,
  start: String.raw`(?<![a-z])(starts?|begins?|start date|first day)(?![a-z])|(?<![א-ת])(תחילת|פתיחת|מתחיל|מתחילים)(?![א-ת])`,
  end: String.raw`(?<![a-z])(ends?|end date|last day|finish(?:es)?)(?![a-z])|(?<![א-ת])(סיום|סוף|מסתיים|נגמר)(?![א-ת])`,
  weekday: String.raw`(?<![a-z])(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tues|tue|wed|thurs|thur|thu|fri)(?![a-z])|(?<![א-ת])[בל]?יום\s+(ראשון|שני|שלישי|רביעי|חמישי|שישי|א|ב|ג|ד|ה|ו)(?![א-ת])`,
};
const DI_CLASS = { lecture: "Lecture", lectures: "Lecture", class: "Class", classes: "Class", tutorial: "Tutorial", tutorials: "Tutorial",
  recitation: "Recitation", recitations: "Recitation", lab: "Lab", labs: "Lab", section: "Section", sections: "Section", seminar: "Seminar",
  seminars: "Seminar", meets: "Class", meeting: "Class", meetings: "Class", הרצאה: "הרצאה", הרצאות: "הרצאה", תרגול: "תרגול", תרגולים: "תרגול",
  שיעור: "שיעור", שיעורים: "שיעור", מעבדה: "מעבדה", מעבדות: "מעבדה", סמינר: "סמינר", סדנה: "סדנה" };
const DI_TUTORIAL = new Set(["Tutorial", "Recitation", "Lab", "Section", "תרגול", "מעבדה"]);
const ymd = ({ y, m, d }) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const plusDays = ({ y, m, d }, n) => { const x = new Date(Date.UTC(y, m - 1, d + n)); return { y: x.getUTCFullYear(), m: x.getUTCMonth() + 1, d: x.getUTCDate() }; };
const weekdayOf = ({ y, m, d }) => new Date(Date.UTC(y, m - 1, d)).getUTCDay();
const hm = (h, m) => `${h}:${String(m).padStart(2, "0")}`;

export const DateImport = Object.freeze({
  maxText: 60_000, maxFound: 60,
  /** [{kind, title, at, endsAt, allDay, place, repeatUntil, uid, checked}] from a syllabus's or a pasted list's text: weekly
   *  classes first, then the dated things, soonest first. `termStarts` ("2026-10-25") counts the weeks when the text doesn't. */
  fromText(text, { now = new Date(), timeZone, termStarts = null } = {}) {
    now = new Date(now);
    let raw = [...String(text ?? "")].slice(0, this.maxText).join("");
    // Month first (11/17, 12/01) when a date can only be read that way and none only the Israeli way.
    const pairs = rxAll(String.raw`(?<![\d/.:])(\d{1,2})/(\d{1,2})(?!\d)`, raw).map(g => [+g.groups[1], +g.groups[2]]);
    if (pairs.some(([a, b]) => b > 12 && a <= 12) && !pairs.some(([a, b]) => a > 12 && b <= 12))
      raw = raw.replace(/(?<![\d/.:])(\d{1,2})\/(\d{1,2})(?!\d)/g, "$2/$1");
    const lines = raw.split(/\r?\n/).map(l => l.replace(/\s+/g, " ").trim()).filter(Boolean);
    const low = lines.map(l => l.toLowerCase());
    const examish = p => rxHas(N.exam, p) || rxHas(N.due, p) || rxHas(N.homework, p);
    const weekOf = p => { const g = rxFirst(DI.week, p); return g ? +(g.groups[1] ?? g.groups[2]) : null; };
    const after = (p, pattern) => { const g = rxFirst(pattern, p); return g ? EssentialsNotice.explicitDate(p.slice(g.at + g.groups[0].length), now, timeZone) : null; };
    // The term and the week count.
    let starts = null, ends = null, anchor = null, maxWeek = 0;
    for (const p of low) {
      if (rxHas(DI.term, p) && !examish(p)) { starts ??= after(p, DI.start); ends ??= after(p, DI.end); }
      const w = weekOf(p);
      if (w != null) { maxWeek = Math.max(maxWeek, w); const d = EssentialsNotice.explicitDate(p, now, timeZone); if (d && !anchor) anchor = { n: w, day: d }; }
    }
    const given = termStarts ? (([y, m, d]) => ({ y, m, d }))(String(termStarts).slice(0, 10).split("-").map(Number)) : null;
    anchor ??= starts ? { n: 1, day: starts } : given ? { n: 1, day: given } : null;
    const weekDay = (n, wd) => { // week n's day: that weekday of the week, else the anchor's own weekday
      const base = plusDays(anchor.day, 7 * (n - anchor.n));
      return wd == null ? base : plusDays(base, wd - weekdayOf(base));
    };
    if (!ends && anchor && maxWeek >= 6) ends = weekDay(maxWeek, 6);
    const found = [];
    for (let i = 0; i < lines.length; i++) {
      const p = low[i], w = weekOf(p);
      if (this.isClassLine(p, now, timeZone)) { found.push(...this.weekly(p, { now, timeZone, starts: starts ?? given, ends })); continue; }
      for (const piece of lines[i].split(/[;!?]\s+|\.\s+(?=[A-Zא-ת])/).filter(Boolean).map(x => x.toLowerCase())) {
        if (rxHas(DI.every, piece)) continue;
        let q = piece;
        if (!EssentialsNotice.explicitDate(q, now, timeZone) && w != null) {
          if (!anchor) continue;
          const wd = rxFirst(DI.weekday, q), day = weekDay(w, wd ? this.weekdayIndex(wd) : null);
          q += ` on ${day.d}/${day.m}/${day.y}`;
        }
        const s = EssentialsNotice.suggestion(q, null, null, now, timeZone);
        if (!s) continue;
        const kind = s.slot === "exam" ? "exam" : "deadline";
        const at = s.allDay ? startOfDayIn(s.at, timeZone) : s.at;
        found.push({ kind, title: s.title, at, endsAt: null, allDay: s.allDay, place: s.place, repeatUntil: null,
                     uid: `stash-dates:${kind}:${ymd(tzParts(at, timeZone))}${s.allDay ? "" : "T" + hm(tzParts(at, timeZone).h, tzParts(at, timeZone).mi)}:${s.title.toLowerCase()}`, checked: true });
      }
    }
    const seen = new Set();
    return this.order(found.filter(f => !seen.has(f.uid) && seen.add(f.uid)), timeZone).slice(0, this.maxFound);
  },
  weekdayIndex(g) { return g.groups[1] ? ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].indexOf(g.groups[1].slice(0, 3)) : HE_WEEKDAYS[g.groups[2]]; },
  /** "Lectures: Sunday 10:00–12:00, Room 204": a class word, a weekday and a time, no date, not office hours. */
  isClassLine(p, now, tz) {
    return rxHas(DI.cls, p) && rxHas(DI.weekday, p) && !rxHas(DI.office, p) && !rxHas(N.exam, p) && !rxHas(N.due, p) && !rxHas(N.homework, p)
      && !EssentialsNotice.explicitDate(p, now, tz) && (rxHas(DI.range, p) || EssentialsNotice.clock(p) != null);
  },
  /** One weekly event per weekday named, from the next one (or the term's first week) until the term ends (else 13 weeks). */
  weekly(p, { now, timeZone, starts, ends }) {
    const name = DI_CLASS[rxFirst(DI.cls, p).groups.slice(1).find(Boolean)] ?? "Class";
    const r = rxFirst(DI.range, p);
    let from = r ? { h: +r.groups[1], m: +(r.groups[2] ?? 0) } : EssentialsNotice.clock(p), to = r ? { h: +r.groups[3], m: +(r.groups[4] ?? 0) } : null;
    if (r && !r.groups[2] && !r.groups[4] && from.h < 8 && to.h < 10) { from.h += 12; to.h += 12; } // "2-4" is the afternoon
    if (!from || from.h < 7 || from.h > 22 || (to && (to.h * 60 + to.m) <= (from.h * 60 + from.m))) return [];
    const today = tzParts(now, timeZone), base = starts && dayNo(starts.y, starts.m, starts.d) > dayNo(today.y, today.m, today.d) ? starts : today;
    const place = EssentialsNotice.place(p), out = [], seen = new Set();
    for (const g of rxAll(DI.weekday, p)) {
      const wd = this.weekdayIndex(g); if (seen.has(wd)) continue; seen.add(wd);
      let day = plusDays(base, (wd - weekdayOf(base) + 7) % 7);
      let at = zonedToUTC(day.y, day.m, day.d, from.h, from.m, 0, timeZone);
      const length = to ? (to.h * 60 + to.m - from.h * 60 - from.m) * 60_000 : this.classLength;
      if (at.getTime() + length <= now.getTime()) { day = plusDays(day, 7); at = zonedToUTC(day.y, day.m, day.d, from.h, from.m, 0, timeZone); }
      const until = ends ?? plusDays(day, 7 * 13 - 1);
      if (dayNo(until.y, until.m, until.d) < dayNo(day.y, day.m, day.d)) continue;
      const kind = DI_TUTORIAL.has(name) ? "tutorial" : "lecture";
      out.push({ kind, title: name, at, endsAt: to ? zonedToUTC(day.y, day.m, day.d, to.h, to.m, 0, timeZone) : null, allDay: false, place,
                 repeatUntil: ymd(until), uid: `stash-dates:${kind}:w${wd}T${hm(from.h, from.m)}:${name.toLowerCase()}`, checked: true });
    }
    return out;
  },
  classLength: 3_600_000,
  /** The same rows from a calendar file (ICSImport.parse's events): what's over is left out; anything that isn't a class,
   *  an exam or a deadline starts unticked. */
  fromEvents(events = [], { now = new Date(), timeZone } = {}) {
    now = new Date(now);
    const out = [];
    for (const e of events) {
      const start = new Date(e.starts_at), length = e.ends_at ? new Date(e.ends_at) - start : 0;
      if (!Essentials.next(start, length, !!e.all_day, e.repeat_until, now, timeZone)) continue;
      const title = String(e.title).replace(/\s+(?:is\s+)?due\.?$/i, "").trim() || e.title;
      out.push({ kind: e.kind, title, at: start, endsAt: e.ends_at ? new Date(e.ends_at) : null, allDay: !!e.all_day, place: blank(e.location),
                 repeatUntil: e.repeat_until ?? null, uid: e.uid ?? null, checked: e.kind !== "other" });
    }
    return this.order(out, timeZone).slice(0, CourseEvents.maxPerCourse);
  },
  /** Classes first, in week order (Sun → Sat, then by time); then the dated things, soonest first. */
  order(list, tz) {
    const week = f => { const p = tzParts(f.at, tz); return p.wd * 1440 + p.h * 60 + p.mi; };
    return [...list].sort((a, b) => (!!b.repeatUntil - !!a.repeatUntil) || (a.repeatUntil && b.repeatUntil ? week(a) - week(b) : 0) || (a.at - b.at));
  },
  /** "Found 6 dates — add them?" */
  headline(n, lang = "en") {
    if (lang === "he") return n === 0 ? "לא נמצאו תאריכים" : n === 1 ? "נמצא תאריך אחד — להוסיף?" : `נמצאו ${n} תאריכים — להוסיף?`;
    return n === 0 ? "No dates found" : n === 1 ? "Found 1 date — add it?" : `Found ${n} dates — add them?`;
  },
  /** A review row: "Every Sun · 10:00–12:00 · Room 204" · "Tue 8 Dec · 18:00 · Hall 2" · "Mon 1 Feb 2027" (a year only when it isn't this one). */
  line(f, now = new Date(), timeZone, lang = "en") {
    const he = lang === "he", p = tzParts(f.at, timeZone), e = f.endsAt ? tzParts(f.endsAt, timeZone) : null;
    const time = f.allDay ? null : hm(p.h, p.mi) + (e && (e.h !== p.h || e.mi !== p.mi) ? `–${hm(e.h, e.mi)}` : "");
    if (f.repeatUntil) return [he ? `כל ${HE_DAYS[p.wd]}` : `Every ${EN_DAYS[p.wd]}`, time, f.place].map(blank).filter(Boolean).join(" · ");
    const year = p.y !== tzParts(now, timeZone).y;
    const day = he ? `${HE_DAYS[p.wd]} ${p.d}/${p.m}${year ? `/${p.y}` : ""}` : `${EN_DAYS[p.wd]} ${p.d} ${EN_MONTHS[p.m - 1]}${year ? ` ${p.y}` : ""}`;
    return [day, time, f.place].map(blank).filter(Boolean).join(" · ");
  },
  /** What import_events takes. */
  toEvent(f) {
    return { kind: f.kind, title: [...f.title].slice(0, 120).join(""), starts_at: new Date(f.at).toISOString(), ends_at: f.endsAt ? new Date(f.endsAt).toISOString() : null,
             all_day: !!f.allDay, location: f.place ? [...f.place].slice(0, 120).join("") : null, repeat_until: f.repeatUntil ?? null, uid: f.uid };
  },
});

// ——— Who's here now (SharedPresence.swift; cases in test/presence-cases.json) ———
// Realtime Presence on the course's own channel (space:<id>): each open page or Mac sends only {p: person id,
// n: display name, c: colour}. Names shown come from the member list (the server's truth), not from what a device
// says; people you hid and people no longer in the course aren't shown; one circle per person however many devices.
const PRESENCE_TONES = ["coral", "butter", "sky"];
export const Presence = Object.freeze({
  max: 4,
  /** What this device sends; null when "Show me as here" is off (then it doesn't send anything). */
  payload(me, name, colour, showMe = true) {
    if (!showMe || !me) return null;
    return { p: String(me), n: [...String(name ?? "").trim()].slice(0, 40).join(""), c: this.colour(colour, name) };
  },
  /** supabase-js presenceState() ({key: [{p, n, c, presence_ref}, …]}) → [{id, name, initials, colour}] in arrival order. */
  people(state, { me = null, members = new Map(), hidden = new Set() } = {}) {
    const out = new Map();
    for (const metas of Object.values(state ?? {})) {
      for (const m of Array.isArray(metas) ? metas : []) {
        const id = typeof m?.p === "string" ? m.p : null;
        if (!id || id === String(me) || out.has(id) || hidden.has(id) || !members.has(id)) continue;
        const name = String(members.get(id) ?? "").trim() || "Someone";
        out.set(id, { id, name, initials: this.initials(name), colour: this.colour(m.c, name) });
      }
    }
    return [...out.values()];
  },
  /** Up to 4 circles, then "+N" for the rest. */
  shown(people, max = this.max) {
    const list = people ?? [];
    return { shown: list.slice(0, max), more: Math.max(0, list.length - max) };
  },
  /** "Dana Levi" → "DL", "Omer" → "O", "נועה כהן" → "נכ", "Ilan (TA)" → "I". */
  initials(name) {
    const words = String(name ?? "").replace(/\([^)]*\)/g, " ").trim().split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w));
    if (!words.length) return "?";
    const first = w => [...w].find(ch => /[\p{L}\p{N}]/u.test(ch)) ?? "";
    return (first(words[0]) + (words.length > 1 ? first(words.at(-1)) : "")).toLocaleUpperCase("en");
  },
  /** One of the brand's three highlight tones: the person's own (profile) when it's one of them, else from the name. */
  colour(wanted, name) {
    if (PRESENCE_TONES.includes(wanted)) return wanted;
    let h = 0;
    for (const ch of String(name ?? "").trim().toLowerCase()) h = (h * 31 + ch.codePointAt(0)) >>> 0;
    return PRESENCE_TONES[h % PRESENCE_TONES.length];
  },
  /** "Dana and Omer are here" · "Dana, Omer and 3 others are here" — for screen readers. */
  label(people, lang = "en") {
    const { shown, more } = this.shown(people);
    if (!shown.length) return "";
    const names = shown.map(p => p.name);
    if (lang === "he") {
      const list = more ? `${names.join(", ")} ועוד ${more}` : names.length > 1 ? `${names.slice(0, -1).join(", ")} ו${names.at(-1)}` : names[0];
      return `כאן עכשיו: ${list}`;
    }
    const list = more ? `${names.join(", ")} and ${more} ${more === 1 ? "other" : "others"}` : names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0];
    return `${list} ${shown.length + more === 1 ? "is" : "are"} here now`;
  },
});

// ——— Reminders from the dates card (SharedReminders.swift; cases in test/presence-cases.json "reminders") ———
// The day before an exam and on a homework's due day, at 8:00 in the morning: "Algorithms exam tomorrow · 9:00 ·
// Room 204". Something due before 10:00 is told the evening before (20:00) instead. Only what's at most `days` ahead;
// nothing already past. The Mac schedules these as local notifications; the phone gets them as web push from the
// server (admin.reminder_batch in shared.sql, the same times).
export const Reminders = Object.freeze({
  morning: 8, evening: 20, earlyDue: 10, days: 14,
  plan({ materials = [], events = [] }, course, now = new Date(), timeZone, lang = "en") {
    now = new Date(now);
    const cards = [
      ...materials.flatMap(m => Essentials.pick({ materials: [m] }, now, timeZone)),
      ...events.filter(e => e.kind === "exam" || e.kind === "deadline").flatMap(e => Essentials.pick({ events: [e] }, now, timeZone)),
    ].filter(c => c.slot === "exam" || c.slot === "due");
    const out = new Map();
    for (const c of cards) {
      const r = this.one(c, course, timeZone, lang);
      if (!r || r.at <= now || r.at > new Date(now.getTime() + this.days * 86_400_000)) continue;
      out.set(r.id, r);
    }
    return [...out.values()].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  },
  /** {id, at, slot, text} for one Essentials card (exam or due). */
  one(c, course, timeZone, lang = "en") {
    const he = lang === "he", p = tzParts(c.at, timeZone), time = c.allDay ? null : `${p.h}:${String(p.mi).padStart(2, "0")}`;
    const early = c.slot === "due" && !c.allDay && p.h < this.earlyDue;
    const dayBefore = c.slot === "exam" || early;
    const at = zonedToUTC(p.y, p.m, p.d - (dayBefore ? 1 : 0), early ? this.evening : this.morning, 0, 0, timeZone);
    const when = dayBefore ? (he ? "מחר" : "tomorrow") : (he ? "היום" : "today");
    const name = blank(String(course ?? "").trim()) ?? (he ? "הקורס" : "Your course");
    const what = c.slot === "exam" ? (he ? `${c.title} ${when}` : `${this.lower(c.title)} ${when}`)
      : (he ? `${c.title} להגשה ${when}` : `${this.lower(c.title)} due ${when}`);
    const text = [he ? `${name}: ${what}` : `${name} ${what}`, time, blank(c.place)].filter(Boolean).join(" · ");
    const source = c.materialId ?? c.eventId ?? c.title;
    return { id: `${c.slot}|${source}|${new Date(c.at).toISOString()}`, at, slot: c.slot, text };
  },
  /** "Exam" → "exam", "Homework 4" → "homework 4"; names stay as typed ("CS Midterm", "Quiz B"). */
  lower(title) { return /^[A-Z][a-z]+( \d+)?$/.test(title) ? title[0].toLowerCase() + title.slice(1) : title; },
});

// ——— Profile (optional): your name everywhere, a colour or a photo for your initial circle, your other devices ———
// Twin: Sources/StashCore/SharedProfile.swift; same cases: test/profile-cases.json. Server: set_my_name (per course),
// set_my_look / space_looks (migration 20261026_shared_profile), make_pair_code / claim_pair_code.
const PHOTO_RE = /^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]+={0,2}$/;
export const Profile = Object.freeze({
  /** The 8 colours (index = what the server keeps). Pale fill + dark ink (light), deep fill + pale ink (dark). */
  COLORS: Object.freeze([
    { id: "coral",  light: ["#FBE4DD", "#8A4536"], dark: ["#4A2D26", "#F5BFB1"] },
    { id: "butter", light: ["#FAEBCB", "#70510D"], dark: ["#463A1F", "#F2D58F"] },
    { id: "sky",    light: ["#E4EDFC", "#345EA0"], dark: ["#26334A", "#A9C4F5"] },
    { id: "sage",   light: ["#E2EFE4", "#3C6B47"], dark: ["#26382B", "#A9D3B2"] },
    { id: "lilac",  light: ["#ECE6F7", "#5B4791"], dark: ["#332B45", "#CBBDF0"] },
    { id: "sand",   light: ["#F1E8DC", "#6E5640"], dark: ["#3B3229", "#DCC7AE"] },
    { id: "rose",   light: ["#F8E1EA", "#8A3F5F"], dark: ["#45283A", "#F0B6CC"] },
    { id: "slate",  light: ["#E3E8EE", "#45556A"], dark: ["#2B323C", "#BCC7D6"] },
  ]),
  maxPhotoChars: 12000,
  photoSide: 96,
  /** "dana" → "D"; one letter even for emoji or Hebrew. */
  initial(name) { const t = DisplayName.clean(name) ?? ""; return t ? [...t][0].toLocaleUpperCase() : "?"; },
  /** [fill, ink] for a colour index, or null for none / out of range. */
  colors(index, dark = false) { const c = Profile.COLORS[index]; return c ? (dark ? c.dark : c.light) : null; },
  /** The server's rule for photos: a small JPEG data address and nothing else. */
  photoOK(data) { return typeof data === "string" && data.length <= Profile.maxPhotoChars && PHOTO_RE.test(data); },
  /** null when fine, else why: "empty" | "tooLong" | "secret". */
  nameRefusal(typed) {
    const t = String(typed ?? "");
    if (!DisplayName.clean(t)) return [...t.trim()].length > Limits.maxNameLength ? "tooLong" : "empty";
    return looksSecret(t) ? "secret" : null;
  },
  /** Which courses a rename touches: `courses` = [{id, myName}], `only` = a course id or null for all. */
  renamePlan(courses, typed, only = null) {
    const name = DisplayName.clean(typed);
    if (!name) return [];
    return courses.filter(c => (only == null || c.id === only) && c.myName !== name).map(c => c.id);
  },
  /** One line after a rename: results = [{name: course name, ok: bool, taken: bool}]. */
  renameSummary(results, name) {
    const done = results.filter(r => r.ok).length, taken = results.filter(r => r.taken), failed = results.filter(r => !r.ok && !r.taken);
    const parts = [];
    if (done) parts.push(done === 1 && results.length === 1 ? `You’re ${name} now.` : `You’re ${name} in ${done} ${done === 1 ? "course" : "courses"}.`);
    if (taken.length) parts.push(`Someone in ${taken.map(r => r.name).join(", ")} already uses that name — you kept your old one there.`);
    if (failed.length) parts.push(`Couldn’t change it in ${failed.map(r => r.name).join(", ")}. Try again in a minute.`);
    return parts.join(" ") || "Nothing to change.";
  },
  /** A linking code as typed ("abcd-2345") → "ABCD2345", or null. Same letters as invite codes (no 0/O/1/I). */
  pairCode(typed) {
    const c = String(typed ?? "").toUpperCase().replace(/[\s-]/g, "");
    return /^[A-HJ-NP-Z2-9]{8}$/.test(c) ? c : null;
  },
  /** Shown 4-4 so it's easy to read out: "ABCD-2345". */
  pairCodeShown(code) { return code ? `${code.slice(0, 4)}-${code.slice(4)}` : ""; },
  /** The quiet "Make it yours · Profile" line: once, after joining, until opened or dismissed. */
  hintVisible(state, { justJoined, hasLook }) {
    if (state === "done" || hasLook) return false;
    return state === "show" || !!justJoined;
  },
});
