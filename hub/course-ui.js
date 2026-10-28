// Join or start a course on the web page (docs/shared/NEW-COURSE.md) — the Mac's SharedNewCourse.swift, the same steps:
// your school, asked once and remembered on this device; then one field, "What's the course called?". As you type, up to
// 3 courses with that name at your school show under it (find_courses), so you join your classmates instead of making a
// second one; otherwise the button says "Create Algorithms". Number, lecturer, cover and dates come later, in the course.
// Loaded by hub.js; replaces the "Join a course" panel (the invite code is one link inside it).
import { Schools, CourseSearch, findByNameLive } from "./core.js";
import { courseScore, CourseFindCache, CLOSE } from "./coursematch.js";
import { SCHOOLS } from "./schools.js";

const HE = {
  "Where do you study?": "איפה לומדים?", "Asked once, so you find your classmates’ courses.": "שואלים רק פעם אחת, כדי שתמצאו את הקורסים של החברים ללימודים.",
  "Search universities and colleges": "חיפוש אוניברסיטה או מכללה", "Universities": "אוניברסיטאות", "Colleges": "מכללות",
  "My school isn’t here": "המוסד שלי לא ברשימה", "Type its name. Your courses work the same.": "כותבים את השם. הקורסים עובדים בדיוק אותו דבר.",
  "Your school’s name": "שם המוסד", "Use": "בחירה", "What’s the course called?": "איך קוראים לקורס?", "Change": "שינוי",
  "Algorithms, Calculus 2, Contracts…": "אלגוריתמים, חדו״א 2, דיני חוזים…", "Create Course": "יצירת קורס", "Have an invite code?": "יש לך קוד הזמנה?",
  "Your name here": "השם שלך כאן", "Join": "הצטרפות", "Ask to Join": "בקשת הצטרפות", "Join with Code": "הצטרפות עם קוד", "Open": "פתיחה",
  "under 10 students": "פחות מ-10 סטודנטים", "Create a New One": "ליצור קורס חדש בכל זאת", "Open It": "פתיחה", "Ask to Join Instead": "בקשת הצטרפות במקום", "Join Instead": "הצטרפות במקום", "Add the syllabus": "להוסיף את הסילבוס", "Find or start a course instead": "למצוא או לפתוח קורס",
  "Too many searches this hour — you can still create it.": "יותר מדי חיפושים בשעה הזו — עדיין אפשר ליצור אותו.",
  "Couldn’t reach Stash. Check the internet and try again.": "אין חיבור ל-Stash. כדאי לבדוק את האינטרנט ולנסות שוב.",
  "Someone in this course already uses that name. Try another.": "מישהו בקורס כבר משתמש בשם הזה. אפשר לנסות שם אחר.",
};

/* The made-up school's courses for the prototype (the Mac's PretendSharedBackend.demoCourses). */
const DEMO = [
  { name: "Algorithms", course_code: "CS 2041", instructor: "Prof. Levin", cover: 4, people: "10+", join_policy: "open", find_token: "demo-alg" },
  { name: "Algorithms 2", course_code: "CS 3042", instructor: "Dr. Cohen", cover: 5, people: "50+", join_policy: "open", find_token: "demo-alg2" },
  { name: "Algorithmic Game Theory", course_code: "CS 4410", instructor: "Prof. Nir", cover: 9, people: "under 10", join_policy: "request", needs_approval: true, find_token: "demo-agt" },
  { name: "Calculus 2", course_code: "MATH 1102", instructor: "Dr. Shapira", cover: 8, people: "50+", join_policy: "open", find_token: "demo-calc2" },
  { name: "Linear Algebra 1", course_code: "MATH 1201", instructor: "Dr. Mor", cover: 0, people: "50+", join_policy: "open", find_token: "demo-lin" },
];

