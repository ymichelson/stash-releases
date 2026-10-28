// The class hub page's own script (moved out of index.html on 27 Oct 2026 so the page can have a strict
// Content-Security-Policy with no inline scripts: THREAT-MODEL T13). A classic script, loaded right after nearby.js.
document.addEventListener("click", e => { if (e.target.closest?.("a[data-noop]")) e.preventDefault(); });   // demo-only links
(() => {
"use strict";
/* ============ helpers ============ */
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const params = new URLSearchParams(location.search);
/* The public address (GitHub Pages, scripts/hub/publish-web.sh; the Mac's SharedLink.webBase). Invite links, QR codes and posters point here. */
const SITE = "https://ymichelson.github.io/stash-releases/", HOSTED = location.origin + "/" === new URL(SITE).origin + "/";
const joinLink = code => `${SITE}j/?c=${code}`;
/* Live mode (docs/shared/WEB-HUB.md): ?live=1 puts this browser on the real Stash server (live.js); ?live=0 back to the made-up courses.
   On the public address it is always live (?live=0 shows the made-up courses for that one visit). */
const LIVE = (() => { const q = params.get("live"); if (HOSTED) return q !== "0"; try { if (q === "1") localStorage.setItem("stash.live", "1"); if (q === "0") localStorage.removeItem("stash.live"); return localStorage.getItem("stash.live") === "1"; } catch { return q === "1"; } })();
if (params.get("code") && !LIVE) location.replace(`../join/?code=${encodeURIComponent(params.get("code"))}${params.get("lang") ? "&lang=" + encodeURIComponent(params.get("lang")) : ""}`);
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const phone = () => matchMedia("(max-width: 699px)").matches;
matchMedia("(max-width: 699px)").addEventListener("change", () => { closeAll(true); render(); }); // phone ↔ computer layout (a turned iPad, a resized window)
/* iPhone/iPad Safari turns a download link into "open the file": there Save hands the file to the share sheet instead (live.js) */
const ios = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const shareSave = () => ios() && typeof navigator.canShare === "function";
const saveWord = it => !shareSave() ? t("save") : it.kind === "photo" ? t("savePhoto") : t("saveFiles");
const store = { get(k, d) { try { const v = localStorage.getItem("hub." + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
                set(k, v) { try { localStorage.setItem("hub." + k, JSON.stringify(v)); } catch {} } };

/* one spring for every landing: response .34 s, damping .78 → CSS linear() */
(function makeSpring() {
  if (!CSS.supports("transition-timing-function", "linear(0, 1)")) return;
  const w0 = 2 * Math.PI / 0.34, z = 0.78, wd = w0 * Math.sqrt(1 - z * z), pts = [];
  let T = 0; while (T < 2 && !(T > 0.1 && Math.exp(-z * w0 * T) < 0.002)) T += 1 / 120;
  for (let i = 0; i <= 48; i++) { const t = T * i / 48; pts.push((1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + (z * w0 / wd) * Math.sin(wd * t))).toFixed(4)); }
  pts[pts.length - 1] = "1";
  document.documentElement.style.setProperty("--spring", `linear(${pts.join(", ")})`);
  document.documentElement.style.setProperty("--spring-dur", Math.round(T * 1000) + "ms");
})();

/* theme (system, or forced from the states menu) */
const theme = () => { const f = document.documentElement.dataset.theme; return f || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); };
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => refreshArt());
function refreshArt() { $$("img[data-art]").forEach(img => { img.src = art(img.dataset.art); }); }
const art = key => {
  const t = theme();
  if (key.startsWith("sticker-")) return `art/${key}-${t === "dark" ? "light" : "dark"}.webp`; // ink stickers on light paper, ivory on night paper
  return `art/${key}-${t}.webp`;
};

/* ============ words (English + Hebrew chrome) ============ */
const HE = {
  courses:"קורסים", joinCourse:"הצטרפות או פתיחת קורס", joinCode:"הצטרפות עם קוד", yourCourses:"הקורסים שלך", onTheirOwn:"קורסים", bring:"הזמנה",
  next:"הבא", add:"הוספה ל", week:"שבוע", thisWeek:"השבוע", courseFiles:"קבצי הקורס", earlier:"קודם", things:"פריטים", thing:"פריט",
  newSince:"חדשים מאז", show:"להראות", others:"ועוד", and:"ו-", people:"אנשים", photo:"תמונה", file:"קובץ", link:"קישור", note:"פתק",
  thanks:"תודה", gotIt:"הבנתי", same:"גם לי יש שאלה", helpful:"עזר לי", addOne:"הוספה", info:"על הקורס", invitePeople:"הזמנת אנשים", reminders:"תזכורות לתאריכים", showHere:"להראות שאני כאן", hereMore:"עוד", thanksW:"תודה", open:"פתיחה", save:"שמירה", saveFiles:"שמירה בקבצים", savePhoto:"שמירת התמונה", close:"סגירה", copy:"העתקה",
  nothingYet:"עוד אין כלום על השולחן", nothingYetP:"אפשר להניח את הסילבוס, מצגות או תמונה של הלוח — כולם בקורס יקבלו את זה.",
  offline:"אין חיבור · עודכן", offlineP:"מה שכאן עדיין עובד; מה שתוסיפו יישלח כשהחיבור יחזור.",
};
if (["dark", "light"].includes(params.get("theme"))) document.documentElement.dataset.theme = params.get("theme");
const lang = (params.get("lang") || (() => { try { return localStorage.getItem("stash.lang"); } catch { return null; } })() || (/^(he|iw)\b/i.test(navigator.language || "") ? "he" : "en")) === "he" ? "he" : "en" /* ?lang= wins, then the choice under More → Language, else the phone's language */;
const EN = { courses:"Courses", joinCourse:"Join or start a course", joinCode:"Join with a code", yourCourses:"Your courses", onTheirOwn:"Courses", bring:"Invite",
  next:"Next", add:"Add to ", week:"Week", thisWeek:"This week", courseFiles:"Course files", earlier:"Earlier", things:"things", thing:"thing",
  newSince:"new since", show:"Show", others:"others", and:"and", people:"people", photo:"Photo", file:"File", link:"Link", note:"Note",
  thanks:"Thanks", gotIt:"Got it", same:"Same question", helpful:"Helpful", addOne:"Add", info:"Course info", invitePeople:"Invite people", reminders:"Reminders for the dates", showHere:"Show me as here", hereMore:"more", thanksW:"Thanks", open:"Open", save:"Save", saveFiles:"Save to Files", savePhoto:"Save Photo", close:"Close", copy:"Copy",
  nothingYet:"Nothing here yet", nothingYetP:"Add the syllabus, slides or a photo of the board. Everyone in the course sees it.",
  offline:"Offline · updated", offlineP:"What's here still works; what you add goes when you're back." };
const t = k => (lang === "he" ? HE[k] : null) ?? EN[k] ?? k;
if (lang === "he") { document.documentElement.lang = "he"; document.documentElement.dir = "rtl"; }
/* the service worker words notifications and the offline note in this language (sw.js pushLang) */
function setPushLang(l) { try { caches?.open("stash-prefs").then(c => c.put("lang", new Response(l))).catch(() => {}); } catch {} }
if (isSecureContext && navigator.serviceWorker) setPushLang(lang);
$$("[data-t]").forEach(n => n.textContent = t(n.dataset.t));


/* ============ Hebrew: one wording table for the chrome (never people's content) ============
   Applied to text nodes and labels as the page renders. Engineering: these pairs are the copy for the real i18n. */
const HE_DAYS = { Sun:"יום א׳", Mon:"יום ב׳", Tue:"יום ג׳", Wed:"יום ד׳", Thu:"יום ה׳", Fri:"יום ו׳", Sat:"שבת", Sunday:"יום ראשון", Monday:"יום שני", Tuesday:"יום שלישי", Wednesday:"יום רביעי", Thursday:"יום חמישי", Friday:"יום שישי", Saturday:"שבת", today:"היום", now:"עכשיו", Nov:"בנוב׳", Oct:"באוק׳", Dec:"בדצמ׳" };
const HE_MONTH = { Jan:1, Feb:2, Mar:3, Apr:4, May:5, Jun:6, Jul:7, Aug:8, Sep:9, Oct:10, Nov:11, Dec:12 };
const heWhen = x => String(x).replace(/\b(\d+ (?:h|min)) ago\b/g, "$1") /* "3 h ago" → לפני 3 שעות */.replace(/\b(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b(?: (\d{4}))?/g, (_, d, m, y) => `${d}.${HE_MONTH[m]}${y ? "." + y.slice(2) : ""}`) /* Israeli dates: 12.11 */
  .replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2})\b/g, (_, m, d) => `${d}.${HE_MONTH[m]}`)
  .replace(/\b(\d+) min\b/g, (_, n) => n === "1" ? "לפני דקה" : `לפני ${n} דק׳`).replace(/\bjust now\b/, "עכשיו").replace(/\b(\d+) h\b/g, (_, n) => n === "1" ? "לפני שעה" : n === "2" ? "לפני שעתיים" : `לפני ${n} שעות`).replace(/\bWeek (\d+)\b/g, "שבוע $1").replace(/\b(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sun|Mon|Tue|Wed|Thu|Fri|Sat|today|now|Nov|Oct|Dec)\b/g, d => HE_DAYS[d]);
