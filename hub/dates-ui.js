// The course fills itself in (docs/shared/SYLLABUS.md): a syllabus (PDF or Word), a calendar file or link, or a pasted list
// → "Here's what I found" — the weekly classes, every exam and deadline, the teaching staff, the grade breakdown, the
// reading and links — a tick per row, each date editable → Add. Nothing is ever added by itself. Rules: syllabus.js Syllabus
// (twin: StashCore SharedSyllabus.swift; cases test/syllabus-cases.json); PDF words: pdftext.js, Word: DocxText — all on
// the device. Saving (the owner and helpers): dates → the course calendar (import_events), people and links → Course info
// (set_info), the grade breakdown + reading → one note. Photos are read by the Mac app (Vision); here they get a hint.
import { DateImport, ICSImport } from "./core.js";
let SY = null;   // syllabus.js: loaded the first time a syllabus is read (it keeps the page's first load small)
const syllabus = async () => (SY ??= await import("./syllabus.js"));
import { PDFText } from "./pdftext.js";

const HE = {
  "Add the course dates": "הוספת תאריכי הקורס", "Add dates…": "הוספת תאריכים…",
  "Stash finds the exams, deadlines and class times. You check each one before anything is added.": "Stash מוצא מבחנים, הגשות ושעות שיעור. בודקים כל אחד לפני שמשהו נוסף.",
  "Syllabus": "סילבוס", "Calendar": "יומן", "Paste a list": "הדבקת רשימה", "Choose the syllabus (PDF)": "בחירת הסילבוס (PDF)",
  "Choose a calendar file (.ics)": "בחירת קובץ יומן (‎.ics)", "or paste the calendar link": "או להדביק את הקישור ליומן", "Get": "הבאה",
  "Paste the dates — one per line, the way the lecturer wrote them.": "להדביק את התאריכים — אחד בכל שורה, כמו שהמרצה כתב.",
  "Find dates": "חיפוש תאריכים", "Reading": "קורא את", "Every week": "כל שבוע", "Dates": "תאריכים", "Not now": "לא עכשיו",
  "Review": "לבדיקה", "Add": "הוספה", "Edit": "עריכה", "Done": "סיום", "Remove": "הסרה", "What": "מה", "Day": "יום", "Time": "שעה",
  "Where": "איפה", "Leave empty for all day": "ריק = כל היום", "Copy the list": "העתקת הרשימה", "Copied.": "הועתק.",
  "Tick what’s right. Nothing is added until you tap Add.": "מסמנים מה נכון. שום דבר לא נוסף עד שמקישים הוספה.",
  "No dates found in": "לא נמצאו תאריכים ב", "No dates found.": "לא נמצאו תאריכים.", "Try pasting them instead.": "אפשר להדביק אותם במקום.",
  "This PDF has no words to read (a scan?). Paste the dates instead.": "ב-PDF הזה אין מילים לקרוא (סריקה?). אפשר להדביק את התאריכים במקום.",
  "This calendar’s site doesn’t let a web page read it. Download the .ics file, then choose it here.": "האתר של היומן לא מאפשר לדף אינטרנט לקרוא אותו. אפשר להוריד את קובץ ה-‎.ics ולבחור אותו כאן.",
  "Couldn’t add the dates. Try again in a minute.": "לא הצלחנו להוסיף את התאריכים. כדאי לנסות שוב בעוד דקה.",
  "Only the course owner and helpers can add dates. Copy the list and send it to them.": "רק מנהלי הקורס יכולים להוסיף תאריכים. אפשר להעתיק את הרשימה ולשלוח להם.",
  "Add the exam and class dates": "הוספת תאריכי המבחנים והשיעורים", "From the syllabus, a calendar or a list": "מהסילבוס, מיומן או מרשימה",
  "in": "ב", "Found": "נמצאו", "dates": "תאריכים", "date": "תאריך", "your note": "הפתק שלך",
  "Exam": "מבחן", "Due": "הגשה", "Class": "שיעור", "Other": "אחר",
  "People": "צוות הקורס", "Grading": "הרכב הציון", "How the grade is made": "איך הציון מורכב", "Reading": "קריאה", "Links": "קישורים",
  "Required": "חובה", "Recommended": "רשות", "Choose the syllabus (PDF or Word)": "בחירת הסילבוס (PDF או Word)",
  "The grade breakdown and the reading go into one note everyone in the course sees.": "הרכב הציון והקריאה נשמרים בפתק אחד שכל הקורס רואה.",
  "Photos of a syllabus are read by the Stash app on a Mac. Here, choose the PDF or Word file, or paste the text.": "צילומים של סילבוס נקראים באפליקציית Stash במק. כאן אפשר לבחור את קובץ ה-PDF או ה-Word, או להדביק את הטקסט.",
  "Nothing to add found in": "לא נמצא מה להוסיף ב", "Added": "נוספו", "to the course": "לקורס",
};
const PENCIL = '<svg class="i s" viewBox="0 0 20 20" aria-hidden="true"><path d="M13.5 3.5l3 3L7 16H4v-3z"/><path d="M11.5 5.5l3 3"/></svg>';
const TICK = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 10.5l3.5 3.5 7.5-8"/></svg>';

