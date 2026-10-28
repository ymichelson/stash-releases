// The optional profile on the web hub: ⋯ → Profile, or tap your own name. Joining never needs it (code → name → in).
// Your name (all courses at once, or one), a colour or a small photo for your initial circle, the courses you're in,
// "Use on my other devices" (linking codes: make_pair_code / claim_pair_code), Your data (Download my data / Delete my
// data: export_me / delete_me, core.js MyData) and Leave / Forget this browser.
// Classmates only ever see your name and colour or photo. Rules: core.js Profile (twin: StashCore SharedProfile.swift).
// Live mode goes through hub.live.profile (live.js); the made-up courses keep everything in this browser.
import { MyData, Profile } from "./core.js";

const HE = {
  "Profile": "פרופיל", "Your circle": "העיגול שלך", "No colour": "בלי צבע", "Choose a photo…": "בחירת תמונה…", "Change photo…": "החלפת תמונה…",
  "Remove photo": "הסרת התמונה", "Your name": "השם שלך", "Name": "שם", "In all my courses": "בכל הקורסים שלי", "Save name": "שמירת השם",
  "Use on my other devices": "שימוש במכשירים האחרים שלי", "Show a code": "הצגת קוד", "I have a code": "יש לי קוד", "Link": "קישור",
  "Leave or forget": "עזיבה או שכחה", "Forget this browser…": "לשכוח את הדפדפן הזה…", "Courses you're in": "הקורסים שלך",
  "Your iPhone and Mac can be the same you: one name, the same courses.": "האייפון וה־Mac יכולים להיות אותו אדם: שם אחד, אותם קורסים.",
  "Classmates see only your name and your colour or photo. Nothing here is required.": "חברים לקורס רואים רק את השם שלך ואת הצבע או התמונה. שום דבר כאן אינו חובה.",
  "Classmates see only your name. Nothing here is required.": "חברים לקורס רואים רק את השם שלך. שום דבר כאן אינו חובה.",
  "Forgetting takes this browser out of all your courses. What you added stays for the others.": "שכחה מוציאה את הדפדפן הזה מכל הקורסים. מה שהוספת נשאר לאחרים.",
  "Type a name.": "צריך להקליד שם.", "40 letters at most.": "עד 40 אותיות.", "That looks like a password. Pick another name.": "זה נראה כמו סיסמה. כדאי לבחור שם אחר.",
  "Type the 8 letters from your other device.": "צריך להקליד את 8 התווים מהמכשיר האחר.", "Code from your other device": "הקוד מהמכשיר האחר",
  "That code didn’t work. Make a new one and try again.": "הקוד לא עבד. כדאי ליצור קוד חדש ולנסות שוב.", "Too many tries. Wait a few minutes.": "יותר מדי ניסיונות. כדאי לחכות כמה דקות.",
  "Linked. This browser is now the same you as your other device.": "מקושר. הדפדפן הזה והמכשיר האחר הם עכשיו אותו אדם.",
  "Photo saved.": "התמונה נשמרה.", "Photo removed.": "התמונה הוסרה.", "That picture can’t be used. Try another.": "אי אפשר להשתמש בתמונה הזאת. כדאי לנסות אחרת.",
  "No connection. Try again when you’re back online.": "אין חיבור. כדאי לנסות שוב כשהחיבור יחזור.",
  "Only in": "רק ב", "here": "כאן", "You’re": "השם שלי",
  "Your data": "הנתונים שלך", "Download my data": "הורדת הנתונים שלי", "Delete my data…": "מחיקת הנתונים שלי…",
  "A copy of everything Stash’s server keeps about you: your profile, courses, names, what you added and your activity.":
    "עותק של כל מה ששרת Stash שומר עליך: הפרופיל, הקורסים, השמות, מה שהוספת והפעילות שלך.",
  "Delete everything?": "למחוק הכול?",
  "Your names, profile, devices and everything you added are erased from every course, and this browser forgets you. A course you own passes to a helper or the longest-standing member; a course only you are in is erased. Files are gone within a day.":
    "השמות, הפרופיל, המכשירים וכל מה שהוספת נמחקים מכל הקורסים, והדפדפן הזה שוכח אותך. קורס שבבעלותך עובר למישהו מצוות הקורס או למי שנמצא בו הכי הרבה זמן; קורס שאין בו אף אחד מלבדך נמחק. קבצים נעלמים תוך יום.",
  "Copies classmates already saved on their own devices stay with them. This can’t be undone.":
    "עותקים שחברים לקורס כבר שמרו במכשירים שלהם נשארים אצלם. אי אפשר לבטל את זה.",
  "Cancel": "ביטול", "Delete everything": "למחוק הכול", "Downloaded.": "הורד.",
  "The server can’t do this yet. Write to us and we’ll do it for you.": "השרת עוד לא יכול לעשות את זה. כדאי לכתוב לנו ונעשה את זה בשבילך.",
  "On the made-up courses nothing is on a server: everything stays in this browser.": "בקורסים לדוגמה שום דבר לא נמצא בשרת: הכול נשאר בדפדפן הזה.",
};
const COLOR_NAMES = { coral: ["Coral", "אלמוג"], butter: ["Butter", "חמאה"], sky: ["Sky", "שמיים"], sage: ["Sage", "מרווה"],
                      lilac: ["Lilac", "לילך"], sand: ["Sand", "חול"], rose: ["Rose", "ורד"], slate: ["Slate", "צפחה"] };