const HE_EXACT = {
  "Profile":"פרופיל", "Make it yours ·":"להפוך אותו לשלך ·", "Don’t show again":"לא להציג שוב", "Your profile":"הפרופיל שלך", "You · your profile":"את/ה · הפרופיל שלך", "Owner · Profile":"בעלים · פרופיל",
  "Join a course":"הצטרפות לקורס", "Join or start a course":"הצטרפות או פתיחת קורס", "Prototype states":"מצבי אב־טיפוס", "Course files":"קבצי הקורס", "This week":"השבוע", "Earlier":"קודם",
  "All":"הכול", "Lectures":"הרצאות", "Tutorials":"תרגולים", "Homework":"שיעורי בית", "Exams":"מבחנים", "Show":"להראות", "Undo":"ביטול",
  "Copied.":"הועתק.", "Link copied.":"הקישור הועתק.", "Saved to this device.":"נשמר במכשיר הזה.", "Removed.":"הוסר.", "Deleted for everyone.":"נמחק אצל כולם.",
  "Thanks — reported.":"תודה — הדיווח נשלח.", "Just you so far":"בינתיים רק את/ה", "Just you":"רק את/ה", "Invite":"הזמנה", "Invite people":"להזמין אנשים", "Add":"הוספה",
  "Photo":"תמונה", "File":"קובץ", "Link":"קישור", "Note":"פתק", "Back":"חזרה", "Next":"הבא", "Goes to":"לאן זה הולך",
  "Has a date?":"יש תאריך?", "(homework, an exam)":"(שיעורי בית, מבחן)", "Leave a sticker":"להשאיר מדבקה", "Send on WhatsApp":"לשלוח בוואטסאפ",
  "Send to someone nearby":"לשלוח למישהו קרוב", "Report":"דיווח", "Delete":"מחיקה", "Open":"פתיחה", "Save":"שמירה", "Copy":"העתקה",
  "Thanks":"תודה", "Got it":"הבנתי", "Same question":"גם לי יש שאלה", "Helpful":"עזר לי", "Code":"קוד", "Nearby":"בסביבה",
  "Copy code":"העתקת הקוד", "Show big for a room":"להציג בגדול לכיתה", "Print a poster for the classroom":"להדפיס פוסטר לכיתה", "New code":"קוד חדש",
  "Works until Thu, 5 Nov":"בתוקף עד יום ה׳, 5.11", "Post in a WhatsApp group":"לפרסם בקבוצת וואטסאפ", "Copy link":"העתקת הקישור", "More…":"עוד…",
  "See who's near you":"מי בסביבה", "Find people in this room by sound":"למצוא אנשים בחדר לפי צליל", "Invite people near you":"להזמין אנשים שנמצאים לידך", "People in this course":"האנשים בקורס", "Change the cover":"החלפת כריכה",
  "Forget this browser…":"לשכוח את הדפדפן הזה…", "Prototype":"אב־טיפוס", "States…":"מצבים…", "Light paper":"נייר בהיר", "Night paper":"נייר לילה",
  "Someone adds something":"מישהו מוסיף משהו", "For the whole class":"לכל המחזור", "This week in your courses":"השבוע בקורסים שלך", "Class":"מחזור",
  "Only what you add is shared.":"רק מה שמוסיפים משותף.", "Sending…":"שולח…", "Waiting to send":"ממתין לשליחה", "Add a sticker":"להוסיף מדבקה",
  "Coming up":"בקרוב", "More":"עוד", "Close":"סגירה", "Stash for Mac":"Stash ל-Mac", "Cancel":"ביטול", "Leave":"עזיבה", "Forget":"לשכוח",
  "Keep a copy":"לשמור עותק", "Get Stash for Mac":"להוריד את Stash ל-Mac", "Not now":"לא עכשיו", "Let the course come to you":"שהקורס יגיע אלייך",
  "It lands by itself":"זה מגיע לבד", "Paste anywhere":"להדביק בכל מקום", "Talk your notes":"לדבר את הסיכומים",
  "new things arrive as they're added":"דברים חדשים מגיעים ברגע שמוסיפים אותם", "drag slides into your notes":"לגרור שקפים לסיכומים", "hold fn and speak":"להחזיק fn ולדבר",
  "Stash for Mac keeps this course one ⌘V away — even with no tab open.":"Stash ל-Mac שומר את הקורס במרחק ⌘V — גם בלי לשונית פתוחה.",
  "New things land here":"דברים חדשים נוחתים כאן", "Add what you have":"להוסיף מה שיש לך", "Say thanks":"להגיד תודה",
  " — the yellow tab marks what you haven't seen.":" — הלשונית הצהובה מסמנת מה עוד לא ראית.", " with a sticker; no chat to keep up with.":" עם מדבקה; בלי צ׳אט לעקוב אחריו.",
  "Prototype with made-up courses · nothing leaves this page · ":"אב־טיפוס עם קורסים מומצאים · שום דבר לא יוצא מהעמוד · ",
  "Made-up class — a prototype. Nothing you add leaves this page.":"מחזור מומצא — אב־טיפוס. שום דבר לא יוצא מהעמוד.",
  "Tip: paste (⌘V) or drop a file anywhere on the course to add it.":"טיפ: אפשר להדביק (⌘V) או לגרור קובץ לכל מקום בעמוד.",
  "Or share a photo of the board straight from your camera.":"או לצלם את הלוח ישר מהמצלמה.", "Invite code":"קוד הזמנה", "Look up":"חיפוש",
  "Find a course by its code":"חיפוש קורס לפי הקוד", "Nobody near you yet — they need the hub open on their phone or laptop":"עוד אין אף אחד לידך — צריך שהעמוד יהיה פתוח אצלם בטלפון או במחשב",
  "Stop":"עצירה", "Added to ":"נוסף ל", "Added for ":"נוסף ל", "the whole class":"כל המחזור",  " is adding ":" · מוסיפים ", " added ":" · נוסף: ",
  "Back online. Everything you added has gone.":"החיבור חזר. כל מה שהוספת נשלח.", "Waiting to send — it goes by itself when you're back online.":"ממתין לשליחה — יישלח לבד כשהחיבור יחזור.",
  "In the real hub this opens in your browser's PDF viewer.":"בגרסה האמיתית זה נפתח במציג ה-PDF של הדפדפן.", "Add one file at a time for now.":"בינתיים קובץ אחד בכל פעם.",
  "Passwords and codes are never shared.":"סיסמאות וקודים לעולם לא משותפים.", "This kind of file can’t be shared: programs, scripts, web pages and macros are blocked.":"אי אפשר לשתף קובץ מהסוג הזה: תוכנות, סקריפטים, דפי אינטרנט ומאקרו חסומים.", "Files up to 50 MB can be shared.":"אפשר לשתף קבצים עד 50MB.",
  "Nothing here yet":"עוד אין כאן כלום", "Add the syllabus, slides or a photo of the board. Everyone in the course sees it.":"אפשר להוסיף את הסילבוס, מצגות או תמונה של הלוח. כל מי שבקורס יראה.",
  "Courses":"קורסים", "Your courses":"הקורסים שלך", "Report this?":"לדווח על זה?", "Forget this browser?":"לשכוח את הדפדפן הזה?",
  "A course helper will look at it. If three people report it, it's hidden until then.":"עוזר/ת בקורס יבדקו. אם שלושה אנשים מדווחים, זה מוסתר עד אז.",
  "This browser leaves all your courses and forgets your name in them. What others added stays.":"הדפדפן יעזוב את כל הקורסים וישכח את השם שלך בהם. מה שאחרים הוסיפו נשאר.",
  "What you added stays for the others. You can come back with the invite code.":"מה שהוספת נשאר לאחרים. אפשר לחזור עם קוד ההזמנה.",
  "People here see only the name you chose for this course.":"האנשים כאן רואים רק את השם שבחרת לקורס הזה.", "Everyone in the course sees the same cover.":"כולם בקורס רואים את אותה כריכה.",
  "Started this course":"בעלי הקורס", "Photo of the board":"תמונה של הלוח", " is on now ":" מתקיים עכשיו ", "Search or jump to…":"חיפוש או מעבר אל…",
  "New since you were here":"חדש מאז הביקור הקודם", "On the desk":"על השולחן", "Do":"פעולות", "Invite people":"להזמין אנשים", "Show the code big for the room":"להציג את הקוד בגדול לכיתה",
  "Open the week":"לפתוח את השבוע", "Copied":"הועתק", "Saved":"נשמר", "Copy link":"העתקת הקישור", "Sticker":"מדבקה", "Pass to…":"להעביר ל…", "WhatsApp":"וואטסאפ", "Nearby":"בסביבה", "Change":"שינוי", "Move to":"להעביר אל", "Filed under ":"תויק תחת ", "Filed in ":"תויק ב", "Also added by ":"הוסיפו גם ", "Pass to someone at the desk":"להעביר למישהו ליד השולחן", "Lecturer and TA":"מרצה ומתרגלים", "Import .ics":"ייבוא ‎.ics", "Edit":"עריכה", "Add course info":"הוספת פרטי הקורס",
  "Nobody has added the lecturer, office hours or links yet.":"עוד אף אחד לא הוסיף מרצה, שעות קבלה או קישורים.", "The course owner adds these in Stash for Mac.":"מי שפתח/ה את הקורס מוסיף/ה אותם ב-Stash ל-Mac.", "Here now":"כאן עכשיו",
  " · paste or drop anything here — it lands on the desk for ":" · אפשר להדביק או לגרור לכאן — זה נוחת על השולחן ל-", "Search this course":"חיפוש בקורס",
  " took a copy of ":" · נלקח עותק של ", "Passed ":"הועבר ", " to ":" ל-", " — it waits for them with Keep · No thanks.":" — זה מחכה לאישור שלהם.",
  "New things land on the desk":"דברים חדשים נוחתים על השולחן", "Lecturer":"מרצה", "Teaching assistant":"מתרגל", "Moodle":"Moodle", "Zoom — tutorials":"Zoom — תרגולים", "Recordings":"הקלטות", "Owner":"בעלים", "You":"את/ה",
  "New things":"דברים חדשים", "Essentials":"תאריכים חשובים", "Photo of a whiteboard":"תמונה של לוח", "Photo of a lecture slide":"תמונה של שקף מהרצאה",
};
Object.assign(HE_EXACT, {
  "Take a photo":"לצלם", "Choose a photo or file":"לבחור תמונה או קובץ", "What to add":"מה להוסיף", "Join your first course":"מצטרפים לקורס הראשון",
  "Type the code from your invite, or find your course by its code.":"מקלידים את הקוד מההזמנה, או מוצאים את הקורס לפי הקוד שלו.", "No cookies, no tracking.":"בלי עוגיות, בלי מעקב.",
  "Invite code, 6 letters and numbers":"קוד הזמנה, 6 אותיות ומספרים", "Your courses · Stash":"הקורסים שלך · Stash", "What you saved from it stays on this device.":"מה ששמרת ממנו נשאר במכשיר הזה.",
  "Lecturer ·":"מרצה ·", "Teaching assistant ·":"מתרגל ·", "About this course":"על הקורס", "People":"אנשים", "Join":"הצטרפות", "How":"איך", "QR code for the invite":"קוד QR להזמנה",
  "Members add the lecturer, TA, office hours and links themselves. Nothing is copied from Moodle.":"חברי הקורס מוסיפים בעצמם את המרצה, המתרגלים, שעות הקבלה והקישורים. שום דבר לא מועתק מ־Moodle.",
  "Keep a copy of the notes and links on this device until then.":"עד אז אפשר לשמור עותק של הפתקים והקישורים במכשיר הזה.", " is nearby":" בסביבה",
  "Just you so far":"בינתיים אין עוד אף אחד", "Just you":"רק אני", "You · your profile":"אני · הפרופיל שלי", "You":"אני", "Owner · Profile":"בעלים · פרופיל",
  "Stash for Mac keeps this course one ⌘V away — even with no tab open.":"Stash ל־Mac שומר את הקורס במרחק \u2066⌘V\u2069 — גם בלי לשונית פתוחה.",
  "Tip: paste (⌘V) or drop a file anywhere on the course to add it.":"טיפ: אפשר להדביק (\u2066⌘V\u2069) או לגרור קובץ לכל מקום בעמוד.",
  "Let the course come to you":"שהקורס יגיע אליך לבד",
  "No connection. Try again when you’re back online.":"אין חיבור. אפשר לנסות שוב כשהחיבור יחזור.", "Slow down a little — try again in a minute.":"רגע, לאט — אפשר לנסות שוב בעוד דקה.",
  "Loading your courses":"טוענים את הקורסים שלך", "Create a class":"יצירת מחזור", "Show me as here":"להראות שאני כאן", "The server didn’t answer.":"השרת לא ענה.",
  "Save to Files":"שמירה בקבצים", "Save Image":"שמירת התמונה", "That code has expired. Ask for a new one.":"תוקף הקוד פג. אפשר לבקש קוד חדש.",
  "That course isn’t taking new people.":"הקורס לא מקבל אנשים חדשים.", "That code doesn’t match a course. Check it and try again.":"הקוד לא מתאים לאף קורס. כדאי לבדוק ולנסות שוב.",
  "Someone in this course already uses that name. Try another.":"מישהו בקורס כבר משתמש בשם הזה. אפשר לבחור שם אחר.", "Too many tries. Wait a few minutes and try again.":"יותר מדי ניסיונות. כדאי לחכות כמה דקות ולנסות שוב.",
  "This course is full.":"הקורס מלא.", "You can’t join this course.":"אי אפשר להצטרף לקורס הזה.", "That code has expired.":"תוקף הקוד פג.", "That code doesn’t match a course.":"הקוד לא מתאים לאף קורס.",
  "Make it yours · Profile":"להפוך אותו לשלך · פרופיל", "Something went wrong. Try again.":"משהו השתבש. אפשר לנסות שוב.", "That couldn’t be shared — try again from the app":"לא הצלחנו לשתף — אפשר לנסות שוב מהאפליקציה",
  "Put Stash on your Home Screen — it opens like an app.":"אפשר לשים את Stash במסך הבית — הוא ייפתח כמו אפליקציה.", "Put Stash on your Home Screen":"Stash במסך הבית",
  "Put Stash on your Home Screen: tap ":"כדי לשים את Stash במסך הבית: נוגעים ב־", " Share, then ":" שיתוף, ואז ב־", "Add to Home Screen":"הוספה למסך הבית",
  "That’s too big to add (50 MB at most)":"זה גדול מדי (עד \u206650 MB\u2069)", "Nothing to add":"אין מה להוסיף", "On — you’ll hear when something’s added":"פועל — תקבלו התראה כשמשהו נוסף",
  "Couldn’t turn it on":"לא הצלחנו להפעיל",
  "You’ve shared a lot in the last hour. Try again a bit later.":"שיתפת הרבה בשעה האחרונה. אפשר לנסות שוב עוד מעט.", "Sent what you added while offline.":"מה שהוספת בלי חיבור נשלח.",
  "Here's what I found":"הנה מה שמצאתי",
  "Code from your invite":"הקוד מההזמנה", "The exam is in room 204…":"המבחן בחדר 204…", "Scan the code, or open ":"סורקים את הקוד, או פותחים את ", " and type ":" ומקלידים ",
  "It opens in the browser — nothing to install.":"נפתח בדפדפן — בלי להתקין כלום.", "Covers":"כריכות", "Stickers":"מדבקות", "No courses yet":"עוד אין קורסים",
  "A course gets good when everyone taking it is in. Bring the people next to you first.":"קורס נהיה טוב כשכל מי שלומד אותו נמצא בו. כדאי להתחיל מהאנשים שיושבים לידך.",
  "Your profile":"הפרופיל שלי",
  "Asked to join. You’ll be in once the owner says yes.":"הבקשה נשלחה. הקורס ייפתח אחרי אישור של מי שפתח אותו.", "Can’t reach Stash right now":"אין חיבור ל־Stash כרגע",
  "Try again":"לנסות שוב", "Your name in this course":"השם שלך בקורס הזה", "Ready — tap ":"מוכן — נוגעים שוב ב־", " again.":".",
  "Join a course first, then share again.":"קודם מצטרפים לקורס, ואז משתפים שוב.", "Like “Dana added Lecture 5”. Only for your courses; turn it off any time.":"למשל ״אלגוריתמים: קובץ חדש מדנה״. רק מהקורסים שלך; אפשר לכבות בכל רגע.",
  "Turn on":"להפעיל", "Install":"התקנה", "Reload":"רענון", "A new version is ready":"גרסה חדשה מוכנה", "A course helper will look at it. If three people report it, it's hidden until then.":"מישהו מצוות הקורס יבדוק. אם שלושה אנשים מדווחים, זה מוסתר עד אז.",
});
const HE_RE = [
  [/^ · paste or drop anything here — it lands on the desk for (.+)\.$/, (_, who) => ` · אפשר להדביק או לגרור לכאן — זה נוחת על השולחן ${who === "everyone you invite" ? "לכל מי שיוזמן" : "ל־" + who.replace(/^([\d,]+) people$/, "$1 אנשים")}.`],
  [/^Cover (\d+)$/, "כריכה $1"], [/^Nothing in (Lectures|Tutorials|Homework|Exams) this week yet\.$/, (_, sec) => `עוד אין ${HE_EXACT[sec]} השבוע.`],
  [/^(Lectures|Tutorials|Homework|Exams|Course files) · (.+)$/, (_, sec, rest) => `${HE_EXACT[sec]} · ${heWhen(rest)}`],
  [/^([\d,]+) (?:person|people)((?: · started by (.+?))?)((?: · the owner approves new people)?)$/, (_, n, st, who, ap) => `${n === "1" ? "אדם אחד" : n + " אנשים"}${who ? ` · נפתח על ידי ${who}` : ""}${ap ? " · כל הצטרפות באישור" : ""}`],
  [/^Add (.+) to which course\?$/, (_, w) => `לאיזה קורס להוסיף${/^\d/.test(w) ? ` ${w.replace(/ things?$/, " פריטים").replace(/ photos?$/, " תמונות").replace(/ files?$/, " קבצים")}` : ({ "this":" את זה", "this photo":" את התמונה", "this file":" את הקובץ", "this link":" את הקישור", "this text":" את הטקסט" })[w] ?? ` ${w}`}?`],
  [/^Tell me when someone adds to (.+)\?$/, "לקבל התראה כשמישהו מוסיף ל$1?"], [/^([\d,]+) too big to add \(50 MB at most\)\.$/, "$1 גדולים מדי (עד \u206650 MB\u2069)."],
  [/^Found (\d+) dates — add them\?$/, "נמצאו $1 תאריכים — להוסיף אותם?"], [/^Join (.+)\?$/, "להצטרף ל$1?"], [/^Join (.+)$/, "הצטרפות ל$1"],
  [/^You're no longer in (.+)\.$/, "הוסרת מ$1."], [/^(.+) deleted this course\. It's gone in (\d+) days\.$/, "הקורס נמחק על ידי $1, והוא ייעלם בעוד $2 ימים."],
  [/^(\d+) more people here$/, "ועוד $1 כאן"], [/^and ([\d,]+) more$/, "ועוד $1"], [/^(.+) is here$/, "$1 כאן"], [/^(.+) is sharing it$/, "משותף על ידי $1"],
  [/^(.+) · (\d+) courses together$/, "$1 · $2 קורסים ביחד"],
  [/^(PDF|DOCX?|PPTX?|XLSX?)((?: · [^·]+)*)$/, (_, k, rest) => k + rest.replace(/ · ([\d,]+) pages?/, (x, n) => ` · ${n === "1" ? "עמוד אחד" : n + " עמודים"}`).replace(/ · ([\d.,]+) (KB|MB|GB)/, " · \u2066$1 $2\u2069")],
  [/^([\d,]+) people in (.+) will see this\.$/, "$1 אנשים בקורס $2 יראו את זה."], [/^Code (.+)$/, "קוד $1"], [/^Search (.+)$/, "חיפוש ב$1"], [/^Saved by (\d+) people$/, "נשמר אצל $1 אנשים"], [/^put this down (.+)$/, (_, w) => "הונח כאן " + heWhen(w.replace(/ ago$/, "")).replace(/^just now$/, "עכשיו")],
  [/^Added by (.+)\. Only what members type here — nothing is copied from Moodle\.$/, "נוסף על ידי $1. רק מה שחברי הקורס כותבים — שום דבר לא מועתק מ-Moodle."],
  [/^ and ([\d,]+) others$/, " ועוד $1"], [/^Invite people to (.+)$/, "הזמנה לקורס $1"], [/^([\d,]+) people in (.+)$/, "$1 אנשים בקורס $2"],
  [/^Note from (.+)$/, "פתק של $1"], [/^Leave (.+)…$/, "לעזוב את $1…"], [/^Leave (.+)\?$/, "לעזוב את $1?"], [/^Week (\d+)$/, "שבוע $1"],
  [/^([\d,]+) people$/, "$1 אנשים"], [/^1 new$/, "חדש אחד"], [/^([\d,]+) new$/, "$1 חדשים"], [/^1 thing$/, "פריט אחד"], [/^([\d,]+) things?$/, "$1 פריטים"], [/^Add to (.+)$/, "הוספה ל$1"],
  [/^You're in (.+)$/, "נכנסת ל$1"], [/^Cover for (.+)$/, "כריכה ל$1"], [/^Nothing in (.+) this week yet\.$/, "עוד אין $1 השבוע."],
  [/^(.+) · whole class$/, "$1 · כל המחזור"], [/^([\d,]+) people in (.+) will see this\.$/, "$1 אנשים בקורס $2 יראו את זה."],
  [/^Everyone in (.+) will see this\.$/, "כל מי שב$1 יראה את זה."], [/^Everyone you bring into (.+) will see this\.$/, "כל מי שיצטרף ל$1 יראה את זה."],
  [/^ — (paste or drop a file anywhere on the page|a photo of the board is two taps)\.$/, m => m.includes("paste") ? " — להדביק או לגרור קובץ לכל מקום בעמוד." : " — תמונה של הלוח זה שתי נגיעות."],
  [/^Read it out, or let people scan the code\. They join (.+) in the browser\.$/, "להקריא בקול, או לתת לסרוק את הקוד. מצטרפים ל$1 בדפדפן."],
  [/^Anyone with the link can open (.+) in their browser\.$/, "כל מי שיש לו את הקישור יכול לפתוח את $1 בדפדפן."],
  [/^Not seeing them\? Read out the code: $/, "לא רואים אותם? להקריא את הקוד: "],
  [/^Phones and laptops near you with the hub open see “(.+) is nearby — Join”\. You stay visible for 10 minutes\.$/, "טלפונים ומחשבים לידך שהעמוד פתוח אצלם יראו ״$1 בסביבה — הצטרפות״. גלוי ל-10 דקות."],
  [/^Northfield University · (\d+) courses together$/, "Northfield University · $1 קורסים ביחד"],
];
const heAfter = name => (/^[A-Za-z0-9]/.test(name) ? "־" : "") + name; // ל־Algorithms, לאלגוריתמים
const docTitle = v => { document.title = lang === "he" ? heText(v) : v; };
const HE_SKIP = ".body, .big, bdi, .nm b, .cw-h b, .slip, .k-note, .k-link, .ghost-t, h1, input, textarea, select, .coming b";
const heJoin = v => v.replace(/(^|[\s(])([בלמש]|ה)([A-Za-z0-9])/g, "$1$2-$3"); // Israeli style: ל-Algorithms, ב-Calculus
function heText(v) {
  if (HE_EXACT[v] != null) return HE_EXACT[v];
  const tr = v.trim(); if (!tr) return v;
  if (HE_EXACT[tr] != null) return v.replace(tr, HE_EXACT[tr]);
  for (const [re, to] of HE_RE) if (re.test(v)) return heJoin(v.replace(re, to));
  const TERM = /\b(?:Semester (A|B)|(Fall|Spring|Summer|Winter)) (\d{4})\b|\b(\d{4}) \(full year\)/g; // course terms, the Mac's words (CourseTerm.localized)
  if (TERM.test(v)) v = v.replace(TERM, (_, ab, season, y, full) => full ? `${full} (שנתי)` : ab ? `סמסטר ${ab === "A" ? "א׳" : "ב׳"} ${y}` : `${{ Fall: "סתיו", Spring: "אביב", Summer: "קיץ", Winter: "חורף" }[season]} ${y}`);
  if (/\b(Sun|Mon|Tue|Wed|Thu|Fri|Sat|Tuesday|Monday|Sunday|now|Week \d+|\d+ h|\d+ min|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/.test(v)) return heWhen(v);
  return v;
}
if (lang === "he") window.__heText = heText; // scripts/hub/web/hebrew.test.mjs checks live.js / pwa-main.js words through it
function heLocalize(root) { // a label that's already Hebrew was built in Hebrew: people's words inside it stay as written
  if (lang !== "he" || !root) return;
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) { if (!/[A-Za-z]/.test(n.nodeValue) || n.parentElement?.closest(HE_SKIP)) continue; const v = heText(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; }
  for (const el of [...(root.matches?.("[aria-label], [placeholder], [title]") ? [root] : []), ...(root.querySelectorAll?.("[aria-label], [placeholder], [title]") || [])]) for (const a of ["aria-label", "placeholder", "title"]) { // the element itself too (a sheet's own name)
    const v = el.getAttribute(a); if (v && /[A-Za-z]/.test(v)) { const h = heText(v); /* Hebrew course names inside English labels ("Search אלגוריתמים") too */ if (h !== v) el.setAttribute(a, h); } }
}
if (lang === "he") new MutationObserver(ms => { for (const m of ms) if (m.type === "attributes") { const v = m.target.getAttribute(m.attributeName); if (v && /[A-Za-z]/.test(v)) { const h = heText(v); /* Hebrew course names inside English labels ("Search אלגוריתמים") too */ if (h !== v) m.target.setAttribute(m.attributeName, h); } } else for (const n of m.addedNodes) { if (n.nodeType === 1) heLocalize(n); else if (n.nodeType === 3 && n.parentElement) heLocalize(n.parentElement); } })
  .observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-label", "placeholder", "title"] });

/* ============ icons ============ */
const I = {
  plus:'<path d="M10 4v12M4 10h12"/>', chev:'<path d="M8 5l5 5-5 5"/>', down:'<path d="M5 8l5 5 5-5"/>',
  x:'<path d="M5.5 5.5l9 9M14.5 5.5l-9 9"/>', more:'<circle cx="5" cy="10" r=".9" fill="currentColor"/><circle cx="10" cy="10" r=".9" fill="currentColor"/><circle cx="15" cy="10" r=".9" fill="currentColor"/>',
  down:'<path d="M5.5 8l4.5 4.5L14.5 8"/>',
  photo:'<rect x="2.5" y="5" width="15" height="11" rx="2.5"/><path d="M7 5l1.2-2h3.6L13 5"/><circle cx="10" cy="10.5" r="2.8"/>',
  file:'<path d="M5 2.5h6.5L15.5 6.5v11H5z"/><path d="M11.5 2.5v4h4"/>',
  link:'<path d="M8.5 11.5a3.2 3.2 0 0 0 4.5 0l2.6-2.6a3.2 3.2 0 0 0-4.5-4.5l-1 1"/><path d="M11.5 8.5a3.2 3.2 0 0 0-4.5 0l-2.6 2.6a3.2 3.2 0 0 0 4.5 4.5l1-1"/>',
  note:'<path d="M4 4.5h12M4 8.5h12M4 12.5h8"/>', people:'<circle cx="7.5" cy="7" r="2.6"/><path d="M2.5 16c.5-2.6 2.6-4 5-4s4.5 1.4 5 4"/><circle cx="14" cy="7.6" r="2.1"/><path d="M13.6 12.1c2 .1 3.4 1.4 3.9 3.4"/>',
  code:'<rect x="3" y="3" width="5.5" height="5.5" rx="1"/><rect x="11.5" y="3" width="5.5" height="5.5" rx="1"/><rect x="3" y="11.5" width="5.5" height="5.5" rx="1"/><path d="M11.5 11.5h2v2M17 11.5v5.5h-5.5M14.5 15h.01"/>',
  nearby:'<circle cx="10" cy="10" r="1.6" fill="currentColor"/><path d="M6.5 13.5a5 5 0 0 1 0-7M13.5 6.5a5 5 0 0 1 0 7M4 16a8.5 8.5 0 0 1 0-12M16 4a8.5 8.5 0 0 1 0 12"/>',
  copy:'<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M13 4.5V4a1.5 1.5 0 0 0-1.5-1.5h-7A1.5 1.5 0 0 0 3 4v7a1.5 1.5 0 0 0 1.5 1.5H5"/>',
  thumb:'<path d="M6 9.5V16.5H3.5v-7zM8 9.5l2.6-5.4c1-.6 2.2 0 2.1 1.2L12.3 8.5h3.6c1 0 1.8 1 1.5 2l-1.5 4.8c-.2.7-.8 1.2-1.5 1.2H8z"/>',
  share:'<path d="M10 12.5V3M6.5 6.5L10 3l3.5 3.5"/><path d="M6 9.5H5a1.5 1.5 0 0 0-1.5 1.5v5A1.5 1.5 0 0 0 5 17.5h10a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 15 9.5h-1"/>',
  save:'<path d="M10 3v9.5M6.5 9L10 12.5 13.5 9"/><path d="M4 14.5v1A1.5 1.5 0 0 0 5.5 17h9a1.5 1.5 0 0 0 1.5-1.5v-1"/>',
  open:'<path d="M8 4H5.5A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16h9a1.5 1.5 0 0 0 1.5-1.5V12"/><path d="M11 3.5h5.5V9M16.5 3.5L9.5 10.5"/>',
  sticker:'<path d="M16.5 10.5V5a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 5v10A1.5 1.5 0 0 0 5 16.5h5.5z"/><path d="M10.5 16.5V12a1.5 1.5 0 0 1 1.5-1.5h4.5"/>',
  flag:'<path d="M4.5 17.5V3.5M4.5 4h9l-2 3.5 2 3.5h-9"/>', trash:'<path d="M4 5.5h12M8 5.5V4h4v1.5M5.5 5.5l.8 11h7.4l.8-11"/>',
  wifioff:'<path d="M3 3l14 14M7.8 13.6a3.2 3.2 0 0 1 4.4 0M5.2 11a7 7 0 0 1 3-1.7M14.8 11a7 7 0 0 0-1.2-.9M2.5 8a11 11 0 0 1 3.3-2M17.5 8A11 11 0 0 0 9 5.3M10 16.5h.01"/>',
  lock:'<rect x="4.5" y="9" width="11" height="8" rx="2"/><path d="M7 9V6.5a3 3 0 0 1 6 0V9"/>', check:'<path d="M4.5 10.5l3.5 3.5 7.5-8"/>', search:'<circle cx="8.5" cy="8.5" r="5"/><path d="M12.5 12.5l4 4"/>', video:'<rect x="2.5" y="5.5" width="11" height="9" rx="2"/><path d="M13.5 9l4-2.5v7l-4-2.5"/>', chat:'<path d="M10 3.5c-3.9 0-7 2.6-7 5.9 0 1.7.8 3.2 2.2 4.3L4.6 17l3.5-1.6c.6.1 1.2.2 1.9.2 3.9 0 7-2.6 7-5.9S13.9 3.5 10 3.5z"/>', cal:'<rect x="3" y="4.5" width="14" height="12.5" rx="2"/><path d="M3 8.5h14M7 3v3M13 3v3"/>',
  warn:'<circle cx="10" cy="10" r="7.5"/><path d="M10 6v4.5M10 13.5h.01"/>', drop:'<path d="M10 3v10M6 9.5L10 13.5 14 9.5"/><path d="M4 16.5h12"/>',
  leave:'<path d="M12 4.5h2.5A1.5 1.5 0 0 1 16 6v8a1.5 1.5 0 0 1-1.5 1.5H12M8.5 13.5L5 10l3.5-3.5M5 10h8"/>', cover:'<rect x="2.5" y="5" width="15" height="10" rx="2"/><path d="M11 12c1.5-2.5 3-3 5-2.5"/>',
  bell:'<path d="M5.5 13.5V9a4.5 4.5 0 0 1 9 0v4.5l1.3 1.5H4.2z"/><path d="M8.3 16.6a1.8 1.8 0 0 0 3.4 0"/>',
  globe:'<circle cx="10" cy="10" r="7"/><path d="M3 10h14M10 3c2 2 2.8 4.5 2.8 7S12 15 10 17c-2-2-2.8-4.5-2.8-7S8 5 10 3z"/>',
  person:'<circle cx="10" cy="7" r="3"/><path d="M4 16.5c.7-3 3.1-4.5 6-4.5s5.3 1.5 6 4.5"/>', forget:'<path d="M3.5 6h13M7 6V4.5h6V6M5 6l.8 10.5h8.4L15 6M8.5 9.5l3 3M11.5 9.5l-3 3"/>', theme:'<circle cx="10" cy="10" r="6.5"/><path d="M10 3.5v13a6.5 6.5 0 0 0 0-13z" fill="currentColor"/>',
};
const ic = (n, cls = "") => `<svg class="i ${cls}${n === "chev" ? " fwd" : ""}" viewBox="0 0 20 20" aria-hidden="true">${I[n]}</svg>`;

/* ============ made-up data ============ */
const STICKERS = [ { id:1, key:"sticker-01-thumbs-up", word:"thanks" }, { id:2, key:"sticker-02-check", word:"gotIt" },
                   { id:3, key:"sticker-04-question", word:"same" }, { id:4, key:"sticker-06-light-bulb", word:"helpful" } ];
const FOCUS = [[.88,.45],[.88,.8],[.9,.42],[.93,.42],[.87,.4],[.9,.45],[.87,.42],[.91,.42],[.83,.52],[.88,.48]];
const thumb = i => { const [fx, fy] = FOCUS[i]; const x = Math.min(136, Math.max(0, fx * 180 - 22)), y = Math.min(30, Math.max(0, fy * 60 - 15)); return `<span class="thumb"><img data-art="${COVERS[i]}" src="${art(COVERS[i])}" alt="" loading="lazy" style="left:-${x}px;top:-${y}px"></span>`; };
const COVERS = ["cover-01-ribbon","cover-02-torn-edge","cover-03-sheet-stack","cover-04-folded-corner","cover-05-bookmark",
                "cover-06-binder-edge","cover-07-ink-loop","cover-08-grid-corner","cover-09-ruled-strip","cover-10-stamp-circle"];
const ME = "You";
/* profile (optional, profile-ui.js): your name here, and the initial circle with someone's colour or photo */
const myNameHere = () => course()?.myName || S.courses?.find(c => c.myName)?.myName || store.get("liveName", "") || (LIVE ? "You" : lang === "he" ? "יונתן" : "Jonathan");
const DEMO_LOOKS = { Dana: { color: 0 }, Omer: { color: 2 }, Maya: { color: 3 }, Noa: { color: 4 } };   // made-up courses only
const lookOf = (c, name) => name === ME ? S.myLook || null : c?.looks?.get(name) || (LIVE ? null : DEMO_LOOKS[name] || null);
function face(name, look, cls = "") {
  const col = look && CORE?.Profile.COLORS[look.color], photo = look?.photo && CORE?.Profile.photoOK(look.photo) ? look.photo : null;
  const st = col ? ` data-c style="--fl:${col.light[0]};--fil:${col.light[1]};--fd:${col.dark[0]};--fid:${col.dark[1]}"` : "";
  const who = String((name === ME ? myNameHere() : name) || "?").trim();
  return `<span class="ini${cls ? " " + cls : ""}${photo ? " has-photo" : ""}"${st} aria-hidden="true">${photo ? `<img src="${photo}" alt="">` : esc(([...who][0] || "?").toLocaleUpperCase())}</span>`;
}
/* "Make it yours · Profile": once, after joining, until opened or dismissed (core.js Profile.hintVisible) */
function profHint() {
  const st = store.get("profileHint", ""), on = st !== "done" && !S.myLook && (st === "show" || S.welcome);
  if (!on) return "";
  if (st !== "show") store.set("profileHint", "show");
  return `<p class="prof-hint">${face(ME, null)}<span>Make it yours · <button class="linkbtn" data-act="profile">Profile</button></span><button class="x" data-act="prof-hint-x" aria-label="Don’t show again">${ic("x","s")}</button></p>`;
}
let uid = 1;
const m = (o) => ({ id: "m" + (uid++), stickers: {}, mine: [], ...o });

function algorithms() {
  return {
    id:"alg", shelf:"CS Year 2", name:"Algorithms", code:"CS 2041", term:"Spring 2027", uni:"Northfield University", cover:4,
    people:41, names:["Dana","Omer"], invite:"K7Q4MZ", week:6, lastVisit:"Tuesday", owner:"Maya", instructor:"Prof. Dan Levin",
    here:["Omer","Dana","Noam","Yael"], hereMore:3, infoBy:"Maya (course rep)",
    liveNow:{ what:"Tutorial 6", where:"Room 118", until:"17:30", section:"Tutorials" },
    staff:[ { i:"L", role:"Lecturer", name:"Prof. Dan Levin", mail:"levin@northfield.example", hours:"Office hours Tue 14:00–15:00 · room 312" },
            { i:"N", role:"Teaching assistant", name:"Noa Ben-David", mail:"noa.bd@northfield.example", hours:"Office hours Thu 10:00–11:00 · Zoom" } ],
    links:[ ["Moodle", "link"], ["Zoom — tutorials", "video"], ["Recordings", "open"] ],
    events:[ { d:"11", wd:"Wed", t:"Tutorial 6", k:"16:00 · Room 118" }, { d:"12", wd:"Thu", t:"Exam", k:"9:00 · Room 204 · one page of notes", due:true },
             { d:"15", wd:"Sun", t:"Homework 4 due", k:"23:59 · Moodle", due:true }, { d:"16", wd:"Mon", t:"Lecture 13", k:"10:00 · Hall 2" }, { d:"17", wd:"Tue", t:"Office hours", k:"14:00 · Room 312" } ],
    weekTitles:{ 6:"Shortest paths", 5:"Dynamic programming", 4:"Greedy algorithms", 3:"Graphs and BFS", 2:"Sorting, again", 1:"Welcome" },
    files:[ m({ kind:"pdf", title:"Syllabus.pdf", meta:"PDF · 180 KB", by:"Maya", ago:"Week 1" }),
            m({ kind:"pdf", title:"Formula sheet.pdf", meta:"PDF · 92 KB", by:"Dana", ago:"Week 3" }),
            m({ kind:"link", title:"Course page — Moodle", dom:"moodle.northfield.example", url:"https://moodle.northfield.example/course/2041", by:"Maya", ago:"Week 1" }) ],
    items:[
      m({ week:6, kind:"photo", pic:"board-dijkstra", title:"Dijkstra on the board", by:"Omer", ago:"1 h", isNew:true, stickers:{1:9,2:3}, section:"Lectures", ocr:"shortest path from A: relax every edge out of the closest unvisited node" }),
      m({ week:6, kind:"link", title:"Dijkstra’s algorithm, step by step", dom:"visualgo.net", url:"https://visualgo.net/en/sssp", by:"Dana", ago:"Wed", isNew:true, stickers:{4:5}, pic:"link-graph", section:"Lectures" }),
      m({ week:6, kind:"photo", pic:"slide-relax", title:"Slide 23 — relaxation", by:"Noam", ago:"Wed", isNew:true, section:"Lectures", ocr:"Relaxation: if d[u] + w(u,v) < d[v] then d[v] = d[u] + w(u,v)" }),
      m({ week:6, kind:"note", text:"Exam on Nov 12, room 204, 9:00. One handwritten page of notes allowed (both sides).", by:"Maya", ago:"Tue", stickers:{2:14,1:6}, section:"Exams", due:"Thu 12 Nov · 9:00", dueTitle:"Exam", dueSort:20 }),
      m({ week:6, kind:"pdf", title:"Lecture 11 — Shortest paths.pdf", meta:"PDF · 34 pages · 2.4 MB", by:"Maya", ago:"Mon", stickers:{1:11}, section:"Lectures", also:["Dana"], ocr:"Dijkstra's algorithm. Negative edges break the greedy choice — use Bellman–Ford. Running time O((V+E) log V) with a binary heap." }),
      m({ week:6, kind:"pdf", title:"Homework 4.pdf", meta:"PDF · 3 pages · 210 KB", by:"Maya", ago:"Mon", section:"Homework", due:"Sun · 23:59", dueTitle:"Homework 4", dueSort:3 }),
      m({ week:6, kind:"note", text:"Tutorial 6: we did Dijkstra by hand on the graph from the board. Bring the exercise sheet on Thursday.", by:"Dana", ago:"Mon", section:"Tutorials", stickers:{2:4} }),
    ],
  };
}
function earlierFor(c) {
  const tpl = [
    w => m({ week:w, kind:"pdf", title:`Lecture ${w*2-1} — ${c.weekTitles[w]}.pdf`, meta:"PDF · 28 pages · 1.9 MB", by:c.owner, ago:`Week ${w}`, section:"Lectures" }),
    w => m({ week:w, kind:"pdf", title:`Lecture ${w*2} — ${c.weekTitles[w]} (cont.).pdf`, meta:"PDF · 22 pages · 1.6 MB", by:c.owner, ago:`Week ${w}`, section:"Lectures" }),
    w => m({ week:w, kind:"photo", pic: w % 2 ? "board-dp" : "board-dijkstra", title:"The board after class", by:"Omer", ago:`Week ${w}`, stickers:{1:4}, section:"Lectures" }),
    w => m({ week:w, kind:"note", text:`Tutorial ${w} moved to Thursday 14:00, room 118.`, by:"Dana", ago:`Week ${w}`, stickers:{2:7}, section:"Tutorials" }),
    w => m({ week:w, kind:"link", title:"Worked example with code", dom:"github.com", url:"https://github.com/example/algorithms-notes", by:"Ilan", ago:`Week ${w}`, section:"Tutorials" }),
    w => m({ week:w, kind:"pdf", title:`Homework ${w - 1}.pdf`, meta:"PDF · 2 pages", by:c.owner, ago:`Week ${w}`, section:"Homework" }),
    w => m({ week:w, kind:"photo", pic:"slide-relax", title:"Slide from the lecture", by:"Noam", ago:`Week ${w}`, section:"Lectures" }),
  ];
  const counts = { 5:7, 4:5, 3:7, 2:4, 1:3 }, out = [];
  for (let w = c.week - 1; w >= 1; w--) for (let i = 0; i < (counts[w] || 4); i++) out.push(tpl[i % tpl.length](w));
  return out;
}
function courses() {
  const a = algorithms(); a.items.push(...earlierFor(a));
  const calc = { id:"calc", shelf:"CS Year 2", name:"Calculus 2", code:"MATH 1102", term:"Spring 2027", uni:"Northfield University", cover:9,
    people:64, names:["Yael","Ilan"], invite:"C2M8PX", week:6, lastVisit:"Sunday", owner:"Yael", weekTitles:{6:"Taylor series",5:"Power series",4:"Series tests",3:"Improper integrals",2:"Integration by parts",1:"Welcome"},
    files:[ m({ kind:"pdf", title:"Syllabus — Calculus 2.pdf", meta:"PDF · 140 KB", by:"Yael", ago:"Week 1" }) ],
    items:[ m({ week:6, kind:"photo", pic:"board-taylor", title:"Taylor expansion of eˣ", by:"Ilan", ago:"3 h", isNew:true, stickers:{4:2} }),
            m({ week:6, kind:"pdf", title:"Exercise 6.pdf", meta:"PDF · 4 pages", by:"Yael", ago:"Sun" }),
            m({ week:6, kind:"note", text:"Office hours this week: Wed 12–13 only.", by:"Yael", ago:"Sun", stickers:{2:5} }) ] };
  calc.items.push(...earlierFor(calc).slice(0, 14));
  const lin = { id:"lin", shelf:"CS Year 2", name:"Linear Algebra", code:"MATH 1201", term:"Spring 2027", uni:"Northfield University", cover:1,
    people:58, names:["Omer","Dana"], invite:"L1N4AG", week:6, lastVisit:"today", owner:"Omer", weekTitles:{6:"Eigenvalues",5:"Determinants",4:"Linear maps",3:"Bases",2:"Vector spaces",1:"Welcome"},
    files:[], items:[ m({ week:6, kind:"pdf", title:"Lecture 11 — Eigenvalues.pdf", meta:"PDF · 30 pages", by:"Omer", ago:"Mon" }),
                      m({ week:6, kind:"note", text:"Quiz 3 is open book.", by:"Dana", ago:"Mon" }) ] };
  lin.items.push(...earlierFor(lin).slice(0, 10));
  const psy = { id:"psy", shelf:null, name:"Intro to Psychology", code:"PSY 1001", term:"Spring 2027", uni:"Northfield University", cover:6,
    people:186, names:["Noa","Itai"], invite:"P5Y1Q7", week:6, lastVisit:"Monday", owner:"Noa", weekTitles:{6:"Memory",5:"Learning",4:"Perception",3:"The brain",2:"Research methods",1:"Welcome"},
    files:[ m({ kind:"pdf", title:"Reading list.pdf", meta:"PDF · 60 KB", by:"Noa", ago:"Week 1" }) ],
    items:[ m({ week:6, kind:"note", text:"Reading for Thursday: chapter 7, pages 210–245. The quiz covers chapters 6 and 7.", by:"Noa", ago:"2 h", isNew:true, stickers:{1:23,2:8} }),
            m({ week:6, kind:"pdf", title:"Lecture 6 — Memory.pdf", meta:"PDF · 41 pages", by:"Itai", ago:"Mon", stickers:{1:31} }),
            m({ week:6, kind:"link", title:"How we make memories", dom:"youtube.com", url:"https://www.youtube.com/watch?v=example", by:"Shira", ago:"Mon", stickers:{4:12} }) ] };
  psy.items.push(...earlierFor(psy).slice(0, 12));
  return [a, calc, lin, psy];
}
function classes() {
  return [{ id:"cs2", name:"CS Year 2", uni:"Northfield University", people:38, names:["Dana","Omer"], invite:"CSY2K8", owner:"Maya",
    items:[ m({ kind:"note", text:"Group project teams are up — find your team in the sheet before Sunday. Two teams still need a fourth person.", by:"Maya", ago:"2 h", isNew:true, stickers:{2:12} }),
            m({ kind:"photo", pic:"timetable", title:"Our timetable, semester A", by:"Omer", ago:"Week 1", stickers:{1:21} }),
            m({ kind:"link", title:"CS Year 2 — WhatsApp group", dom:"chat.whatsapp.com", url:"https://chat.whatsapp.com/example", by:"Dana", ago:"Week 1" }),
            m({ kind:"pdf", title:"Semester calendar.pdf", meta:"PDF · 1 page · 90 KB", by:"Maya", ago:"Week 1" }) ] }];
}

/* ============ drawings (made-up content: board photos, slides, first pages) ============ */
function pic(name) {
  const W = 'xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"';
  if (name === "board-dijkstra" || name === "board-dp") {
    const blue = "#2F57A6", blk = "#2B2E33";
    const g = name === "board-dijkstra"
      ? `<g stroke="${blue}" stroke-width="2.2" fill="none" stroke-linecap="round"><path d="M46 52 L118 40 L178 70 L120 112 L52 118 Z M46 52 L120 112 M118 40 L120 112"/>
         ${[[46,52,"A"],[118,40,"B"],[178,70,"C"],[120,112,"D"],[52,118,"E"]].map(([x,y,l]) => `<circle cx="${x}" cy="${y}" r="11" fill="#F2F2EE"/><text x="${x}" y="${y+4.5}" font-size="13" text-anchor="middle" fill="${blue}" stroke="none" font-family="Bradley Hand, Comic Sans MS, cursive">${l}</text>`).join("")}</g>
         <g fill="${blk}" font-family="Bradley Hand, Comic Sans MS, cursive" font-size="12"><text x="76" y="40">4</text><text x="152" y="50">2</text><text x="154" y="100">5</text><text x="80" y="128">3</text><text x="74" y="80">1</text><text x="124" y="78">7</text></g>
         <path d="M190 28 q10 -6 18 2" stroke="#C0392B" stroke-width="2" fill="none"/>`
      : `<g stroke="${blk}" stroke-width="1.8" fill="none"><path d="M30 40h170M30 64h170M30 88h170M30 112h170M60 24v104M100 24v104M140 24v104M180 24v104"/></g>
         <g fill="${blue}" font-family="Bradley Hand, Comic Sans MS, cursive" font-size="14">${[[40,58,"0"],[78,58,"1"],[118,58,"1"],[156,58,"2"],[78,82,"1"],[118,82,"2"],[156,82,"3"],[118,106,"3"],[156,106,"5"]].map(([x,y,s]) => `<text x="${x}" y="${y}">${s}</text>`).join("")}</g>`;
    return `<svg ${W} viewBox="0 0 230 160" role="img" aria-label="Photo of a whiteboard"><rect width="230" height="160" fill="#E8E8E2"/><rect x="10" y="12" width="210" height="140" rx="3" fill="#F2F2EE"/>${g}<rect x="0" y="150" width="230" height="10" fill="#B9B6AE"/></svg>`;
  }
  if (name === "board-taylor") {
    return `<svg ${W} viewBox="0 0 230 160" role="img" aria-label="Photo of a whiteboard"><rect width="230" height="160" fill="#2E3B33"/><rect x="8" y="10" width="214" height="140" rx="2" fill="#33463B"/>
      <g fill="#EDEDE3" font-family="Bradley Hand, Comic Sans MS, cursive" font-size="15"><text x="22" y="48">eˣ = 1 + x + x²/2! + x³/3! + …</text><text x="22" y="84">≈ Σ xⁿ / n!</text><text x="22" y="118" font-size="12">converges for all x</text></g>
      <path d="M150 112 q20 -16 40 -2" stroke="#EDEDE3" stroke-width="1.6" fill="none"/></svg>`;
  }
  if (name === "slide-relax") {
    return `<svg ${W} viewBox="0 0 230 160" role="img" aria-label="Photo of a lecture slide"><rect width="230" height="160" fill="#2A2724"/><path d="M28 22 L206 14 L212 128 L22 134 Z" fill="#F4F2EC"/>
      <g fill="#30343A" font-family="-apple-system, Helvetica, Arial" ><text x="40" y="44" font-size="12" font-weight="600" transform="rotate(-2 40 44)">Relaxation</text></g>
      <g stroke="#9AA0A8" stroke-width="3" stroke-linecap="round" transform="rotate(-2 40 60)"><path d="M40 62h120M40 76h96M40 90h130M40 104h70"/></g>
      <rect x="150" y="84" width="40" height="30" rx="3" fill="#82AAF1" opacity=".55" transform="rotate(-2 150 84)"/>
      <ellipse cx="115" cy="160" rx="120" ry="18" fill="#1D1B19"/></svg>`;
  }
  if (name === "timetable") {
    const cols = ["#F1A08F","#F2CF88","#82AAF1","#BFD8B8"]; let cells = "";
    for (let d = 0; d < 5; d++) for (let h = 0; h < 4; h++) if ((d * 3 + h) % 3 !== 1) cells += `<rect x="${34 + d * 38}" y="${36 + h * 28}" width="34" height="24" rx="2" fill="${cols[(d + h) % 4]}" opacity=".75"/>`;
    return `<svg ${W} viewBox="0 0 230 160" role="img" aria-label="Photo of a printed timetable"><rect width="230" height="160" fill="#CFCBC2"/><rect x="14" y="10" width="206" height="146" fill="#FBFAF6" transform="rotate(-1.5 115 80)"/>
      <g transform="rotate(-1.5 115 80)"><g fill="#8A8F96" font-size="8" font-family="-apple-system, Helvetica, Arial">${(lang === "he" ? ["א׳","ב׳","ג׳","ד׳","ה׳"].reverse() : ["Sun","Mon","Tue","Wed","Thu"]).map((d, i) => `<text x="${40 + i * 38}" y="28">${d}</text>`).join("")}</g>${cells}</g></svg>`;
  }
  if (name === "link-graph") {
    return `<svg ${W} viewBox="0 0 160 70" aria-hidden="true"><rect width="160" height="70" fill="#1F2D44"/><g stroke="#7FB0FF" stroke-width="1.6" fill="#1F2D44"><path d="M30 20L70 40L110 18L140 46M70 40L60 62" fill="none"/><circle cx="30" cy="20" r="5"/><circle cx="70" cy="40" r="5" fill="#F2CF88" stroke="#F2CF88"/><circle cx="110" cy="18" r="5"/><circle cx="140" cy="46" r="5"/><circle cx="60" cy="62" r="5"/></g></svg>`;
  }
  return "";
}
function page(title, thumb) { // first page of a PDF: the real one when its adder made a thumbnail (live), else drawn
  if (thumb && /^(https:|blob:)/.test(thumb)) return `<img class="pg-thumb" src="${esc(thumb)}" alt="" loading="lazy" decoding="async">`;
  const s = esc(title.replace(/\.pdf$/i, "")).slice(0, 34);
  return `<svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="100" height="130" fill="#fff"/>
    <text x="10" y="20" font-size="6.4" font-weight="700" fill="#22262A" font-family="-apple-system, Helvetica, Arial">${s}</text>
    <g fill="#D3D6DA"><rect x="10" y="30" width="62" height="2.6" rx="1"/><rect x="10" y="40" width="80" height="2.2" rx="1"/><rect x="10" y="46" width="74" height="2.2" rx="1"/><rect x="10" y="52" width="78" height="2.2" rx="1"/><rect x="10" y="58" width="50" height="2.2" rx="1"/>
    <rect x="10" y="70" width="80" height="2.2" rx="1"/><rect x="10" y="76" width="70" height="2.2" rx="1"/><rect x="10" y="82" width="76" height="2.2" rx="1"/></g>
    <rect x="10" y="92" width="38" height="26" rx="2" fill="#EEF1F5"/><path d="M14 112l9-9 7 6 6-8 8 11" stroke="#9EB3D4" stroke-width="1.4" fill="none"/></svg>`;
}

/* ============ state ============ */
const S = {
  courses: courses(), current: params.get("c") || store.get("course", "alg"), state: params.get("state") || "normal",
  online: navigator.onLine !== false, saves: 0, nudge: false, statusMsg: null, undo: null, arrivals: 0,
  classes: classes(), view: params.get("class") ? "class" : "course", section: "All",
  welcome: !!params.get("joined") || params.get("state") === "welcome",
};
/* In Hebrew the made-up class is an Israeli one (names, courses, notes), so the demo reads like the real thing.
   Only the made-up content — real courses on the server are never rewritten. */
const DEMO_HE = {
  "CS Year 2":"מדמ״ח שנה ב׳", "Algorithms":"אלגוריתמים", "CS 2041":"234247", "Spring 2027":"סמסטר ב׳ תשפ״ז", "Northfield University":"אוניברסיטת נורת׳פילד",
  "Maya":"מאיה", "Dana":"דנה", "Omer":"עומר", "Noam":"נועם", "Yael":"יעל", "Ilan":"אילן", "Noa":"נועה", "Itai":"איתי", "Shira":"שירה", "Jonathan":"יונתן",
  "Prof. Dan Levin":"פרופ׳ דן לוין", "Maya (course rep)":"מאיה (נציגת הקורס)", "Noa Ben-David":"נועה בן־דוד",
  "Tutorial 6":"תרגול 6", "Room 118":"חדר 118", "Exam":"מבחן מועד א׳", "Homework 4 due":"הגשת תרגיל בית 4", "Lecture 13":"הרצאה 13", "Office hours":"שעות קבלה",
  "16:00 · Room 118":"16:00 · חדר 118", "9:00 · Room 204 · one page of notes":"9:00 · חדר 204 · דף נוסחאות אחד", "23:59 · Moodle":"23:59 · Moodle",
  "10:00 · Hall 2":"10:00 · אולם 2", "14:00 · Room 312":"14:00 · חדר 312",
  "Office hours Tue 14:00–15:00 · room 312":"שעות קבלה: יום ג׳ 14:00–15:00 · חדר 312", "Office hours Thu 10:00–11:00 · Zoom":"שעות קבלה: יום ה׳ 10:00–11:00 · Zoom",
  "Zoom — tutorials":"Zoom — תרגולים", "Recordings":"הקלטות",
  "Shortest paths":"מסלולים קצרים ביותר", "Dynamic programming":"תכנון דינמי", "Greedy algorithms":"אלגוריתמים חמדניים", "Graphs and BFS":"גרפים ו־BFS",
  "Sorting, again":"מיון, שוב", "Welcome":"פתיחה", "Taylor series":"טורי טיילור", "Power series":"טורי חזקות", "Series tests":"מבחני התכנסות",
  "Improper integrals":"אינטגרלים מוכללים", "Integration by parts":"אינטגרציה בחלקים", "Eigenvalues":"ערכים עצמיים", "Determinants":"דטרמיננטות",
  "Linear maps":"העתקות לינאריות", "Bases":"בסיסים", "Vector spaces":"מרחבים וקטוריים", "Memory":"זיכרון", "Learning":"למידה", "Perception":"תפיסה",
  "The brain":"המוח", "Research methods":"שיטות מחקר", "Review":"חזרה",
  "Syllabus.pdf":"סילבוס.pdf", "Formula sheet.pdf":"דף נוסחאות.pdf", "Course page — Moodle":"דף הקורס — Moodle",
  "Dijkstra on the board":"דייקסטרה על הלוח", "Dijkstra’s algorithm, step by step":"האלגוריתם של דייקסטרה, צעד אחר צעד", "Slide 23 — relaxation":"שקף 23 — הקלה",
  "Exam on Nov 12, room 204, 9:00. One handwritten page of notes allowed (both sides).":"המבחן ב־12.11, חדר 204, 9:00. מותר דף נוסחאות אחד בכתב יד (משני הצדדים).",
  "Homework 4.pdf":"תרגיל בית 4.pdf", "Homework 4":"תרגיל בית 4",
  "Tutorial 6: we did Dijkstra by hand on the graph from the board. Bring the exercise sheet on Thursday.":"תרגול 6: פתרנו דייקסטרה ביד על הגרף מהלוח. להביא את דף התרגילים ביום חמישי.",
  "The board after class":"הלוח אחרי השיעור", "Worked example with code":"דוגמה פתורה עם קוד", "Slide from the lecture":"שקף מההרצאה",
  "Calculus 2":"חדו״א 2", "MATH 1102":"104032", "Syllabus — Calculus 2.pdf":"סילבוס — חדו״א 2.pdf", "Taylor expansion of eˣ":"פיתוח טיילור של eˣ",
  "Exercise 6.pdf":"תרגיל 6.pdf", "Office hours this week: Wed 12–13 only.":"שעות הקבלה השבוע: רק ביום רביעי 12–13.",
  "Linear Algebra":"אלגברה לינארית", "MATH 1201":"104166", "Quiz 3 is open book.":"בוחן 3 עם חומר פתוח.",
  "Intro to Psychology":"מבוא לפסיכולוגיה", "PSY 1001":"51101", "Reading list.pdf":"רשימת קריאה.pdf",
  "Reading for Thursday: chapter 7, pages 210–245. The quiz covers chapters 6 and 7.":"קריאה ליום חמישי: פרק 7, עמודים 210–245. הבוחן על פרקים 6 ו־7.",
  "How we make memories":"איך נוצרים זיכרונות",
  "Group project teams are up — find your team in the sheet before Sunday. Two teams still need a fourth person.":"הצוותים לפרויקט עלו — מוצאים את הצוות בגיליון עד יום ראשון. לשני צוותים עדיין חסר אדם רביעי.",
  "Our timetable, semester A":"מערכת השעות שלנו, סמסטר א׳", "CS Year 2 — WhatsApp group":"מדמ״ח שנה ב׳ — קבוצת וואטסאפ", "Semester calendar.pdf":"לוח הסמסטר.pdf",
  "Data Structures":"מבני נתונים",
};
const DEMO_HE_RE = [
  [/^Lecture (\d+) — (.+?)( \(cont\.\))?\.pdf$/, (_, n, t, c) => `הרצאה ${n} — ${DEMO_HE[t] || t}${c ? " (המשך)" : ""}.pdf`],
  [/^Tutorial (\d+) moved to Thursday 14:00, room 118\.$/, "תרגול $1 עבר ליום חמישי 14:00, חדר 118."], [/^Homework (\d+)\.pdf$/, "תרגיל בית $1.pdf"],
];
const DEMO_KEYS = new Set(["name", "shelf", "code", "term", "uni", "owner", "instructor", "infoBy", "by", "title", "text", "what", "where", "t", "k", "role", "hours", "dueTitle", "course"]);
function heDemo(x, key) {
  if (typeof x === "string") { if (key && !DEMO_KEYS.has(key)) return x; if (DEMO_HE[x] != null) return DEMO_HE[x]; for (const [re, to] of DEMO_HE_RE) if (re.test(x)) return x.replace(re, to); return x; }
  if (Array.isArray(x)) return x.map(v => heDemo(v, key === "names" || key === "here" || key === "also" || key === "links" ? undefined : key));
  if (x && typeof x === "object") { for (const k of Object.keys(x)) x[k] = k === "weekTitles" ? Object.fromEntries(Object.entries(x[k]).map(([w, v]) => [w, heDemo(v)])) : heDemo(x[k], k); return x; }
  return x;
}
if (lang === "he" && !LIVE) { heDemo(S.courses); heDemo(S.classes); }
if (S.state === "offline") S.online = false;
if (S.state === "long") {
  const c = S.courses[0]; c.name = "Introduction to Probability and Statistics for Engineering Students"; c.code = "STAT 2290–01";
  c.uni = "The Hebrew University of Jerusalem, Faculty of Engineering"; c.names = ["Alexandria-Maria", "Bartholomew"]; c.people = 1240;
  c.weekTitles[6] = "Joint distributions, conditional expectation and the law of total variance";
  c.items[0].title = "Photo of the board — the whole proof of the central limit theorem, part two of three"; c.items[0].by = "Konstantinos Papadopoulos-Weiss";
  c.items[4].title = "Lecture 11 — Joint distributions, covariance, correlation and independence (final, corrected after class).pdf";
  c.items[3].text = "Pneumonoultramicroscopicsilicovolcanoconiosis is a long word. " + c.items[3].text + " Also bring a calculator, a ruler, and your student card; without it you will not be allowed into the hall.";
}
if (S.state === "many") { const c = S.courses[0]; for (let w = 1; w <= 13; w++) c.weekTitles[w] = c.weekTitles[w] || "Review"; c.week = 13; for (let i = 0; i < 480; i++) c.items.push(m({ week: 1 + (i % 13), kind: ["pdf","note","photo","link"][i % 4], title:`Material ${i + 1}.pdf`, meta:"PDF · 1 page", text:`Note number ${i + 1}.`, pic:"board-dp", dom:"example.org", by:["Dana","Omer","Yael","Ilan"][i % 4], ago:`Week ${1 + (i % 13)}` })); }
if (S.state === "worst") { // QA (docs/shared/QA-PLAN.md): realistic worst case per field, at the backend's limits (shared.sql)
  const c = S.courses[0], long80 = "Введение в теорию вероятностей и математическую статистику для инженеров, часть 2"; // 80 = spaces.name limit
  c.name = long80.slice(0, 80); c.code = "STAT 2290–01A"; c.uni = "Rheinisch-Westfälische Technische Hochschule Aachen"; c.people = 200;
  c.names = ["👩🏽‍💻 Aleksandra Wiśniewska-Kowalczyk", "Jo"]; c.here = ["👩🏽‍💻 Aleksandra Wiśniewska-Kowalczyk", "J", "נועה כהן-לוי", "Bartholomew Fitzgerald-Montgomery III"]; c.hereMore = 196; c.owner = "נועה כהן-לוי"; c.weekTitles[6] = "Joint distributions, conditional expectation and the law of total variance";
  const it = c.items;
  it[0].by = "🦄"; it[0].title = "IMG_20261022_101532_HDR_PORTRAIT_FRONT_CAMERA.jpg"; it[0].stickers = { 1: 9999, 2: 1 };
  it[1].title = "https://moodle.northfield.example/mod/resource/view.php?id=12345678901234567890&forcedownload=1&token=abc"; it[1].dom = "moodle.northfield.example"; it[1].by = "J";
  it[2].by = "נועה כהן-לוי"; it[2].title = "שקף 23 — relaxation (תיקון)";
  it[3].text = "<b>Exam</b> moved &amp; **room 204**: https://maps.northfield.example/buildings/engineering/rooms/204?floor=2&wing=north&accessible=true " + "Bring your student card. ".repeat(180);
  it[4].title = "Lecture_11_Joint_Distributions_Covariance_Correlation_Independence_FINAL_v12_corrected_after_class.pdf"; it[4].meta = "PDF · 1,204 pages · 49.9 MB";
  it[5].by = "Bartholomew Fitzgerald-Montgomery III"; it[5].due = "Sun 31 Dec · 23:59"; it[5].dueTitle = "Homework 4 — the extended version with all bonus questions";
  it[6].text = "ok"; it[6].stickers = {};
  c.files[0].title = "Syllabus (final) (1) (2) — please read before the first lecture, it has the grading rules.pdf"; c.files[0].meta = "PDF · 50.0 MB";
  S.courses[1].name = "A"; S.courses[1].code = ""; S.courses[1].people = 1;
}
if (S.state === "empty") { const c = S.courses[0]; c.items = []; c.files = []; c.people = 1; c.names = []; }
if (S.state === "none") { S.courses = []; S.view = "course"; }
if (LIVE) document.querySelector('.side-btn[data-act="states"]')?.remove();   // the demo's state list never shows to real people (launch QA B3)
if (LIVE) { S.courses = []; S.state = "normal"; S.view = "course"; S.classes = [{ id: "none", name: "", uni: "", people: 0, names: [], invite: "", owner: "", items: [] }]; S.liveBlock = () => { document.title = "Stash"; renderLoading(); }; }
const course = () => S.courses.find(c => c.id === S.current) || S.courses[0];
const isOwn = it => it.live ? !!it.own : it.by === ME;   // live: by id (a classmate may be called "You")
const theClass = () => S.classes[0];
const allItems = () => [...S.courses.flatMap(c => [...c.items, ...c.files].map(i => (i._c = c, i))), ...theClass().items.map(i => (i._c = null, i))];
const findItem = id => allItems().find(x => x.id === id);
const fold = x => String(x ?? "").normalize("NFD").replace(/[\u0591-\u05C7\u0300-\u036f]/g, "").toLowerCase(); // Hebrew niqqud and Latin accents don't matter in search
const shows = it => (S.section === "All" || it.section === S.section) && (!S.q || fold([it.title, it.text, it.by, it.dom].join(" ")).includes(fold(S.q)));

/* ============ render ============ */
function render() {
  const c = course();
  if (c) pwa(P => P.openedCourse?.(c.id));
  hooks.course?.(S.view === "class" ? null : c);   // live.js: say "here" in the open course only
  renderSide();
  if (LIVE && S.liveBlock) return S.liveBlock();
  if (!c) return renderNoCourses();
  if (S.view === "class") return renderClass();
  docTitle(`${c.name} · Stash`);
  $("#tb-title").textContent = c.name; $("#tb-back").textContent = c.shelf || t("courses");
  if (S.state === "loading" && !S._loaded) { renderLoading(); setTimeout(() => { S._loaded = true; render(); }, 1400); return; }
  const sections = [...new Set(c.items.map(i => i.section).filter(Boolean))], shelf = phone(); // phone: the shelf (docs/shared/HUB-SIMPLE.md, Jonathan's pick B)
  if (S.section !== "All" && (shelf || !sections.includes(S.section))) S.section = "All";
  const weekNow = shelf ? c.items.filter(shows).map((it, i) => [it, i]).sort((a, b) => (b[0].week ?? 0) - (a[0].week ?? 0) || a[1] - b[1]).map(x => x[0])
    : c.items.filter(i => i.week === c.week && shows(i)), earlier = shelf ? [] : [...new Set(c.items.filter(i => i.week < c.week && shows(i)).map(i => i.week))].sort((a, b) => b - a);
  const coming = c.items.filter(i => i.due).sort((a, b) => a.dueSort - b.dueSort);
  const removed = S.state === "removed", deleted = S.state === "deleted", canAdd = !removed && !deleted;
  const isEmpty = c.items.length === 0 && c.files.length === 0;
  if (shelf && !removed && !deleted) return renderFolio(c, isEmpty);
  $("#course").innerHTML = `
    <div class="course-top">
      <header class="hd">
        <span class="cov"><img data-art="${COVERS[c.cover]}" src="${art(COVERS[c.cover])}" alt="" decoding="async"></span>
        <div class="id">${c.shelf ? `<span class="shelf">${esc(c.shelf)}</span>` : ""}<h1 id="course-name">${esc(c.name)}</h1>
          <div class="meta">${esc([c.code, c.term, c.instructor].filter(Boolean).join(" · "))}${c.here ? "" : `<span class="here-slot" id="here-slot">${presenceInner(c)}</span>`}</div></div>
        <span class="grow"></span>
        ${isEmpty ? "" : `<label class="search">${ic("search","s")}<input id="q" type="search" placeholder="Search ${esc(c.name)}" value="${esc(S.q || "")}" autocomplete="off" aria-label="Search this course"><span class="kbd-hint" aria-hidden="true">⌘K</span></label>`}
        <span class="acts-hd">${canAdd ? `<button class="btn" data-act="invite">${ic("people","s")}<span>${t("bring")}</span></button>
          ${isEmpty ? "" : `<button class="btn primary add-top" data-act="add">${ic("plus","s")}<span>${addLabel(c)}</span></button>`}` : ""}
          <button class="btn icon quiet" data-act="more" aria-label="More" aria-haspopup="menu">${ic("more")}</button></span>
      </header>
      ${S.welcome && !shelf ? `<aside class="welcome" aria-labelledby="w-h"><img data-art="c2-added" src="${art("c2-added")}" alt="">
        <div><h2 id="w-h">You're in ${esc(c.name)}</h2><ul>
          <li><b>New things land on the desk</b> — the yellow tab marks what you haven't seen.</li>
          <li><b>Add what you have</b> — ${phone() ? "a photo of the board is two taps" : "paste or drop a file anywhere on the page"}.</li>
          <li><b>Say thanks</b> with a sticker; no chat to keep up with.</li></ul>
          <div class="acts"><button class="btn" data-act="welcome-ok">Got it</button></div></div></aside>` : ""}
      ${profHint()}
      ${removed ? `<div class="notice">${ic("leave")}<p><b>You're no longer in ${esc(c.name)}.</b><small>What you saved from it stays on this device.</small></p></div>` : ""}
      ${deleted ? `<div class="notice">${ic("trash")}<p><b>${esc(c.owner)} deleted this course. It's gone in 5 days.</b><small>Keep a copy of the notes and links on this device until then.</small></p><button class="btn">Keep a copy</button></div>` : ""}
    </div>
    <div class="workspace">
      <section class="desk" id="desk" aria-labelledby="h-now">
        ${!isEmpty && c.here ? `<div class="seats" aria-label="Here now">${c.here.map(n => `<button class="seat" data-act="people" data-seat="${esc(n)}" aria-label="${esc(n)} is here">${face(n, lookOf(c, n))}<bdi>${esc(n)}</bdi></button>`).join("")}${c.hereMore ? `<button class="seat more" data-act="people" aria-label="${c.hereMore} more people here"><bdi dir="ltr">+${c.hereMore}</bdi></button>` : ""}</div>` : ""}
        ${isEmpty ? emptyCourse(c) : `
        <div class="desk-head"><h2 id="h-now">${t("week")} ${c.week} <span class="sub"><bdi>${esc(c.weekTitles[c.week] || "")}</bdi></span></h2>
          ${sections.length >= 2 ? `<span class="seg" role="tablist" aria-label="Show">${["All", ...["Lectures","Tutorials","Homework","Exams"].filter(x => sections.includes(x))].map(x => `<button role="tab" data-act="section" data-s="${x}" aria-selected="${x === S.section}">${x}</button>`).join("")}</span>` : ""}</div>
        ${c.liveNow && S.state !== "removed" && S.state !== "deleted" ? `<div class="live" role="note"><span class="dotl" aria-hidden="true"></span><span><b>${esc(c.liveNow.what)}</b> is on now <span class="k">· <bdi>${esc(lang === "he" ? c.liveNow.where.replace(/^Room\b/, "חדר").replace(/^Hall\b/, "אולם") : c.liveNow.where)}</bdi> · ${lang === "he" ? "עד" : "until"} ${esc(c.liveNow.until)}</span></span><span class="grow"></span>
          <button class="btn primary" data-act="quick" data-q="photo" data-section="${esc(c.liveNow.section)}">${ic("photo","s")}<span>Photo of the board</span></button></div>` : ""}
        <div class="info"><div class="status" id="status" role="status" aria-live="polite"></div></div>
        <div class="grid" id="grid-now" data-week="${c.week}">${(shelf ? weekNow.slice(0, S.shelfLim = S.shelfFor === c.id ? Math.max(SHELF_PAGE, S.shelfLim || 0) : (S.shelfFor = c.id, SHELF_PAGE)) : weekNow).map(sheet).join("") || `<p style="grid-column:1/-1;margin:0;color:var(--ink2)">${S.q ? `Nothing matches “${esc(S.q)}” this week.` : `Nothing in ${esc(S.section)} this week yet.`}</p>`}</div>
        ${shelf && weekNow.length > S.shelfLim ? `<div id="shelf-more" aria-hidden="true"></div>` : ""}
        ${earlier.length ? `<div class="weeks" aria-label="${t("earlier")}">${earlier.map(w => weekRow(c, w)).join("")}</div>` : ""}
        ${canAdd ? `<div class="you" id="you"><button class="you-face" data-act="profile" aria-label="Your profile">${face(ME, S.myLook)}</button><p><b>You</b> · paste or drop anything here — it lands on the desk for ${c.people > 1 ? `${c.people} people` : "everyone you invite"}.</p>
          <span class="q"><button class="btn" data-act="quick" data-q="photo">${ic("photo","s")}<span>${t("photo")}</span></button><button class="btn" data-act="quick" data-q="file">${ic("file","s")}<span>${t("file")}</span></button>
          <button class="btn" data-act="quick" data-q="link">${ic("link","s")}<span>${t("link")}</span></button><button class="btn" data-act="quick" data-q="note">${ic("note","s")}<span>${t("note")}</span></button></span></div>` : ""}`}
      </section>
      <aside class="rail" aria-label="About this course">${railCards(c, coming)}</aside>
    </div>
    <div id="nudge-slot">${S.nudge ? nudgeCard() : ""}</div>`;
  if (isEmpty) { const st = $("#desk"); if (st && !$("#status", st)) st.insertAdjacentHTML("afterbegin", `<div class="status" id="status" role="status" aria-live="polite"></div>`); }
  $("#foot").innerHTML = LIVE ? `<p>Connected to the real Stash server · what you add is shared with the course · <a href="../">Stash for Mac</a></p>` : `<p>Prototype with made-up courses · nothing leaves this page · <a href="../">Stash for Mac</a></p>`;
  $("#bottombar").innerHTML = !(canAdd && !isEmpty) ? "" : shelf ? `<button class="btn primary" data-act="add">${ic("photo","s")}<span>${t("addOne")}</span></button>` : c.liveNow // during a lecture/tutorial the one obvious thing is the photo of the board
    ? `<button class="btn primary" data-act="quick" data-q="photo" data-section="${esc(c.liveNow.section)}">${ic("photo","s")}<span>Photo of the board</span></button><button class="btn" style="flex:0 0 46px;padding:0" data-act="add" aria-label="${esc(addLabel(c))}">${ic("plus")}</button>`
    : `<button class="btn primary" data-act="add">${ic("plus","s")}<span>${addLabel(c)}</span></button>`;
  $("#bottombar").style.display = canAdd && !isEmpty ? "" : "none";
  renderStatus();
  observeTitle();
  if (shelf) shelfMore(weekNow);
  hooks.rendered?.(c);
}
/* ============ the phone: the course as a paper folio (docs/shared/HUB-DIRECTION.md; Jonathan's pick: the cover folds into
   the top bar as you scroll, the three dates in one card) ============
   Cover with the moment line → Essentials (Next exam · Due · Next class, core.js Essentials) → New since … → the shelf
   (This week / Earlier) → one bar. During class: the line says so, today's board leads, the bar is camera-first. */
let CORE = null; import("./core.js").then(mod => { CORE = mod; if (!LIVE && params.get("here")) demoHere(+params.get("here")); if ((phone() || params.get("here")) && course() && S.view !== "class") render(); }).catch(() => {});
function demoHere(n) { // prototype only (?here=6): classmates with the course open, for pictures and tests
  const names = lang === "he" ? ["דנה לוי", "עומר", "נועה כהן", "Maya Ben David", "אילן", "שירה"] : ["Dana Levi", "Omer", "Noa Cohen", "Maya Ben David", "Ilan", "Shira"];
  const members = new Map(names.map((x, i) => [`p${i}`, x]));
  for (const c of S.courses) c.present = CORE.Presence.people(Object.fromEntries(names.slice(0, n).map((x, i) => [`p${i}`, [{ p: `p${i}` }]])), { me: "me", members });
}
const tzHere = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return undefined; } };
function wallClock(text) { // the prototype's made-up courses carry display strings ("Thu 12 Nov · 9:00"); live rows carry due_at
  const p = String(text ?? "").toLowerCase(), day = CORE.EssentialsNotice.date(p, new Date(), tzHere()), t = CORE.EssentialsNotice.clock(p);
  return day ? new Date(day.y, day.m - 1, day.d, t?.h ?? 0, t?.m ?? 0) : null;
}
function essRows(c) { // what Essentials.pick reads, in the server's row shapes
  const files = new Set(c.files.map(i => i.id));
  const materials = [...c.items, ...c.files].filter(i => i.due || i.dueAt).map(i => ({ id: i.id, title: i.title,
    due_at: i.dueAt ?? wallClock(i.due)?.toISOString(), due_title: i.dueTitle, pinned: files.has(i.id) || !!i.pinned })).filter(r => r.due_at);
  const events = (c.events || []).filter(e => !e.due).map((e, n) => { // the prototype's due:true rows mirror its dated sheets
    const [time, ...where] = String(e.k || "").split(" · "), at = e.starts_at ? new Date(e.starts_at) : wallClock(`${e.wd} ${time}`);
    return at && { id: e.id ?? `demo-${n}`, kind: e.kind ?? CORE.CourseEvents.guessKind(e.title ?? e.t), title: e.title ?? e.t, starts_at: at.toISOString(),
      ends_at: e.ends_at ?? null, all_day: !!e.all_day, location: e.location ?? where[0] ?? null, repeat_until: e.repeat_until ?? null }; }).filter(Boolean);
  return { materials, events, lessons: c.lessons || [] };
}
function essentialsOf(c, now = new Date()) { if (!CORE?.Essentials) return []; try { return CORE.Essentials.pick(essRows(c), now, tzHere()); } catch { return []; } }
/* "Thu 12 Nov · 09:00" / Israeli "יום ה׳ 12.11 · 09:00" (24-hour in both) */
const dueWords = (d, allDay) => (lang === "he" ? `${d.toLocaleDateString("he", { weekday: "short" })} ${d.getDate()}.${d.getMonth() + 1}` : d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }))
  + (allDay ? "" : " · " + d.toLocaleTimeString(lang === "he" ? "he" : "en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }));
function essCard(e, now = new Date()) { // {l, v, s}: "Next exam" / "12 Nov" / "Wed · 9:00"
  const d = new Date(e.at), loc = lang === "he" ? "he" : "en-GB", days = Math.round((new Date(d).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 864e5);
  const wd = d.toLocaleDateString(loc, { weekday: "short" }), time = e.allDay ? "" : d.toLocaleTimeString(loc, { hour: "numeric", minute: "2-digit" });
  const day = days === 0 ? (lang === "he" ? "היום" : "Today") : days === 1 ? (lang === "he" ? "מחר" : "Tomorrow") : wd;
  const l = CORE.Essentials.label(e.slot, lang);
  const short = x => String(x || "").replace(/^Homework\s*/i, "HW ").replace(/^Assignment\s*/i, "Assn ").replace(/^Exercise\s*/i, "Ex ").trim(); // index cards are ~100 pt wide
  if (e.slot === "exam") return { l, v: lang === "he" ? `${d.getDate()}.${d.getMonth() + 1}` : d.toLocaleDateString(loc, { day: "numeric", month: "short" }), s: [day, time].filter(Boolean).join(" · "), place: e.place };
  if (e.slot === "due") return { l, v: short(e.title), s: [day, time].filter(Boolean).join(" · ") };
  if (e.isNow) return { l, v: lang === "he" ? "עכשיו" : "Now", s: e.place || "" };
  return { l, v: days <= 1 ? time || day : [wd, time].filter(Boolean).join(" "), s: [days <= 1 && time ? day : "", e.place].filter(Boolean).join(" · "), when: [days <= 1 ? day : wd, time].filter(Boolean).join(" ") };
}
const soonWords = (e, now = new Date()) => CORE.Essentials.headline(e, now, tzHere(), lang); // "Exam in 5 days"
function duringClass(c, ess) { // the timetable says a class is on, or 2+ things arrived in the last 30 min
  if (params.get("moment") === "during") return c.liveNow || { what: lang === "he" ? "שיעור" : "Class" };
  if (params.get("moment") === "between" || (!LIVE && params.get("moment") !== "auto")) return null;
  const now = ess.find(e => e.slot === "class" && e.isNow); if (now) return { what: now.title || "Class", where: now.place || "" };
  // A course with class times knows when class is: the guess from a burst of posts is only for courses without them
  // (launch QA S3: "Class now" next to "Next class · Tomorrow 9:00").
  if ((c.events || []).some(e => e.kind === "lecture" || e.kind === "tutorial") || c.lessons?.length) return null;
  return c.items.filter(i => i.at && Date.now() - i.at < 30 * 60000).length >= 2 ? { what: lang === "he" ? "שיעור" : "Class" } : null;
}
// Who's here now: up to 4 initial circles + "+N" (core.js Presence); live.js fills c.present from Realtime Presence and
// redraws only this slot. The name shows on hover, keyboard focus or a tap; screen readers hear one sentence.
const presenceSeen = new Set();
function presenceInner(c) {
  const ppl = c?.present || [];
  if (!ppl.length || !CORE?.Presence) return "";
  const { shown, more } = CORE.Presence.shown(ppl), rest = ppl.slice(shown.length).map(p => p.name).join(", ");
  const html = `<span class="here-now" role="group" aria-label="${esc(CORE.Presence.label(ppl, lang))}">${shown.map(p => {
    const fresh = !presenceSeen.has(c.id + p.id); presenceSeen.add(c.id + p.id);
    // their profile colour or photo when they chose one (hub-profile's looks), else a brand tone from the name
    const look = lookOf(c, p.name), col = look && CORE.Profile?.COLORS[look.color], photo = look?.photo && CORE.Profile?.photoOK(look.photo) ? look.photo : null;
    const st = col ? ` data-c style="--fl:${col.light[0]};--fil:${col.light[1]};--fd:${col.dark[0]};--fid:${col.dark[1]}"` : "";
    return `<button class="pc t-${p.colour}${fresh ? " in" : ""}${photo ? " has-photo" : ""}"${st} data-act="here-who" data-name="${esc(p.name)}" aria-label="${esc(p.name)}">${photo ? `<img src="${photo}" alt="">` : `<span aria-hidden="true">${esc(p.initials)}</span>`}</button>`; }).join("")}${more
    ? `<button class="pc more" data-act="here-who" data-name="${esc(rest)}" aria-label="${esc(rest)}"><bdi dir="ltr" aria-hidden="true">+${more}</bdi></button>` : ""}</span>`;
  return html;
}
const remindersOn = c => store.get(`remind.${c?.id}`, true);  // one switch per course (Mac: its own; phone: + set_reminders)
const showHere = () => store.get("showHere", true);           // this device: "Show me as here"
function renderPresence() { const el = $("#here-slot"); if (el) el.innerHTML = presenceInner(course()); }
const newWord = n => lang === "he" ? (n === 1 ? "חדש אחד" : `${n} חדשים`) : `${n} new`;
function renderFolio(c, isEmpty) {
  const ess = essentialsOf(c), live = duringClass(c, ess), nNew = c.items.filter(i => i.isNew);
  const exam = ess.find(e => e.slot === "exam"), soon = ess.filter(e => e.slot !== "class").sort((a, b) => a.at - b.at)[0];
  const examDays = exam ? (new Date(exam.at) - Date.now()) / 864e5 : 99;
  const moment = live ? `<span class="now-dot" aria-hidden="true"></span><b>${esc(live.what)} ${lang === "he" ? "עכשיו" : "now"}</b>${live.where ? ` <span class="k">· <bdi>${esc(live.where)}</bdi>${live.until ? ` · ${lang === "he" ? "עד" : "until"} ${esc(live.until)}` : ""}</span>` : ""}`
    : exam && examDays <= 13 ? `<b class="ink soon">${esc(soonWords(exam))}</b>`
    : soon && (new Date(soon.at) - Date.now()) / 864e5 <= 2 ? `<b class="ink soon">${esc(soonWords(soon))}</b>` : "";
  // Q1 (docs/shared/hub-design/quiet-2026-10-27): one accent — the nearest exam or deadline within a week gets coral, nothing else
  const hot = soon && (new Date(soon.at) - Date.now()) / 864e5 <= 7 ? soon : null;
  const sub = [c.code, c.instructor].filter(Boolean).join(" · ");
  const essHTML = !ess.length ? "" : live
    ? `<div class="ess-strip" role="list" aria-label="Essentials">${ess.map(e => { const k = essCard(e); return `<div role="listitem"><b dir="auto">${esc(e.slot === "class" ? t("next") : e.slot === "exam" ? e.title : k.v)}</b><span>${esc(e.slot === "exam" ? k.v : e.slot === "due" ? k.s.replace(/ · .*/, "") : k.when || k.v)}</span></div>`; }).join("")}</div>`
    : `<div class="ess" role="list" aria-label="Essentials">${ess.map(e => { const k = essCard(e);
        return `<div class="icard ${e === hot ? "hot" : ""}" role="listitem"><span class="l">${esc(k.l)}</span><b class="v" dir="auto">${esc(k.v)}</b><span class="s">${esc(k.s)}</span></div>`; }).join("")}</div>`;
  const ask = S.essAsk && S.essAsk.c === c.id && CORE ? (() => { const a = S.essAsk.s, now = new Date();
    return `<div class="ess-ask" role="group" aria-label="Add to Essentials?"><span>${lang === "he" ? "להוסיף לתאריכים?" : "Add to the dates?"} <b dir="auto">${esc(CORE.Essentials.label(a.slot, lang))} · ${esc(a.slot === "due" ? CORE.Essentials.line(a, now, tzHere(), lang) : `${a.title} · ${CORE.Essentials.line(a, now, tzHere(), lang)}`)}</b></span>
      <span class="ess-ask-b"><button class="btn" data-act="ess-no">${lang === "he" ? "לא עכשיו" : "Not now"}</button><button class="btn primary" data-act="ess-add">${lang === "he" ? "הוספה" : "Add"}</button></span></div>`; })() : "";
  const thisWeek = c.items.filter(i => (i.week ?? c.week) >= c.week), earlier = c.items.filter(i => (i.week ?? c.week) < c.week).map((it, i) => [it, i]).sort((a, b) => (b[0].week ?? 0) - (a[0].week ?? 0) || a[1] - b[1]).map(x => x[0]);
  if (!earlier.length) S.shelfTab = "week";
  const tab = S.shelfTab === "earlier" ? "earlier" : "week", list = tab === "earlier" ? earlier : thisWeek;
  S.shelfLim = S.shelfFor === c.id + tab ? Math.max(SHELF_PAGE, S.shelfLim || 0) : (S.shelfFor = c.id + tab, SHELF_PAGE);
  const board = live ? c.items.filter(i => i.kind === "photo" && (i.week ?? c.week) >= c.week).slice(0, 3) : [];
  docTitle(`${c.name} · Stash`); $("#tb-title").innerHTML = `${thumb(c.cover)}<span class="tt"><b>${esc(c.name)}</b>${moment ? `<small>${moment.replace(/<span class="now-dot"[^>]*><\/span>/, "")}</small>` : ""}</span>`;
  $("#tb-back").textContent = c.shelf || t("courses");
  $("#course").innerHTML = `<div class="folio ${live ? "during" : ""}">
    <header class="fcover">
      <h1 id="course-name"><button class="fname" data-act="switcher" aria-haspopup="dialog">${esc(c.name)}${ic("down","s")}</button></h1>
      <div class="fsubline">${sub ? `<span class="sub">${esc(sub)}</span>` : ""}<span class="here-slot" id="here-slot">${presenceInner(c)}</span></div>
      ${moment ? `<p class="moment">${moment}</p>` : ""}</header>
    ${essHTML}${ask}${hooks.datesCard?.(c, ess) ?? ""}${profHint()}
    <div class="status" id="status" role="status" aria-live="polite"></div>
    ${isEmpty ? emptyCourse(c) : `
    ${board.length ? `<section class="fsec board" aria-labelledby="h-board"><h2 class="fh" id="h-board">${lang === "he" ? "הלוח של היום" : "Today’s board"}</h2>
      <div class="board-grid">${board.map(sheet).join("")}</div></section>` : ""}
    ${!live && nNew.length ? `<section class="fsec" aria-labelledby="h-new"><h2 class="fh" id="h-new">${t("newSince")[0].toUpperCase() + t("newSince").slice(1)} ${esc(lang === "he" ? heWhen(c.lastVisit) : c.lastVisit)}<span class="vh">, ${nNew.length}</span></h2>
      <div class="newrow">${nNew.slice(0, 4).map(sheet).join("")}</div></section>` : ""}
    <section class="fsec" aria-label="${esc(c.name)}">
      ${earlier.length ? `<div class="ftabs" role="tablist">${[["week", t("thisWeek")], ["earlier", t("earlier")]].map(([k, w]) => `<button role="tab" data-act="shelf-tab" data-tab="${k}" aria-selected="${k === tab}">${w}</button>`).join("")}</div>` : `<h2 class="fh">${t("thisWeek")}</h2>`}
      <div class="grid" id="grid-now" data-week="${c.week}">${list.slice(0, S.shelfLim).map(sheet).join("") || `<p class="empty-line">${lang === "he" ? "עוד אין כלום השבוע." : "Nothing this week yet."}</p>`}</div>
      ${list.length > S.shelfLim ? `<div id="shelf-more" aria-hidden="true"></div>` : ""}</section>`}
  </div>`;
  $("#foot").innerHTML = "";
  const bar = $("#bottombar");
  bar.innerHTML = isEmpty ? "" : live
    ? `<button class="btn primary cam" data-act="quick" data-q="photo" data-section="${esc(c.liveNow?.section || "")}">${ic("photo")}<span>${lang === "he" ? "צילום הלוח" : "Photo of the board"}</span></button><button class="btn plus" data-act="add" aria-label="${esc(t("addOne"))}">${ic("plus")}</button>`
    : `<button class="btn primary wide" data-act="add">${ic("plus","s")}<span>${t("addOne")}</span></button>`;
  bar.className = "bottombar" + (live ? " during" : ""); bar.style.display = isEmpty ? "none" : "";
  renderStatus(); observeTitle();
  shelfMore(list);
}
const SHELF_PAGE = 24; // the phone shelf draws 24 tiles, then 24 more as you near the end (500 things stay light)
let shelfObs = null;
function shelfMore(list) {
  shelfObs?.disconnect(); const end = $("#shelf-more"); if (!end) return;
  shelfObs = new IntersectionObserver(es => { if (!es.some(e => e.isIntersecting)) return;
    const g = $("#grid-now"), next = list.slice(S.shelfLim, S.shelfLim + SHELF_PAGE); S.shelfLim += next.length;
    g?.insertAdjacentHTML("beforeend", next.map(sheet).join(""));
    if (S.shelfLim >= list.length) { shelfObs.disconnect(); end.remove(); } }, { rootMargin: "600px 0px" });
  shelfObs.observe(end);
}
const dueSoon = it => it.due && it.dueSort != null && it.dueSort <= 3; // a deadline within 3 days
const KIND_WORDS = { photo: ["a board photo", "photos"], link: ["a link", "links"], pdf: ["a lecture file", "lecture files"], note: ["a note", "notes"] };
function newSummary(items) { // "a board photo, a link and 2 lecture files"
  const by = {}; items.forEach(i => by[i.kind] = (by[i.kind] || 0) + 1);
  const parts = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => n === 1 ? KIND_WORDS[k][0] : `${n} ${KIND_WORDS[k][1]}`);
  return parts.length > 1 ? parts.slice(0, -1).join(", ") + " and " + parts.at(-1) : parts[0] || "";
}
function guessFiling(d) { // where a new thing probably goes, and why — always one tap to change
  const c = course(), name = (d.title || d.text || "") + "";
  if (S.addSection) return { section: S.addSection, why: `${c.liveNow?.what || S.addSection} is on now` };
  if (/lecture|lec\b|slides?|הרצאה/i.test(name)) return { section: "Lectures", why: "from its name" };
  if (/homework|\bhw\b|exercise|ex\s?\d|תרגיל|שיעורי בית/i.test(name)) return { section: "Homework", why: "from its name" };
  if (/exam|quiz|midterm|מבחן|בוחן/i.test(name)) return { section: "Exams", why: "from its name" };
  if (/tutorial|recitation|תרגול/i.test(name)) return { section: "Tutorials", why: "from its name" };
  if (c.liveNow) return { section: c.liveNow.section, why: `${c.liveNow.what} is on now` };
  return null;
}
function cleanName(name, kind) { // camera and screenshot names become words; people's own titles are never touched
  if (!/^(IMG|PXL|DSC|DCIM|Photo|Screenshot|Screen Shot|Scan|WhatsApp Image)[ _-]/i.test(name)) return null;
  const when = new Date().toLocaleString(lang === "he" ? "he" : "en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" });
  return `${/^screen/i.test(name) ? "Screenshot" : kind === "photo" ? "Board photo" : "Scan"} · ${when}`;
}
function didIt(btn, label) { // the button itself says it worked, for a moment
  if (!btn || btn._did) return; btn._did = true; const html = btn.innerHTML;
  btn.innerHTML = ic("check","s") + (label ? `<span>${label}</span>` : ""); btn.classList.add("did");
  setTimeout(() => { btn.innerHTML = html; btn.classList.remove("did"); btn._did = false; }, 1400);
}
function maybeNudge() {
  if (S.saves >= 2 && !S.nudge && desktopOS() && (store.get("nudgeNo", 0) < 2) && store.get("nudgeDay", "") !== new Date().toDateString()) { S.nudge = true; store.set("nudgeDay", new Date().toDateString()); const n = $("#nudge-slot"); if (n) n.innerHTML = nudgeCard(); }
}
function evShown(events, now = new Date()) { // calendar rows (starts_at …) as Coming up lines; the made-up courses' rows are already words
  if (!CORE) return events.filter(e => e.d != null);
  return events.map(e => { if (e.d != null) return e;
    const start = new Date(e.starts_at), len = e.ends_at ? new Date(e.ends_at) - start : 0, at = CORE.Essentials.next(start, len, !!e.all_day, e.repeat_until, now, tzHere());
    if (!at) return null; const loc = lang === "he" ? "he" : "en-GB";
    return { at, d: String(at.getDate()), wd: at.toLocaleDateString(loc, { weekday: "short" }), t: e.title, due: false, hot: e.kind === "exam" || e.kind === "deadline",
      k: [e.all_day ? "" : at.toLocaleTimeString(loc, { hour: "numeric", minute: "2-digit" }), e.location].filter(Boolean).join(" · ") }; })
    .filter(Boolean).sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
}
function railCards(c, coming) {
  const ev = c.events?.length ? evShown(c.events) : coming.map(i => ({ d: "", wd: i.due, t: i.dueTitle, k: "", due: true, id: i.id }));
  const cal = ev.length ? `<section class="rcard" aria-labelledby="r-cal"><h3 id="r-cal"><span>Coming up</span><button class="linkbtn" data-act="ics">Import .ics</button></h3>
    ${ev.slice(0, 5).map(e => `<div class="ev ${e.due || e.hot ? "due" : ""}"><span class="d"><b>${esc(e.d)}</b>${esc(e.wd)}</span><span><span class="t"><span>${esc(e.t)}</span></span><span class="k" style="display:block">${esc(e.k)}</span></span></div>`).join("")}</section>` : "";
  const files = c.files.length ? `<section class="rcard" aria-labelledby="r-files"><h3 id="r-files"><span>${t("courseFiles")}</span></h3><div class="files">${c.files.map(slip).join("")}</div></section>` : "";
  // Live: the lecturer, TA, office hours and links come from the course's info (live.js courseInfo, launch QA B4); the
  // owner and helpers add them in Stash for Mac, so the page has no Edit here.
  const safeUrl = u => /^https?:\/\//i.test(String(u || "")) ? String(u) : "";
  const linkHtml = ([l, i, u]) => safeUrl(u) ? `<a href="${esc(safeUrl(u))}" target="_blank" rel="noopener noreferrer">${ic(i,"s")}<span>${esc(l)}</span></a>` : `<a href="#" data-noop>${ic(i,"s")}<span>${esc(l)}</span></a>`;
  const staff = c.staff?.length || c.links?.length ? `<section class="rcard" aria-labelledby="r-people"><h3 id="r-people"><span>${t("Lecturer and TA")}</span>${LIVE ? "" : `<button class="linkbtn" data-act="info-edit">Edit</button>`}</h3>
    <div class="staff">${(c.staff || []).map(p => `<div class="p"><span class="ini" aria-hidden="true">${esc(p.i)}</span><div><b dir="auto">${esc(p.name)}</b><small>${esc(p.role)}${p.mail ? ` · <a href="mailto:${esc(p.mail)}">${esc(p.mail)}</a>` : ""}</small>${p.hours ? `<small dir="auto">${esc(p.hours)}</small>` : ""}</div></div>`).join("")}</div>
    <div class="rlinks">${(c.links || []).map(linkHtml).join("")}</div>
    ${c.infoBy ? `<p class="prov">Added by ${esc(c.infoBy)}. Only what members type here — nothing is copied from Moodle.</p>` : ""}</section>`
    : `<section class="rcard"><h3><span>${t("Lecturer and TA")}</span></h3><p class="empty-info">${t("Nobody has added the lecturer, office hours or links yet.")}</p>${LIVE
      ? `<p class="empty-info" style="margin-top:6px">${t("The course owner adds these in Stash for Mac.")}</p>`
      : `<p style="margin:10px 0 0"><button class="btn" data-act="info-edit">${ic("plus","s")}<span>Add course info</span></button></p>`}</section>`;
  return cal + files + staff;
}
const ppl = n => n <= 1 ? (lang === "he" ? "רק אני" : "Just you") : `${n.toLocaleString()} ${t("people")}`;
const addLabel = c => lang === "he" ? `הוספה לשבוע ${c.week}` : `Add to Week ${c.week}`;
function peopleLine(c) {
  if (c.people <= 1) return `<button class="people" data-act="people">${ic("people","s")}<span>Just you so far</span></button>`;
  const n = c.people - 1 - c.names.length;
  const names = c.names.map(x => `<b><bdi>${esc(x)}</bdi></b>`).join(", ");
  return `<button class="people" data-act="people" aria-label="${c.people} people in this course">${ic("people","s")}<span>${names}${n > 0 ? ` and ${n.toLocaleString()} others` : ""}</span></button>`;
}
function renderClass() {
  const k = theClass(), mine = S.courses.filter(c => c.shelf === k.name);
  docTitle(`${k.name} · Stash`); $("#tb-title").textContent = k.name; $("#tb-back").textContent = t("courses");
  $("#course").innerHTML = `
    <div class="course-top">
      <div class="cover"><img data-art="${COVERS[2]}" src="${art(COVERS[2])}" alt="" decoding="async">
        <div class="words"><span class="shelf">Class</span><h1 id="course-name">${esc(k.name)}</h1><div class="meta">${esc(k.uni)} · ${mine.length} courses together</div></div></div>
      <div class="course-bar">
        <button class="people" data-act="people">${ic("people","s")}<span>${k.names.map(x => `<b>${esc(x)}</b>`).join(", ")} and ${k.people - 1 - k.names.length} others</span></button>
        <span class="grow"></span>
        <button class="btn" data-act="invite">${ic("people","s")}<span>Invite</span></button>
        <button class="btn primary add-top" data-act="add">${ic("plus","s")}<span>Add</span></button>
      </div>
      <div class="status" id="status" role="status" aria-live="polite"></div>
    </div>
    <section class="block" aria-labelledby="h-class"><h2 class="sec-h" id="h-class">For the whole class</h2>
      <div class="grid" id="grid-class">${k.items.map(sheet).join("")}</div></section>
    <section class="block" aria-labelledby="h-cw"><h2 class="sec-h" id="h-cw">This week in your courses</h2>
      ${mine.map(c => { const now = c.items.filter(i => i.week === c.week), n = now.filter(i => i.isNew).length;
        return `<div class="cw"><a class="cw-h" href="?c=${c.id}" data-course="${c.id}">${thumb(c.cover)}
          <b>${esc(c.name)}</b><span class="wk">Week ${c.week} · ${esc(c.weekTitles[c.week] || "")}</span>
          <span class="n">${n ? `${n} new` : `${now.length} ${now.length === 1 ? "thing" : "things"}`}${ic("chev","s")}</span></a>
          <div class="strip">${now.slice(0, 8).map(sheet).join("")}</div></div>`; }).join("")}
    </section>`;
  $("#foot").innerHTML = `<p>Made-up class — a prototype. Nothing you add leaves this page.</p>`;
  $("#bottombar").innerHTML = `<button class="btn primary" data-act="add">${ic("plus","s")}<span>Add</span></button>`; $("#bottombar").style.display = "";
  renderStatus(); observeTitle();
}
function renderSide() {
  const groups = {}; S.courses.forEach(c => (groups[c.shelf || ""] ??= []).push(c));
  const keys = Object.keys(groups).sort((a, b) => (a === "") - (b === ""));
  $("#side").innerHTML = (S.courses.length ? "" : `<p class="shelf-h">No courses yet</p>`) + keys.map(k => `
    ${k ? `<a class="shelf-h shelf-link" href="?class=${theClass().id}" data-class="${theClass().id}" ${S.view === "class" ? 'aria-current="page"' : ""}><span>${esc(k)}</span>${ic("chev","s")}</a>` : `<div class="shelf-h">${t("onTheirOwn")}</div>`}
    ${groups[k].map(c => `<a class="course-link" href="?c=${c.id}${lang === "he" ? "&lang=he" : ""}" data-course="${c.id}" ${S.view === "course" && c.id === course()?.id ? 'aria-current="page"' : ""}>
      ${thumb(c.cover)}
      <span class="nm"><b><span>${esc(c.name)}</span></b><small>${[c.code ? `<bdi>${esc(c.code)}</bdi>` : "", esc(ppl(c.people))].filter(Boolean).join(" · ")}</small></span>
      ${c.items.some(i => i.isNew) && c.id !== course()?.id ? `<span class="dot" aria-label="New things"></span>` : ""}</a>`).join("")}`).join("");
}
function slip(it) {
  const file = it.kind === "pdf";
  return `<button class="slip ${file ? "file" : ""}" data-open="${it.id}"><b dir="auto">${esc(it.title)}</b><small>${esc(file ? it.meta : it.dom)}</small></button>`;
}
function stickerStack(it) {
  const ids = Object.keys(it.stickers).filter(k => it.stickers[k] > 0).sort((a, b) => it.stickers[b] - it.stickers[a]).slice(0, 2);
  if (!ids.length) return "";
  const total = Object.values(it.stickers).reduce((a, b) => a + b, 0);
  const rot = [-6, 4, -2];
  return `<span class="stk" aria-label="${lang === "he" ? `${total} מדבקות` : `${total} stickers`}">${ids.map((k, i) => { const s = STICKERS[k - 1];
    return `<img data-art="${s.key}" src="${art(s.key)}" alt="" style="transform:rotate(${rot[i]}deg)">`; }).join("")}<span class="n">${total.toLocaleString()}</span></span>`;
}
function body(it) {
  if (it.crisp && hooks.body) { const b = hooks.body(it); if (b) return b; } // Crisp Swap (hidden flag)
  if (it.kind === "note") return `<div class="body k-note"><p dir="auto">${esc(it.text)}</p></div>`;
  if (it.kind === "link") return `<div class="body k-link ${it.pic ? "has-pic" : ""}">${mono(it.dom)}<div class="dom"><i></i>${esc(it.dom)}</div><h3 dir="auto">${esc(it.title)}</h3>${it.pic ? `<div class="pic">${pic(it.pic)}</div>` : ""}</div>`;
  if (it.kind === "photo") return `<div class="body k-photo"><div class="ph">${it.src ? `<img src="${it.src}" alt="">` : pic(it.pic)}</div></div>`;
  return `<div class="body k-file"><div class="page">${page(it.title, it.thumb)}</div><b dir="auto">${esc(it.title)}</b></div>`;
}
function accName(it) {
  if (lang === "he") { // people's titles stay as written; only the chrome words are Hebrew
    const what = it.kind === "note" ? `פתק: ${it.text.slice(0, 80)}` : it.kind === "photo" ? `תמונה: ${it.title}` : it.kind === "link" ? `קישור: ${it.title}, ${it.dom}` : `קובץ: ${it.title}`;
    return `${what}. נוסף על ידי ${it.by}, ${heWhen(it.ago)}${it.isNew ? ". חדש" : ""}`;
  }
  const what = it.kind === "note" ? `Note: ${it.text.slice(0, 80)}` : it.kind === "photo" ? `Photo: ${it.title}` : it.kind === "link" ? `Link: ${it.title}, ${it.dom}` : `File: ${it.title}`;
  return `${what}. Added by ${it.by}, ${it.ago}${it.isNew ? ". New" : ""}`;
}
function sheet(it) {
  const file = it.kind === "pdf";
  if (it.uploading != null) { const pct = Math.round(it.uploading * 100);
    return `<div class="sheet uploading ${file ? "file" : ""}" data-id="${it.id}" aria-busy="true" aria-label="${esc(it.by)} is adding ${esc(it.title)}, ${pct} percent">
      <div class="body">${it.kind === "photo" ? `<div class="ghost-photo"></div>` : `<div class="ghost-page"></div><div class="ghost-t" dir="auto">${esc(it.title)}</div>`}</div>
      <span class="bar"><i style="transform:scaleX(${it.uploading})"></i></span>
      <div class="label"><span class="who"><bdi>${esc(it.by)}</bdi> · ${pct}%</span></div></div>`; }
  return `<div class="sheet ${file ? "file" : ""} ${it.sending ? "sending" : ""}" data-open="${it.id}" data-id="${it.id}" ${it.sending ? "" : 'draggable="true"'}>
    <button class="press" data-open="${it.id}" aria-label="${esc(accName(it))}"></button>
    ${it.isNew ? `<span class="newtab" aria-hidden="true"></span>` : ""}
    ${body(it)}
    <b class="cap" aria-hidden="true">${it.isNew ? `<i class="newtab"></i>` : ""}<span dir="auto">${esc(tileCap(it))}</span></b>
    ${it.sending && S.online ? `<span class="bar"><i></i></span>` : ""}
    <div class="label">${!it.sending && dueSoon(it) ? `<span class="due">${lang === "he" ? `להגשה ${esc(heWhen(it.due.split(" · ")[0]))}` : `Due ${esc(it.due.split(" · ")[0])}`}</span>` : ""}<span class="who">${it.sending ? t(S.online ? "Sending…" : "Waiting to send") : `<bdi>${esc(it.by)}</bdi>${it.also?.length ? ` + <bdi>${esc(it.also[0])}</bdi>` : ""}${dueSoon(it) ? "" : ` · ${esc(it.ago)}`}`}</span><span class="grow"></span>${stickerStack(it)}</div>
    ${it.sending ? "" : `<div class="quick">${it.kind === "note" || it.kind === "link"
      ? `<button class="qbtn" data-act="qcopy" data-id="${it.id}" aria-label="${it.kind === "link" ? "Copy link" : "Copy"}" title="${it.kind === "link" ? "Copy link" : "Copy"}">${ic("copy","s")}</button>`
      : `<button class="qbtn" data-act="qsave" data-id="${it.id}" aria-label="Save" title="Save">${ic("save","s")}</button>`}<button class="react-btn" data-act="tray" data-id="${it.id}" aria-label="Add a sticker" title="Sticker" aria-haspopup="true" aria-expanded="false">${ic("sticker","s")}</button></div>`}
  </div>`;
}
const tileCap = it => it.kind === "link" ? String(it.dom || "").replace(/^www\./, "") : it.kind === "note" ? String(it.text || "").split("\n")[0].slice(0, 80) : capOf(it);
const capOf = it => it.kind === "note" ? "" : String(it.title || it.dom || "").replace(/\.(pdf|docx?|pptx?|key)$/i, "");
// A site's icon without fetching anything (link previews never call out): its first letter on one of the brand's pale fills
const MONO = [["#E4EDFC", "#345EA0"], ["#FBE4DD", "#8A4536"], ["#FAEBCB", "#70510D"], ["#E7EFE9", "#2F5B45"]];
function mono(dom) {
  const d = String(dom || "").replace(/^www\./, ""), [bg, fg] = MONO[[...d].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7) % MONO.length];
  return `<span class="mono" aria-hidden="true" style="background:${bg};color:${fg}">${esc(([...d][0] || "?").toUpperCase())}</span>`;
}
function weekRow(c, w) {
  const n = c.items.filter(i => i.week === w && shows(i)).length;
  return `<div class="week-row" data-week="${w}" data-open="false">
    <button aria-expanded="false" aria-controls="wk-${w}">
      <span class="wn">${t("week")} ${w}</span><span class="wt">${esc(c.weekTitles[w] || "")}</span>
      <span class="cnt">${n} ${n === 1 ? t("thing") : t("things")}</span>${ic("chev","s chev")}
    </button>
    <div class="fold" id="wk-${w}"><div><div class="grid" data-week="${w}"></div></div></div></div>`;
}
function emptyCourse(c) {
  return `<div class="empty"><img data-art="c1-a-class" src="${art("c1-a-class")}" alt="">
    <h2>${t("nothingYet")}</h2><p>${t("nothingYetP")}</p>
    <div class="acts"><button class="btn primary big" data-act="add">${ic("plus","s")}<span>${addLabel(c)}</span></button>
    </div></div>`;
}
function renderNoCourses() {
  docTitle("Your courses · Stash");
  $("#course").innerHTML = `<div class="empty" style="padding-top:12vh"><img data-art="c4-join" src="${art("c4-join")}" alt="">
    <h2>Join your first course</h2><p>Type the code from your invite, or find your course by its code.</p>
    <form class="acts" data-form="code" style="width:min(360px,100%);flex-direction:column;align-items:center;gap:14px">${codeBox("")}
    <button class="btn primary big" type="submit">Join</button></form>
    <p style="margin-top:14px"><a href="../join/?find=1${lang === "he" ? "&lang=he" : ""}">Find a course by its code</a></p></div>`;
  $("#foot").innerHTML = `No cookies, no tracking.`;
  $("#bottombar").style.display = "none";
}
function renderLoading() {
  $("#course").innerHTML = `<div class="course-top" aria-busy="true" aria-label="Loading the course"><div class="sk sk-cover sk-pulse"></div><div class="sk sk-line sk-pulse"></div></div>
    <section class="block"><div class="sk sk-line sk-pulse" style="width:22%;margin:0 0 14px"></div><div class="grid">${"<div class='sk sk-sheet sk-pulse'></div>".repeat(4)}</div></section>`;
}
function nudgeCard() {
  return `<aside class="nudge" aria-label="Stash for Mac"><img data-art="nudge-mac" src="${art("nudge-mac")}" alt="">
    <div><h3>Let the course come to you</h3><p>Stash for Mac keeps this course one ⌘V away — even with no tab open.</p>
    <div class="why"><figure><img data-art="onboarding-copy" src="${art("onboarding-copy")}" alt=""><figcaption><b>It lands by itself</b>new things arrive as they're added</figcaption></figure>
      <figure><img data-art="onboarding-paste" src="${art("onboarding-paste")}" alt=""><figcaption><b>Paste anywhere</b>drag slides into your notes</figcaption></figure>
      <figure><img data-art="onboarding-talk" src="${art("onboarding-talk")}" alt=""><figcaption><b>Talk your notes</b>hold fn and speak</figcaption></figure></div>
    <div class="acts"><a class="btn primary" href="../">Get Stash for Mac</a><button class="btn quiet" data-act="nudge-no">Not now</button></div></div></aside>`;
}

/* status line: "new since" by default; notes replace it for a few seconds */
let statusTimer;
function hhmm(d) { return d.toLocaleTimeString(lang === "he" ? "he" : undefined, { hour: "2-digit", minute: "2-digit" }); }
function renderStatus(animate) {
  const el = $("#status"); if (!el) return;
  const c = S.view === "class" ? { items: S.courses.filter(x => x.shelf === theClass().name).flatMap(x => x.items).concat(theClass().items), lastVisit: "Tuesday" } : course(); let html = "";
  if (S.statusMsg) html = S.statusMsg;
  else if (!S.online) html = `<span class="off">${ic("wifioff","s")}</span><span>${t("offline")} ${LIVE ? hhmm(S.offlineSince || new Date()) : "10:42"}.</span><span>${t("offlineP")}</span>`;
  else if (S.view === "class" || phone()) html = "";
  else { const n = c.items.filter(i => i.isNew).length;
    if (n) { const sum = lang === "he" || phone() ? "" : newSummary(c.items.filter(i => i.isNew)), long = sum.length > 46;
      html = `<span class="tab" aria-hidden="true"></span><span><b>${lang === "he" && n === 1 ? "חדש אחד מאז" : `${n} ${t("newSince")}`} ${esc(lang === "he" ? heWhen(c.lastVisit) : c.lastVisit)}</b>${sum && !long ? ` · ${esc(sum)}` : ""}</span><button class="linkbtn" data-act="show-new">${t("show")}</button>`; } }
  el.innerHTML = html ? `<div class="line ${animate && !reduced() ? "in" : ""}">${html}</div>` : "";
}
function floatNote() { // a copy of the status line, pinned above the bottom bar (phone) / bottom centre, only while #status is off screen
  let f = $("#float-note"); const st = $("#status"); const r = st?.getBoundingClientRect();
  const off = !!S.statusMsg && r && (r.bottom < 52 || r.top > innerHeight - 80);
  if (!off) { f?.remove(); return; }
  if (!f) { f = document.createElement("div"); f.id = "float-note"; document.body.append(f); }
  f.innerHTML = `<div class="line">${S.statusMsg}</div>`;
}
addEventListener("scroll", () => requestAnimationFrame(floatNote), { passive: true });
function say(html, ms = 4000) {
  S.statusMsg = html; renderStatus(true); floatNote(); clearTimeout(statusTimer);
  const el = $("#status");
  const run = () => { statusTimer = setTimeout(() => { if (el && el.matches(":hover")) return run(); S.statusMsg = null; S.undo = null; renderStatus(true); floatNote(); }, ms); };
  run();
}

/* ============ the moments ============ */
function land(it, grid) { // a sheet lands at the front of its week; the others slide over on the same spring
  const before = new Map($$(".sheet", grid).map(el => [el.dataset.id, el.getBoundingClientRect()]));
  grid.insertAdjacentHTML("afterbegin", sheet(it));
  const el = grid.firstElementChild;
  if (reduced()) { el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150 }); return; }
  const dur = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--spring-dur")) || 460;
  const ease = getComputedStyle(document.documentElement).getPropertyValue("--spring").trim();
  $$(".sheet", grid).forEach(s => { const b = before.get(s.dataset.id); if (!b) return; const a = s.getBoundingClientRect();
    const dx = b.left - a.left, dy = b.top - a.top; if (dx || dy) s.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: "none" }], { duration: dur, easing: ease }); });
  const seat = it.by === ME ? $("#you .ini") : $(`.seat[data-seat="${CSS.escape(it.by || "")}"]`);
  if (seat) { const sr = seat.getBoundingClientRect(), er = el.getBoundingClientRect();
    const dx = sr.left + sr.width / 2 - (er.left + er.width / 2), dy = sr.top + sr.height / 2 - (er.top + er.height / 2), rot = dx < 0 ? 10 : -10;
    seat.closest(".seat")?.classList.add("adding"); setTimeout(() => seat.closest(".seat")?.classList.remove("adding"), dur);
    el.animate([{ transform: `translate(${dx}px,${dy}px) rotate(${rot}deg) scale(.42)`, opacity: .2, boxShadow: "0 20px 40px rgba(0,0,0,.18)" }, { opacity: 1, offset: .25 },
      { transform: "translate(0,-6px) rotate(-1deg) scale(1.02)", boxShadow: "0 16px 30px rgba(0,0,0,.14)", offset: .7 }, { transform: "none", opacity: 1 }], { duration: Math.round(dur * 1.5), easing: ease });
  } else el.animate([{ transform: "translateY(-18px) scale(.9)", opacity: 0 }, { opacity: 1, offset: .35 }, { transform: "none", opacity: 1 }], { duration: dur, easing: ease });
}
function addItem(it, announce = true) {
  if (announce && it.by === ME) pwa(P => P.noteMoment("add"));
  const c = course(); it.week ??= c.week; c.items.unshift(it);
  const grid = $(`#grid-now`);
  if (!grid || it.week !== c.week) { render(); const el = $(`#grid-now .sheet[data-id="${it.id}"]`);
    if (el && !reduced()) el.animate([{ transform: "translateY(60px) scale(.86) rotate(4deg)", opacity: 0 }, { opacity: 1, offset: .3 }, { transform: "none", opacity: 1 }], { duration: 640, easing: getComputedStyle(document.documentElement).getPropertyValue("--spring").trim() });
    if (announce && it.by === ME) { S.undo = it.id; say(`<span>${ic("check","s")}</span><span>Added to <b>${t("week")} ${it.week}</b>.</span><button class="linkbtn" data-act="undo">Undo</button>`, 5000); }
    return; }
  land(it, grid);
  if (!announce) return;
  if (it.by === ME) {
    S.undo = it.id;
    say(`<span>${ic("check","s")}</span><span>Filed in <b>${t("week")} ${it.week}${it.section ? " · " + esc(it.section) : ""}</b></span><button class="linkbtn" data-act="refile" data-id="${it.id}">Change</button><button class="linkbtn" data-act="undo">Undo</button>`, 6000);
    setTimeout(() => { if (!S.online || it.live) return; it.sending = false; it.ago = "now"; const el = $(`[data-id="${it.id}"]`); if (el) el.outerHTML = sheet(it); }, 1300);
  } else {
    say(`<span><b>${esc(it.by)}</b> added <b>${esc(it.kind === "note" ? it.title || "a note" : it.title)}</b></span><button class="linkbtn" data-act="goto" data-id="${it.id}">${t("show")}</button>`);
  }
}
const POOL = [
  { by:"Omer", kind:"note", title:"Question 4", text:"Question 4: can Dijkstra handle a negative edge if there's no negative cycle? (No — that's Bellman–Ford.)" },
  { by:"Dana", kind:"photo", pic:"board-dp", title:"The table from the tutorial" },
  { by:"Yael", kind:"pdf", title:"Summary — weeks 1–6.pdf", meta:"PDF · 9 pages · 640 KB" },
  { by:"Noam", kind:"link", title:"Bellman–Ford in 5 minutes", dom:"youtube.com", url:"https://www.youtube.com/watch?v=example2" },
];
function takeCopy() {
  const seats = $$(".seat[data-seat]"), sheets = $$("#grid-now .sheet:not(.uploading)"); if (!seats.length || sheets.length < 3) return;
  const seat = seats[Math.floor(Math.random() * seats.length)], sh = sheets[1 + Math.floor(Math.random() * (sheets.length - 1))], it = findItem(sh.dataset.id); if (!it) return;
  if (!reduced()) { const g = sh.cloneNode(true), r = sh.getBoundingClientRect(), sr = seat.getBoundingClientRect();
    Object.assign(g.style, { position: "fixed", left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px", margin: 0, zIndex: 30, pointerEvents: "none" }); g.removeAttribute("data-id"); document.body.append(g);
    g.animate([{ transform: "none", opacity: .9 }, { transform: `translate(${sr.left - r.left - r.width / 2 + 20}px,${sr.top - r.top - r.height / 2 + 14}px) rotate(8deg) scale(.25)`, opacity: 0 }], { duration: 900, easing: "cubic-bezier(.5,0,.3,1)" }).onfinish = () => g.remove(); }
  say(`<span><b><bdi>${esc(seat.dataset.seat)}</bdi></b> took a copy of <b>${esc(it.title || "a note")}</b></span>`, 3500);
}
function arrival() {
  if (S.state !== "normal" || document.hidden || !S.online || $(".panel") || S.view !== "course") return;
  const p = POOL[S.arrivals++ % POOL.length];
  if (S.arrivals % 3 === 0 && $$(".seat[data-seat]").length) return takeCopy();
  if (p.kind === "pdf" || p.kind === "photo") return liveUpload(p);
  addItem(m({ ...p, ago:"now", isNew:true }));
}
function liveUpload(p) { // someone else's upload: on the table the moment it starts, fills in, then becomes the sheet
  const c = course(), grid = $("#grid-now"); if (!grid) return;
  const it = m({ ...p, ago:"now", isNew:true, week:c.week, uploading:0 }); c.items.unshift(it); land(it, grid);
  const name = esc(p.title);
  say(`<span class="live-dot" aria-hidden="true"></span><span><b>${esc(p.by)}</b> is adding <b>${name}</b>…</span>`, 60000);
  let v = 0; const tick = setInterval(() => {
    v = Math.min(1, v + .07 + Math.random() * .09); it.uploading = v;
    const el = $(`.sheet[data-id="${it.id}"]`);
    if (el) { $(".bar i", el).style.transform = `scaleX(${v})`; $(".who", el).textContent = `${p.by} · ${Math.round(v * 100)}%`; }
    if (v < 1) return;
    clearInterval(tick); it.uploading = null;
    setTimeout(() => { const e2 = $(`.sheet[data-id="${it.id}"]`); if (e2) { e2.outerHTML = sheet(it); $(`.sheet[data-id="${it.id}"]`)?.animate([{ opacity: .7 }, { opacity: 1 }], { duration: 220, easing: "ease-out" }); }
      say(`<span><b>${esc(p.by)}</b> added <b>${name}</b></span><button class="linkbtn" data-act="goto" data-id="${it.id}">${t("show")}</button>`); }, 250);
  }, 320);
}

/* ============ overlays ============ */
let lastFocus = null;
// Phone Back closes the open sheet instead of leaving the hub (launch QA: Back from a file went to the previous page).
// One history entry per open sheet stack: switching sheets keeps it, closing gives it back.
let sheetEntry = false, ignorePop = false;
addEventListener("popstate", () => {
  if (ignorePop) { ignorePop = false; return; }
  if (sheetEntry && $(".panel")) { sheetEntry = false; closeAll(); }
});
function openPanel(html, { w = 560, label = "", onMount, from, cls = "" } = {}) {
  const keep = document.activeElement?.closest(".panel") || document.activeElement === document.body ? lastFocus : document.activeElement; // (from ⌘K the bar is already gone: keep its return point) // stepping between cards keeps the original return point
  closeAll(true, true);
  if (phone() && !sheetEntry) { try { history.pushState({ ...(history.state || {}), stashSheet: true }, ""); sheetEntry = true; } catch { /* sandboxed: Back just leaves */ } }
  lastFocus = keep?.closest?.(".menu") ? keep.closest(".menu")._btn || keep : keep;
  const scrim = document.createElement("div"); scrim.className = "scrim"; scrim.dataset.act = "close";
  const p = document.createElement("div"); p.className = "panel" + (cls ? " " + cls : ""); p.setAttribute("role", "dialog"); p.setAttribute("aria-modal", "true");
  if (label) p.setAttribute("aria-label", label);
  p.style.setProperty("--w", w + "px"); p.innerHTML = `<div class="grab" aria-hidden="true"></div>` + html;
  if (from && !phone() && !reduced()) { const r = from.getBoundingClientRect(); p.style.transformOrigin = `${r.left + r.width / 2 - innerWidth / 2 + w / 2}px ${r.top + r.height / 2 - innerHeight / 2 + 200}px`; }
  document.body.append(scrim, p);
  document.body.style.overflow = "hidden";
  $("#app").inert = true; $("#bottombar").inert = true;
  requestAnimationFrame(() => requestAnimationFrame(() => { scrim.classList.add("in"); p.classList.add("in"); }));
  onMount?.(p);
  p.querySelectorAll(".p-body").forEach(b => { if (!b.querySelector("button, a, input, select, textarea")) b.tabIndex = 0; }); // scrollable lists reachable by keyboard
  (p.querySelector("[autofocus]") || p.querySelector(".close"))?.focus({ preventScroll: true });
  dragToClose(p);
  return p;
}
function closeAll(instant, keepEntry) {
  closeTray(); closeMenu();
  const p = $(".panel"), s = $(".scrim"); if (!p) return;
  if (sheetEntry && !keepEntry) { sheetEntry = false;   // give the sheet's history entry back (an instant close may be followed by a URL change: no Back then)
    if (instant) history.replaceState({ ...(history.state || {}), stashSheet: false }, ""); else { ignorePop = true; history.back(); } }
  document.body.style.overflow = ""; $("#app").inert = false; $("#bottombar").inert = false;
  if (instant) { p.remove(); s?.remove(); return; }
  p.classList.add("out"); p.classList.remove("in"); s?.classList.remove("in");
  setTimeout(() => { p.remove(); s?.remove(); }, 240);
  (lastFocus?.isConnected && lastFocus !== document.body ? lastFocus : $("#course"))?.focus?.({ preventScroll: true }); // never drop focus to <body>
}
function dragToClose(p) { // phone bottom sheet: follows the finger from the grabber, the header, or the content pulled down at its top
  const handles = [".grab", ".p-head", ".lift-bar"].map(q => p.querySelector(q)).filter(Boolean);
  const bodies = [...p.querySelectorAll(".p-body, .lift-stage")];
  let y0 = 0, base = 0, d = 0, v = 0, yPrev = 0, tPrev = 0, dragging = false;
  const scrim = () => $(".scrim");
  const start = y => { // interruptible: catches the sheet where it is, even mid-open
    dragging = true; base = new DOMMatrixReadOnly(getComputedStyle(p).transform).m42 || 0; y0 = y; yPrev = y; tPrev = performance.now(); v = 0; d = base;
    p.style.transition = "none"; const s = scrim(); if (s) s.style.transition = "none"; };
  const move = y => {
    const dy = y - y0 + base; d = dy < 0 ? -(-dy * 40) / (40 - dy) : dy; // rubber-band upwards
    p.style.transform = `translateY(${d}px)`; const s = scrim(); if (s) s.style.opacity = String(Math.max(0, 1 - d / p.offsetHeight));
    const now = performance.now(); if (now > tPrev) v = .8 * ((y - yPrev) / (now - tPrev)) + .2 * v; yPrev = y; tPrev = now; };
  const end = () => { if (!dragging) return; dragging = false;
    const s = scrim(); p.style.transition = ""; p.style.transform = ""; if (s) { s.style.transition = ""; s.style.opacity = ""; }
    if (d > Math.min(140, p.offsetHeight * .25) || (v > .5 && d > 10)) closeAll(); }; // a flick or a real pull; otherwise it springs back
  handles.forEach(h => {
    h.addEventListener("pointerdown", e => { if (!phone() || e.button > 0 || e.target.closest("button, a, input")) return; start(e.clientY); h.setPointerCapture(e.pointerId); });
    h.addEventListener("pointermove", e => { if (dragging) move(e.clientY); });
    h.addEventListener("pointerup", end); h.addEventListener("pointercancel", end);
  });
  bodies.forEach(b => { // iOS: pulling down on content that's already at its top moves the sheet instead of bouncing the content
    let sy = 0, armed = false;
    b.addEventListener("touchstart", e => { armed = phone() && e.touches.length === 1 && b.scrollTop <= 0 && !e.target.closest("input, textarea, select, [contenteditable]"); sy = e.touches[0].clientY; }, { passive: true });
    b.addEventListener("touchmove", e => { if (!armed) return; const y = e.touches[0].clientY;
      if (!dragging) { if (y - sy < 6) { if (y < sy) armed = false; return; } if (b.scrollTop > 0) { armed = false; return; } start(sy); }
      e.preventDefault(); move(y); }, { passive: false });
    b.addEventListener("touchend", () => { armed = false; end(); }); b.addEventListener("touchcancel", () => { armed = false; end(); });
  });
}
const head = (title) => `<div class="p-head"><h2>${title}</h2><button class="close" data-act="close" aria-label="Close">${ic("x","s")}</button></div>`;

function openItem(id, from, dir = 0) {
  if (!dir) pwa(P => P.noteMoment("open"));
  const it = findItem(id); if (!it || it.uploading != null) return; const c = it._c;
  if (it.isNew) { it.isNew = false; }
  const media = it.kind === "pdf" ? `<div class="pg">${page(it.title, it.thumb)}</div><div class="ttl" style="text-align:center">${esc(it.title.replace(/\.(pdf|docx?|pptx?|key)$/i, ""))}${it.meta ? `<small>${esc(it.meta)}</small>` : ""}</div>`
    : it.kind === "photo" ? `<div class="media">${it.src ? `<img src="${it.src}" alt="${esc(it.title)}">` : pic(it.pic)}</div><div class="ttl">${esc(it.title)}</div>`
    : it.kind === "link" ? `${it.pic ? `<div class="media" style="aspect-ratio:16/7">${pic(it.pic)}</div>` : ""}<div class="ttl">${esc(it.title)}<small dir="ltr">${esc(it.url || it.dom)}</small></div>`
    : `<div class="txt" dir="auto">${esc(it.text)}</div>`;
  const primary = it.kind === "pdf" ? `<button class="btn primary" data-act="fake-open">${ic("open","s")}<span>${t("open")}</span></button><button class="btn quiet" data-act="save" data-id="${it.id}">${ic("save","s")}<span>${saveWord(it)}</span></button>`
    : it.kind === "photo" ? `<button class="btn primary" data-act="save" data-id="${it.id}">${ic("save","s")}<span>${saveWord(it)}</span></button>`
    : it.kind === "link" ? `<a class="btn primary" href="${esc(it.url)}" target="_blank" rel="noopener noreferrer">${ic("open","s")}<span>${t("open")}</span></a><button class="btn" data-act="copy" data-text="${esc(it.url)}">${ic("copy","s")}<span>${t("copy")}</span></button>`
    : `<button class="btn primary" data-act="copy" data-text="${esc(it.text)}">${ic("copy","s")}<span>${t("copy")}</span></button>`;
  const title = it.kind === "note" ? `Note from ${it.by}` : it.title;
  const where = !c ? `${theClass().name} · whole class` : it.week ? `${S.view === "class" ? c.name + " · " : ""}${t("week")} ${it.week}${it.section ? " · " + it.section : ""}` : t("courseFiles");
  const share = `${SITE}hub/?${c ? "c=" + c.id : "class=" + theClass().id}`;
  const waText = lang === "he" ? `${it.kind === "note" ? it.text.slice(0, 120) : it.title} — ${c ? c.name : theClass().name} ב־Stash: ${share}` : `${it.kind === "note" ? it.text.slice(0, 120) : it.title} — ${c ? c.name : theClass().name} on Stash: ${share}`;
  const saves = 3 + (it.id.charCodeAt(it.id.length - 1) % 17);
  if (phone()) return openItemPhone(it, title, share, waText);
  const p = openPanel(`<div class="lift-bar"><button class="close" data-act="close" aria-label="${t("close")}">${ic("x","s")}</button></div><h2 class="vh" id="lift-h" tabindex="-1" autofocus>${esc(title)}</h2>
    <div class="lift-stage"><div class="bigsheet">${media}<div class="stuck" role="group" aria-label="Stickers">${STICKERS.map(s => stButton(it, s)).join("")}</div></div>
      <aside class="tag"><button class="close" data-act="close" aria-label="Close">${ic("x","s")}</button>
        <div class="from"><span class="ini" aria-hidden="true">${esc((it.by || "?")[0])}</span><div><b><bdi>${esc(it.by)}</bdi></b><small>put this down ${esc(it.ago === "now" ? "just now" : it.ago + (/^\d/.test(it.ago) ? " ago" : ""))}</small></div></div>
        <p class="where"><b>${esc(where)}</b>${it.meta && it.kind !== "pdf" ? `<br>${esc(it.meta)}` : ""}${it.also?.length ? `<br>Also added by <bdi>${esc(it.also.join(", "))}</bdi>` : ""}${it.orig ? `<br>Was ${esc(it.orig)}` : ""}${dueSoon(it) ? `<br><span class="due" style="color:var(--ink);padding:1px 6px;border-radius:6px;background:color-mix(in srgb, var(--butter) 42%, var(--sheet))">Due ${esc(it.due)}</span>` : ""}${LIVE ? "" : `<br>Saved by ${saves} people`}</p>
        <div class="acts">${primary}</div>
        <div class="pass-to" hidden role="group" aria-label="Pass to"></div>
        <div class="more-acts">${c && c.here ? `<button class="btn tile" data-act="pass-menu" data-id="${it.id}" aria-expanded="false">${ic("people","s")}<span>Pass to…</span></button>` : ""}<a class="btn tile" href="https://wa.me/?text=${encodeURIComponent(waText)}" target="_blank" rel="noopener noreferrer">${ic("chat","s")}<span>WhatsApp</span></a>
          ${it.kind === "note" ? "" : `<a class="btn tile" href="nearby/?material=${encodeURIComponent(it.title)}&url=${encodeURIComponent(it.url || share)}">${ic("nearby","s")}<span>Nearby</span></a>`}
          ${isOwn(it) ? `<button class="btn quiet report" data-act="delete" data-id="${it.id}">Delete</button>` : `<button class="btn quiet report" data-act="report" data-id="${it.id}">Report</button>`}</div>
      </aside></div>`, { w: 880, label: title, from, cls: "lift" });
  p.dataset.item = it.id;
  if (dir && !reduced()) { p.classList.add("in"); $(".scrim")?.classList.add("in"); $(".bigsheet", p).animate([{ transform: `translateX(${dir * 28}px)`, opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 260, easing: "cubic-bezier(.23,1,.32,1)" }); }
  const big = $(".bigsheet", p), tag = $(".tag", p);
  if (from && !reduced() && !phone()) { // the sheet lifts off the desk from where it lay
    requestAnimationFrame(() => { const a = from.getBoundingClientRect(), b = big.getBoundingClientRect();
      big.animate([{ transform: `translate(${a.left + a.width / 2 - (b.left + b.width / 2)}px,${a.top + a.height / 2 - (b.top + b.height / 2)}px) scale(${a.width / b.width}) rotate(-1.5deg)` },
        { transform: "translateY(-6px) scale(1.01) rotate(-.4deg)", offset: .72 }, { transform: "none" }], { duration: 520, easing: "cubic-bezier(.2,.9,.25,1)" });
      tag.animate([{ opacity: 0, transform: "translateX(-22px) rotate(-3deg)" }, { opacity: 1, transform: "none" }], { duration: 420, delay: 180, easing: "cubic-bezier(.2,.9,.25,1.08)", fill: "backwards" });
      $$(".stuck .st", p).forEach((x, i) => x.animate([{ opacity: 0, transform: "translateY(10px) scale(.8)" }, { opacity: x.classList.contains("ghost") ? .34 : 1, transform: "none" }], { duration: 360, delay: 300 + i * 50, easing: "cubic-bezier(.2,.9,.25,1.2)", fill: "backwards" })); });
  }
  p.setAttribute("aria-labelledby", "lift-h");
  $$(`.sheet[data-id="${id}"] .newtab`).forEach(x => x.remove()); renderStatus();
  hooks.openItem?.(it, p);
}
function openItemPhone(it, title, share, waText) { // the phone: the thing itself, who and when, Thanks, one or two buttons
  const media = it.kind === "pdf" ? `<div class="pv-page">${page(it.title, it.thumb)}</div>`
    : it.kind === "photo" ? `<div class="pv-photo">${it.src ? `<img src="${it.src}" alt="${esc(it.title)}">` : pic(it.pic)}</div>`
    : it.kind === "link" ? (it.pic ? `<div class="pv-photo">${pic(it.pic)}</div>` : "")
    : `<div class="pv-note" dir="auto">${esc(it.text)}</div>`;
  const when = it.ago === "now" ? "just now" : it.ago + (/^\d/.test(it.ago) ? " ago" : "");
  const sub = [`<bdi>${esc(it.by)}</bdi>`, esc(when), it.kind === "pdf" && it.meta ? esc(it.meta.replace(/^PDF · /, "")) : it.kind === "link" ? `<bdi dir="ltr">${esc(it.dom || "")}</bdi>` : ""].filter(Boolean).join(" · ");
  const acts = it.kind === "pdf" ? `<button class="btn" data-act="save" data-id="${it.id}">${saveWord(it)}</button><button class="btn primary" data-act="fake-open">${t("open")}</button>`
    : it.kind === "photo" ? `<button class="btn primary" data-act="save" data-id="${it.id}">${saveWord(it)}</button>`
    : it.kind === "link" ? `<button class="btn" data-act="copy" data-text="${esc(it.url)}">${t("copy")}</button><a class="btn primary" href="${esc(it.url)}" target="_blank" rel="noopener noreferrer">${t("open")}</a>`
    : `<button class="btn primary" data-act="copy" data-text="${esc(it.text)}">${t("copy")}</button>`;
  const p = openPanel(`<div class="lift-bar"><button class="close" data-act="close" aria-label="${t("close")}">${ic("x","s")}</button><span class="grow"></span>
      <button class="close" data-act="share-item" data-id="${it.id}" data-url="${esc(it.url || share)}" data-wa="${esc(waText)}" aria-label="Share">${ic("share","s")}</button></div>
    <h2 class="vh" id="lift-h" tabindex="-1" autofocus>${esc(title)}</h2>
    <div class="lift-stage pv-stage">${media ? `<div class="pv-media pv-${it.kind}">${media}</div>` : ""}
      <div class="pv-meta">${it.kind === "note" ? "" : `<h3 dir="auto">${esc(capOf(it) || it.title)}</h3>`}<p>${sub}</p>
        <div class="pv-row">${thanksBtn(it)}<span class="grow"></span>${isOwn(it) ? `<button class="linkbtn quiet-link" data-act="delete" data-id="${it.id}">Delete</button>` : `<button class="linkbtn quiet-link" data-act="report" data-id="${it.id}">Report</button>`}</div></div></div>
    <div class="pv-acts ${acts.split("</").length > 2 ? "two" : ""}">${acts}</div>`, { w: 560, label: title, cls: "lift pv" });
  p.dataset.item = it.id; p.setAttribute("aria-labelledby", "lift-h");
  $$(`.sheet[data-id="${it.id}"] .newtab`).forEach(x => x.remove()); renderStatus();
  hooks.openItem?.(it, p);
}
function thanksBtn(it) { // the phone keeps one sticker: Thanks
  const on = it.mine.includes(1), n = it.stickers[1] || 0;
  return `<button class="thanks" data-act="stick" data-id="${it.id}" data-s="1" aria-pressed="${on}" aria-label="${t("thanksW")}${n ? ", " + n : ""}">${ic("thumb","s")}<span>${t("thanksW")}${n ? ` · ${n}` : ""}</span></button>`;
}
function stButton(it, s) {
  const on = it.mine.includes(s.id), n = it.stickers[s.id] || 0;
  return `<button class="st ${n ? "" : "ghost"}" data-act="stick" data-id="${it.id}" data-s="${s.id}" aria-pressed="${on}" aria-label="${t(s.word)}${n ? ", " + n : ""}"><img data-art="${s.key}" src="${art(s.key)}" alt="">
    <span>${t(s.word)}</span>${n ? `<span class="c">${n}</span>` : ""}</button>`;
}
function stick(id, sid) {
  const it = findItem(id); if (!it) return;
  const on = it.mine.includes(sid);
  if (LIVE) hub.live.sticker(it, sid, !on);
  if (on) { it.mine = it.mine.filter(x => x !== sid); it.stickers[sid] = Math.max(0, (it.stickers[sid] || 1) - 1); }
  else { it.mine.push(sid); it.stickers[sid] = (it.stickers[sid] || 0) + 1; }
  $$(`.st[data-id="${id}"][data-s="${sid}"]`).forEach(b => b.outerHTML = stButton(it, STICKERS[sid - 1]));
  if (sid === 1) $$(`.thanks[data-id="${id}"]`).forEach(b => { b.outerHTML = thanksBtn(it); if (!on && !reduced()) $(`.thanks[data-id="${id}"] svg`)?.animate([{ transform: "scale(.4) rotate(-12deg)" }, { transform: "scale(1.15)", offset: .6 }, { transform: "none" }], { duration: 360, easing: "ease-out" }); });
  const sh = $(`.sheet[data-id="${id}"] .label`);
  if (sh) { const old = $(".stk", sh); const html = stickerStack(it); if (old) old.outerHTML = html || ""; else sh.insertAdjacentHTML("beforeend", html);
    if (!on) $(".stk", sh)?.classList.add("pop"); }
}

/* sticker tray (computer): scales from its button */
function openTray(btn) {
  if (phone()) return openItem(btn.dataset.id, btn);
  closeTray();
  const it = findItem(btn.dataset.id); if (!it) return;
  const tr = document.createElement("div"); tr.className = "tray"; tr.setAttribute("role", "group"); tr.setAttribute("aria-label", "Stickers");
  tr.innerHTML = STICKERS.map(s => stButton(it, s)).join(""); document.body.append(tr);
  const r = btn.getBoundingClientRect(), w = tr.offsetWidth, h = tr.offsetHeight;
  let left = Math.min(Math.max(8, r.right - w + 6), innerWidth - w - 8), top = r.top - h - 8;
  if (top < 8) top = r.bottom + 8;
  tr.style.left = left + "px"; tr.style.top = top + "px"; tr.style.transformOrigin = `${r.left + r.width / 2 - left}px ${top < r.top ? h + 8 : -8}px`;
  btn.setAttribute("aria-expanded", "true"); tr._btn = btn;
  requestAnimationFrame(() => tr.classList.add("in")); tr.querySelector("button").focus({ preventScroll: true });
}
function closeTray() { const tr = $(".tray"); if (!tr) return; tr._btn?.setAttribute("aria-expanded", "false"); tr.remove(); }

/* menu */
function openMenu(btn) {
  closeMenu();
  const c = course(); const mu = document.createElement("div"); mu.className = "menu"; mu.setAttribute("role", "menu");
  mu.innerHTML = c ? `${phone() ? `<button role="menuitem" data-act="invite">${ic("plus","s")}${t("invitePeople")}</button>
    <button role="menuitem" data-act="course-info">${ic("note","s")}${t("info")}</button>` : ""}${hub.dates ? `<button role="menuitem" data-act="dates">${ic("cal","s")}${lang === "he" ? "הוספת תאריכים…" : "Add dates…"}</button>` : ""}<button role="menuitem" data-act="people">${ic("people","s")}People in this course</button>
    ${phone() ? "" : `<button role="menuitem" data-act="covers">${ic("cover","s")}Change the cover</button>`}
    <button role="menuitemcheckbox" data-act="reminders" aria-checked="${remindersOn(c)}">${ic("bell","s")}${t("reminders")}<span class="chk" aria-hidden="true">${remindersOn(c) ? (lang === "he" ? "פועל" : "On") : (lang === "he" ? "כבוי" : "Off")}</span></button>
    <button role="menuitemcheckbox" data-act="show-here" aria-checked="${showHere()}">${ic("people","s")}${t("showHere")}<span class="chk" aria-hidden="true">${showHere() ? (lang === "he" ? "פועל" : "On") : (lang === "he" ? "כבוי" : "Off")}</span></button>
    <button role="menuitem" data-act="leave" class="danger">${ic("leave","s")}Leave ${esc(c.name)}…</button><hr>
    <button role="menuitem" data-act="profile">${ic("person","s")}Profile</button>
    <button role="menuitem" data-act="forget">${ic("forget","s")}Forget this browser…</button><hr>` : "";
  mu.innerHTML += `<button role="menuitem" data-act="lang" ${lang === "he" ? 'lang="en" dir="ltr"' : 'lang="he" dir="rtl"'}>${ic("globe","s")}${lang === "he" ? "English" : "עברית"}</button>${LIVE ? "" : "<hr>"}`;
  if (!LIVE) mu.innerHTML += `<div class="lab">Prototype</div><button role="menuitem" data-act="states">${ic("note","s")}States…</button>
    <button role="menuitem" data-act="toggle-theme">${ic("theme","s")}${theme() === "dark" ? "Light paper" : "Night paper"}</button>
    <button role="menuitem" data-act="arrive">${ic("drop","s")}Someone adds something</button>`;
  mu.addEventListener("keydown", e => { // arrow keys move through the menu (QA-10)
    const items = [...mu.querySelectorAll('[role="menuitem"], [role="menuitemcheckbox"]')], i = items.indexOf(document.activeElement);
    const n = e.key === "ArrowDown" ? (i + 1) % items.length : e.key === "ArrowUp" ? (i - 1 + items.length) % items.length : e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : -1;
    if (n >= 0) { e.preventDefault(); items[n].focus(); } });
  mu._btn = btn; document.body.append(mu);
  const r = btn.getBoundingClientRect(); const w = mu.offsetWidth;
  mu.style.top = Math.min(r.bottom + 6, innerHeight - mu.offsetHeight - 8) + "px";
  mu.style.left = Math.max(8, Math.min(r.right - w, innerWidth - w - 8)) + "px";
  requestAnimationFrame(() => mu.classList.add("in")); mu.querySelector("button")?.focus({ preventScroll: true });
}
function closeMenu() { const mu = $(".menu"); if (!mu) return; if (mu.contains(document.activeElement)) mu._btn?.focus({ preventScroll: true }); mu.remove(); } // focus goes back to ⋯, never to <body>

/* ============ add (composer) ============ */
let draft = null;
// + the keys in core.js SharePlan (sk-…, sk-ant-…, ghp_…, xox…-): until the page imports core.js, keep these in step
const SECRET = /\bsk-(?:ant-)?[A-Za-z0-9_-]{20,}|\bghp_[A-Za-z0-9]{36}\b|\bxox[abpr]-[A-Za-z0-9-]{10,}|(password|passwd|passcode|pwd)\s*[:=]|\b(sk|pk|rk)[-_][A-Za-z0-9]{16,}|\bAKIA[0-9A-Z]{16}\b|-----BEGIN [A-Z ]*PRIVATE KEY|\b(code|otp|pin)\s*(is|:)?\s*\d{4,8}\b|\b\d{6}\b(?=.*\b(code|verify|verification)\b)/i;
function openAdd(prefill) {
  const c = course(); draft = prefill || null;
  const title = phone() ? t("addOne") : addLabel(c);
  openPanel(`${head(esc(title))}<div class="p-body" id="add-body"></div><div class="p-foot" id="add-foot"></div>`, { w: 560, label: title, cls: "add" });
  drawAdd();
}
function drawAdd(kind) {
  const c = course(), bodyEl = $("#add-body"), foot = $("#add-foot"); if (!bodyEl) return;
  if (!draft && kind !== "link" && kind !== "note" && phone()) { // the phone: four plain rows, nothing to read
    const row = (k, i, w) => `<button class="arow" data-act="way" data-k="${k}"><span class="ai">${ic(i)}</span><span>${w}</span></button>`;
    bodyEl.innerHTML = `<div class="addlist" role="group" aria-label="What to add">${row("photo", "photo", "Take a photo")}${row("file", "file", "Choose a photo or file")}${row("link", "link", t("link"))}${row("note", "note", t("note"))}</div>`;
    foot.innerHTML = ""; return;
  }
  if (!draft && kind !== "link" && kind !== "note") {
    bodyEl.innerHTML = `<div class="ways" role="group" aria-label="What to add">
      <button class="way" data-act="way" data-k="photo">${ic("photo")}<span>${t("photo")}</span></button>
      <button class="way" data-act="way" data-k="file">${ic("file")}<span>${t("file")}</span></button>
      <button class="way" data-act="way" data-k="link">${ic("link")}<span>${t("link")}</span></button>
      <button class="way" data-act="way" data-k="note">${ic("note")}<span>${t("note")}</span></button></div>
      <p style="margin:16px 2px 0;color:var(--ink2);font-size:13px">${phone() ? "Or share a photo of the board straight from your camera." : "Tip: paste (⌘V) or drop a file anywhere on the course to add it."}</p>`;
    foot.innerHTML = `<span class="grow" style="color:var(--ink2);font-size:13px">${ic("lock","s")} Only what you add is shared.</span>`;
    return;
  }
  if (!draft && kind === "link") {
    bodyEl.innerHTML = `<div class="field"><label for="f-link">Link</label><input class="input" id="f-link" type="url" inputmode="url" placeholder="https://" autofocus autocomplete="off"></div>`;
    foot.innerHTML = `<button class="btn quiet" data-act="add-back">Back</button><span class="grow"></span><button class="btn primary" data-act="make" data-k="link">Next</button>`;
    $("#f-link").focus(); return;
  }
  if (!draft && kind === "note") {
    bodyEl.innerHTML = `<div class="field"><label for="f-note">Note</label><textarea class="input" id="f-note" placeholder="The exam is in room 204…" maxlength="5000"></textarea></div>`;
    foot.innerHTML = `<button class="btn quiet" data-act="add-back">Back</button><span class="grow"></span><button class="btn primary" data-act="make" data-k="note">Next</button>`;
    $("#f-note").focus(); return;
  }
  // preview: exactly what goes, and where
  const weeks = Object.keys(c.weekTitles).map(Number).filter(w => w <= c.week).sort((a, b) => b - a);
  const k = theClass(), inClass = S.view === "class";
  const dest = inClass ? `<option value="class">${esc(k.name)} · whole class</option>${S.courses.filter(x => x.shelf === k.name).map(x => `<option value="c:${x.id}">${esc(x.name)} · Week ${x.week}</option>`).join("")}`
    : weeks.map(w => `<option value="${w}" ${w === c.week ? "selected" : ""}>${t("week")} ${w} · ${esc(c.weekTitles[w] || "")}</option>`).join("");
  const refusal = draft.refuse;
  bodyEl.innerHTML = `<div class="preview-wrap"><div>${sheet({ ...draft, by: ME, ago: "now", stickers: {}, mine: [], id: "preview" }).replace(/<button class="press"[^>]*><\/button>/, "").replace('class="sheet ', 'aria-hidden="true" class="sheet ').replace(/<div class="quick">[\s\S]*?<\/div>/, "")}</div>
    <div><div class="field" style="margin-top:0"><label for="f-week">Goes to</label>
      <select class="input" id="f-week">${dest}</select>
      ${!inClass && !refusal && !LIVE && guessFiling(draft) ? (() => { const g = guessFiling(draft); draft.section = g.section; return `<p class="reason">Filed under <b>${esc(g.section)}</b> · ${esc(g.why)}</p>`; })() : ""}</div>
      ${draft.orig ? `<p class="reason">Named from the photo's time · was ${esc(draft.orig)}</p>` : ""}
      ${!inClass && !refusal && (draft.kind === "pdf" || draft.kind === "note") ? `<div class="field"><label for="f-due">Has a date? <span style="font-weight:400">(homework, an exam)</span></label><input class="input" id="f-due" type="datetime-local"></div>` : ""}
      ${refusal ? `<div class="refuse" role="alert">${ic("warn","s")}<span>${esc(refusal)}</span></div>`
        : draft.wa ? `<div class="who-sees">${ic("chat","s")}<span>WhatsApp doesn't let anyone add a whole group from outside. Keep this link here so new people find the group — and <a href="https://wa.me/?text=${encodeURIComponent(lang === "he" ? `כל מה שצריך ל${heAfter(c.name)} במקום אחד ב־Stash (נפתח בדפדפן): ${joinLink(c.invite)}` : `Everything for ${c.name} in one place on Stash (opens in the browser): ${joinLink(c.invite)}`)}" target="_blank" rel="noopener noreferrer">post the invite in that group</a> so everyone can join.</span></div>`
        : `<div class="who-sees">${ic("people","s")}<span>${inClass ? `Everyone in ${esc(k.name)} will see this.` : c.people > 1 ? `${c.people} people in ${esc(c.name)} will see this.` : `Everyone you bring into ${esc(c.name)} will see this.`}</span></div>`}
    </div></div>`;
  foot.innerHTML = `<button class="btn quiet" data-act="add-back">Back</button><span class="grow"></span><button class="btn primary" data-act="commit" ${refusal ? "disabled" : ""}>${ic("plus","s")}<span>Add</span></button>`;
  (refusal ? $('[data-act="add-back"]') : $('[data-act="commit"]'))?.focus(); // a disabled button can't take focus
  hooks.drawAdd?.(draft, bodyEl);
}
function fromText(text) {
  text = text.trim(); if (!text) return null;
  if (SECRET.test(text)) return { kind: "note", text, refuse: "Passwords and codes are never shared." };
  if (/^https?:\/\/\S+$/i.test(text)) { let dom = text; try { dom = new URL(text).hostname.replace(/^www\./, ""); } catch {}
    if (dom === "chat.whatsapp.com") return { kind: "link", url: text, dom, title: `${S.view === "class" ? theClass().name : course().name} — WhatsApp group`, wa: true };
    return { kind: "link", url: text, dom, title: dom === "visualgo.net" ? "VisuAlgo" : (t => { try { return decodeURIComponent(t); } catch { return t; } })(text.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")).slice(0, 80) }; } // a malformed %-escape must not break paste
  return { kind: "note", text: text.slice(0, 5000) };
}
// The server's blocked kinds (shared.sql file_allowed), said before Add instead of after it (launch QA): programs,
// scripts, web pages, disk images and macro documents. The server still decides.
const BLOCKED_EXT = new Set(("exe msi msp com scr pif bat cmd cpl msc vb vbs vbe js jse mjs wsf wsh ws ps1 psm1 psd1 hta jar reg dll sys drv ocx lnk url inf scf " +
  "appx msix appinstaller app pkg mpkg dmg command tool sh bash zsh csh ksh fish workflow scpt scptd applescript terminal webloc inetloc fileloc action " +
  "prefpane kext plugin dylib so deb rpm apk aab ipa iso img vhd vhdx vmdk html htm xhtml shtml mht mhtml svg svgz xml xsl xslt " +
  "docm dotm xlsm xltm xlam pptm potm ppam ppsm sldm").split(" "));
function fromFile(f) {
  if (!f) return null;
  if (f.size > 50 * 1024 * 1024) return { kind: "pdf", title: f.name, meta: sizeOf(f.size), refuse: "Files up to 50 MB can be shared." };
  const ext = /\.([a-z0-9]+)$/i.exec(f.name || "")?.[1]?.toLowerCase();
  if (ext && BLOCKED_EXT.has(ext)) return { kind: "pdf", title: f.name, meta: sizeOf(f.size), refuse: "This kind of file can’t be shared: programs, scripts, web pages and macros are blocked." };
  if (f.type.startsWith("image/")) { const nice = cleanName(f.name, "photo"); const d = { kind: "photo", title: nice || f.name, orig: nice ? f.name : null, src: URL.createObjectURL(f), file: f }; return hooks.photo?.(d, f) || d; }
  return { kind: "pdf", title: f.name, meta: `${(f.name.split(".").pop() || "File").toUpperCase()} · ${sizeOf(f.size)}`, file: f };
}
const sizeOf = b => b > 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB";
function commit() {
  if (!draft || draft.refuse) return;   // a second fast tap on Add, or a refused file: nothing (more) to add (launch QA)
  const dv = $("#f-week")?.value || "", due = $("#f-due")?.value;
  if (S.view === "class") { const it = m({ ...draft, refuse: undefined, by: ME, ago: "now" }); draft = null; closeAll();
    if (dv === "class") { theClass().items.unshift(it); setTimeout(() => land(it, $("#grid-class")), 120); say(`<span>${ic("check","s")}</span><span>Added for <b>the whole class</b>.</span>`, 4000); }
    else { const tc = S.courses.find(x => "c:" + x.id === dv); it.week = tc.week; tc.items.unshift(it); render(); say(`<span>${ic("check","s")}</span><span>Added to <b>${esc(tc.name)}</b>.</span>`, 4000); }
    return; }
  const c = course(); const wk = Number(dv || c.week);
  if (due) { const d = new Date(due); draft.due = dueWords(d, false);
    draft.dueTitle = draft.kind === "note" ? draft.text.split(/[.\n]/)[0].slice(0, 28) : draft.title.replace(/\.[a-z0-9]+$/i, ""); draft.dueSort = d.getTime() / 864e5 - Date.now() / 864e5; }
  const it = m({ ...draft, refuse: undefined, week: wk, by: ME, ago: "now", sending: true, section: S.addSection || draft.section }); S.addSection = null;
  hooks.added?.(it);
  if (it.by === ME && ["note", "pdf", "photo"].includes(it.kind) && !it.due && CORE?.EssentialsNotice) { // it names an exam or a deadline: offer it, never add it
    const sg = CORE.EssentialsNotice.find([it.text, it.ocr].filter(Boolean).join("\n"), it.kind === "note" ? null : it.title, new Date(), tzHere());
    if (sg) { S.essAsk = { it, s: sg, c: course()?.id }; setTimeout(() => { if (phone()) render(); }, 450); }
  }
  if (S.essAsk && S.essAsk.it !== it) { S.essAsk = null; $(".ess-ask")?.remove(); }   // you moved on: an older "Add to the dates?" goes instead of sitting on top of every later add (launch QA S6)
  hub.dates?.afterAdd(it); // a syllabus or a list of dates: "Found 6 dates — add them?" (dates-ui.js)
  if (LIVE) { it.cid = crypto.randomUUID(); it.live = true; it.section = null; }
  draft = null; closeAll();
  if (LIVE) hub.live.send(it, c, wk, due);
  setTimeout(() => {
    if (wk !== c.week) { c.items.unshift(it); render(); say(`<span>${ic("check","s")}</span><span>Added to <b>${t("week")} ${wk}</b>.</span><button class="linkbtn" data-act="undo">Undo</button>`, 5000); S.undo = it.id;
      if (!LIVE) setTimeout(() => { it.sending = !S.online; }, 1300); return; }
    addItem(it);
  }, phone() ? 200 : 120);
  if (!S.online) setTimeout(() => say(`<span>${ic("wifioff","s")}</span><span>Waiting to send — it goes by itself when you're back online.</span>`, 5000), 400);
}

/* drop anywhere on the course (computer) */
let dragDepth = 0;
addEventListener("dragenter", e => { if (!e.dataTransfer?.types.includes("Files") || $(".panel") || S.state === "removed") return; e.preventDefault();
  if (dragDepth++ === 0) { const g = $("#grid-now"); if (g && !$(".slot", g)) { const before = new Map($$(".sheet", g).map(el => [el.dataset.id, el.getBoundingClientRect()]));
    g.insertAdjacentHTML("afterbegin", `<div class="slot">${ic("drop")}<div>Drop to add to<br>${t("week")} ${course().week}</div></div>`);
    if (!reduced()) $$(".sheet", g).forEach(s => { const b = before.get(s.dataset.id), a = s.getBoundingClientRect(); if (b) s.animate([{ transform:`translate(${b.left - a.left}px,${b.top - a.top}px)` }, { transform:"none" }], { duration: 300, easing: getComputedStyle(document.documentElement).getPropertyValue("--spring").trim() }); });
    g.firstElementChild.animate([{ opacity: 0, transform: "scale(.96)" }, { opacity: 1, transform: "none" }], { duration: reduced() ? 150 : 240, easing: "ease-out" }); } } });
addEventListener("dragover", e => { if (e.dataTransfer?.types.includes("Files")) e.preventDefault(); });
addEventListener("dragleave", () => { if (--dragDepth <= 0) { dragDepth = 0; $(".slot")?.remove(); } });
addEventListener("drop", e => { if (!e.dataTransfer?.files.length) return; e.preventDefault(); dragDepth = 0; $(".slot")?.remove();
  if (e.dataTransfer.files.length > 1) { say(`<span>${ic("warn","s")}</span><span>Add one file at a time for now.</span>`); return; }
  openAdd(fromFile(e.dataTransfer.files[0])); });

/* paste anywhere on the course: the clipboard is read only on your paste */
addEventListener("paste", e => {
  if (e.target.closest("input, textarea") || S.state === "removed" || S.state === "deleted" || !course()) return;
  const f = [...(e.clipboardData?.files || [])][0];
  const d = f ? fromFile(f) : fromText(e.clipboardData?.getData("text") || "");
  if (!d) return; e.preventDefault();
  if ($(".panel")) { draft = d; drawAdd(); } else openAdd(d);
});

/* ============ other sheets ============ */
const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // same as core.js InviteCode.alphabet
function newCode() { const r = crypto.getRandomValues(new Uint8Array(6)); return [...r].map(b => INVITE_ALPHABET[b % INVITE_ALPHABET.length]).join(""); } // always 6 letters/digits from the invite alphabet (QA-14; the server makes the real ones)
function openInvite(from, which = "code") {
  const c = S.view === "class" ? theClass() : course(); const code = c.invite.slice(0, 3) + "‑" + c.invite.slice(3);
  openPanel(`${head(lang === "he" ? t("bring") : `Invite people to ${esc(c.name)}`)}<div class="p-body">
    <div class="ways3" role="group" aria-label="How">
      <button class="way" data-act="inv" data-k="code" aria-pressed="${which === "code"}">${ic("code")}<span>Code</span></button>
      <button class="way" data-act="inv" data-k="link" aria-pressed="${which === "link"}">${ic("link")}<span>Link</span></button>
      <button class="way" data-act="inv" data-k="nearby" aria-pressed="${which === "nearby"}">${ic("nearby")}<span>Nearby</span></button></div>
    ${c.people <= 1 ? `<div style="display:flex;gap:14px;align-items:center;margin:0 0 14px"><img data-art="c3-invite" src="${art("c3-invite")}" alt="" style="width:72px;height:72px"><p style="margin:0;color:var(--ink2)">A course gets good when everyone taking it is in. Bring the people next to you first.</p></div>` : ""}
    <div id="inv-body">${invBody(which, c, code)}</div></div>
    <div class="p-foot"><span class="grow" style="color:var(--ink2);font-size:13px">Works until Thu, 5 Nov</span><button class="btn quiet" data-act="new-code">New code</button></div>`, { w: 480, label: t("bring"), from });
}
function invBody(k, c, code) {
  const link = joinLink(c.invite), shown = link.replace(/^https:\/\//, "");
  if (k === "link") return `<div class="code-big"><div style="font:500 17px/1.3 var(--display);direction:ltr;overflow-wrap:anywhere">${esc(shown)}</div>
    <p>Anyone with the link can open ${esc(c.name)} in their browser.</p><div class="acts-row" style="justify-content:center;margin-top:0">
    <a class="btn primary" href="https://wa.me/?text=${encodeURIComponent(lang === "he" ? `הצטרפות ל${heAfter(c.name)}${c.code ? ` (${c.code})` : ""} ב־Stash — מצגות, תמונות של הלוח וסיכומים מכל מי שבקורס. נפתח בדפדפן: ${link}` : `Join ${c.name}${c.code ? ` (${c.code})` : ""} on Stash — slides, board photos and notes from everyone in it. Opens in the browser: ${link}`)}" target="_blank" rel="noopener noreferrer">${ic("chat","s")}<span>Post in a WhatsApp group</span></a>
    <button class="btn" data-act="copy" data-text="${link}">${ic("copy","s")}<span>Copy link</span></button>
    <button class="btn quiet" data-act="share-link" data-text="${link}">${ic("share","s")}<span>More…</span></button></div></div>`;
  if (k === "nearby") return `<div class="code-big"><div class="nearby-anim" aria-hidden="true"><span></span><span></span><span></span><i></i></div>
    <div style="font:500 17px/1.3 var(--display)">Invite people near you</div>
    <p>Phones and laptops near you with the hub open see “${esc(c.name)} is nearby — Join”. You stay visible for 10 minutes.</p>
    <a class="btn primary" href="${nearbyLink(c)}">${ic("nearby","s")}<span>See who's near you</span></a>
    <p style="margin:10px 0 0"><a href="nearby/?invite=${encodeURIComponent(c.invite)}&course=${encodeURIComponent(c.name)}&sound=1">Find people in this room by sound</a></p>
    <p style="margin:8px 0 0">Not seeing them? Read out the code: <b style="color:var(--ink);font-weight:500;direction:ltr;unicode-bidi:isolate">${code}</b></p></div>`;
  return `<div class="code-big"><div class="qr" role="img" aria-label="QR code for the invite">${qr(c.invite)}</div><div class="c"><span aria-hidden="true">${code}</span><span class="vh">Code ${c.invite.split("").join(" ")}</span></div>
    <p>Read it out, or let people scan the code. They join ${esc(c.name)} in the browser.</p>
    <div class="acts-row" style="justify-content:center;margin-top:0"><button class="btn primary" data-act="copy" data-text="${c.invite}">${ic("copy","s")}<span>Copy code</span></button>
    <button class="btn" data-act="projector">Show big for a room</button></div>
    <p style="margin:12px 0 0"><a href="poster/?code=${encodeURIComponent(c.invite)}&course=${encodeURIComponent(c.name)}${lang === "he" ? "&lang=he" : ""}" target="_blank" rel="noopener">Print a poster for the classroom</a></p></div>`;
}
/* Nearby never broadcasts the course's main code: it gets its own short-lived one (THREAT-MODEL.md).
   TODO backend: nearby_invite(space) → { code (6 chars, 15 min, ≤ 60 joins) }. The prototype makes up a demo code. */
function nearbyLink(c) {
  const code = Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
  return `nearby/?invite=${code}&course=${encodeURIComponent(c.name)}&expires=${Date.now() + 15 * 60 * 1000}`;
}
// The QR library (55 KB) loads after the page is up, not before it draws (phone LCP on slow 4G, launch QA); Invite asks
// for it if it isn't there yet and draws the real code the moment it arrives — never the made-up one while waiting.
let qrLoad = null, qrFailed = false;
function loadQR() {
  return qrLoad ??= new Promise(res => { if (window.qrcode) return res(true);
    const sc = document.createElement("script"); sc.src = "vendor/qrcode-generator-1.4.4.js";
    sc.onload = () => res(true); sc.onerror = () => res(false); document.head.append(sc); })
    .then(ok => { qrFailed = !ok; $$(".qr-wait").forEach(el => { el.outerHTML = qr(el.dataset.seed); }); return ok; });
}
addEventListener("load", () => setTimeout(loadQR, 1200));
function qr(seed) { // real, scannable QR of the invite link (qrcode-generator, MIT, vendored; drawn on the device)
  if (!window.qrcode && !qrFailed) { loadQR(); return `<span class="qr-wait" data-seed="${esc(seed)}" aria-hidden="true"></span>`; }
  if (window.qrcode) { const q = qrcode(0, "M"); q.addData(joinLink(seed)); q.make(); const n = q.getModuleCount(); let d = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    return `<svg viewBox="-2 -2 ${n + 4} ${n + 4}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="-2" y="-2" width="${n + 4}" height="${n + 4}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`; }
  let h = 0; for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const n = 25, cells = []; const rnd = () => (h = (h * 1103515245 + 12345) >>> 0) / 4294967296;
  const finder = (x, y) => `<rect x="${x}" y="${y}" width="7" height="7" fill="#000"/><rect x="${x + 1}" y="${y + 1}" width="5" height="5" fill="#fff"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3" fill="#000"/>`;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const inF = (x < 8 && y < 8) || (x > 16 && y < 8) || (x < 8 && y > 16); if (!inF && rnd() > .52) cells.push(`<rect x="${x}" y="${y}" width="1" height="1"/>`); }
  return `<svg viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect width="${n}" height="${n}" fill="#fff"/><g fill="#000">${cells.join("")}</g>${finder(0,0)}${finder(18,0)}${finder(0,18)}</svg>`;
}
function openProjector() {
  const c = S.view === "class" ? theClass() : course(); const code = c.invite.slice(0, 3) + "‑" + c.invite.slice(3);
  closeAll(true); if (document.activeElement !== document.body) lastFocus = document.activeElement; // opened from the invite sheet: focus goes back to Invite
  const d = document.createElement("div"); d.className = "proj"; d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true"); d.setAttribute("aria-label", `Join ${c.name}`);
  d.innerHTML = `<div class="proj-box"><img src="art/poster-projector-light.webp" alt="">
    <div class="proj-words"><h2>Join ${esc(c.name)}</h2><p>Scan the code, or open <b>${esc(SITE.replace(/^https:\/\//, "") + "j")}</b> and type <b style="direction:ltr;unicode-bidi:isolate">${code}</b>.<br>It opens in the browser — nothing to install.</p></div>
    <div class="proj-card"><div class="qr">${qr(c.invite)}</div><div class="c">${code}</div></div></div>
    <button class="close" data-act="close" aria-label="Close">${ic("x","s")}</button>`;
  document.body.append(d); $("#app").inert = true; $("#bottombar").inert = true;
  requestAnimationFrame(() => requestAnimationFrame(() => d.classList.add("in"))); $(".close", d).focus();
}
function closeProjector() { const d = $(".proj"); if (!d) return; $("#app").inert = false; $("#bottombar").inert = false; d.classList.remove("in"); setTimeout(() => d.remove(), 200); lastFocus?.focus?.(); }
function openPeople() {
  const c = S.view === "class" ? theClass() : course(); const names = LIVE ? (c.allNames || []).map(p => p.name) : [...c.names, ...["Maya", "Noam", "Ilan", "Shira", "Itai", "Yael"].map(n => lang === "he" ? DEMO_HE[n] : n)].filter((v, i, a) => a.indexOf(v) === i).slice(0, Math.max(0, c.people - 1));
  openPanel(`${head(lang === "he" ? `${c.people.toLocaleString()} אנשים בקורס ${esc(c.name)}` : `${c.people.toLocaleString()} ${t("people")} in ${esc(c.name)}`)}<div class="p-body"><ul class="list">
    <li><button class="me-row" data-act="profile" aria-label="You · your profile">${face(ME, S.myLook)}<span class="nm">You</span><span class="role">${c.owner === ME ? "Owner · " : ""}Profile${ic("chev","s")}</span></button></li>
    ${names.map(n => `<li>${face(n, lookOf(c, n))}<span class="nm">${esc(n)}</span><span class="role">${n === c.owner ? "Started this course" : ""}</span></li>`).join("")}
    ${c.people - 1 > names.length ? `<li style="color:var(--ink2)">and ${(c.people - 1 - names.length).toLocaleString()} more</li>` : ""}</ul>
    <p style="color:var(--ink2);font-size:13px;margin:14px 0 0">People here see only the name you chose for this course.</p></div>
    <div class="p-foot"><button class="btn primary" data-act="invite">${ic("people","s")}<span>${t("bring")}</span></button></div>`, { w: 440, label: "People" });
}
function openSwitcher() {
  const groups = {}; S.courses.forEach(c => (groups[c.shelf || ""] ??= []).push(c));
  openPanel(`${head(t("yourCourses"))}<div class="p-body" style="padding-top:4px"><div class="near" id="near-sheet">${typeof nearCards === "function" ? nearCards() : ""}</div>${Object.keys(groups).sort((a, b) => (a === "") - (b === "")).map(k => `
    ${k ? `<a class="shelf-h shelf-link" style="padding-inline:4px" href="?class=${theClass().id}" data-class="${theClass().id}" ${S.view === "class" ? 'aria-current="page"' : ""}><span>${esc(k)}</span>${ic("chev","s")}</a>` : `<div class="shelf-h" style="padding-inline:4px">${t("onTheirOwn")}</div>`}
    ${groups[k].map(c => `<a class="course-link" href="?c=${c.id}" data-course="${c.id}" ${S.view === "course" && c.id === course()?.id ? 'aria-current="page"' : ""}>
      ${thumb(c.cover)}
      <span class="nm"><b><span>${esc(c.name)}</span></b><small>${[c.code ? `<bdi>${esc(c.code)}</bdi>` : "", esc(ppl(c.people))].filter(Boolean).join(" · ")}</small></span>
      ${c.items.some(i => i.isNew) && c.id !== course()?.id ? `<span class="dot" aria-label="New things"></span>` : ""}</a>`).join("")}`).join("")}
    <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--hair)"><button class="side-btn" data-act="join">${ic("plus","s")}${t("joinCourse")}</button></div></div>`, { w: 420, label: t("yourCourses") });
}
/** Join or start a course (course-ui.js): the school once, then one name field; the invite code is a link inside it. */
function openJoin() {
  if (hub.newCourse) return hub.newCourse.open();
  // Loaded on first use, so the page's first paint doesn't wait for the school list.
  import("./course-ui.js").then(mod => { mod.startCourses(hub); hub.newCourse.open(); }).catch(() => openCode());
}
function openCode() {
  openPanel(`${head(t("joinCode"))}<div class="p-body"><form data-form="code"><div class="field" style="margin-top:0"><label for="f-code">Code from your invite</label>
    ${codeBox("f-code")}</div>
    <div class="acts-row" style="justify-content:space-between;align-items:center">${hub.newCourse ? `<button class="btn quiet" type="button" data-act="join" style="padding:0">${esc(hub.newCourse.findWords)}</button>` : "<span></span>"}<button class="btn primary" type="submit">Look up</button></div></form></div>`, { w: 420, label: t("joinCode") });
  $("#f-code")?.focus();
}
function openCovers() {
  const c = course();
  openPanel(`${head("Cover for " + esc(c.name))}<div class="p-body"><div class="covers">${COVERS.map((k, i) => `<button data-act="cover" data-i="${i}" aria-pressed="${i === c.cover}" aria-label="Cover ${i + 1}"><img data-art="${k}" src="${art(k)}" alt=""></button>`).join("")}</div>
    <p style="color:var(--ink2);font-size:13px;margin:14px 0 0">Everyone in the course sees the same cover.</p></div>`, { w: 520, label: "Covers" });
}
function confirmSheet(title, text, btn, act) {
  openPanel(`${head(title)}<div class="p-body"><p style="margin:0;color:var(--ink2)">${text}</p></div>
    <div class="p-foot"><button class="btn quiet" data-act="close">Cancel</button><button class="btn primary" data-act="${act}">${btn}</button></div>`, { w: 420, label: title });
}
function openStates() {
  const list = [["normal","The course"],["empty","Empty course"],["loading","Loading"],["offline","Offline"],["none","No courses yet"],["removed","Removed from course"],["deleted","Course deleted"],["many","500 things"],["long","Long names"],["worst","Worst case (QA)"],["welcome","First visit after joining"],["nudge","Get the app nudge"]];
  list.push(["static&nearby=1", "Someone nearby is sharing a course"]);
  openPanel(`${head("Prototype states")}<div class="p-body"><ul class="list">${list.map(([k, l]) => `<li><a href="?state=${k}" style="flex:1;padding:10px 0;text-decoration:none">${l}</a></li>`).join("")}
    <li><a href="?lang=he" style="flex:1;padding:10px 0;text-decoration:none">Hebrew (right to left)</a></li>
    <li><a href="../join/" style="flex:1;padding:10px 0;text-decoration:none">Invite page (join)</a></li>
    <li><a href="../join/?code=XXXXXX" style="flex:1;padding:10px 0;text-decoration:none">Invite page — bad code</a></li></ul></div>`, { w: 420, label: "Prototype states" });
}

/* ============ events ============ */
document.addEventListener("click", async e => {
  const a = e.target.closest("[data-act]"), o = e.target.closest("[data-open]");
  if (!a && !e.target.closest(".tray")) closeTray();
  if (!a && !e.target.closest(".menu")) closeMenu();
  const kl = e.target.closest("a[data-class]");
  if (kl && !e.metaKey && !e.ctrlKey) { e.preventDefault(); S.view = "class"; history.replaceState(null, "", `?class=${kl.dataset.class}`); closeAll(true); render(); scrollTo(0, 0); return; }
  const cl = e.target.closest("a[data-course]");
  if (cl && !e.metaKey && !e.ctrlKey) { e.preventDefault(); S.view = "course"; S.section = "All"; S.current = cl.dataset.course; store.set("course", S.current); history.replaceState(null, "", `?c=${S.current}${lang === "he" ? "&lang=he" : ""}`); closeAll(true); render(); scrollTo(0, 0); $("#course").focus({ preventScroll: true }); return; }
  if (!a && o) return openItem(o.dataset.open, o);
  if (!a) return;
  const act = a.dataset.act, id = a.dataset.id;
  switch (act) {
    case "close": closeAll(); $(".proj") && closeProjector(); break;
    case "refile": { const it = findItem(id); if (!it) break; const secs = ["Lectures", "Tutorials", "Homework", "Exams"];
      say(`<span>Move to</span><span class="refile">${secs.map(x => `<button class="seat" data-act="refile-to" data-id="${id}" data-s="${x}" aria-pressed="${it.section === x}">${x}</button>`).join("")}</span>`, 8000); break; }
    case "refile-to": { const it = findItem(id); if (it) it.section = a.dataset.s; say(`<span>${ic("check","s")}</span><span>Moved to <b>${esc(a.dataset.s)}</b></span>`, 2500); break; }
    case "pass-menu": { const box = $(".tag .pass-to"), open = box.hidden; box.hidden = !open; a.setAttribute("aria-expanded", String(open));
      if (open) { box.innerHTML = `<div class="tray-h" style="margin:12px 0 6px">Pass to someone at the desk</div><div style="display:flex;flex-wrap:wrap;gap:6px">${(course().here || []).map(n => `<button class="seat" data-act="pass-to" data-id="${id}" data-who="${esc(n)}">${face(n, lookOf(course(), n))}<bdi>${esc(n)}</bdi></button>`).join("")}</div>`; $("button", box)?.focus(); } break; }
    case "pass-to": { const it = findItem(id); didIt(a); say(`<span>${ic("check","s")}</span><span>Passed <b>${esc(it?.title || "the note")}</b> to <b><bdi>${esc(a.dataset.who)}</bdi></b> — it waits for them with Keep · No thanks.</span>`, 4500); break; }
    case "quick": { const k = a.dataset.q; S.addSection = a.dataset.section || null; openAdd(); if (k === "photo") $("#pick-photo").click(); else if (k === "file") $("#pick-file").click(); else drawAdd(k); break; }
    case "ics": if (hub.dates) { hub.dates.open(a); break; } say(`<span>In the real hub, the course rep pastes the course's calendar link (.ics) here — lectures, tutorials and deadlines appear in Coming up.</span>`, 5000); break;
    case "info-edit": say(`<span>Members add the lecturer, TA, office hours and links themselves. Nothing is copied from Moodle.</span>`, 4500); break;
    case "welcome-ok": { const w = $(".welcome"); S.welcome = false; if (!w) break; if (reduced()) { w.remove(); break; }
      w.animate([{ opacity: 1 }, { opacity: 0, transform: "translateY(-6px)" }], { duration: 160, easing: "ease-in" }).onfinish = () => w.remove(); break; }
    case "section": S.section = a.dataset.s; { const y = scrollY; render(); scrollTo(0, y); $(`[data-act="section"][data-s="${S.section}"]`)?.focus({ preventScroll: true }); if (S.section !== "All") $$(".week-row").forEach(r => { if (r.querySelector(".cnt").textContent.startsWith("0")) r.hidden = true; }); } break;
    case "add": openAdd(); break;
    case "way": { const k = a.dataset.k; if (k === "photo") $("#pick-photo").click(); else if (k === "file") $("#pick-file").click(); else drawAdd(k); break; }
    case "add-back": draft = null; drawAdd(); break;
    case "make": { const v = a.dataset.k === "link" ? $("#f-link").value : $("#f-note").value; const d = a.dataset.k === "link" ? fromText(/^https?:/i.test(v.trim()) ? v : v.trim() ? "https://" + v.trim() : "") : fromText(v);
      if (!d) { (a.dataset.k === "link" ? $("#f-link") : $("#f-note")).focus(); return; } draft = d; drawAdd(); break; }
    case "commit": commit(); break;
    case "undo": { const c = course(); const it = c.items.find(x => x.id === S.undo); if (!it) break; c.items = c.items.filter(x => x !== it); if (LIVE && it.live) hub.live.remove(it);
      const el = $(`.sheet[data-id="${it.id}"]`); if (el && !reduced()) { el.animate([{ opacity: 1 }, { opacity: 0, transform: "scale(.96)" }], { duration: 160, easing: "ease-in" }).onfinish = () => el.remove(); } else el?.remove();
      S.undo = null; say(`<span>Removed.</span>`, 2500); break; }
    case "invite": closeAll(true); openInvite(a); break;
    case "inv": $$('[data-act="inv"]').forEach(b => b.setAttribute("aria-pressed", String(b === a))); { const c = S.view === "class" ? theClass() : course(); $("#inv-body").innerHTML = invBody(a.dataset.k, c, c.invite.slice(0, 3) + "‑" + c.invite.slice(3)); } break;
    case "new-code": { const c = course(); c.invite = LIVE ? await hub.live.newCode(c) : newCode(); const which = $('[data-act="inv"][aria-pressed="true"]')?.dataset.k || "code"; $("#inv-body").innerHTML = invBody(which, c, c.invite.slice(0, 3) + "‑" + c.invite.slice(3)); break; }
    case "projector": openProjector(); break;
    case "people": closeMenu(); openPeople(); break;
    case "profile": closeMenu(); hub.openProfile?.(a); break;
    case "prof-hint-x": store.set("profileHint", "done"); $(".prof-hint")?.remove(); break;
    case "ess-no": S.essAsk = null; render(); break;
    case "ess-add": { const { it, s: a } = S.essAsk || {}; S.essAsk = null; if (!it) { render(); break; }
      const title = CORE.Essentials.dueTitle(a.title, a.place);
      it.dueAt = a.at.toISOString(); it.dueTitle = title; it.dueSort = (a.at - Date.now()) / 864e5;
      it.due = dueWords(a.at, a.allDay);
      render();
      if (it.live && hub.live?.setDue) { for (let i = 0; i < 40 && it.sending; i++) await new Promise(r => setTimeout(r, 500)); // the server's id first
        try { await hub.live.setDue(it, a.at, title); } catch { say(`<span>Couldn’t save the date. Try again in a minute.</span>`, 4000); } }
      break; }
    case "shelf-tab": S.shelfTab = a.dataset.tab; { const y = scrollY; render(); scrollTo(0, y); $(`[data-act="shelf-tab"][data-tab="${S.shelfTab}"]`)?.focus({ preventScroll: true }); } break;
    case "course-info": { closeMenu(); const c = course(); openPanel(`${head(esc(c.name))}<div class="p-body info-sheet">${railCards(c, c.items.filter(i => i.due).sort((x, y) => x.dueSort - y.dueSort)) || ""}</div>`, { w: 480, label: t("info") }); break; }
    case "switcher": openSwitcher(); break;
    case "join": closeAll(true); openJoin(); break;
    case "covers": closeMenu(); openCovers(); break;
    case "cover": course().cover = Number(a.dataset.i); closeAll(); render(); break;
    case "more": openMenu(a); break;
    case "here-who": { a.classList.add("show"); clearTimeout(a._t); a._t = setTimeout(() => a.classList.remove("show"), 2200); break; }
    case "reminders": { const c = course(), on = !remindersOn(c); store.set(`remind.${c.id}`, on); closeMenu();
      say(`<span>${ic(on ? "bell" : "check", "s")}</span><span>${on ? (lang === "he" ? `תזכורות ל${esc(c.name)} פועלות: יום לפני מבחן, ובבוקר של יום הגשה.` : `Reminders on for ${esc(c.name)}: the day before an exam and the morning something’s due.`)
        : (lang === "he" ? `אין תזכורות ל${esc(c.name)}.` : `No reminders for ${esc(c.name)}.`)}</span>`, 4000);
      hooks.reminders?.(c, on); break; }
    case "show-here": { const on = !showHere(); store.set("showHere", on); closeMenu();
      say(`<span>${on ? (lang === "he" ? "אחרים בקורס יראו שאני כאן." : "Others in the course see when you’re here.") : (lang === "he" ? "לא יראו שאני כאן. עדיין אפשר לראות מי כאן." : "Nobody sees when you’re here now. You still see who is.")}</span>`, 4000);
      hooks.showHere?.(on); break; }
    case "states": closeMenu(); openStates(); break;
    case "lang": { const to = lang === "he" ? "en" : "he"; try { localStorage.setItem("stash.lang", to); } catch {} setPushLang(to); const u = new URL(location.href); u.searchParams.delete("lang"); location.replace(u.href); break; }
    case "toggle-theme": closeMenu(); document.documentElement.dataset.theme = theme() === "dark" ? "light" : "dark"; refreshArt(); break;
    case "arrive": closeMenu(); { const s = S.state; S.state = "normal"; arrival(); S.state = s; } break;
    case "leave": closeMenu(); confirmSheet(`Leave ${esc(course().name)}?`, "What you added stays for the others. You can come back with the invite code.", "Leave", "do-leave"); break;
    case "do-leave": if (LIVE) { hub.live.leave(course()); break; } closeAll(); S.state = "removed"; render(); break;
    case "forget": closeMenu(); confirmSheet("Forget this browser?", "This browser leaves all your courses and forgets your name in them. What others added stays.", "Forget", "do-forget"); break;
    case "do-forget": if (LIVE) { hub.live.forget(); break; } closeAll(); S.courses = []; render(); break;
    case "tray": e.stopPropagation(); if (a.getAttribute("aria-expanded") === "true") closeTray(); else openTray(a); break;
    case "stick": stick(id, Number(a.dataset.s)); pwa(P => P.haptic?.("light")); break;
    case "copy": try { await navigator.clipboard.writeText(a.dataset.text); } catch {}
      if (a.closest(".panel.lift")) { didIt(a, "Copied"); say(`<span>Copied.</span>`, 1800); } else { closeAll(); say(`<span>${ic("check","s")}</span><span>Copied.</span>`, 2500); } break;
    case "qcopy": { const it = findItem(id); try { await navigator.clipboard.writeText(it.kind === "link" ? it.url : it.text); } catch {} didIt(a); say(`<span>Copied.</span>`, 1800); break; }
    case "qsave": if (LIVE) hub.live.open(findItem(id), true); S.saves++; didIt(a); say(`<span>Saved to this device.</span>`, 1800); maybeNudge(); break;
    case "share-item": { const it = findItem(id); if (!it) break;
      if (LIVE && it.filePath && shareSave()) { hub.live.open(it, true); break; } // the file itself
      const data = it.kind === "note" ? { text: it.text } : { title: it.title, url: a.dataset.url };
      if (navigator.share) { try { await navigator.share(data); } catch {} break; }
      location.href = `https://wa.me/?text=${encodeURIComponent(a.dataset.wa)}`; break; }
    case "share-link": if (navigator.share) { try { await navigator.share({ url: a.dataset.text }); } catch {} } else { try { await navigator.clipboard.writeText(a.dataset.text); } catch {} say(`<span>Link copied.</span>`, 2500); } break;
    case "save": if (LIVE) { hub.live.open(findItem(id), true); if (a.closest(".panel.lift")) break; } if (a.closest(".panel.lift")) { S.saves++; didIt(a, "Saved"); pwa(P => { P.noteMoment("save"); P.haptic?.("light"); }); say(`<span>Saved to this device.</span>`, 1800); maybeNudge(); break; }
      closeAll(); S.saves++; say(`<span>${ic("check","s")}</span><span>Saved to this device.</span>`, 2500);
      if (S.saves >= 2 && !S.nudge && desktopOS() && (store.get("nudgeNo", 0) < 2) && store.get("nudgeDay", "") !== new Date().toDateString()) { S.nudge = true; store.set("nudgeDay", new Date().toDateString()); const ns = $("#nudge-slot"); if (ns) ns.innerHTML = nudgeCard(); } break;
    case "nudge-no": store.set("nudgeNo", store.get("nudgeNo", 0) + 1); S.nudge = false; const ns = $("#nudge-slot"); if (ns) ns.innerHTML = ""; break;
    case "fake-open": if (LIVE) { hub.live.open(findItem($(".panel.lift")?.dataset.item), false); break; } closeAll(); say(`<span>In the real hub this opens in your browser's PDF viewer.</span>`, 3500); break;
    case "nearby-send": closeAll(); openInvite(null, "nearby"); break;
    case "report": S.reportId = id; confirmSheet("Report this?", "A course helper will look at it. If three people report it, it's hidden until then.", "Report", "do-report"); break;
    case "do-report": if (LIVE && S.reportId) hub.live.report(S.reportId); closeAll(); say(`<span>Thanks — reported.</span>`, 2500); break;
    case "delete": { const c = course(); if (LIVE) { const gone = findItem(id); if (gone) hub.live.remove(gone); } c.items = c.items.filter(x => x.id !== id); closeAll(); render(); say(`<span>Deleted for everyone.</span>`, 2500); break; }
    case "show-new": { const el = $(".sheet .newtab")?.closest(".sheet"); el?.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "center" }); $(".press", el)?.focus({ preventScroll: true }); break; }
    case "goto": { const el = $(`.sheet[data-id="${id}"]`); el?.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "center" }); $(".press", el)?.focus({ preventScroll: true }); break; }
  }
});
const desktopOS = () => !phone() && /Mac|Win/.test(navigator.platform || navigator.userAgent) && !/iPhone|iPad|Android/.test(navigator.userAgent);

/* search the course: filters the desk as you type */
document.addEventListener("input", e => { if (e.target.id !== "q") return; S.q = e.target.value.trim();
  const c = course(), g = $("#grid-now"); if (!g) return; const now = c.items.filter(i => i.week === c.week && shows(i));
  g.innerHTML = now.map(sheet).join("") || `<p style="grid-column:1/-1;margin:0;color:var(--ink2)">Nothing matches “${esc(S.q)}” this week.</p>`;
  $$(".week-row").forEach(r => { const w = +r.dataset.week, n = c.items.filter(i => i.week === w && shows(i)).length; r.hidden = !!S.q && !n; const cn = $(".cnt", r); if (cn) cn.textContent = `${n} ${n === 1 ? t("thing") : t("things")}`; $(".grid", r).innerHTML = ""; r.dataset.open = "false"; });
});
/* pass a sheet to someone at the desk: drag it onto their name (web version of passing to the person next to you) */
document.addEventListener("dragstart", e => { const sh = e.target.closest?.("#desk .sheet[data-id]"); if (!sh) return; e.dataTransfer.setData("text/x-stash-sheet", sh.dataset.id); e.dataTransfer.effectAllowed = "copy"; sh.classList.add("dragging"); });
document.addEventListener("dragend", e => { $$(".sheet.dragging").forEach(x => x.classList.remove("dragging")); $$(".seat.drop").forEach(x => x.classList.remove("drop")); });
document.addEventListener("dragover", e => { const seat = e.target.closest?.(".seat[data-seat]"); if (!seat || !e.dataTransfer.types.includes("text/x-stash-sheet")) return; e.preventDefault(); $$(".seat.drop").forEach(x => x !== seat && x.classList.remove("drop")); seat.classList.add("drop"); });
document.addEventListener("drop", e => { const seat = e.target.closest?.(".seat[data-seat]"); const id = e.dataTransfer?.getData("text/x-stash-sheet"); if (!seat || !id) return; e.preventDefault(); e.stopPropagation();
  seat.classList.remove("drop"); const it = findItem(id); say(`<span>${ic("check","s")}</span><span>Passed <b>${esc(it?.title || "the note")}</b> to <b><bdi>${esc(seat.dataset.seat)}</bdi></b> — it waits for them with Keep · No thanks.</span>`, 4500); }, true);

/* earlier weeks open in place; their sheets are built only when opened (lazy) */
document.addEventListener("click", e => {
  const b = e.target.closest(".week-row > button"); if (!b) return;
  const row = b.parentElement, open = row.dataset.open !== "true", c = course(), w = Number(row.dataset.week);
  const g = $(".grid", row); if (open && !g.childElementCount) g.innerHTML = c.items.filter(i => i.week === w && shows(i)).map(sheet).join("");
  if (open && row.closest(".desk")) $$(".desk .week-row").forEach(r => { if (r !== row && r.dataset.open === "true") { r.dataset.open = "false"; $("button", r).setAttribute("aria-expanded", "false"); } });
  const from = b.getBoundingClientRect();
  row.dataset.open = String(open); b.setAttribute("aria-expanded", String(open));
  if (open && !reduced() && row.closest(".desk")) $$(".sheet", g).forEach((el, i) => { const r = el.getBoundingClientRect();
    el.animate([{ transform: `translate(${from.left - r.left}px,${from.top - r.top}px) scale(.5) rotate(${i % 2 ? 4 : -4}deg)`, opacity: 0 }, { opacity: 1, offset: .4 }, { transform: "none", opacity: 1 }], { duration: 460, delay: i * 28, easing: "cubic-bezier(.2,.9,.25,1.06)", fill: "backwards" }); });
});
/* ⌘K: find anything in the course, or do anything */
let palSel = 0, palOpts = [];
function palette() {
  closeTray(); closeMenu();
  const p = openPanel(`<div class="pal-in">${ic("search")}<input id="pq" placeholder="Search or jump to…" autocomplete="off" aria-label="Search or jump to" aria-controls="pr" aria-activedescendant=""><kbd>esc</kbd></div><div class="pal-list" id="pr" role="listbox" aria-label="Results"></div>`, { w: 620, label: "Search or jump to", cls: "palette" });
  const q = $("#pq", p); q.focus(); drawPalette(""); q.addEventListener("input", () => { palSel = 0; drawPalette(q.value.trim()); });
}
function drawPalette(q) {
  const c = course(), lq = fold(q), match = x => !lq || fold(x).includes(lq);
  const cmds = [
    { t: addLabel(c) + " — photo", ic: "photo", run: () => { closeAll(true); openAdd(); $("#pick-photo").click(); } },
    { t: addLabel(c) + " — note", ic: "note", run: () => { closeAll(true); openAdd(); drawAdd("note"); } },
    { t: addLabel(c) + " — link", ic: "link", run: () => { closeAll(true); openAdd(); drawAdd("link"); } },
    { t: "Invite people", ic: "people", run: () => { closeAll(true); openInvite(); } },
    { t: "Show the code big for the room", ic: "code", run: () => { closeAll(true); openProjector(); } },
    ...[...new Set(c.items.filter(i => i.week < c.week).map(i => i.week))].sort((a, b) => b - a).map(w => ({ t: `${t("week")} ${w} · ${c.weekTitles[w] || ""}`, k: "Open the week", ic: "file", run: () => { closeAll(true); const b = $(`.week-row[data-week="${w}"] > button`); if (b && b.getAttribute("aria-expanded") !== "true") b.click(); b?.scrollIntoView({ block: "center", behavior: reduced() ? "auto" : "smooth" }); b?.focus({ preventScroll: true }); } })),
  ].filter(x => match(x.t));
  const items = c.items.filter(i => !lq || fold([i.title, i.text, i.by, i.dom, i.ocr].join(" ")).includes(lq)).sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0)).slice(0, lq ? 8 : 4);
  const courses = S.courses.filter(x => x.id !== c.id && match(x.name + " " + x.code)).map(x => ({ t: x.name, k: x.code, ic: "people", run: () => { closeAll(true); S.view = "course"; S.current = x.id; render(); scrollTo(0, 0); } }));
  palOpts = [];
  const opt = (o, extra = "") => { const i = palOpts.push(o) - 1; return `<button class="pal-o" role="option" id="po${i}" data-pi="${i}" aria-selected="${i === palSel}">${extra || `<span class="ic">${ic(o.ic,"s")}</span>`}${o.why ? `<span class="tt"><span class="t">${esc(o.t)}</span><span class="pw">${o.why}</span></span>` : `<span class="t">${esc(o.t)}</span>`}${o.k ? `<span class="k">${esc(o.k)}</span>` : ""}</button>`; };
  let html = "";
  const why = i => { if (!lq) return ""; const inTitle = fold(i.kind === "note" ? i.text : i.title).includes(lq) || fold(i.by).includes(lq); if (inTitle || !i.ocr) return "";
    const f = fold(i.ocr), at = f.indexOf(lq); if (at < 0) return ""; const a = Math.max(0, at - 24), seg = i.ocr.slice(a, at + lq.length + 30);
    const k = at - a; return `${i.kind === "photo" ? "in the photo" : "in the text"}: ${a ? "…" : ""}${esc(seg.slice(0, k))}<mark>${esc(seg.slice(k, k + lq.length))}</mark>${esc(seg.slice(k + lq.length))}…`; };
  if (items.length) html += `<div class="pal-h">${lq ? "On the desk" : "New since you were here"}</div>` + items.map(i => opt({ t: i.kind === "note" ? i.text : i.title, why: why(i), k: `${i.by} · ${t("week")} ${i.week}`, run: () => { closeAll(true); openItem(i.id, $(`.sheet[data-id="${i.id}"]`)); } },
    `<span class="ic">${ic(i.kind === "photo" ? "photo" : i.kind === "link" ? "link" : i.kind === "note" ? "note" : "file", "s")}</span>${i.isNew ? '<span class="nt" aria-label="New"></span>' : ""}`)).join("");
  if (cmds.length) html += `<div class="pal-h">Do</div>` + cmds.map(o => opt(o)).join("");
  if (courses.length) html += `<div class="pal-h">${t("courses")}</div>` + courses.map(o => opt(o)).join("");
  $("#pr").innerHTML = html || `<div class="pal-empty">Nothing matches “${esc(q)}”.</div>`;
  $("#pq")?.setAttribute("aria-activedescendant", palOpts.length ? "po" + palSel : "");
}
document.addEventListener("click", e => { const o = e.target.closest(".pal-o"); if (o) palOpts[+o.dataset.pi]?.run(); });
document.addEventListener("keydown", e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); if ($(".panel.palette")) closeAll(); else if (course()) palette(); return; }
  if ($(".panel.palette") && ["ArrowDown", "ArrowUp", "Enter"].includes(e.key)) { e.preventDefault();
    if (e.key === "Enter") { palOpts[palSel]?.run(); return; }
    palSel = (palSel + (e.key === "ArrowDown" ? 1 : -1) + palOpts.length) % Math.max(1, palOpts.length);
    $$(".pal-o").forEach((o, i) => o.setAttribute("aria-selected", String(i === palSel))); $(`#po${palSel}`)?.scrollIntoView({ block: "nearest" }); $("#pq")?.setAttribute("aria-activedescendant", "po" + palSel); return; }
  // ←/→ in the item view: the next card on the desk, without closing
  if ($(".panel.lift") && (e.key === "ArrowLeft" || e.key === "ArrowRight") && !e.target.closest("input, textarea")) {
    const ids = $$("#grid-now .sheet[data-id], .week-row[data-open=true] .sheet[data-id]").map(x => x.dataset.id), cur = $(".panel.lift")?.dataset.item, i = ids.indexOf(cur);
    const fwd = (e.key === "ArrowRight") !== (document.documentElement.dir === "rtl"); const next = ids[i + (fwd ? 1 : -1)];
    if (next) { e.preventDefault(); openItem(next, null, fwd ? 1 : -1); } return; }
  // arrows move between cards on the desk (nearest card in that direction)
  const pr = e.target.closest?.(".sheet .press");
  if (pr && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
    const all = $$("#desk .sheet .press").filter(x => x.offsetParent), r0 = pr.getBoundingClientRect(), cx = r0.left + r0.width / 2, cy = r0.top + r0.height / 2;
    const dx = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0, dy = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
    let best = null, bd = Infinity;
    for (const x of all) { if (x === pr) continue; const r = x.getBoundingClientRect(), vx = r.left + r.width / 2 - cx, vy = r.top + r.height / 2 - cy;
      if ((dx && Math.sign(vx) !== dx) || (dy && Math.sign(vy) !== dy) || (dx && Math.abs(vy) > r0.height * .6) ) continue;
      const d = dx ? Math.abs(vx) + Math.abs(vy) * 2 : Math.abs(vy) + Math.abs(vx) * 2; if (d < bd) { bd = d; best = x; } }
    if (best) { e.preventDefault(); best.focus(); best.scrollIntoView({ block: "nearest" }); } return; }
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && $(".proj")) { closeProjector(); return; }
  if (e.key === "Escape") { if ($(".tray")) { const b = $(".tray")._btn; closeTray(); b?.focus(); } else if ($(".menu")) closeMenu(); else if ($(".panel")) closeAll(); return; }
  if (e.key === "Tab" && $(".panel")) { const f = $$(".panel button:not([disabled]), .panel a, .panel input, .panel select, .panel textarea").filter(x => x.offsetParent); if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); } else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); } }
});
document.addEventListener("pointerdown", e => { const s = e.target.closest(".sheet[data-open]"); if (s && !e.target.closest(".react-btn")) { s.animate([{ transform: "scale(1)" }, { transform: "scale(.98)" }], { duration: 100, easing: "ease-out", fill: "forwards" });
  const up = () => { s.animate([{ transform: "scale(.98)" }, { transform: "scale(1)" }], { duration: 160, easing: "ease-out", fill: "forwards" }); removeEventListener("pointerup", up); removeEventListener("pointercancel", up); };
  addEventListener("pointerup", up); addEventListener("pointercancel", up); } });