export function startDates(hub) {
  const { S, esc, ic, say, render, course, openPanel, closeAll, head, $, phone } = hub;
  const he = hub.lang === "he", T = s => (he ? HE[s] ?? s : s), lang = he ? "he" : "en";
  const tz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return undefined; } })();
  const canAdd = c => !hub.LIVE || ["owner", "helper"].includes(c?.myRole);
  const addWord = n => (n ? (he ? `הוספת ${n}` : `Add ${n}`) : T("Add"));
  const kindWord = k => T(k === "exam" ? "Exam" : k === "deadline" ? "Due" : k === "other" ? "Other" : "Class");
  let R = null;   // the review: { c, found, from, editing }

  const style = document.createElement("style");
  style.textContent = `
  .dates-ways .way { min-height:86px; }
  .dates-intro { margin:0 0 14px; color:var(--ink2); font-size:14px; line-height:1.45; }
  .dates-link { display:flex; gap:8px; margin-top:10px; } .dates-link .input { flex:1; min-width:0; }
  .dates-err { margin:12px 0 0; color:var(--ink2); font-size:13px; line-height:1.45; }
  .dates-reading { display:flex; align-items:center; gap:10px; padding:26px 2px; color:var(--ink2); font-size:14px; }
  .dates-reading i { width:14px; height:14px; border-radius:50%; box-shadow:inset 0 0 0 2px var(--hair-strong); border-top-color:transparent; animation:drSpin .9s linear infinite;
    background:conic-gradient(var(--ink2) 0 25%, transparent 0); -webkit-mask:radial-gradient(circle, transparent 4.5px, #000 5px); mask:radial-gradient(circle, transparent 4.5px, #000 5px); }
  @keyframes drSpin { to { transform:rotate(1turn); } }
  .dr-from { margin:0 0 6px; color:var(--ink2); font-size:13px; line-height:1.45; }
  .dr-h { margin:16px 0 2px; font:500 12px/1.2 var(--font); color:var(--ink2); }
  .dr-list { margin:0; padding:0; list-style:none; }
  .dr-row { position:relative; display:flex; align-items:center; gap:12px; min-height:56px; padding:8px 0 8px 12px; border-bottom:1px solid var(--hair); }
  [dir="rtl"] .dr-row { padding:8px 12px 8px 0; }
  .dr-row:last-child { border-bottom:0; }
  .dr-row::before { content:""; position:absolute; inset-inline-start:0; top:14px; bottom:14px; width:3px; border-radius:2px; background:var(--hair-strong); }
  .dr-row.k-exam::before { background:var(--coral); } .dr-row.k-deadline::before { background:var(--butter); }
  .dr-row.k-lecture::before, .dr-row.k-tutorial::before { background:var(--sky); }
  .dr-tick { position:relative; flex:none; width:24px; height:24px; }
  .dr-tick input { position:absolute; inset:-10px; width:44px; height:44px; margin:0; opacity:0; cursor:pointer; }
  .dr-tick span { display:grid; place-items:center; width:24px; height:24px; border-radius:7px; box-shadow:inset 0 0 0 1.5px var(--hair-strong); background:var(--paper);
    transition:background .16s var(--ease-out), box-shadow .16s var(--ease-out); pointer-events:none; }
  .dr-tick svg { width:16px; height:16px; fill:none; stroke:var(--on-primary); stroke-width:2.2; stroke-linecap:round; stroke-linejoin:round; opacity:0; transform:scale(.6);
    transition:opacity .14s var(--ease-out), transform .2s var(--spring); }
  .dr-tick input:checked + span { background:var(--primary); box-shadow:none; }
  .dr-tick input:checked + span svg { opacity:1; transform:none; }
  .dr-tick input:focus-visible + span { box-shadow:0 0 0 2px var(--focus); }
  .dr-txt { flex:1; min-width:0; }
  .dr-txt b { display:block; font:500 15px/1.3 var(--font); overflow-wrap:anywhere; }
  .dr-txt span { display:block; margin-top:2px; font:400 13px/1.35 var(--font); color:var(--ink2); overflow-wrap:anywhere; }
  .dr-row.off .dr-txt { opacity:.5; }
  .dr-ed { flex:none; display:grid; place-items:center; width:40px; height:40px; margin-inline-end:-8px; border:0; border-radius:10px; background:none; color:var(--ink2); }
  .dr-ed:hover { background:var(--well); color:var(--ink); } .dr-ed svg { width:18px; height:18px; fill:none; stroke:currentColor; stroke-width:1.5; stroke-linejoin:round; }
  .dr-form { flex:1; min-width:0; padding:2px 0 6px; } .dr-form > .field:first-child { margin-top:2px; } .dr-2 .field { margin-top:14px; }
  .dr-2 { display:grid; grid-template-columns:1.3fr 1fr; gap:10px; }
  .dr-form-b { display:flex; justify-content:space-between; gap:8px; margin-top:14px; }
  .dr-foot-note { flex:1; margin:0; font-size:12.5px; line-height:1.4; color:var(--ink2); }
  .ess-add { position:relative; z-index:2; display:flex; align-items:center; gap:12px; width:calc(100% - 8px); margin:-42px 4px 0; padding:14px; border:0; border-radius:14px;
    background:var(--sheet); box-shadow:0 2px 8px rgba(32,36,39,.07), 0 0 0 1px var(--hair); color:var(--ink); text-align:start; font:inherit; }
  .ess-add:active { transform:scale(.985); }
  .dr-bar { display:flex; gap:2px; width:min(260px, 100%); height:4px; margin-top:7px; }
  .dr-bar i { display:block; flex:none; height:4px; border-radius:2px; background:var(--ink); opacity:.55; } .dr-bar i:nth-child(even) { opacity:.28; }
  .dr-note { margin:14px 0 2px; font-size:12.5px; line-height:1.4; color:var(--ink2); }
  .dr-row.k-person::before, .dr-row.k-grades::before, .dr-row.k-reading::before, .dr-row.k-link::before { background:var(--hair-strong); }
  .ess-add .ic { display:grid; place-items:center; flex:none; width:36px; height:36px; border-radius:10px; background:var(--well); }
  .ess-add b { display:block; font:500 15px/1.3 var(--font); } .ess-add small { display:block; margin-top:2px; font-size:12.5px; color:var(--ink2); }
  @media (prefers-reduced-motion:reduce) { .dr-tick span, .dr-tick svg { transition:none; } .dates-reading i { animation:none; } }`;
  document.head.append(style);

  const pickPDF = Object.assign(document.createElement("input"), { type: "file", hidden: true,
    accept: "application/pdf,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,.txt,.md,.ics,text/calendar,image/*" });
  const pickICS = Object.assign(document.createElement("input"), { type: "file", hidden: true, accept: ".ics,text/calendar" });
  document.body.append(pickPDF, pickICS);
  for (const inp of [pickPDF, pickICS]) inp.addEventListener("change", () => { const f = inp.files?.[0]; inp.value = ""; if (f) fromFile(course(), f); });

  // ——— finding ———
  const read = async text => (await syllabus()).Syllabus.read(text, { now: new Date(), timeZone: tz, termStarts: course()?.termStarts ?? null });
  const findICS = text => DateImport.fromEvents(ICSImport.parse(text, tz).events, { now: new Date(), timeZone: tz });
  const isICS = f => /\.ics$/i.test(f.name) || f.type === "text/calendar";
  const isPDF = f => /\.pdf$/i.test(f.name) || f.type === "application/pdf";
  const isDocx = f => /\.docx$/i.test(f.name) || f.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const isPhoto = f => /^image\//.test(f.type) || /\.(png|jpe?g|heic|heif|webp)$/i.test(f.name);
  /** {found, syl?, scan?, photo?}: a calendar gives dates only; a syllabus everything it says. */
  async function readFile(f) {
    if (isICS(f)) return { found: f.size <= 2_000_000 ? findICS(await f.text()) : [] };
    const whole = async text => { const syl = await read(text); return { found: syl.dates, syl }; };
    if (isPDF(f)) { const text = await PDFText.read(await f.arrayBuffer()); return text ? whole(text) : { found: [], scan: true }; }
    if (isDocx(f)) { const text = await (await syllabus()).DocxText.read(await f.arrayBuffer()); return text ? whole(text) : { found: [] }; }
    if (/^text\//.test(f.type) || /\.(txt|md)$/i.test(f.name)) return whole((await f.text()).slice(0, DateImport.maxText));
    if (isPhoto(f)) return { found: [], photo: true };
    return { found: [] };
  }
  const anything = r => r.found.length > 0 || (r.syl && SY.SyllabusWords.count(r.syl) > 0);
  async function fromFile(c, f) {
    if (!c) return;
    reading(f.name);
    const r = await readFile(f).catch(() => ({ found: [] }));
    if (anything(r)) review(c, r.found, f.name.replace(/\.[a-z0-9]{1,5}$/i, ""), r.syl);
    else open(null, r.photo ? T("Photos of a syllabus are read by the Stash app on a Mac. Here, choose the PDF or Word file, or paste the text.")
      : r.scan ? T("This PDF has no words to read (a scan?). Paste the dates instead.") : `${T("No dates found in")} ${f.name}. ${T("Try pasting them instead.")}`, "paste");
  }
  /** At most `max` bytes of a response, read as it arrives (a huge or endless calendar never fills the phone's memory). */
  async function readCapped(res, max) {
    if (+res.headers.get("content-length") > max * 2) return "";
    const reader = res.body?.getReader(); if (!reader) return (await res.text()).slice(0, max);
    const parts = []; let n = 0;
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      parts.push(value); n += value.length;
      if (n >= max) { reader.cancel().catch(() => {}); break; }
    }
    return new TextDecoder().decode(await new Blob(parts).arrayBuffer()).slice(0, max);
  }
  async function fromLink(c, raw) {
    const url = raw.trim().replace(/^webcal:\/\//i, "https://");
    if (!/^https:\/\//i.test(url)) return open(null, T("This calendar’s site doesn’t let a web page read it. Download the .ics file, then choose it here."), "calendar");
    reading(url.replace(/^https:\/\//, "").slice(0, 40));
    try {
      const res = await fetch(url, { credentials: "omit", referrerPolicy: "no-referrer" });
      const text = res.ok ? await readCapped(res, 2_000_000) : "";
      const found = text.includes("BEGIN:VCALENDAR") ? findICS(text) : [];
      if (found.length) return review(c, found, T("Calendar"));
      open(null, T("No dates found."), "calendar");
    } catch { open(null, T("This calendar’s site doesn’t let a web page read it. Download the .ics file, then choose it here."), "calendar"); }
  }

  // ——— the sheets ———
  function open(from, note = "", way = "") {
    const c = course(); if (!c) return;
    const w = way || "";
    openPanel(`${head(T("Add the course dates"))}<div class="p-body">
      <p class="dates-intro">${T("Stash finds the exams, deadlines and class times. You check each one before anything is added.")}</p>
      <div class="ways3 dates-ways" role="group" aria-label="${T("Add the course dates")}">
        <button class="way" data-act="dates-way" data-k="syllabus" aria-label="${T("Choose the syllabus (PDF or Word)")}">${ic("file")}<span>${T("Syllabus")}</span></button>
        <button class="way" data-act="dates-way" data-k="calendar" aria-pressed="${w === "calendar"}">${ic("cal")}<span>${T("Calendar")}</span></button>
        <button class="way" data-act="dates-way" data-k="paste" aria-pressed="${w === "paste"}">${ic("note")}<span>${T("Paste a list")}</span></button>
      </div>
      <div id="dates-more">${more(w)}</div>
      ${note ? `<p class="dates-err" role="alert">${esc(note)}</p>` : ""}</div>`, { w: 480, label: T("Add the course dates"), from });
  }
  function more(w) {
    if (w === "calendar") return `<div class="field"><button class="btn" data-act="dates-ics">${ic("cal", "s")}<span>${T("Choose a calendar file (.ics)")}</span></button></div>
      <div class="field"><label class="lab" for="dates-url">${T("or paste the calendar link")}</label>
      <form class="dates-link" data-dates-form="link"><input class="input" id="dates-url" type="url" inputmode="url" placeholder="https://…/calendar.ics" autocomplete="off" dir="ltr">
      <button class="btn" type="submit">${T("Get")}</button></form></div>`;
    if (w === "paste") return `<form data-dates-form="paste"><div class="field"><label class="lab" for="dates-text">${T("Paste the dates — one per line, the way the lecturer wrote them.")}</label>
      <textarea class="input" id="dates-text" dir="auto" placeholder="${he ? "בוחן 2 – 19.11&#10;הגשת תרגיל 3 עד 26/11" : "Quiz 2 – Nov 19&#10;HW 3 due 26.11 at noon"}"></textarea></div>
      <p style="margin:12px 0 0;text-align:end"><button class="btn primary" type="submit">${T("Find dates")}</button></p></form>`;
    return "";
  }
  function reading(name) {
    openPanel(`${head(T("Add the course dates"))}<div class="p-body"><p class="dates-reading" role="status"><i aria-hidden="true"></i>${T("Reading")} <bdi>${esc(name)}</bdi>…</p></div>`, { w: 480, label: T("Add the course dates") });
  }

  function review(c, found, from, syl = null) {
    const on = x => ({ ...x, checked: true });
    R = { c, found: found.map(f => ({ ...f })), from, editing: null, syl,
          people: (syl?.people ?? []).map(on), grades: syl?.grades ?? [], gradesOn: !!syl?.grades.length, reading: (syl?.reading ?? []).map(on), links: (syl?.links ?? []).map(on) };
    draw();
  }
  const hasMore = () => R.people.length || R.grades.length || R.reading.length || R.links.length;
  const noteOn = () => (R.gradesOn && R.grades.length) || R.reading.some(r => r.checked);
  const ticked = () => R.found.filter(f => f.checked).length + R.people.filter(p => p.checked).length + R.links.filter(l => l.checked).length
    + (R.gradesOn && R.grades.length ? 1 : 0) + R.reading.filter(r => r.checked).length;
  /** "CS 2341 · 25 Oct–22 Jan" under the title. */
  function courseLine() {
    const s = R.syl; if (!s) return "";
    const day = v => { if (!v) return null; const [, m, d] = v.split("-").map(Number); return he ? `${d}/${m}` : `${d} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]}`; };
    return [s.code, [day(s.term?.starts), day(s.term?.ends)].filter(Boolean).join("–")].filter(Boolean).join(" · ");
  }
  /** 10:00–11:00 and 25/10–22/1 stay in order inside Hebrew. */
  const ltr = t => esc(t).replace(/(\d{1,2}[:/]\d{1,2})–(\d{1,2}[:/]\d{1,2})/g, "<bdi dir=\"ltr\">$1–$2</bdi>");
  function tickRow(key, kind, on, title, line, extra = "") {
    return `<li class="dr-row k-${kind} ${on ? "" : "off"}">
      <label class="dr-tick"><input type="checkbox" data-sy-tick="${key}" ${on ? "checked" : ""} aria-label="${esc(`${title}, ${line}`)}"><span>${TICK}</span></label>
      <div class="dr-txt"><b dir="auto">${esc(title)}</b><span dir="auto">${ltr(line)}</span>${extra}</div></li>`;
  }
  function moreHTML() {
    const sec = (h, rows) => rows.length ? `<h3 class="dr-h">${T(h)}</h3><ul class="dr-list">${rows.join("")}</ul>` : "";
    const total = Math.max(100, R.grades.reduce((a, g) => a + g.percent, 0));
    const bar = `<div class="dr-bar" aria-hidden="true">${R.grades.map(g => `<i style="width:${(100 * g.percent / total).toFixed(1)}%"></i>`).join("")}</div>`;
    return sec("People", R.people.map((p, i) => tickRow(`people:${i}`, "person", p.checked, p.name, SY.SyllabusWords.person(p, lang))))
      + sec("Grading", R.grades.length ? [tickRow("grades", "grades", R.gradesOn, T("How the grade is made"), SY.SyllabusWords.grades(R.grades), bar)] : [])
      + sec("Reading", R.reading.map((r, i) => tickRow(`reading:${i}`, "reading", r.checked, r.title, T(r.required ? "Required" : "Recommended"))))
      + sec("Links", R.links.map((l, i) => tickRow(`links:${i}`, "link", l.checked, l.name, l.url)))
      + (noteOn() && canAdd(R.c) ? `<p class="dr-note">${T("The grade breakdown and the reading go into one note everyone in the course sees.")}</p>` : "");
  }
  function rowHTML(f, i) {
    if (R.editing === i) {
      const at = new Date(f.at), day = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`;
      const time = f.allDay ? "" : `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
      return `<li class="dr-row k-${f.kind} editing" data-i="${i}"><div class="dr-form">
        <div class="field"><label class="lab" for="dr-t">${T("What")}</label><input class="input" id="dr-t" data-f="title" value="${esc(f.title)}" maxlength="120" dir="auto"></div>
        <div class="dr-2"><div class="field"><label class="lab" for="dr-d">${T("Day")}</label><input class="input" id="dr-d" type="date" data-f="day" value="${day}"></div>
        <div class="field"><label class="lab" for="dr-h">${T("Time")}</label><input class="input" id="dr-h" type="time" data-f="time" value="${time}" ${f.repeatUntil ? "required" : `placeholder="${T("Leave empty for all day")}"`}></div></div>
        <div class="field"><label class="lab" for="dr-p">${T("Where")}</label><input class="input" id="dr-p" data-f="place" value="${esc(f.place ?? "")}" maxlength="120" dir="auto"></div>
        <div class="dr-form-b"><button class="btn quiet" data-act="dr-remove" data-i="${i}">${T("Remove")}</button><button class="btn primary" data-act="dr-done" data-i="${i}">${T("Done")}</button></div>
      </div></li>`;
    }
    const line = DateImport.line(f, new Date(), tz, lang);
    const shown = esc(line).replace(/(\d{1,2}:\d{2})–(\d{1,2}:\d{2})/g, "<bdi dir=\"ltr\">$1–$2</bdi>");   // 12:00–14:00 stays in order in Hebrew
    return `<li class="dr-row k-${f.kind} ${f.checked ? "" : "off"}" data-i="${i}">
      <label class="dr-tick"><input type="checkbox" data-dr-tick="${i}" ${f.checked ? "checked" : ""} aria-label="${esc(`${kindWord(f.kind)}: ${f.title}, ${line}`)}"><span>${TICK}</span></label>
      <div class="dr-txt"><b dir="auto">${esc(f.title)}</b><span dir="auto">${shown}</span></div>
      <button class="dr-ed" data-act="dr-edit" data-i="${i}" aria-label="${T("Edit")} ${esc(f.title)}">${PENCIL}</button></li>`;
  }
  function draw() {
    const { c, found, from } = R;
    const n = ticked();
    const weekly = found.map((f, i) => [f, i]).filter(([f]) => f.repeatUntil), once = found.map((f, i) => [f, i]).filter(([f]) => !f.repeatUntil);
    const headings = hasMore() || (weekly.length && once.length);
    const list = (rows, h) => rows.length ? `${headings ? `<h3 class="dr-h">${h}</h3>` : ""}<ul class="dr-list">${rows.map(([f, i]) => rowHTML(f, i)).join("")}</ul>` : "";
    const foot = canAdd(c)
      ? `<button class="btn quiet" data-act="close">${T("Not now")}</button><button class="btn primary" data-act="dr-add" ${n ? "" : "disabled"}>${addWord(n)}</button>`
      : `<p class="dr-foot-note">${T("Only the course owner and helpers can add dates. Copy the list and send it to them.")}</p><button class="btn primary" data-act="dr-copy">${T("Copy the list")}</button>`;
    const title = hasMore() ? SY.SyllabusWords.headline(lang) : DateImport.headline(found.length, lang), cl = courseLine();
    const body = `<div class="p-body"><p class="dr-from">${from ? `<bdi>${esc(from)}</bdi> · ` : ""}${cl ? `<bdi>${ltr(cl)}</bdi> · ` : ""}${T("Tick what’s right. Nothing is added until you tap Add.")}</p>
      ${list(weekly, T("Every week"))}${list(once, T("Dates"))}${moreHTML()}</div><div class="p-foot">${foot}</div>`;
    const p = $(".panel.dates-review");
    if (p) { const y = p.querySelector(".p-body")?.scrollTop ?? 0; p.querySelector(".p-head h2").textContent = title; p.querySelector(".p-body").outerHTML = body.slice(0, body.indexOf('<div class="p-foot">'));
      p.querySelector(".p-foot").outerHTML = body.slice(body.indexOf('<div class="p-foot">')); p.querySelector(".p-body").scrollTop = y; }
    else openPanel(`${head(esc(title))}${body}`, { w: 520, label: title, cls: "dates-review" });
    if (R.editing != null) $(".panel.dates-review #dr-t")?.focus({ preventScroll: true });
  }
  function saveEdit(i) {
    const p = $(".panel.dates-review"), f = R.found[i]; if (!p || !f) return;
    const v = k => p.querySelector(`[data-f="${k}"]`)?.value ?? "";
    const title = v("title").trim(), day = v("day"), time = v("time");
    if (!title) return p.querySelector('[data-f="title"]').focus();
    if (day) {
      const [y, mo, d] = day.split("-").map(Number), [h, mi] = time ? time.split(":").map(Number) : [0, 0];
      const at = new Date(y, mo - 1, d, h, mi), length = f.endsAt ? new Date(f.endsAt) - new Date(f.at) : 0;
      f.at = at; f.allDay = !time && !f.repeatUntil; f.endsAt = f.endsAt && !f.allDay ? new Date(at.getTime() + length) : null;
    }
    f.title = title; f.place = v("place").trim() || null; f.checked = true;
    R.editing = null; draw();
  }
  async function add() {
    const { c } = R, picked = R.found.filter(f => f.checked), total = ticked();
    if (!total) return;
    const btn = $('[data-act="dr-add"]'); if (btn) btn.disabled = true;
    const info = [...R.people.filter(p => p.checked).map(p => ({ kind: "person", role: p.role, name: [...p.name].slice(0, 80).join(""), email: p.email,
      hours: p.hours ? [...p.hours].slice(0, 120).join("") : null })), ...R.links.filter(l => l.checked).map(l => ({ kind: "link", name: [...l.name].slice(0, 80).join(""), url: l.url }))];
    const note = noteOn() ? SY.SyllabusWords.note(R.gradesOn ? R.grades : [], R.reading.filter(r => r.checked), R.syl?.lang ?? lang) : null;
    try {
      if (hub.LIVE) {
        if (picked.length) await hub.live.importDates(c, picked.map(f => DateImport.toEvent(f)));
        if (info.length) await hub.live.saveInfo(c, info);
      } else {
        const rows = picked.map(f => ({ ...DateImport.toEvent(f), id: f.uid, t: f.title }));
        c.events = [...(c.events || []).filter(e => !rows.some(r => r.uid === e.uid)), ...rows];
        c.info = [...(c.info || []), ...info];
      }
    } catch { if (btn) btn.disabled = false; say(`<span>${esc(T("Couldn’t add the dates. Try again in a minute."))}</span>`, 5000); return; }
    S.datesAsk = null; R = null; closeAll(); render();
    if (note) {   // one text sheet, added like any note (it shows on the course for everyone)
      const it = hub.m({ kind: "note", text: note, week: c.week, by: hub.ME, ago: "now", sending: true });
      hub.addItem(it, false);
      if (hub.LIVE) { it.cid = crypto.randomUUID(); it.live = true; hub.live.send(it, c, c.week); }
    }
    say(`<span>${ic("check", "s")}</span><span>${he ? `נוספו ${total} פריטים לקורס` : `Added ${total} to the course`}</span>`, 4000);
  }
  async function copy() {
    const text = [...R.found.filter(f => f.checked).map(f => `${f.title} — ${DateImport.line(f, new Date(), tz, lang)}`),
      ...R.people.filter(p => p.checked).map(p => `${p.name} — ${SY.SyllabusWords.person(p, lang)}`), ...(R.gradesOn && R.grades.length ? [SY.SyllabusWords.grades(R.grades)] : []),
      ...R.reading.filter(r => r.checked).map(r => r.title), ...R.links.filter(l => l.checked).map(l => `${l.name} — ${l.url}`)].join("\n");
    try { await navigator.clipboard.writeText(text); say(`<span>${ic("check", "s")}</span><span>${T("Copied.")}</span>`, 2500); } catch { /* the list stays on screen */ }
  }

  // ——— on the folio: after you add a syllabus or a list, and when a course has no dates yet ———
  async function afterAdd(it) {
    const c = course(); if (!c || !canAdd(c)) return;
    let found = [], syl = null, from = it.title ? it.title.replace(/\.[a-z0-9]{1,5}$/i, "") : null;   // "Syllabus" — the extension trips right-to-left names
    if (it.kind === "note") { syl = await read(it.text || ""); found = syl.dates; from = null; if (found.length < 2) return; }
    else if (it.file && (isPDF(it.file) || isICS(it.file) || isDocx(it.file))) { const r = await readFile(it.file).catch(() => ({ found: [] })); if (!anything(r)) return; found = r.found; syl = r.syl ?? null; }
    else return;
    S.essAsk = null; S.datesAsk = { c: c.id, found, from, syl };
    if (phone()) render();
    else say(`<span>${foundWords(found.length, from)}</span><button class="linkbtn" data-act="dates-review">${T("Review")}</button>`, 12000);
  }
  const foundWords = (n, from) => he
    ? `נמצאו <b>${n === 1 ? "תאריך אחד" : `${n} תאריכים`}</b>${from ? ` ${/^[\u0590-\u05FF]/.test(from) ? "ב" : "ב-"}<b><bdi>${esc(from)}</bdi></b>` : ""}`
    : `Found <b>${n} ${n === 1 ? "date" : "dates"}</b>${from ? ` in <b><bdi>${esc(from)}</bdi></b>` : ""}`;
  hub.hooks.datesCard = (c, ess) => {
    const a = S.datesAsk;
    if (a && a.c === c.id) return `<div class="ess-ask" role="group" aria-label="${esc(DateImport.headline(a.found.length, lang))}"><span>${foundWords(a.found.length, a.from)} — ${he ? "להוסיף?" : a.found.length === 1 ? "add it?" : "add them?"}</span>
      <span class="ess-ask-b"><button class="btn" data-act="dates-no">${T("Not now")}</button><button class="btn primary" data-act="dates-review">${T("Review")}</button></span></div>`;
    if (!ess.length && canAdd(c) && (c.items.length || c.files.length) && !S.essAsk)
      return `<button class="ess-add" data-act="dates"><span class="ic">${ic("cal")}</span><span><b>${T("Add the exam and class dates")}</b><small>${T("From the syllabus, a calendar or a list")}</small></span></button>`;
    return "";
  };

  document.addEventListener("click", e => {
    const a = e.target.closest("[data-act]"); if (!a) return;
    const i = +a.dataset.i;
    switch (a.dataset.act) {
      case "dates": hub.closeMenu?.(); open(a); break;
      case "dates-way": {
        const k = a.dataset.k;
        if (k === "syllabus") { pickPDF.click(); break; }
        a.parentElement.querySelectorAll(".way").forEach(b => b.setAttribute("aria-pressed", String(b === a)));
        const m = $("#dates-more"); if (m) { m.innerHTML = more(k); m.querySelector("input, textarea")?.focus({ preventScroll: true }); }
        $(".dates-err")?.remove(); break;
      }
      case "dates-ics": pickICS.click(); break;
      case "dates-no": S.datesAsk = null; render(); break;
      case "dates-review": { const s = S.datesAsk; if (!s) break; const c = hub.S.courses.find(x => x.id === s.c) || course(); review(c, s.found, s.from, s.syl); break; }
      case "dr-edit": if (R) { if (R.editing != null) saveEdit(R.editing); R.editing = i; draw(); } break;
      case "dr-done": saveEdit(i); break;
      case "dr-remove": if (R) { R.found.splice(i, 1); R.editing = null; if (R.found.length) draw(); else closeAll(); } break;
      case "dr-add": add(); break;
      case "dr-copy": copy(); break;
    }
  });
  document.addEventListener("change", e => {
    const t = e.target.closest?.("[data-dr-tick], [data-sy-tick]"); if (!t || !R) return;
    if (t.dataset.drTick != null) { const f = R.found[+t.dataset.drTick]; if (!f) return; f.checked = t.checked; }
    else { const [k, i] = t.dataset.syTick.split(":"); if (k === "grades") R.gradesOn = t.checked; else if (R[k]?.[+i]) R[k][+i].checked = t.checked; }
    t.closest(".dr-row")?.classList.toggle("off", !t.checked);
    const note = $(".panel.dates-review .dr-note"), want = noteOn() && canAdd(R.c);
    if (!!note !== want) { R.editing = null; draw(); return; }
    const n = ticked(), b = $('[data-act="dr-add"]');
    if (b) { b.disabled = !n; b.textContent = addWord(n); }
  });
  document.addEventListener("submit", e => {
    const f = e.target.closest?.("[data-dates-form]"); if (!f) return;
    e.preventDefault();
    const c = course();
    if (f.dataset.datesForm === "paste") { const text = $("#dates-text")?.value || ""; read(text).then(syl => {
      if (SY.SyllabusWords.count(syl)) review(c, syl.dates, null, syl); else { const m = $(".dates-err") || Object.assign(document.createElement("p"), { className: "dates-err" }); m.setAttribute("role", "alert"); m.textContent = T("No dates found."); f.after(m); } }); }
    else fromLink(c, $("#dates-url")?.value || "");
  });
  document.addEventListener("keydown", e => { if (e.key === "Enter" && R?.editing != null && e.target.closest?.(".dr-form input")) { e.preventDefault(); saveEdit(R.editing); } });

  hub.dates = { open, review, afterAdd, fromFile };
  if (phone() && course()) render();
}