export function startProfile(hub) {
  const { S, esc, ic, say, render, course, openPanel, closeAll, head, store, $, ME } = hub;
  const he = hub.lang === "he";
  const T = s => (he ? HE[s] ?? s : s);
  const live = () => (hub.LIVE ? hub.live?.profile : null);
  const myName = () => hub.myNameHere();
  const looksOn = () => !hub.LIVE || !!S.looksOn;
  // Made-up courses: what you pick stays in this browser.
  if (!hub.LIVE) { S.myLook = store.get("protoLook", null); S.looksOn = true; }
  render();   // the circles get their colours now that the rules (core.js) are here

  const swatch = (i, look) => {
    const on = (look?.color ?? null) === i;
    if (i == null) return `<button type="button" class="sw none" role="radio" aria-checked="${on}" data-act="prof-color" data-c="" aria-label="${esc(T("No colour"))}">${esc(Profile.initial(myName()))}</button>`;
    const c = Profile.COLORS[i], [n, nh] = COLOR_NAMES[c.id];
    return `<button type="button" class="sw" role="radio" aria-checked="${on}" data-act="prof-color" data-c="${i}" aria-label="${esc(he ? nh : n)}"
      style="--fl:${c.light[0]};--fil:${c.light[1]};--fd:${c.dark[0]};--fid:${c.dark[1]}">${esc(Profile.initial(myName()))}</button>`;
  };

  function draw(from) {
    const c = course(), courses = S.courses || [], look = S.myLook, name = myName();
    const panel = $(".panel.prof-panel");
    const html = `${head(esc(T("Profile")))}<div class="p-body prof">
      <div class="prof-top">${hub.face(ME, look, "big")}<div><b><bdi>${esc(name)}</bdi></b>
        <small>${he ? (courses.length === 1 ? "בקורס אחד" : `ב-${courses.length} קורסים`) : courses.length === 1 ? "In 1 course" : `In ${courses.length} courses`}</small></div></div>
      <p class="prof-note">${ic("lock", "s")}<span>${esc(T(looksOn() ? "Classmates see only your name and your colour or photo. Nothing here is required." : "Classmates see only your name. Nothing here is required."))}</span></p>
      ${looksOn() ? `<section class="prof-sec" aria-labelledby="pf-look"><h3 id="pf-look">${esc(T("Your circle"))}</h3>
        <div class="swatches" role="radiogroup" aria-labelledby="pf-look">${swatch(null, look)}${Profile.COLORS.map((_, i) => swatch(i, look)).join("")}</div>
        <div class="acts-row" style="margin-top:0"><button type="button" class="btn" data-act="prof-photo">${ic("photo", "s")}<span>${esc(T(look?.photo ? "Change photo…" : "Choose a photo…"))}</span></button>
          ${look?.photo ? `<button type="button" class="btn quiet" data-act="prof-photo-clear">${esc(T("Remove photo"))}</button>` : ""}</div>
        <input type="file" id="prof-file" accept="image/*" hidden tabindex="-1"></section>` : ""}
      <section class="prof-sec" aria-labelledby="pf-name-h"><h3 id="pf-name-h">${esc(T("Your name"))}</h3>
        <form data-form="prof-name" novalidate><div class="field" style="margin-top:0"><label for="pf-name">${esc(T("Name"))}</label>
          <input class="input" id="pf-name" name="name" maxlength="40" value="${esc(name)}" autocomplete="given-name" dir="auto" required></div>
        ${courses.length > 1 && c ? `<div class="prof-scope" role="radiogroup" aria-label="${esc(T("Your name"))}">
          <label><input type="radio" name="scope" value="" checked> ${esc(T("In all my courses"))}</label>
          <label><input type="radio" name="scope" value="${esc(c.id)}"> ${esc(T("Only in"))}${he ? "" : " "}<bdi>${esc(c.name)}</bdi></label></div>` : ""}
        <p class="prof-err" role="alert"></p>
        <div class="acts-row" style="justify-content:flex-end;margin-top:8px"><button class="btn primary" type="submit">${esc(T("Save name"))}</button></div></form>
        ${courses.length ? `<h3 class="prof-sub">${esc(T("Courses you're in"))}</h3><ul class="list prof-courses">${courses.map(x => `<li><a class="course-link" href="?c=${esc(x.id)}${he ? "&lang=he" : ""}" data-course="${esc(x.id)}">${hub.thumb(x.cover ?? 0)}
          <span class="nm"><b><span>${esc(x.name)}</span></b><small>${esc(T("You’re"))} <bdi>${esc(x.myName || name)}</bdi> ${esc(T("here"))}</small></span></a></li>`).join("")}</ul>` : ""}</section>
      <section class="prof-sec" aria-labelledby="pf-dev"><h3 id="pf-dev">${esc(T("Use on my other devices"))}</h3>
        <p class="prof-p">${esc(T("Your iPhone and Mac can be the same you: one name, the same courses."))}</p>
        <div id="pf-pair" aria-live="polite"><div class="acts-row" style="margin-top:0"><button type="button" class="btn" data-act="prof-pair-show">${ic("code", "s")}<span>${esc(T("Show a code"))}</span></button>
          <button type="button" class="btn" data-act="prof-pair-enter">${esc(T("I have a code"))}</button></div></div></section>
      <section class="prof-sec" aria-labelledby="pf-data"><h3 id="pf-data">${esc(T("Your data"))}</h3>
        <div id="pf-data-box" aria-live="polite">${dataButtons()}</div></section>
      <section class="prof-sec" aria-labelledby="pf-out"><h3 id="pf-out">${esc(T("Leave or forget"))}</h3>
        <div class="acts-row" style="margin-top:0">${c ? `<button type="button" class="btn quiet danger" data-act="leave">${ic("leave", "s")}<span>${he ? `לעזוב את ${esc(c.name)}…` : `Leave ${esc(c.name)}…`}</span></button>` : ""}
          <button type="button" class="btn quiet danger" data-act="forget">${ic("forget", "s")}<span>${esc(T("Forget this browser…"))}</span></button></div>
        <p class="prof-p" style="margin-top:10px">${esc(T("Forgetting takes this browser out of all your courses. What you added stays for the others."))}</p></section>
    </div>`;
    if (panel) {   // redraw in place (keeps the sheet open, focus goes back to what was pressed)
      const keep = document.activeElement?.dataset?.act, y = $(".p-body", panel)?.scrollTop ?? 0;
      panel.innerHTML = `<div class="grab" aria-hidden="true"></div>` + html;
      $(".p-body", panel).scrollTop = y;
      if (keep) (panel.querySelector(`[data-act="${keep}"][aria-checked="true"]`) || panel.querySelector(`[data-act="${keep}"]`))?.focus({ preventScroll: true });
      return;
    }
    openPanel(html, { w: 460, label: T("Profile"), from, cls: "prof-panel" });
  }

  function dataButtons() {
    return `<p class="prof-p">${esc(T("A copy of everything Stash’s server keeps about you: your profile, courses, names, what you added and your activity."))}</p>
      <div class="acts-row" style="margin-top:0"><button type="button" class="btn" data-act="prof-data-get">${ic("save", "s")}<span>${esc(T("Download my data"))}</span></button>
        <button type="button" class="btn quiet danger" data-act="prof-data-ask">${ic("trash", "s")}<span>${esc(T("Delete my data…"))}</span></button></div>`;
  }
  /** The confirm step, in place: what goes, what stays with classmates, and a red button. */
  function dataConfirm() {
    $("#pf-data-box").innerHTML = `<p class="prof-p" style="margin-bottom:6px"><b>${esc(T("Delete everything?"))}</b></p>
      <p class="prof-p">${esc(T("Your names, profile, devices and everything you added are erased from every course, and this browser forgets you. A course you own passes to a helper or the longest-standing member; a course only you are in is erased. Files are gone within a day."))}</p>
      <p class="prof-p">${esc(T("Copies classmates already saved on their own devices stay with them. This can’t be undone."))}</p>
      <p class="prof-err" role="alert"></p>
      <div class="acts-row" style="justify-content:flex-end;margin-top:0"><button type="button" class="btn quiet" data-act="prof-data-cancel">${esc(T("Cancel"))}</button>
        <button type="button" class="btn primary" data-act="prof-data-delete">${esc(T("Delete everything"))}</button></div>`;
    $('[data-act="prof-data-cancel"]').focus();
  }
  async function dataDownload(btn) {
    if (!live()) { say(`<span>${esc(T("On the made-up courses nothing is on a server: everything stays in this browser."))}</span>`, 4000); return; }
    btn.disabled = true;
    try {
      const doc = MyData.document(await hub.live.myData.exportMe());
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" }));
      a.download = MyData.fileName(); document.body.append(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
      say(`<span>${ic("check", "s")}</span><span>${esc(T("Downloaded."))}</span>`, 2200);
    } catch (e) { say(`<span>${esc(MyData.missingFunction(e) ? T("The server can’t do this yet. Write to us and we’ll do it for you.") : fail(e))}</span>`, 5000); }
    finally { btn.disabled = false; }
  }
  async function dataDelete(btn) {
    if (!live()) { say(`<span>${esc(T("On the made-up courses nothing is on a server: everything stays in this browser."))}</span>`, 4000); closeAll(); return; }
    btn.disabled = true;
    try {
      const r = await hub.live.myData.erase();
      say(`<span>${ic("check", "s")}</span><span>${esc(MyData.deletedLine(r, he))}</span>`, 6000);
    } catch (e) {
      const err = $("#pf-data-box .prof-err");
      if (err) err.textContent = MyData.missingFunction(e) ? T("The server can’t do this yet. Write to us and we’ll do it for you.") : fail(e);
      btn.disabled = false;
    }
  }

  hub.openProfile = from => {
    store.set("profileHint", "done");
    hub.$(".prof-hint")?.remove();
    draw(from);
    live()?.load().then(() => { if ($(".panel.prof-panel")) draw(); }).catch(() => {});
  };

  const fail = e => /Failed to fetch|NetworkError|offline|Load failed/i.test(String(e?.message || e)) ? T("No connection. Try again when you’re back online.")
    : /slow down/i.test(String(e?.message)) ? (he ? "יותר מדי שינויים בשעה האחרונה. אפשר לנסות שוב מאוחר יותר." : "Too many changes in the last hour. Try again a bit later.") : String(e?.message || e);

  async function setLook(color, photo) {
    const before = S.myLook;
    S.myLook = color != null || photo ? { color, photo } : null; draw(); render();   // at once; the server's answer follows
    try { if (live()) await live().setLook(color, photo); else store.set("protoLook", S.myLook); }
    catch (e) { S.myLook = before; draw(); render(); say(`<span>${esc(fail(e))}</span>`, 4000); return false; }
    return true;
  }

  /** A square, small JPEG drawn fresh from the picture: GPS, camera and every other detail stay behind. */
  async function facePhoto(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image(); img.src = url; await img.decode();
      const side = Profile.photoSide, cv = document.createElement("canvas"); cv.width = cv.height = side;
      const g = cv.getContext("2d"), s = Math.min(img.naturalWidth, img.naturalHeight);
      if (!s) throw new Error("empty");
      g.fillStyle = "#fff"; g.fillRect(0, 0, side, side);
      g.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, side, side);
      for (const q of [0.82, 0.7, 0.58, 0.46]) { const d = cv.toDataURL("image/jpeg", q); if (Profile.photoOK(d)) return d; }
      return null;
    } catch { return null; } finally { URL.revokeObjectURL(url); }
  }

  function pairEnter() {
    $("#pf-pair").innerHTML = `<form data-form="prof-pair" novalidate><div class="field" style="margin-top:0"><label for="pf-code">${esc(T("Code from your other device"))}</label>
      <input class="input pair-input" id="pf-code" name="code" maxlength="9" autocomplete="off" autocapitalize="characters" spellcheck="false" inputmode="text" dir="ltr" placeholder="ABCD-2345"></div>
      <p class="prof-err" role="alert"></p>
      <div class="acts-row" style="justify-content:flex-end;margin-top:8px"><button class="btn primary" type="submit">${esc(T("Link"))}</button></div></form>`;
    $("#pf-code").focus();
  }

  async function pairShow() {
    let code = null;
    try { code = live() ? await live().pairCode() : Array.from({ length: 8 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join(""); }
    catch (e) { say(`<span>${esc(fail(e))}</span>`, 4000); return; }
    const shown = Profile.pairCodeShown(code);
    $("#pf-pair").innerHTML = `<div class="pair-code" dir="ltr" aria-label="${esc([...code].join(" "))}">${esc(shown)}</div>
      <p class="prof-p">${he ? "ב-Stash במכשיר האחר: פרופיל ← יש לי קוד, ולהקליד אותו תוך 10 דקות. שני המכשירים יהיו אותו אדם, עם אותם קורסים."
        : "In Stash on your other device: Profile → I have a code, and type it within 10 minutes. That device becomes you here, and brings its courses along."}</p>
      <div class="acts-row" style="margin-top:0"><button type="button" class="btn" data-act="prof-pair-copy" data-code="${esc(code)}">${ic("copy", "s")}<span>${he ? "העתקה" : "Copy"}</span></button></div>`;
  }

  document.addEventListener("click", async e => {
    const a = e.target.closest("[data-act]"); if (!a || !a.closest(".prof-panel")) return;
    switch (a.dataset.act) {
      case "prof-color": { const c = a.dataset.c === "" ? null : Number(a.dataset.c); await setLook(c, S.myLook?.photo ?? null); break; }
      case "prof-photo": $("#prof-file")?.click(); break;
      case "prof-photo-clear": if (await setLook(S.myLook?.color ?? null, null)) say(`<span>${esc(T("Photo removed."))}</span>`, 2200); break;
      case "prof-pair-show": pairShow(); break;
      case "prof-pair-enter": pairEnter(); break;
      case "prof-data-get": dataDownload(a); break;
      case "prof-data-ask": dataConfirm(); break;
      case "prof-data-cancel": $("#pf-data-box").innerHTML = dataButtons(); $('[data-act="prof-data-ask"]')?.focus(); break;
      case "prof-data-delete": dataDelete(a); break;
      case "prof-pair-copy": try { await navigator.clipboard.writeText(a.dataset.code); } catch {} say(`<span>${he ? "הועתק." : "Copied."}</span>`, 1800); break;
    }
  });
  // Arrow keys move through the colours (a radio group: one stop for Tab).
  document.addEventListener("keydown", e => {
    const sw = e.target.closest?.(".prof-panel .sw"); if (!sw) return;
    const all = [...sw.parentElement.querySelectorAll(".sw")], i = all.indexOf(sw), rtl = document.dir === "rtl";
    const step = { ArrowRight: rtl ? -1 : 1, ArrowDown: 1, ArrowLeft: rtl ? 1 : -1, ArrowUp: -1 }[e.key];
    if (step == null) return;
    e.preventDefault(); const n = all[(i + step + all.length) % all.length]; n.focus(); n.click();
  });
  document.addEventListener("change", async e => {
    if (e.target.id !== "prof-file") return;
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file || !/^image\//.test(file.type || "image/")) return;
    const data = await facePhoto(file);
    if (!data) { say(`<span>${esc(T("That picture can’t be used. Try another."))}</span>`, 4000); return; }
    if (await setLook(S.myLook?.color ?? null, data)) say(`<span>${esc(T("Photo saved."))}</span>`, 2200);
  });
  document.addEventListener("submit", async e => {
    const f = e.target.closest('[data-form="prof-name"], [data-form="prof-pair"]'); if (!f) return;
    e.preventDefault();
    const err = $(".prof-err", f), btn = $('button[type="submit"]', f);
    if (f.dataset.form === "prof-pair") {
      const code = Profile.pairCode($("#pf-code").value);
      if (!code) { err.textContent = T("Type the 8 letters from your other device."); $("#pf-code").focus(); return; }
      btn.disabled = true;
      try {
        const status = live() ? await live().claim(code) : "linked";
        if (status !== "linked") { err.textContent = T(status === "too_many_tries" ? "Too many tries. Wait a few minutes." : "That code didn’t work. Make a new one and try again."); btn.disabled = false; return; }
        closeAll(); say(`<span>${ic("check", "s")}</span><span>${esc(T("Linked. This browser is now the same you as your other device."))}</span>`, 5000);
      } catch (ex) { err.textContent = fail(ex); btn.disabled = false; }
      return;
    }
    const typed = String(new FormData(f).get("name") || ""), why = Profile.nameRefusal(typed);
    if (why) { err.textContent = T({ empty: "Type a name.", tooLong: "40 letters at most.", secret: "That looks like a password. Pick another name." }[why]); $("#pf-name").focus(); return; }
    const only = new FormData(f).get("scope") || null, name = typed.trim().replace(/\s+/g, " ");
    const ids = Profile.renamePlan((S.courses || []).map(c => ({ id: c.id, myName: c.myName || myName() })), name, only);
    if (!ids.length) { closeAll(); return; }
    btn.disabled = true;
    let results;
    if (live()) { try { results = await live().rename(name, ids); } catch (ex) { err.textContent = fail(ex); btn.disabled = false; return; } }
    else {   // made-up courses: a name someone already uses there is refused, like the server
      results = ids.map(id => { const c = S.courses.find(x => x.id === id), taken = (c.names || []).some(n => n.toLowerCase() === name.toLowerCase());
        if (!taken) c.myName = name; return { name: c.name, ok: !taken, taken }; });
      if (results.some(r => r.ok)) store.set("liveName", name);
    }
    const line = he ? (results.every(r => r.ok) ? `השם עודכן ל-${name}.` : results.some(r => r.ok) ? `השם עודכן בחלק מהקורסים. ב-${results.filter(r => !r.ok).map(r => r.name).join(", ")} מישהו כבר משתמש בשם הזה.` : `ב-${results.map(r => r.name).join(", ")} מישהו כבר משתמש בשם הזה.`)
      : Profile.renameSummary(results, name);
    if (results.every(r => r.ok)) { closeAll(); render(); say(`<span>${ic("check", "s")}</span><span>${esc(line)}</span>`, 4000); }
    else { render(); draw(); const e2 = $(".prof-panel .prof-err"); if (e2) e2.textContent = line; $("#pf-name")?.focus(); }
  });
}