function codeBox(id) {
  return `<div class="codebox"><input ${id ? `id="${id}"` : 'aria-label="Invite code, 6 letters and numbers"'} name="code" maxlength="12" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" enterkeyhint="go"><span class="cb on" aria-hidden="true"></span>${'<span class="cb" aria-hidden="true"></span>'.repeat(5)}</div>`;
}
// Capitals only, dashes and spaces dropped as you type or paste; the sixth character looks the course up.
document.addEventListener("input", e => { const inp = e.target.closest(".codebox input"); if (!inp) return;
  const v = inp.value.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 6);
  if (inp.value !== v) inp.value = v;
  inp.removeAttribute("aria-invalid");
  inp.parentElement.querySelectorAll(".cb").forEach((b, i) => { b.textContent = v[i] || ""; b.classList.toggle("on", i === Math.min(v.length, 5)); });
  if (v.length === 6) inp.form?.requestSubmit(); });
document.addEventListener("submit", e => { const f = e.target.closest('[data-form="code"]'); if (!f) return; e.preventDefault();
  const code = (new FormData(f).get("code") || "").toString().replace(/[^a-z0-9]/gi, "").toUpperCase();
  if (!code) { const inp = $("input[name=code]", f); inp?.setAttribute("aria-invalid", "true"); inp?.focus(); return; } // an empty code goes nowhere (QA-12)
  if (LIVE) { closeAll(true); hub.live.lookup(code); return; }
  location.href = `../join/?code=${code}${lang === "he" ? "&lang=he" : ""}`; });