export function startCourses(hub) {
  const { S, esc, ic, say, render, openPanel, closeAll, head, $, store } = hub;
  const he = hub.lang === "he", T = s => (he ? HE[s] ?? s : s);
  const cache = new CourseFindCache();
  let school = Schools.restore(SCHOOLS, store.get("school", null));
  let found = [], duplicate = null, searching = false, limited = false, timer = 0, asked = 0, editingName = false, typed = null, hi = 0, findable = true;

  const style = document.createElement("style");
  style.textContent = `
  .nc { padding-top:2px; }
  .nc-sub { margin:0 0 16px; color:var(--ink2); font-size:14px; line-height:1.45; }
  .nc-sub .linkbtn, .nc-line .linkbtn { margin-inline-start:6px; }
  .linkbtn { border:0; background:none; padding:0; font:500 13px/1.3 var(--font); color:var(--ink2); text-decoration:underline; text-decoration-color:var(--hair-strong); text-underline-offset:3px; cursor:pointer; }
  .linkbtn:hover { color:var(--ink); }
  .nc-search { display:flex; align-items:center; gap:8px; height:44px; padding:0 12px; border-radius:12px; background:var(--sheet); box-shadow:0 0 0 1px var(--hair-strong); transition:box-shadow .15s var(--ease-out); }
  .nc-search:focus-within { box-shadow:0 0 0 1.5px var(--focus), 0 0 0 5px color-mix(in srgb, var(--focus) 18%, transparent); }
  .nc-search .i { color:var(--ink2); flex:none; }
  .nc-search input { flex:1; min-width:0; border:0; outline:0; background:none; font:400 16px/1.3 var(--font); color:var(--ink); }
  .nc-search small { color:var(--ink2); font-size:12px; white-space:nowrap; }
  .nc-list { margin-top:4px; max-height:min(52vh, 420px); overflow:auto; padding:0 1px 4px; overscroll-behavior:contain; }
  .nc-h { margin:16px 12px 6px; font:500 12px/1.2 var(--font); color:var(--ink2); }
  .nc-group { border-radius:12px; background:var(--sheet); box-shadow:0 0 0 1px var(--hair); overflow:hidden; }
  .nc-row { position:relative; display:flex; align-items:center; gap:12px; width:100%; min-height:48px; padding:7px 14px; border:0; background:none; text-align:start; color:var(--ink); cursor:pointer; font:inherit; }
  .nc-row + .nc-row::before { content:""; position:absolute; top:0; inset-inline:14px 0; height:1px; background:var(--hair); }
  .nc-row.thumbed + .nc-row::before { inset-inline-start:72px; }
  .nc-row[data-hi="1"], .nc-row:hover { background:var(--well); }
  .nc-row[data-hi="1"]::before, .nc-row[data-hi="1"] + .nc-row::before, .nc-row:hover::before, .nc-row:hover + .nc-row::before { opacity:0; }
  .nc-row:active { background:color-mix(in srgb, var(--well) 70%, var(--hair-strong)); }
  .nc-tx { flex:1; min-width:0; }
  .nc-tx b, .nc-tx span { display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .nc-tx b { font:400 14px/1.35 var(--font); } .nc-row.thumbed .nc-tx b { font-weight:500; }
  .nc-tx span { font-size:12px; line-height:1.35; color:var(--ink2); }
  .nc-tx mark { background:none; color:inherit; font-weight:600; text-decoration:underline; text-decoration-color:var(--focus); text-decoration-thickness:1.5px; text-underline-offset:3px; }
  .nc-tick { flex:none; width:20px; height:20px; border-radius:50%; background:var(--primary); display:grid; place-items:center; animation:ncTick .28s var(--spring); }
  .nc-tick::after { content:""; width:5px; height:9px; border:solid var(--on-primary); border-width:0 1.8px 1.8px 0; transform:translateY(-1px) rotate(45deg); }
  @keyframes ncTick { from { transform:scale(.6); opacity:0; } }
  .nc-plus { flex:none; width:26px; height:26px; border-radius:7px; border:1px dashed var(--hair-strong); display:grid; place-items:center; color:var(--ink2); }
  .nc-typed { display:flex; gap:8px; padding:8px; } .nc-typed .input { flex:1; min-width:0; }
  .nc-big { width:100%; height:56px; padding:0 16px; border:0; outline:0; border-radius:12px; background:var(--sheet); color:var(--ink); font:400 20px/1.2 var(--font);
    box-shadow:0 0 0 1px var(--hair-strong); transition:box-shadow .15s var(--ease-out); }
  .nc-big:focus { box-shadow:0 0 0 1.5px var(--focus), 0 0 0 5px color-mix(in srgb, var(--focus) 18%, transparent); }
  .nc-found { margin-top:16px; animation:ncIn .32s var(--ease-out); } .nc-found .nc-h { margin-top:0; }
  @keyframes ncIn { from { opacity:0; transform:translateY(-4px); } }
  .nc-found .btn { flex:none; height:32px; }
  .nc-ins { font-style:normal; }
  .nc-row .thumb { position:relative; flex:none; width:44px; height:30px; border-radius:6px; overflow:hidden; background:var(--paper); box-shadow:0 0 0 1px var(--hair); }
  .nc-row .thumb img { position:absolute; width:180px; height:60px; max-width:none; }
  .nc-looking { display:flex; align-items:center; gap:8px; margin:14px 12px 0; color:var(--ink2); font-size:12px; }
  .nc-looking i { width:12px; height:12px; border-radius:50%; background:conic-gradient(var(--ink2) 0 25%, transparent 0); -webkit-mask:radial-gradient(circle, transparent 4px, #000 4.5px); mask:radial-gradient(circle, transparent 4px, #000 4.5px); animation:ncSpin .9s linear infinite; }
  @keyframes ncSpin { to { transform:rotate(1turn); } }
  .nc-line { display:flex; align-items:center; gap:10px; margin-top:16px; font-size:13px; color:var(--ink2); }
  .nc-line .input { max-width:220px; min-height:36px; }
  .nc-find { justify-content:space-between; color:var(--ink); }
  .nc-sw { position:relative; flex:none; width:38px; height:22px; border:0; padding:0; border-radius:11px; background:var(--well); box-shadow:inset 0 0 0 1px var(--hair-strong); cursor:pointer; transition:background .2s; }
  .nc-sw::after { content:""; position:absolute; top:2px; inset-inline-start:2px; width:18px; height:18px; border-radius:50%; background:#fff; box-shadow:0 1px 2px rgba(0,0,0,.25); transition:inset-inline-start .3s var(--spring); }
  .nc-sw[aria-checked="true"] { background:var(--primary); box-shadow:none; } .nc-sw[aria-checked="true"]::after { inset-inline-start:18px; background:var(--on-primary); }
  .nc-dup { display:flex; gap:12px; margin-top:18px; padding:14px; border-radius:12px; background:var(--sheet); box-shadow:0 0 0 1.5px color-mix(in srgb, var(--focus) 55%, transparent); animation:ncIn .32s var(--ease-out); }
  .nc-dup .thumb { position:relative; flex:none; width:44px; height:30px; border-radius:6px; overflow:hidden; background:var(--paper); box-shadow:0 0 0 1px var(--hair); }
  .nc-dup .thumb img { position:absolute; width:180px; height:60px; max-width:none; }
  .nc-dup b { white-space:normal; font-weight:500; } .nc-dup-acts { display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; }
  .nc-err { margin:12px 0 0; color:var(--red); font-size:13px; }
  .nc .p-foot { padding-inline:0; }
  .nc-foot { display:flex; align-items:center; gap:10px; margin-top:22px; } .nc-foot .grow { flex:1; }
  .nc-foot .btn.primary { max-width:320px; overflow:hidden; text-overflow:ellipsis; }
  @media (max-width:699px) {
    .nc-row { min-height:56px; padding:9px 16px; } .nc-ins { display:none; } .nc-tx b { font-size:17px; } .nc-tx span { font-size:13px; }
    .nc-search { height:48px; } .nc-search input { font-size:17px; }
    .nc-list { max-height:calc(100dvh - 300px); }
    .nc-foot { position:sticky; bottom:0; padding:12px 0 calc(8px + env(safe-area-inset-bottom)); background:linear-gradient(transparent, var(--sheet) 30%); flex-wrap:wrap; }
    .nc-foot .btn.primary { flex:1 1 100%; max-width:none; height:50px; font-size:17px; border-radius:12px; order:-1; justify-content:center; }
  }
  @media (prefers-reduced-motion: reduce) { .nc-tick, .nc-found { animation:none; } .nc-sw::after { transition:none; } }`;
  document.head.append(style);

  const myName = () => store.get("liveName", "") || (hub.LIVE ? "" : hub.myNameHere());
  /** "Bar-Ilan University" / "אוניברסיטת בר-אילן"; in Hebrew without a leading ה so "ב" + it reads right. */
  const phrase = () => { const n = school?.school ? (he ? school.school.he : school.school.en) : school?.name ?? ""; return he && n.startsWith("ה") ? n.slice(1) : n; };
  const at = () => (he ? `ב${phrase()}` : `at ${phrase()}`);
  const hl = (text, q) => {
    const lo = text.toLowerCase(), ql = String(q || "").trim().toLowerCase(); if (!ql) return esc(text);
    for (let k = lo.indexOf(ql); k >= 0; k = lo.indexOf(ql, k + 1))
      if (k === 0 || /[\s\-–]/.test(lo[k - 1])) return esc(text.slice(0, k)) + "<mark>" + esc(text.slice(k, k + ql.length)) + "</mark>" + esc(text.slice(k + ql.length));
    return esc(text);
  };
  const people = b => (b === "under 10" ? T("under 10 students") : he ? `${b} סטודנטים` : `${b} students`);
  const action = c => T(c.already_member ? "Open" : c.join_policy === "code" ? "Join with Code" : c.needs_approval || c.join_policy === "request" ? "Ask to Join" : "Join");

  // ——— where do you study? ———
  function schoolStep() {
    typed = null; hi = 0;
    openPanel(`${head(T("Where do you study?"))}<div class="p-body nc"><p class="nc-sub">${T("Asked once, so you find your classmates’ courses.")}</p>
      <label class="nc-search">${ic("search", "s")}<input id="nc-q" dir="auto" type="text" inputmode="search" autocomplete="off" spellcheck="false" enterkeyhint="go"
        placeholder="${esc(T("Search universities and colleges"))}" aria-label="${esc(T("Search universities and colleges"))}"><small id="nc-n"></small></label>
      <div class="nc-list" id="nc-list"></div></div>`,
      { w: 520, label: T("Where do you study?"), onMount: () => { drawSchools(); $("#nc-q")?.focus(); } });
  }
  function drawSchools() {
    const q = $("#nc-q")?.value ?? "", list = Schools.search(SCHOOLS, q);
    hi = Math.min(hi, Math.max(0, list.length - 1));
    $("#nc-n").textContent = q.trim() ? (he ? `נמצאו ${list.length}` : `${list.length} found`) : "";
    const row = (s, i) => `<button class="nc-row" data-act="nc-school" data-id="${s.id}" data-hi="${i === hi ? 1 : 0}"${school?.school?.id === s.id ? ' aria-current="true"' : ""}>
      <span class="nc-tx"><b>${hl(he ? s.he : s.en, q)}</b><span lang="${he ? "en" : "he"}" dir="auto">${esc(he ? s.en : s.he)}</span></span>${school?.school?.id === s.id ? '<span class="nc-tick" aria-hidden="true"></span>' : ""}</button>`;
    const uni = list.filter(s => s.kind === "university"), col = list.filter(s => s.kind === "college");
    const group = (title, arr, from) => arr.length ? `<div class="nc-h">${T(title)}</div><div class="nc-group">${arr.map((s, i) => row(s, from + i)).join("")}</div>` : "";
    const other = typed != null
      ? `<div class="nc-group nc-typed"><input class="input" id="nc-typed" maxlength="80" value="${esc(typed)}" placeholder="${esc(T("Your school’s name"))}" aria-label="${esc(T("Your school’s name"))}">
          <button class="btn primary" data-act="nc-typed">${T("Use")}</button></div>`
      : `<div class="nc-group"><button class="nc-row" data-act="nc-other"><span class="nc-plus" aria-hidden="true">${ic("plus", "s")}</span>
          <span class="nc-tx"><b>${T("My school isn’t here")}</b><span>${T("Type its name. Your courses work the same.")}</span></span></button></div>`;
    $("#nc-list").innerHTML = group("Universities", uni, 0) + group("Colleges", col, uni.length) + `<div style="margin-top:14px">${other}</div>`;
    $("#nc-list").querySelector('[data-hi="1"]')?.scrollIntoView({ block: "nearest" });
  }
  function choose(c) {
    school = c; store.set("school", Schools.stored(c)); found = []; limited = false;
    courseStep();
  }

  // ——— what's the course called? ———
  function courseStep(keep = "") {
    openPanel(`${head(T("What’s the course called?"))}<div class="p-body nc"><p class="nc-sub" id="nc-at">${esc(at())}<button class="linkbtn" data-act="nc-change">${T("Change")}</button></p>
      <input class="nc-big" id="nc-name" dir="auto" maxlength="60" autocomplete="off" enterkeyhint="done" value="${esc(keep)}"
        placeholder="${esc(T("Algorithms, Calculus 2, Contracts…"))}" aria-label="${esc(T("What’s the course called?"))}">
      <div id="nc-results" aria-live="polite"></div><div id="nc-extra"></div><div id="nc-dup"></div>
      <div class="nc-foot"><button class="btn quiet" data-act="nc-code" style="padding:0">${T("Have an invite code?")}</button><span class="grow"></span>
        <button class="btn primary" data-act="nc-create" id="nc-create" disabled>${T("Create Course")}</button></div></div>`,
      { w: 520, label: T("What’s the course called?"), onMount: () => { drawCourse(); $("#nc-name")?.focus(); } });
  }
  const nameNow = () => String($("#nc-name")?.value ?? "").split(/\s+/).filter(Boolean).join(" ");
  const shown = () => (nameNow().length >= CourseSearch.minimumLetters ? found.slice(0, CourseFindCache.shown) : []);
  const canBeFound = () => Schools.serverID(school) != null && findByNameLive;
  function drawCourse() {
    const n = nameNow(), list = shown(), r = $("#nc-results"); if (!r) return;
    r.innerHTML = list.length
      ? `<div class="nc-found"><div class="nc-h">${he ? `כבר קיימים ב${esc(phrase())}` : `Already ${esc(at())}`}</div><div class="nc-group">${list.map((c, i) =>
          `<div class="nc-row thumbed" style="cursor:default">${hub.thumb((c.cover ?? 0) % 10)}<span class="nc-tx"><b>${esc(c.name)}</b>
            <span>${esc(c.course_code || "")}${c.instructor ? `<i class="nc-ins"> · ${esc(c.instructor)}</i>` : ""}${c.course_code || c.instructor ? " · " : ""}${esc(people(c.people))}</span></span>
            <button class="btn" data-act="nc-join" data-i="${i}">${action(c)}</button></div>`).join("")}</div></div>`
      : searching ? `<div class="nc-looking"><i aria-hidden="true"></i>${he ? `מחפשים ב${esc(phrase())}…` : `Looking ${esc(at())}…`}</div>` : "";
    const me = myName();
    $("#nc-extra").innerHTML = (canBeFound() ? `<div class="nc-line nc-find"><span>${he ? `חברים ללימודים ב${esc(phrase())} יוכלו למצוא אותו לפי השם` : `Classmates ${esc(at())} can find it by its name`}</span>
        <button class="nc-sw" role="switch" aria-checked="${findable}" data-act="nc-findable" aria-label="${esc(he ? "אפשר למצוא אותו" : "Can be found")}"></button></div>` : "")
      + (editingName || !me
        ? `<div class="nc-line"><label for="nc-me">${T("Your name here")}</label><input class="input" id="nc-me" maxlength="40" value="${esc(me)}" autocomplete="given-name"></div>`
        : `<div class="nc-line">${he ? `תופיעו בשם ${esc(me)}` : `You’ll show as ${esc(me)}`}<button class="linkbtn" data-act="nc-rename">${T("Change")}</button></div>`)
      + (limited ? `<p class="nc-err" style="color:var(--ink2)">${T("Too many searches this hour — you can still create it.")}</p>` : "");
    // Create was pressed, but this course is already here: join the classmates in it instead.
    const d = duplicate;
    $("#nc-dup").innerHTML = d ? `<div class="nc-dup" role="alert">${hub.thumb((d.cover ?? 0) % 10)}<div class="nc-tx">
        <b>${he ? `הקורס „<bdi>${esc(d.name)}</bdi>” כבר קיים ב${esc(phrase())}` : `“${esc(d.name)}” is already ${esc(at())}`}</b>
        <span>${esc([d.course_code, d.instructor, people(d.people)].filter(Boolean).join(" · "))}</span>
        <div class="nc-dup-acts"><button class="btn primary" data-act="nc-instead">${T(d.already_member ? "Open It" : d.needs_approval || d.join_policy === "request" ? "Ask to Join Instead" : "Join Instead")}</button>
          <button class="btn" data-act="nc-anyway">${T("Create a New One")}</button></div></div></div>` : "";
    const b = $("#nc-create");
    b.style.display = d ? "none" : "";
    b.textContent = n ? (he ? `יצירת „${n}”` : `Create “${n}”`) : T("Create Course");
    b.disabled = !n || !(editingName ? String($("#nc-me")?.value ?? "").trim() : me);
  }
  function look() {
    clearTimeout(timer);
    const q = nameNow(), u = Schools.serverID(school) ?? (hub.LIVE ? null : 0);
    if (u == null || limited || !CourseSearch.canSearch(u, q)) { found = []; searching = false; return drawCourse(); }
    const known = cache.answer(q); if (known) { found = known; searching = false; return drawCourse(); }
    const mine = ++asked;
    found = found.filter(c => courseScore(q, c.name) > 0);   // while asking, only what still fits
    drawCourse();
    timer = setTimeout(async () => {
      searching = true; drawCourse();
      try {
        const rows = hub.LIVE ? await hub.hooks.findCourses(u, q) : await demoFind(q);
        if (mine !== asked) return;
        if (rows?.[0]?.status === "too_many_tries") { limited = true; found = []; }
        else { const cards = (rows ?? []).filter(x => x.status === "ok" || !hub.LIVE); cache.store(q, cards); found = cards; }
      } catch { if (mine === asked) found = []; }
      if (mine === asked) { searching = false; drawCourse(); }
    }, 450);
  }
  /** The made-up school, by the server's rules (coursematch.js = find_courses): exact number, then the score. */
  async function demoFind(q) {
    await new Promise(r => setTimeout(r, 380));
    const code = s => String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    return DEMO.map(c => ({ c, s: code(q) && code(c.course_code) === code(q) ? 1000 : courseScore(q, c.name) })).filter(x => x.s > 0)
      .sort((a, b) => b.s - a.s || (a.c.name < b.c.name ? -1 : 1)).slice(0, 8).map(({ c, s }) => ({ ...c, status: "ok", close: s >= CLOSE }));
  }

  const failText = e => (e && hub.hooks.failText?.(e)) || T("Couldn’t reach Stash. Check the internet and try again.");
  function err(text) { let p = $(".nc .nc-err.bad"); if (!p) { p = document.createElement("p"); p.className = "nc-err bad"; p.setAttribute("role", "alert"); $("#nc-extra")?.after(p); } p.textContent = text; }
  function nameToUse() { const v = editingName ? String($("#nc-me")?.value ?? "").trim() : myName(); if (v) store.set("liveName", v); return v; }

  async function create(anyway = false) {
    const dup = !anyway && !duplicate && shown().find(c => c.close);
    if (dup) { duplicate = dup; drawCourse(); return $('[data-act="nc-instead"]')?.focus(); }
    duplicate = null;
    const name = nameNow(), me = nameToUse(), b = $("#nc-create"); if (!name || !me || (b.disabled && !anyway)) return;
    b.disabled = true; b.setAttribute("aria-busy", "true");
    try {
      if (hub.LIVE) {
        const made = await hub.hooks.createCourse(name, me, Schools.serverID(school), canBeFound() && findable);
        if (!made?.space_id) throw new Error("no answer");
        await hub.hooks.arrive(made.space_id);
      } else {
        const id = "new-" + Date.now().toString(36);
        S.courses.push({ id, shelf: null, name, code: "", term: "", uni: phrase(), cover: Math.floor(Math.random() * 10), people: 1, names: [], invite: "N3W4CS",
          week: 1, lastVisit: "", owner: me, myName: me, myRole: "owner", here: [], items: [], files: [], weekTitles: {} });
        S.current = id; store.set("course", id); closeAll(true); history.replaceState(null, "", `?c=${id}`); render();
      }
      // The one optional next step: the syllabus fills in the exams and deadlines (each one checked first).
      say(`<span>${ic("check", "s")}</span><span>${esc(name)} ${he ? "מוכן." : "is ready."}</span>${hub.dates ? `<button class="linkbtn" data-act="nc-syllabus">${he ? "להוסיף את הסילבוס — התאריכים יתמלאו לבד" : "Add the syllabus — dates fill in by themselves"}</button>` : ""}`, 9000);
    } catch (e) { b.disabled = false; b.removeAttribute("aria-busy"); err(failText(e)); }
  }

  async function join(c, btn) {
    const me = nameToUse(); if (!me) { editingName = true; drawCourse(); return $("#nc-me")?.focus(); }
    if (c.already_member) { const s = S.courses.find(x => x.name === c.name); if (s) { S.current = s.id; closeAll(true); render(); } return; }
    btn.disabled = true; btn.setAttribute("aria-busy", "true");
    try {
      const r = hub.LIVE ? await hub.hooks.joinFound(c.find_token, me) : { status: c.needs_approval ? "requested" : "joined" };
      cache.spend(c.find_token);
      if (r?.status === "requested") { closeAll(); say(`<span>${ic("check", "s")}</span><span>${he ? "ביקשת להצטרף. תיכנסו כשהבעלים יאשרו." : "Asked to join. You’ll be in once the owner says yes."}</span>`, 6000); return; }
      if (r?.status === "joined" || r?.status === "already") {
        if (hub.LIVE) return hub.hooks.arrive(r.space_id);
        const id = "found-" + c.find_token;
        if (!S.courses.some(x => x.id === id)) S.courses.push({ id, shelf: null, name: c.name, code: c.course_code || "", term: "", uni: phrase(), cover: c.cover ?? 0,
          people: 12, names: [], invite: "K7Q4MZ", week: 6, lastVisit: "", owner: "Maya", myName: me, here: [], items: [], files: [], weekTitles: {} });
        S.current = id; S.welcome = true; closeAll(true); render(); return;
      }
      btn.disabled = false; btn.removeAttribute("aria-busy");
      err(r?.status === "name_taken" ? T("Someone in this course already uses that name. Try another.") : failText());
      look();
    } catch (e) { btn.disabled = false; btn.removeAttribute("aria-busy"); err(failText(e)); }
  }

  // ——— events (inside these panels only) ———
  document.addEventListener("input", e => {
    if (e.target.id === "nc-q") { hi = 0; drawSchools(); }
    else if (e.target.id === "nc-name") { duplicate = null; drawCourse(); look(); }
    else if (e.target.id === "nc-me") drawCourse();
    else if (e.target.id === "nc-typed") { typed = e.target.value; }
  });
  document.addEventListener("keydown", e => {
    if (e.target.id === "nc-q") {
      const rows = [...document.querySelectorAll('#nc-list [data-act="nc-school"]')];
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); hi = Math.max(0, Math.min(rows.length - 1, hi + (e.key === "ArrowDown" ? 1 : -1))); drawSchools(); }
      if (e.key === "Enter" && rows[hi]) { e.preventDefault(); rows[hi].click(); }
    } else if (e.target.id === "nc-name" && e.key === "Enter") { e.preventDefault(); if (!shown().length) create(); }
    else if (e.target.id === "nc-typed" && e.key === "Enter") { e.preventDefault(); $('[data-act="nc-typed"]')?.click(); }
    else if (e.target.id === "nc-me" && e.key === "Enter") { e.preventDefault(); editingName = false; nameToUse(); drawCourse(); }
  });
  document.addEventListener("click", e => {
    const a = e.target.closest("[data-act^='nc-']"); if (!a) return;
    switch (a.dataset.act) {
      case "nc-school": return choose({ school: SCHOOLS.find(s => s.id === Number(a.dataset.id)) });
      case "nc-other": typed = $("#nc-q")?.value ?? ""; drawSchools(); return $("#nc-typed")?.focus();
      case "nc-typed": { const n = Schools.clean($("#nc-typed")?.value); if (n) choose({ name: n }); else $("#nc-typed")?.focus(); return; }
      case "nc-change": return schoolStep();
      case "nc-code": return hub.openCode();
      case "nc-create": return create();
      case "nc-anyway": return create(true);
      case "nc-instead": return duplicate && join(duplicate, a);
      case "nc-join": return join(shown()[Number(a.dataset.i)], a);
      case "nc-rename": editingName = true; drawCourse(); return $("#nc-me")?.focus();
      case "nc-findable": findable = !findable; return a.setAttribute("aria-checked", String(findable));
      case "nc-syllabus": return hub.dates?.open();
    }
  });

  hub.newCourse = { open: () => (school ? courseStep() : schoolStep()), findWords: T("Find or start a course instead"), schoolStep, courseStep };
}