$("#pick-file").addEventListener("change", e => { const f = e.target.files[0]; e.target.value = ""; if (f) { draft = fromFile(f); drawAdd(); } });
$("#pick-photo").addEventListener("change", e => { const f = e.target.files[0]; e.target.value = ""; if (f) { draft = fromFile(f); drawAdd(); } });
// Live: what's waiting is sent by live.js, which says so only once it really went (27 Oct launch QA, B1). The demo pretends.
addEventListener("online", () => { S.online = true; if (LIVE) { render(); return; } course()?.items.forEach(i => { if (i.sending) i.sending = false; }); render(); say(`<span>${ic("check","s")}</span><span>Back online. Everything you added has gone.</span>`, 3000); });
addEventListener("offline", () => { S.online = false; S.offlineSince = new Date(); clearTimeout(statusTimer); S.statusMsg = null; render(); });   // being offline outranks a note like "Filed in Week 1"

/* large title → top bar title on phones */
let ticking = false;
function observeTitle() { const h = $("#course-name"); $("#topbar").classList.toggle("scrolled", !!h && h.getBoundingClientRect().bottom < 52); }
addEventListener("scroll", () => { if (ticking) return; ticking = true; requestAnimationFrame(() => { ticking = false; observeTitle(); }); }, { passive: true });

/* ============ hidden features ============ */
// Crisp Swap (CONFIDENTIAL, off): ?crisp=1 turns it on for this browser, ?crisp=0 off. Lives in crisp/ (never published).
const hooks = {};
const hub = { S, m, ME, store, course, render, renderSide, renderPresence, remindersOn, showHere, pwa, addItem, say, esc, ic, reduced, phone, shareSave, openItem, drawAdd, findItem, closeAll, hooks, openPanel, head, sheet, $, $$,
  get draft() { return draft; }, set draft(v) { draft = v; }, live: null };
Object.assign(hub, { LIVE, lang, face, thumb, myNameHere, openCode, t }); import("./profile-ui.js").then(mod => mod.startProfile(hub)).catch(() => {});
import("./dates-ui.js").then(mod => mod.startDates(hub)).catch(() => {});
if (navigator.webdriver) window.stashHubTest = { S, heWhen, duringClass, page, railCards };   // automated tests only (scripts/hub/web/launch.test.mjs)
try { const q = params.get("crisp"); if (q === "1") localStorage.setItem("stash.crisp", "1"); if (q === "0") localStorage.removeItem("stash.crisp"); } catch {}
if ((() => { try { return localStorage.getItem("stash.crisp") === "1"; } catch { return params.get("crisp") === "1"; } })()) {
  window.stashHub = hub;
  const sc = document.createElement("script"); sc.type = "module"; sc.src = "crisp/crisp-hub.js"; document.head.append(sc);
}


/* ============ go ============ */
render(); heLocalize(document.body);
if (LIVE) { window.stashHub = hub; import("./live.js").then(m => m.startLive(hub)).catch(e => { console.warn("live mode didn't start", e); S.liveBlock = null; render(); }); }
if (params.get("joined")) { // arriving from the invite: the cover stays, the course fills in underneath
  const rest = $$("#course > section, #course .course-bar, #course .status");
  if (!reduced()) rest.forEach((el, i) => el.animate([{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], { duration: 420, delay: 120 + i * 60, easing: "cubic-bezier(.23,1,.32,1)", fill: "backwards" }));
  setTimeout(() => say(`<span>${ic("check","s")}</span><span>You're in <b>${esc(course().name)}</b>. Everything here is yours to open and save.</span>`, 6000), 500);
}
if (S.state === "normal" && !LIVE) { setTimeout(arrival, 9000); setInterval(arrival, 32000); }
if (S.state === "nudge") { S.nudge = true; const n = $("#nudge-slot"); if (n) n.innerHTML = nudgeCard(); } // (the phone folio has no nudge)
if (params.get("show") === "projector") openProjector();
if (params.get("show") === "palette") setTimeout(() => { palette(); if (params.get("pq")) { $("#pq").value = params.get("pq"); drawPalette(params.get("pq")); } }, 150);
if (params.get("show") === "filed") setTimeout(() => { const it = findItem($("#grid-now .sheet")?.dataset.id); if (it) say(`<span>${ic("check","s")}</span><span>Filed in <b>${t("week")} ${it.week}${it.section ? " · " + esc(it.section) : ""}</b></span><button class="linkbtn" data-act="refile" data-id="${it.id}">Change</button><button class="linkbtn" data-act="undo">Undo</button>`, 60000); }, 200);
if (params.get("show") === "hover") setTimeout(() => { const el = $("#grid-now .sheet"); if (el) { el.classList.add("show-hover"); } }, 100);
if (params.get("open") != null) setTimeout(() => { const el = $$("#grid-now .sheet")[+params.get("open") || 0]; if (el) openItem(el.dataset.id, el); }, 150);
/* nearby: courses someone near you is sharing, that you're not in yet */
let nearList = [];
const nearCards = () => nearList.filter(n => !S.courses.some(c => c.name === n.course)).slice(0, 3).map(n => `<div class="near-card"><span class="ring" aria-hidden="true"><span></span><i></i></span>
  <p><b>${esc(n.course)}</b> is nearby<small>${esc(n.name)} is sharing it</small></p><a class="btn primary" href="../join/?code=${encodeURIComponent(n.code)}${lang === "he" ? "&lang=he" : ""}">Join</a></div>`).join("");
function renderNear() { const el = $("#near-side"); if (el) el.innerHTML = nearCards(); const sw = $("#near-sheet"); if (sw) sw.innerHTML = nearCards(); }
if (params.get("nearby")) { nearList = [{ id: "demo", name: lang === "he" ? "דנה" : "Dana", course: lang === "he" ? "מבני נתונים" : "Data Structures", code: "DS2K7Q" }]; renderNear(); }
else if (window.stashNearby) window.stashNearby.onSharing(list => { nearList = list || []; renderNear(); }, { courses: S.courses.map(c => c.name) });
// installable app (nearby-share's pwa.js, a module that may load after this script): the hub's status line owns the offline queue
function pwa(f) { if (window.StashPWA) f(window.StashPWA); }
function pwaInit() { pwa(P => { P.configure({ ui: { queue: false } }); P.setCourses(S.courses.map(c => ({ id: c.id, name: c.name, space: c.space || c.id })));
  P.suggestCourse?.(() => S.courses.find(c => c.liveNow)?.id || null); }); }
if (window.StashPWA) pwaInit(); else addEventListener("load", pwaInit, { once: true });
})();
