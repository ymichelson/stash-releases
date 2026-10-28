// The syllabus reader (docs/shared/SYLLABUS.md), its own file so the page's first load stays small: it's imported only
// when a syllabus, a pasted list or a Word file is read (dates-ui.js). Twin: StashCore SharedSyllabus.swift.
import { EssentialsNotice, DateImport, _dates } from "./core.js";
const { rxAll, rxFirst, rxHas, N, DI, MONTH_KEYS, HE_MONTHS, HE_WEEKDAYS, EN_DAYS, HE_DAYS, tzParts, dayNo, zonedToUTC, addDaysIn, plusDays, weekdayOf, ymd, hm } = _dates;

/** Weekly classes first, then the dated things, soonest first (DateImport's rows): a syllabus's or a pasted list's dates. */
export function datesFromText(text, { now = new Date(), timeZone, termStarts = null } = {}) {
  return Syllabus.read(text, { now, timeZone, termStarts }).dates;
}

// ——— A syllabus, read whole (SharedSyllabus.swift; cases in test/syllabus-cases.json, scored by scripts/hub/syllabus-score.mjs) ———
// Upload a syllabus (PDF, Word, photo, pasted text) and the course fills itself in: the course code and term, the weekly
// classes, every exam and deadline (time, room, moed A/B), who teaches it (emails, office hours), the grade breakdown,
// the reading and links. All rules, on the device, English + Hebrew; nothing is saved until the person ticks it in
// "Here’s what I found". datesFromText (below) is this reader’s dates. The Mac runs the same rules and the same cases
// (SharedSyllabusTests checks its output against test/syllabus-golden.json, which this side writes).
const SY = {
  cls: String.raw`(?<![a-z])(exercise class(?:es)?|exercise sessions?|practicals?|workshops?|lectures?|class(?:es)?|tutorials?|recitations?|labs?|sections?|seminars?|meets|meet|meetings?|sessions?)(?![a-z])|(?<![א-ת])[ובה]?(הרצאות|הרצאה|תרגולים|תרגול|שיעורים|שיעור|מעבדות|מעבדה|סמינר|סדנה|מפגשי הנחיה|מפגשים|מפגש)(?![א-ת])`,
  office: String.raw`(?<![a-z])(office hours?|student hours|reception hours?|consultation hours?)(?![a-z])|שעות קבלה|שעת קבלה`,
  wdEN: String.raw`(?<![a-z])(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tues|tue|wed|thurs|thur|thu|fri|sat)(s)?(?![a-z])`,
  wdHE: String.raw`(?<![א-ת])[ובל]{0,2}(?:יום|ימי)\s+(ראשון|שני|שלישי|רביעי|חמישי|שישי|א|ב|ג|ד|ה|ו)(?![א-ת])`,
  wdHEList: String.raw`(?<![א-ת])[בל]?(?:ימים|ימי)\s+([א-ו]['׳]?(?:\s*(?:,|ו-?|-)\s*[א-ו]['׳]?)+)(?![א-ת])`,
  wdCodes: String.raw`(?<![A-Za-z/])((?:Th|Tu|M|T|W|R|F)(?:/?(?:Th|Tu|M|T|W|R|F)){1,4})(?![A-Za-z/])`,
  range: String.raw`(?<![\d:./])([01]?\d|2[0-3])(?::([0-5]\d))?\s*(am|pm|a\.m\.|p\.m\.)?\s*(?:[-–—]|to|עד)\s*([01]?\d|2[0-3])(?::([0-5]\d))?\s*(am|pm|a\.m\.|p\.m\.)?(?![\d/]|\.\d|:\d)`,
  every: String.raw`(?<![a-z])(every|each|weekly)(?![a-z])|(?<![a-z])(sunday|monday|tuesday|wednesday|thursday|friday)s(?![a-z])|(?<![א-ת])(כל|מדי)(?![א-ת])`,
  examHE: String.raw`(?<![א-ת])[והבלמשכ]{0,2}(בחינה|בחינת|בחינות)(?![א-ת])`,
  deliver: String.raw`(?<![a-z])ps\s*#?\s*\d|(?<![a-z])(coursework|proposal|report|paper|portfolio|milestones?|notebook|capstone|presentations?|demo|project|case study|essay|reflection)(?![a-z])|(?<![א-ת])[והבלמשכ]{0,2}(עבודה|עבודת|פרויקט|הצעת מחקר|דו"ח|דו״ח|ממ"ן|ממ״ן|ממן|מטלה|מטלת)(?![א-ת])`,
  finalBare: String.raw`(?<![a-z])final(?![a-z])(?!\s+(?:project|report|paper|presentation|portfolio|essay|grade|exam))`,
  submitHE: String.raw`(?<![א-ת])(מגישים|מוגשים|יוגשו)(?![א-ת])`,
  review: String.raw`(?<![a-z])(review|revision|prep|preparation|practice)(?![a-z])|(?<![א-ת])[ול]?(חזרה|הכנה)(?![א-ת])`,
  noClass: String.raw`(?<![a-z])no (?:class|classes|lecture|lectures)(?![a-z])|אין (?:שיעור|הרצאה|תרגול)`,
  opens: String.raw`(?<![a-z])(opens|opened|open|available)(?![a-z])|(?<![א-ת])(נפתח|נפתחת|פתיחה)(?![א-ת])`,
  inClass: String.raw`(?<![a-z])in[- ](?:class|lecture)(?![a-z])|(?<![a-z])in the (?:tutorial|recitation|section|lab|lecture)(?![a-z])|(?<![א-ת])(?:בכיתה|בהרצאה|בתרגול)(?![א-ת])(?!\s*\d)`,
  tutorialish: String.raw`(?<![a-z])(tutorials?|recitations?|sections?|labs?)(?![a-z])|תרגול`,
  term: String.raw`(?<![a-z])(semester|term|classes|course)(?![a-z])|סמסטר|הלימודים|הקורס`,
  termOnly: String.raw`(?<![a-z])(semester|term)(?![a-z])|סמסטר`,
  lecturer: String.raw`(?<![a-z])(instructors?|lecturers?|professor|teacher|module convenor|convenor|course coordinator|coordinator)(?![a-z])|(?<![א-ת])ה?(מרצה|מרצת|מורה|רכז הקורס|רכזת הקורס)(?![א-ת])`,
  ta: String.raw`(?<![a-z])(teaching assistants?|tas|ta|tutors|tutor|t\.a\.)(?![a-z])|(?<![א-ת])ה?(מתרגלים|מתרגלות|מתרגלת|מתרגל|עוזרת הוראה|עוזר הוראה|מנחים|מנחה|מנחת)(?![א-ת])`,
  staffHead: String.raw`^(?:teaching assistants?|tas|tutors?|course staff|staff|instructors?|lecturers?|מתרגלים|מתרגלות|סגל הקורס|צוות הקורס)\s*:?$`,
  honorEN: String.raw`(?<![A-Za-z])(?:Dr|Prof|Professor|Mr|Ms|Mrs)\.?\s+(?=[A-Z])`,
  honorHE: String.raw`(?<![א-ת])(?:ד["״]ר|פרופ['׳]|פרופסור|עו["״]ד)\s+(?=[א-ת])`,
  email: String.raw`[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}`,
  url: String.raw`https://[^\s<>()"'|]+`,
  gradeHead: String.raw`(?<![a-z])(grading|grades?|assessments?|evaluation|weights?|weighting|final grade|course grade|requirements|components?|marking|breakdown)(?![a-z])|הרכב (?:ה)?ציון|מרכיבי (?:ה)?ציון|(?<![א-ת])ה?ציון(?![א-ת])|דרישות|הערכה|משקל`,
  pct: String.raw`(?<![\d.,])(\d{1,3})\s*%|%\s*(\d{1,3})(?![\d.])`,
  gradeBad: String.raw`(?<![a-z])(late|lose|loses|penalty|penalties|deduct|deducted|per day|a day|each|bonus|extra credit|attendance is required)(?![a-z])|איחור|קנס|הורדה|ליום|כל אחד|בונוס`,
  readHead: String.raw`^(?:(?:required|recommended|core|essential|further|optional|supplementary|suggested)\s+)?(?:reading list|readings?|texts?|textbooks?|books?|bibliography|literature|course materials)(?:\s*\(([^)]*)\))?\s*(?::\s*(.*)|$)|^(required|recommended)\s*:\s*(.+)$`,
  readHeadHE: String.raw`^(רשימת קריאה|קריאת חובה|קריאת רשות|קריאה נוספת|קריאה מומלצת|ספר חובה|ספרי חובה|ספר הקורס|ספרות|ביבליוגרפיה)(?:\s*\(([^)]*)\))?\s*(?::\s*(.*)|$)`,
  codeEN: String.raw`(?<![A-Za-z0-9@./])([A-Z]{2,5})[ -]?(\d{3,4}[A-Z]?)(?![A-Za-z0-9])`,
  codeNum: String.raw`(?<![\d./:-])(\d{4}-\d{4}|\d{5,6})(?![\d./:-])`,
  cue: String.raw`^(?:due|due date|deadline|date|closes|close|submission|reminder|quick reminder|תאריך הגשה|מועד הגשה|תאריך|הגשה|מועד|תזכורת)$`,
};
const SY_EN_NAMES = { homework: "Homework", hw: "Homework", assignment: "Assignment", exercise: "Exercise", ex: "Exercise", "problem set": "Problem set",
  pset: "Problem set", ps: "Problem set", project: "Project", essay: "Essay", "lab report": "Lab report" };
const SY_CLASS = { "exercise class": "Exercise class", "exercise classes": "Exercise class", "exercise session": "Exercise class",
  "exercise sessions": "Exercise class", practical: "Practical", practicals: "Practical", workshop: "Workshop", workshops: "Workshop", lecture: "Lecture", lectures: "Lecture", class: "Class", classes: "Class", tutorial: "Tutorial", tutorials: "Tutorial",
  recitation: "Recitation", recitations: "Recitation", lab: "Lab", labs: "Lab", section: "Section", sections: "Section", seminar: "Seminar",
  seminars: "Seminar", meets: "Class", meet: "Class", meeting: "Class", meetings: "Class", session: "Class", sessions: "Class", הרצאה: "הרצאה",
  הרצאות: "הרצאה", תרגול: "תרגול", תרגולים: "תרגול", שיעור: "שיעור", שיעורים: "שיעור", מעבדה: "מעבדה", מעבדות: "מעבדה", סמינר: "סמינר",
  סדנה: "סדנה", "מפגשי הנחיה": "מפגש הנחיה", מפגשים: "מפגש", מפגש: "מפגש" };
const SY_TUTORIAL = new Set(["Exercise class", "Practical", "Tutorial", "Recitation", "Lab", "Section", "תרגול", "מעבדה", "מפגש הנחיה"]);
const SY_STOP_EN = new Set(["office", "email", "e-mail", "room", "hall", "building", "course", "teaching", "assistant", "assistants", "lecturer", "instructor",
  "hours", "hour", "zoom", "the", "and", "ta", "tas", "website", "phone", "mon", "tue", "wed", "thu", "fri", "monday", "tuesday", "wednesday",
  "thursday", "friday", "sunday", "fall", "spring", "winter", "summer", "semester", "term", "reception", "student", "by", "appointment"]);
const SY_STOP_HE = new Set(["שעות", "שעת", "קבלה", "יום", "בתיאום", "מראש", "הקורס", "חדר", "בניין", "דוא\"ל", "דוא״ל", "טלפון", "מייל", "אימייל", "השבוע",
  "שלי", "מרצה", "מרצת", "מתרגל", "מתרגלת", "מנחה", "בכיתה", "סמסטר", "בבניין", "דואל"]);
const SY_MONTH_WORD = String.raw`(?<![a-z])(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?![a-z])|(?<![א-ת])[בל]?(?:ינואר|פברואר|מרץ|מרס|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)(?![א-ת])`;
const SY_KEY = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const syYear = s => (s == null ? null : +s < 100 ? 2000 + +s : +s);
const syValid = (y, m, d) => m >= 1 && m <= 12 && d >= 1 && d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
const syEnd = g => g.at + g.groups[0].length;
const syTidy = s => String(s).replace(/\s+/g, " ").replace(/^[\s,;:.|·–—-]+|[\s,;:.|·–—-]+$/g, "").trim();
const syHeQuotes = s => s.replace(/(?<=[א-ת])"(?=[א-ת])/g, "״").replace(/(?<=(?:^|\s)[א-ת])'/g, "׳");
const syCap = s => (/^[a-z]/.test(s) ? s[0].toUpperCase() + s.slice(1) : s);

export const Syllabus = Object.freeze({
  maxText: 60_000, maxDates: 60, maxPeople: 8, maxGrades: 12, maxReading: 15, maxLinks: 10,

  /** {code, term: {starts, ends} | null, dates (FoundDate rows, weekly classes first), people [{role, name, email, hours}],
   *  grades [{item, percent}], reading [{title, required}], links [{name, url}], lang}. `termStarts` ("2026-10-25", the
   *  course's own) counts the weeks when the text doesn't. */
  read(text, { now = new Date(), timeZone, termStarts = null } = {}) {
    now = new Date(now);
    const L = this.lines(text);
    const { lines, low, gap } = L;
    const term = this.term(low, now, timeZone);
    const given = termStarts ? (([y, m, d]) => ({ y, m, d }))(String(termStarts).slice(0, 10).split("-").map(Number)) : null;
    const used = new Set(), classes = [];
    for (let i = 0; i < lines.length; i++) {
      if (!this.isClassLine(lines[i], low[i], now, timeZone)) continue;
      used.add(i);
      classes.push(...this.weekly(lines[i], low[i], { now, timeZone, starts: term.starts ?? given, ends: term.ends ?? term.weeksEnd }));
    }
    const once = this.dated(L, { now, timeZone, used, classes, anchor: term.anchor ?? (given ? { n: 1, day: given } : null) });
    const seen = new Set(), dates = [];
    for (const { wd, from, ...f } of [...classes, ...once]) if (!seen.has(f.uid)) { seen.add(f.uid); dates.push(f); }
    const he = (String(text ?? "").match(/[א-ת]/g) || []).length > (String(text ?? "").match(/[A-Za-z]/g) || []).length;
    return {
      code: this.code(lines), term: term.starts || term.ends ? { starts: term.starts ? ymd(term.starts) : null, ends: term.ends ? ymd(term.ends) : null } : null,
      dates: DateImport.order(dates, timeZone).slice(0, this.maxDates), people: this.people(lines, low, gap),
      grades: this.grades(lines, low, gap), reading: this.reading(lines, low, gap), links: this.links(lines), lang: he ? "he" : "en",
    };
  },

  /** The text as lines: right-to-left marks out, a tab or a run of spaces (a PDF's table columns) becomes a " | " cell
   *  border like a pasted table's, ruler rows (|---|) go; `gap` says a blank line came before. Month first (11/17, 12/01)
   *  when a date can only be read that way and none only the Israeli way. */
  lines(text) {
    let raw = [...String(text ?? "")].slice(0, this.maxText).join("").replace(/\r\n?/g, "\n").replace(/[‎‏‪-‮⁦-⁩]/g, "");
    const pairs = rxAll(String.raw`(?<![\d/.:])(\d{1,2})/(\d{1,2})(?!\d)`, raw).map(g => [+g.groups[1], +g.groups[2]]);
    if (pairs.some(([a, b]) => b > 12 && a <= 12) && !pairs.some(([a, b]) => a > 12 && b <= 12))
      raw = raw.replace(/(?<![\d/.:])(\d{1,2})\/(\d{1,2})(?!\d)/g, "$2/$1");
    raw = raw.replace(/(?<![a-zA-Z])between (\d{1,2}(?::\d{2})?\s*(?:am|pm)?) and (\d{1,2}(?::\d{2})?)/gi, "$1-$2")
      .replace(/(?<![א-ת])בין (\d{1,2}(?::\d{2})?) ל-?(\d{1,2}(?::\d{2})?)/g, "$1-$2");
    const lines = [], gap = [];
    let blankBefore = true;
    for (const l of raw.split("\n")) {
      const t = l.replace(/\t| {2,}/g, " | ").replace(/\s+/g, " ").replace(/(?:\s*\|\s*)+/g, " | ").replace(/^\s*\|\s*|\s*\|\s*$/g, "").trim();
      if (!t || /^[\s|:=_-]+$/.test(t)) { blankBefore = true; continue; }
      lines.push(t); gap.push(blankBefore); blankBefore = false;
    }
    return { lines, low: lines.map(l => l.toLowerCase()), gap };
  },

  // MARK: Dates, times and days

  /** Every written or numeric date in a piece of lower-case text, in reading order: {at, end, y|null, m, d}. */
  explicit(p) {
    const out = [];
    const add = (g, y, m, d) => out.push({ at: g.at, end: syEnd(g), y, m, d });
    for (const g of rxAll(String.raw`(?<!\d)(\d{1,2})(?:st|nd|rd|th)?(?:\s+of)?\s+` + N.month + String.raw`\.?(?:,?\s+(\d{4}))?(?![a-z])`, p))
      add(g, syYear(g.groups[3]), MONTH_KEYS.indexOf(g.groups[2].slice(0, 3)) + 1, +g.groups[1]);
    for (const g of rxAll(String.raw`(?<![a-z])` + N.month + String.raw`\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?![\d:])(?:,?\s+(\d{4})(?!\d))?`, p))
      add(g, syYear(g.groups[3]), MONTH_KEYS.indexOf(g.groups[1].slice(0, 3)) + 1, +g.groups[2]);
    for (const g of rxAll(String.raw`(?<!\d)(\d{1,2})\s*[בל]?-?\s*(ינואר|פברואר|מרץ|מרס|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)(?:\s+(\d{4}))?`, p))
      add(g, syYear(g.groups[3]), HE_MONTHS[g.groups[2]], +g.groups[1]);
    for (const g of rxAll(String.raw`(?<![\d-])(20\d\d)-(\d{1,2})-(\d{1,2})(?![\d-])`, p)) add(g, +g.groups[1], +g.groups[2], +g.groups[3]);
    for (const pattern of [String.raw`(?<![\d/.:])(\d{1,2})/(\d{1,2})(?:/(\d{4}|\d{2}))?(?!/?\d)`,
                           String.raw`(?<![\d.:])(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})(?!\d)`,
                           String.raw`(?:^|:\s*|\|\s*|(?<![a-z])(?:on|by|until|due|date|before|sun|mon|tue|wed|thu|fri|sat)[a-z]*\.?,?\s+|(?<![א-ת])(?:ב|עד|ל|ה|בתאריך)\s?-?\s?|['׳]\s+|[–—-]\s+)(\d{1,2})\.(\d{1,2})(?!\.?\d)`]) {
      for (const g of rxAll(pattern, p)) {
        const a = +g.groups[1], b = +g.groups[2], [d, m] = b > 12 && a <= 12 ? [b, a] : [a, b];
        add(g, g.groups.length > 3 ? syYear(g.groups[3]) : null, m, d);
      }
    }
    return out.sort((a, b) => a.at - b.at || b.end - a.end).filter((x, i, all) => !all.slice(0, i).some(y => x.at < y.end && y.at < x.end));
  },
  /** The first date, past or not: a missing year is the one nearest to now ("Week 1 (25/10)", "the semester ends 22/1"). */
  explicitDate(p, now, tz) {
    const today = tzParts(now, tz), t = dayNo(today.y, today.m, today.d);
    for (const e of this.explicit(p)) {
      if (e.y != null) { if (syValid(e.y, e.m, e.d)) return { y: e.y, m: e.m, d: e.d }; continue; }
      const y = [today.y - 1, today.y, today.y + 1].filter(y => syValid(y, e.m, e.d)).sort((a, b) => Math.abs(dayNo(a, e.m, e.d) - t) - Math.abs(dayNo(b, e.m, e.d) - t))[0];
      if (y != null) return { y, m: e.m, d: e.d };
    }
    return null;
  },
  /** The day a piece names: a written or numeric date (a year-less one already past by up to 60 days means nothing to
   *  add; further back is next year's), else a weekday (the next one), else today / tomorrow. {y, m, d, end}. */
  date(p, now, tz) {
    const today = tzParts(now, tz);
    const e = this.explicit(p).find(x => syValid(x.y ?? today.y, x.m, x.d));
    if (e) {
      if (e.y != null) return { y: e.y, m: e.m, d: e.d, end: e.end };
      const ahead = dayNo(today.y, e.m, e.d) - dayNo(today.y, today.m, today.d);
      if (ahead >= 0) return { y: today.y, m: e.m, d: e.d, end: e.end };
      return ahead < -60 && syValid(today.y + 1, e.m, e.d) ? { y: today.y + 1, m: e.m, d: e.d, end: e.end } : null;
    }
    const wd = [...rxAll(String.raw`(?<![a-z])(sunday|monday|tuesday|wednesday|thursday|friday|sun|mon|tues|tue|wed|thurs|thur|thu|fri)(?![a-z])`, p)
      .map(g => ({ at: g.at, end: syEnd(g), wd: SY_KEY[g.groups[1].slice(0, 3)] })),
      ...rxAll(String.raw`(?<![א-ת])[בל]?יום\s+(ראשון|שני|שלישי|רביעי|חמישי|שישי|א|ב|ג|ד|ה|ו)(?![א-ת])`, p).map(g => ({ at: g.at, end: syEnd(g), wd: HE_WEEKDAYS[g.groups[1]] }))]
      .sort((a, b) => a.at - b.at)[0];
    if (wd) { const ahead = (wd.wd - today.wd + 7) % 7; return { ...plusDays(today, ahead === 0 ? 7 : ahead), end: wd.end }; }
    const rel = [...rxAll(String.raw`(?<![a-z])(today|tonight|tomorrow)(?![a-z])`, p), ...rxAll(String.raw`(?<![א-ת])[ול]?(היום|מחרתיים|מחר)(?![א-ת])`, p)].sort((a, b) => a.at - b.at)[0];
    if (rel) return { ...plusDays(today, { today: 0, tonight: 0, tomorrow: 1, היום: 0, מחר: 1, מחרתיים: 2 }[rel.groups[1]]), end: syEnd(rel) };
    return null;
  },
  /** A time range's hours, with am/pm worked out: "2:30-3:45 pm" → 14:30–15:45, "11:30am-12:20pm", "3-4pm", "12:30-1:30 pm",
   *  "2-4" (the afternoon). Null when it isn't a plausible time of day. */
  span(g) {
    const ampm = (h, s) => (s == null ? h : s.startsWith("p") ? (h < 12 ? h + 12 : h) : h === 12 ? 0 : h);
    let [h1, m1, s1, h2, m2, s2] = [+g.groups[1], +(g.groups[2] ?? 0), g.groups[3], +g.groups[4], +(g.groups[5] ?? 0), g.groups[6]];
    const raw1 = h1, raw2 = h2;
    h2 = ampm(h2, s2);
    if (s1) h1 = ampm(h1, s1);
    else if (s2 && s2.startsWith("p") && raw1 < 12 && raw1 <= raw2) h1 += 12;
    if (!s1 && !s2 && h1 < 7 && h2 <= 10) { h1 += 12; h2 += 12; }
    if (h1 < 7 || h1 > 22 || h2 * 60 + m2 <= h1 * 60 + m1 || h2 > 23) return null;
    return { from: { h: h1, m: m1 }, to: { h: h2, m: m2 } };
  },
  /** The time a piece names and where it ends in the text: a range's start ("7:00-9:00 PM" → 19:00), "9:00", "2pm", "at 9",
   *  "בשעה 10", "noon". {h, m, end}. */
  clock(p) {
    const found = [];
    const ampm = (h, s) => (s == null ? h : s.startsWith("p") ? (h < 12 ? h + 12 : h) : h === 12 ? 0 : h);
    const afternoon = h => (h >= 1 && h <= 6 ? h + 12 : h >= 7 && h <= 23 ? h : null);
    for (const g of rxAll(SY.range, p)) {
      if (!g.groups[3] && !g.groups[6]) continue;
      const s = this.span(g);
      if (s) found.push({ at: g.at, end: syEnd(g), h: s.from.h, m: s.from.m, rank: 0 });
    }
    for (const g of rxAll(String.raw`(?<![\d:./])([01]?\d|2[0-3]):([0-5]\d)(?!\d)(?:\s*(am|pm|a\.m\.|p\.m\.))?`, p)) found.push({ at: g.at, end: syEnd(g), h: ampm(+g.groups[1], g.groups[3]), m: +g.groups[2], rank: 1 });
    for (const g of rxAll(String.raw`(?<![\d:./])(1[0-2]|0?[1-9])\s*(am|pm|a\.m\.|p\.m\.)(?![a-z])`, p)) found.push({ at: g.at, end: syEnd(g), h: ampm(+g.groups[1], g.groups[2]), m: 0, rank: 1 });
    for (const g of rxAll(String.raw`(?<![a-z])at\s+(\d{1,2})(?![\d:./]|\s*(?:am|pm|a\.m\.|p\.m\.))`, p)) { const h = afternoon(+g.groups[1]); if (h != null) found.push({ at: g.at, end: syEnd(g), h, m: 0, rank: 1 }); }
    for (const g of rxAll(String.raw`בשעה\s*(\d{1,2})(?::([0-5]\d))?(?!\d)`, p)) { const h = afternoon(+g.groups[1]); if (h != null) found.push({ at: g.at, end: syEnd(g), h, m: g.groups[2] != null ? +g.groups[2] : 0, rank: 1 }); }
    for (const g of rxAll(String.raw`(?:(?<!\d)12\s+)?(?<![a-z])noon(?![a-z])`, p)) found.push({ at: g.at, end: syEnd(g), h: 12, m: 0, rank: 1 });
    for (const g of rxAll(String.raw`(?<![a-z])midnight(?![a-z])|(?<![א-ת])ב?חצות(?![א-ת])`, p)) found.push({ at: g.at, end: syEnd(g), h: 23, m: 59, rank: 1 });
    found.sort((a, b) => a.at - b.at || a.rank - b.rank);
    return found[0] ? { h: found[0].h, m: found[0].m, end: found[0].end } : null;
  },
  /** Weekdays named in a line, in order: "Tuesday and Thursday", "Mondays", "MWF", "M/W", "TTh", "יום ב׳", "ימים א׳ ו-ג׳". [{at, wd}] */
  weekdays(line, p) {
    const out = [];
    for (const g of rxAll(SY.wdEN, p)) out.push({ at: g.at, wd: SY_KEY[g.groups[1].slice(0, 3)] });
    for (const g of rxAll(SY.wdHE, p)) out.push({ at: g.at, wd: HE_WEEKDAYS[g.groups[1]] });
    for (const g of rxAll(SY.wdHEList, p))
      for (const x of rxAll(String.raw`(?:^|[\s,\-]|ו)([א-ו])(?=['׳]|\s|,|$)`, g.groups[1])) out.push({ at: g.at + x.at, wd: HE_WEEKDAYS[x.groups[1]] });
    const bare = line.replace(new RegExp(SY.email, "g"), m => " ".repeat(m.length)).replace(new RegExp(SY.url, "g"), m => " ".repeat(m.length));
    for (const g of rxAll(SY.wdCodes, bare)) {
      const code = g.groups[1].replace(/\//g, ""), slashed = g.groups[1].includes("/");
      if (!slashed && code.length < 2) continue;
      let k = 0;
      while (k < code.length) {
        const two = code.slice(k, k + 2), at = g.at + k;
        if (two === "Th") { out.push({ at, wd: 4 }); k += 2; } else if (two === "Tu") { out.push({ at, wd: 2 }); k += 2; }
        else { out.push({ at, wd: { M: 1, T: 2, W: 3, R: 4, F: 5 }[code[k]] }); k++; }
      }
    }
    return out.sort((a, b) => a.at - b.at);
  },
  /** Each weekday with its time range: the range after it (else the last one before it). [{wd, from, to, end}] */
  slots(line, p) {
    const ranges = rxAll(SY.range, p).map(g => ({ at: g.at, end: syEnd(g), span: this.span(g) })).filter(r => r.span);
    const out = [], seen = new Set();
    for (const w of this.weekdays(line, p)) {
      if (seen.has(w.wd)) continue;
      const r = ranges.find(r => r.at > w.at) ?? ranges.filter(r => r.at < w.at).at(-1);
      if (!r) continue;
      seen.add(w.wd);
      out.push({ wd: w.wd, from: r.span.from, to: r.span.to, end: r.end });
    }
    return out;
  },

  // MARK: Term

  /** When the term starts and ends ("The semester starts 25/10/2026 and ends 22/01/2027", "Term: 2026-10-25 to 2027-01-22",
   *  "הסמסטר: 14.3.2027–25.6.2027"), the week anchor ("Week 1 (25/10)") and the end the week numbers imply. */
  term(low, now, tz) {
    let starts = null, ends = null, anchor = null, maxWeek = 0;
    const after = (p, pattern) => { const g = rxFirst(pattern, p); return g ? this.explicitDate(p.slice(syEnd(g)), now, tz) : null; };
    for (const p of low) {
      if (rxHas(DI.term, p) && !this.examish(p)) {
        starts ??= after(p, DI.start); ends ??= after(p, DI.end);
        if (rxHas(SY.termOnly, p)) {
          const two = this.explicit(p).filter(e => e.y != null && syValid(e.y, e.m, e.d));
          if (two.length === 2 && rxHas(String.raw`[–—-]|(?<![a-z])(to|until|through)(?![a-z])`, p.slice(two[0].end, two[1].at + 1))) {
            starts ??= { y: two[0].y, m: two[0].m, d: two[0].d }; ends ??= { y: two[1].y, m: two[1].m, d: two[1].d };
          }
        }
      }
      const w = this.weekOf(p);
      if (w != null) { maxWeek = Math.max(maxWeek, w); const d = this.explicitDate(p, now, tz); if (d && !anchor) anchor = { n: w, day: d }; }
    }
    anchor ??= starts ? { n: 1, day: starts } : null;
    const weeksEnd = anchor && maxWeek >= 6 ? (b => plusDays(b, 6 - weekdayOf(b)))(plusDays(anchor.day, 7 * (maxWeek - anchor.n))) : null;
    return { starts, ends, anchor, weeksEnd };
  },
  weekOf(p) { const g = rxFirst(DI.week, p); return g ? +(g.groups[1] ?? g.groups[2]) : null; },
  examish(p) { return rxHas(N.exam, p) || rxHas(N.due, p) || rxHas(N.homework, p) || rxHas(SY.examHE, p); },
  itemish(p) { return this.examish(p) || rxHas(SY.deliver, p) || rxHas(SY.finalBare, p); },

  // MARK: Weekly classes

  /** "Lectures: Tuesday and Thursday 2:30-3:45 PM, Hewlett 200": a class word, a weekday and a time; no date, not office hours. */
  isClassLine(line, p, now, tz) {
    return rxHas(SY.cls, p) && !rxHas(SY.office, p) && !this.examish(p) && !rxHas(SY.noClass, p) && !this.explicitDate(p, now, tz)
      && rxHas(SY.range, p) && this.slots(line, p).length > 0;
  },
  /** One weekly row per weekday (each with its own hours), from the next one (or the term's first week) until the term ends
   *  (else 13 weeks). The place is what follows the last time ("…, Building 72 Room 123"), else a room the line names. */
  weekly(line, p, { now, timeZone, starts, ends }) {
    const g = rxFirst(SY.cls, p), name = SY_CLASS[g.groups.slice(1).find(Boolean)] ?? "Class";
    const kind = SY_TUTORIAL.has(name) ? "tutorial" : "lecture";
    const slots = this.slots(line, p);
    if (!slots.length) return [];
    const last = Math.max(...slots.map(s => s.end));
    const place = this.after(line, last) ?? EssentialsNotice.place(p);
    const today = tzParts(now, timeZone), base = starts && dayNo(starts.y, starts.m, starts.d) > dayNo(today.y, today.m, today.d) ? starts : today;
    const out = [];
    for (const s of slots) {
      let day = plusDays(base, (s.wd - weekdayOf(base) + 7) % 7);
      let at = zonedToUTC(day.y, day.m, day.d, s.from.h, s.from.m, 0, timeZone);
      if (zonedToUTC(day.y, day.m, day.d, s.to.h, s.to.m, 0, timeZone) <= now) { day = plusDays(day, 7); at = zonedToUTC(day.y, day.m, day.d, s.from.h, s.from.m, 0, timeZone); }
      const until = ends ?? plusDays(day, 7 * 13 - 1);
      if (dayNo(until.y, until.m, until.d) < dayNo(day.y, day.m, day.d)) continue;
      out.push({ kind, title: name, at, endsAt: zonedToUTC(day.y, day.m, day.d, s.to.h, s.to.m, 0, timeZone), allDay: false, place, repeatUntil: ymd(until),
                 uid: `stash-dates:${kind}:w${s.wd}T${hm(s.from.h, s.from.m)}:${name.toLowerCase()}`, checked: true, wd: s.wd, from: s.from });
    }
    return out;
  },
  /** The place a line names after `from`: "Hewlett 200", "Physics Auditorium", "בניין גילמן 144" — short, no date, no %,
   *  not "TBA", not another exam or deadline. */
  after(line, from) {
    let s = line.slice(from).replace(/^[\s,;|·:–—)-]+/, "").replace(/^(?:in|at|on)\s+(?:the\s+)?/i, "").replace(/^the\s+/i, "");
    s = s.split(/\s*[(;|]|\.\s|\.$|\s[–—-]\s|,\s*(?=or\b|by\b|please\b)/)[0];
    s = syTidy(s);
    const p = s.toLowerCase();
    if (s.length < 2 || s.length > 48 || s.split(" ").length > 5 || !/[a-zא-ת]/i.test(s) || /%/.test(s)) return null;
    if (rxHas(String.raw`(?<![a-z])(tba|tbd|tbc|to be announced|location)(?![a-z])|יפורסם|יעודכן|ייקבע`, p)) return null;
    if (rxHas(String.raw`^(?:in )?(?:class|lecture|the tutorial|tutorial)$|^(?:בכיתה|בהרצאה|בתרגול)$`, p)) return null;
    if (this.itemish(p) || this.explicit(p).length || rxHas(SY_MONTH_WORD, p) || rxHas(SY.wdEN, p) || rxHas(String.raw`@|https?:`, p)) return null;
    return s;
  },

  // MARK: Exams and deadlines

  /** Every exam and deadline: one per date, a Moodle block's "Due:" line titled by the line above it, a table's columns
   *  ("מועד א׳ | מועד ב׳"), "Week 5 — Quiz 1" counted from the term's start on the class's day, "(in class)" at the class's
   *  time and room, and a "due every Friday at 5pm" rule giving homework its time. */
  dated({ lines, low }, { now, timeZone, used, classes, anchor }) {
    let defaultDue = null;
    for (const p of low) {
      if (rxHas(SY.every, p) && (rxHas(N.due, p) || rxHas(SY.submitHE, p))) { const c = this.clock(p); if (c && !defaultDue) defaultDue = { h: c.h, m: c.m }; }
    }
    const items = [];
    let header = null, heading = null;
    for (let i = 0; i < lines.length; i++) {
      if (used.has(i)) continue;
      const line = lines[i], p = low[i];
      const cells = line.includes("|") ? line.split("|").slice(0, 40).map(c => c.trim()) : null;
      const dated = this.explicit(p).length > 0;
      if (cells && cells.length >= 2 && !dated) header = cells;
      if (rxHas(SY.office, p) || rxHas(SY.noClass, p)) { heading = null; continue; }
      const w = this.weekOf(p);
      const segs = [];
      const dateCells = cells ? cells.map((c, k) => (this.explicit(c.toLowerCase()).length ? k : -1)).filter(k => k >= 0) : [];
      if (cells && dateCells.length >= 2 && header && header.length === cells.length) {
        for (const k of dateCells) segs.push({ text: `${header[k]}: ${cells[k]}`, table: false });
      } else {
        for (const piece of line.split(/[;!?]\s+|\.\s+(?=[A-Zא-ת])/).filter(Boolean)) segs.push(...this.segments(piece).map(text => ({ text, table: !!cells && cells.length >= 3 })));
      }
      for (const seg of segs) {
        const q = seg.text.toLowerCase();
        if (rxHas(SY.every, q) || rxHas(SY.review, q)) continue;
        const opens = rxFirst(SY.opens, q), first = this.explicit(q)[0];
        if (opens && (!first || opens.at < first.at)) continue;   // "Opened: Monday, 16 November", not "Exam: 6 Dec (opens 4 Dec)"
        let day = null;
        if (!this.explicit(q).length && w != null && this.itemish(q)) {
          if (!anchor) continue;
          const wd = rxFirst(String.raw`(?<![a-z])(sunday|monday|tuesday|wednesday|thursday|friday|sun|mon|tue|wed|thu|fri)(?![a-z])|(?<![א-ת])[בל]?יום\s+(ראשון|שני|שלישי|רביעי|חמישי|שישי|א|ב|ג|ד|ה|ו)(?![א-ת])`, q);
          const base = plusDays(anchor.day, 7 * (w - anchor.n));
          const want = wd ? (wd.groups[1] ? SY_KEY[wd.groups[1].slice(0, 3)] : HE_WEEKDAYS[wd.groups[2]]) : this.classFor(q, classes)?.wd ?? weekdayOf(base);
          day = plusDays(base, want - weekdayOf(base));
        }
        let it = this.item(seg.text, q, { now, timeZone, day, table: seg.table });
        if (heading && i - heading.i <= 3 && this.dateOnly(q))   // a Moodle block: "Quiz 2" / "Closes: Friday, 20 November, 11:59 PM"
          it = this.item(`${heading.text} · ${seg.text}`, `${heading.text.toLowerCase()} · ${q}`, { now, timeZone, day, label: this.label(heading.text), table: false }) ?? it;
        if (it) items.push(it);
      }
      if (!dated && /[a-zא-ת]/i.test(line) && line.length <= 60 && !cells) heading = this.itemish(p) ? { i, text: line } : null;
    }
    for (const it of items) {
      if (it.allDay && it.inClass) {
        const c = this.classFor(it.q, classes, it.wd);
        if (c && c.wd === it.wd) { it.time = c.from; it.allDay = false; it.place ??= c.place; }
      }
      if (it.allDay && it.kind === "deadline" && defaultDue && rxHas(String.raw`(?<![a-z])(homework|problem set|exercise|assignment)(?![a-z])|תרגיל|מטלה|שיעורי בית`, it.title.toLowerCase())) {
        it.time = defaultDue; it.allDay = false;
      }
    }
    const out = [];
    for (const it of items) {
      const h = it.allDay ? 0 : it.time.h, m = it.allDay ? 0 : it.time.m;
      const at = zonedToUTC(it.y, it.m, it.d, h, m, 0, timeZone);
      out.push({ kind: it.kind, title: it.title, at, endsAt: null, allDay: it.allDay, place: it.place, repeatUntil: null,
                 uid: `stash-dates:${it.kind}:${ymd(it)}${it.allDay ? "" : "T" + hm(h, m)}:${it.title.toLowerCase()}`, checked: true });
    }
    return out;
  },
  /** A piece with several dates ("Wet 1 due 19.11, Dry 1 due 3.12, Wet 2 due 24.12") → one piece per date. */
  segments(piece) {
    const p = piece.toLowerCase(), dates = this.explicit(p);
    if (dates.length < 2 || !this.itemish(p)) return [piece];
    const cuts = [];
    for (let k = 1; k < dates.length; k++) {
      const between = p.slice(dates[k - 1].end, dates[k].at), sep = between.search(/,\s|;\s|\s[–—-]\s|\s\|\s/);
      if (sep < 0 && !this.itemish(between)) return [piece];
      cuts.push(dates[k - 1].end + (sep < 0 ? 0 : sep));
    }
    const out = [];
    let from = 0;
    for (const c of cuts) { out.push(piece.slice(from, c)); from = c; }
    out.push(piece.slice(from));
    return out.map(s => s.replace(/^[\s,;–—-]+/, "")).filter(Boolean);
  },
  /** A line that is just a date and a time ("Closes: Friday, 20 November 2026, 11:59 PM", "תאריך הגשה: …"). */
  dateOnly(q) {
    let s = q;
    for (const e of this.explicit(q)) s = s.slice(0, e.at) + " ".repeat(e.end - e.at) + s.slice(e.end);
    s = s.replace(new RegExp(SY_MONTH_WORD, "g"), " ").replace(new RegExp(SY.wdEN, "g"), " ").replace(/\d+/g, " ")
      .replace(/(?<![a-z])(due|date|deadline|closes|close|at|by|on|am|pm|a\.m\.|p\.m\.|noon)(?![a-z])|תאריך|הגשה|מועד|יום|בשעה|עד|(?<![א-ת])ב?(ראשון|שני|שלישי|רביעי|חמישי|שישי)(?![א-ת])|[א-ו]['׳]/g, " ");
    return s.replace(/[^a-zא-ת]/g, "").length <= 1;
  },
  /** The class an exam or a "Week 5" item happens in: a tutorial when it says so, else the first lecture (on that weekday). */
  classFor(q, classes, wd = null) {
    const pool = wd == null ? classes : classes.filter(c => c.wd === wd);
    const tut = rxHas(SY.tutorialish, q);
    return pool.find(c => (c.kind === "tutorial") === tut) ?? pool[0] ?? null;
  },
  /** One exam or deadline in one piece of text, or null: {kind, title, y, m, d, time, allDay, place, inClass, wd, q}. */
  item(seg, q, { now, timeZone, day = null, label = undefined, table = false }) {
    let kind;
    if (rxHas(N.due, q) || rxHas(SY.submitHE, q)) kind = "deadline";
    else if (rxHas(N.exam, q) || rxHas(SY.examHE, q)) kind = "exam";
    else if (rxHas(N.homework, q) || rxHas(SY.deliver, q)) kind = "deadline";
    else if (rxHas(SY.finalBare, q)) kind = "exam";
    else return null;
    const d = day ?? this.date(q, now, timeZone);
    if (!d) return null;
    const time = this.clock(q), allDay = !time;
    const at = zonedToUTC(d.y, d.m, d.d, time?.h ?? (kind === "deadline" ? 23 : 0), time?.m ?? (kind === "deadline" ? 59 : 0), 0, timeZone);
    const ends = kind === "exam" && allDay ? addDaysIn(at, 1, timeZone) : at;
    if (ends <= now || at > new Date(now.getTime() + 400 * 86_400_000)) return null;
    const l = label === undefined ? this.label(seg) : label;
    const title = kind === "exam" ? this.examTitle(q, l) : this.dueTitle(q, l);
    const tail = Math.max(d.end ?? 0, time?.end ?? 0);
    const place = EssentialsNotice.place(q) ?? (table || !d.end ? null : this.after(seg, tail));
    return { kind, title, y: d.y, m: d.m, d: d.d, time: time ? { h: time.h, m: time.m } : null, allDay, place, inClass: rxHas(SY.inClass, q),
             wd: weekdayOf(d), q };
  },
  /** What a line calls the thing: "Lab practical exam", "Capstone project", "ממ״ן 11", "עבודה סמינריונית" — the words before
   *  its date or "due", without numbering, "Week 5 —", "(1,500 words)" or "הגשת". Null when it isn't a short name. */
  label(seg) {
    let s = seg;
    if (s.includes("|")) {
      const cells = s.split("|").map(c => c.trim()).filter(Boolean);
      s = cells.find(c => this.itemish(c.toLowerCase()) && !this.explicit(c.toLowerCase()).length) ?? cells.find(c => this.itemish(c.toLowerCase())) ?? "";
    }
    s = s.replace(/^[\s,;–—-]+/, "").replace(/^(?:[-•*·–—]|\(?\d{1,2}[.)])\s+/, "")
      .replace(/^(?:week|wk)\.?\s*\d{1,2}\s*(?:\([^)]*\))?\s*[:–—-]?\s*/i, "").replace(/^שבוע\s*\d{1,2}\s*(?:\([^)]*\))?\s*[:–—-]?\s*/, "");
    const lead = this.explicit(s.toLowerCase())[0];
    if (lead && lead.at <= 1) s = s.slice(lead.end).replace(/^[\s,;:|–—-]*(?:\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?)?[\s,;:|–—-]*/i, "");
    if (/^\d/.test(s)) s = s.replace(/^[\d\s:./\-–—|,]+/, "");
    const typed = s.match(/^(?:assignment|quiz|task|activity|מטלה|משימה)\s*:\s*(.+)$/i);
    if (typed) s = typed[1];
    const low = s.toLowerCase();
    const cut = low.search(new RegExp(String.raw`\s*[:(]|\s+[–—-]\s+|\s[–—]|,\s|\s+(?:is|are|will|on|by|at|in|moved|scheduled|until|before|due|deadline|opens|closes)(?![a-z])|\s+(?:עד|להגשה|הגשה|יתקיים|תתקיים|בתאריך|ביום|בשעה)(?![א-ת])|\s+ב-?\d|\s+\d{1,2}[./]\d`));
    if (cut >= 0) s = s.slice(0, cut);
    s = syHeQuotes(syTidy(s).replace(/^(?:הגשת|הגשה של|submission of|submit)\s+/i, ""));
    const t = s.toLowerCase();
    if (!s || s.length > 48 || s.split(" ").length > 5 || !/[a-zא-ת]/i.test(s) || rxHas(SY.cue, t)) return null;
    if (rxHas(String.raw`^(?:` + SY_MONTH_WORD + String.raw`)$`, t) || rxHas(String.raw`^(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)$`, t)) return null;
    return s;
  },
  /** Midterm 2 · Final exam · Quiz 3 · Exam 2 · Moed B · מועד א׳ · מבחן אמצע · בחינה — else the line's own name ("Lab practical exam"). */
  examTitle(p, label) {
    let g;
    if ((g = rxFirst(String.raw`(?<![a-z])midterms?\s*#?\s*(\d)(?!\d|[/.:]\d)`, p))) return `Midterm ${g.groups[1]}`;
    if (rxHas(String.raw`(?<![a-z])midterms?(?![a-z])`, p)) return "Midterm";
    if (rxHas(String.raw`(?<![a-z])(final exam|finals)(?![a-z])`, p) || (rxHas(SY.finalBare, p) && !rxHas(N.exam, p))) return "Final exam";
    if ((g = rxFirst(String.raw`(?<![a-z])quiz\s*#?\s*0*(\d{1,2})(?!\d|[/.:]\d)`, p))) return `Quiz ${g.groups[1]}`;
    if ((g = rxFirst(String.raw`(?<![a-z])quiz\s+([a-e])(?![a-z])`, p))) return `Quiz ${g.groups[1].toUpperCase()}`;
    if (rxHas(String.raw`(?<![a-z])quiz(?![a-z])`, p)) return "Quiz";
    if ((g = rxFirst(String.raw`(?<![a-z])moed\s+([ab])(?![a-z])|(?<![א-ת])מועד\s+([אב])(?![א-ת])`, p))) return g.groups[1] ? `Moed ${g.groups[1].toUpperCase()}` : `מועד ${g.groups[2]}׳`;
    if ((g = rxFirst(String.raw`(?<![a-z])exam\s*#?\s*(\d{1,2})(?!\d|[/.:]\d)`, p))) return `Exam ${g.groups[1]}`;
    if (rxHas(String.raw`(?<![א-ת])מועד\s+(?:ה)?בחינה(?![א-ת])`, p)) return "בחינה";
    if ((g = rxFirst(String.raw`(?<![א-ת])[והבלמשכ]{0,2}(מבחן|בוחן)(?:\s+ה?(אמצע|סופי)|\s*(?:מס['׳]?\s*)?0*(\d{1,2})(?!\d|[/.:]\d))?(?![א-ת])`, p)))
      return [g.groups[1], g.groups[2] ?? g.groups[3]].filter(Boolean).join(" ");
    if (rxHas(SY.examHE, p)) return label && /^בחינ/.test(label) ? label : "בחינה";
    if (label) return syCap(label);
    return /[א-ת]/.test(p) ? "מבחן" : "Exam";
  },
  /** Homework 3 · Problem set 5 · ממ״ן 11 · תרגיל 2 — else the line's own name ("Capstone project", "Wet 1"). */
  dueTitle(p, label) {
    let g = rxFirst(String.raw`(?<![a-z])(homework|hw|assignment|exercise|problem set|pset|ps|essay|lab report|ex)\s*#?\s*0*(\d{1,2})(?!\d)`, p);
    if (g) return `${SY_EN_NAMES[g.groups[1]]} ${g.groups[2]}`;
    g = rxFirst(String.raw`(?<![א-ת])[והבלמשכ]?(תרגיל בית|תרגיל|מטלה|ממ["״]ן|ממן|עבודה|ש["״]ב)\s*(?:מס['׳]?\s*|#)?0*(\d{1,3})(?!\d)`, p);
    if (g) return `${/^ממ/.test(g.groups[1]) ? "ממ״ן" : /^ש/.test(g.groups[1]) ? "שיעורי בית" : g.groups[1]} ${g.groups[2]}`;
    if (label) return syCap(label);
    g = rxFirst(String.raw`(?<![a-z])(homework|hw|assignment|project|essay|lab report|problem set)(?![a-z])`, p);
    if (g) return SY_EN_NAMES[g.groups[1]];
    g = rxFirst(String.raw`(?<![א-ת])[והבלמשכ]?(תרגיל בית|תרגילי בית|תרגיל|מטלה|ש"ב|שיעורי בית)`, p);
    if (g) return g.groups[1] === 'ש"ב' ? "שיעורי בית" : g.groups[1];
    return /[א-ת]/.test(p) ? "הגשה" : "Due";
  },

  // MARK: People

  /** Who teaches it: [{role: lecturer|ta|other, name, email, hours}] — "Lecturer: Dr. Maya Ronen", "מתרגל: יואב כהן | …",
   *  "שירה אברהם, מתרגלת הקורס", a "Teaching assistants:" list, a signature ("Dr. Ilan Levi" + an email on the next line);
   *  office hours go to whoever their line names (a TA's when it says TA), else the lecturer. Never phone numbers. */
  people(lines, low, gap) {
    const people = [], pending = [];
    let staffRole = null, last = null, lastLine = -9, inReading = false;
    const add = (role, name, i) => {
      const key = name.toLowerCase();
      let p = people.find(x => x.name.toLowerCase() === key);
      if (!p) {
        if (people.length >= this.maxPeople) return null;
        p = { role: role ?? (people.some(x => x.role === "lecturer") ? "other" : "lecturer"), name, email: null, hours: null };
        people.push(p);
      }
      last = p; lastLine = i;
      return p;
    };
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i], p = low[i];
      if (gap[i]) staffRole = null;
      if (rxHas(SY.readHead, p) || rxHas(SY.readHeadHE, p)) { inReading = true; continue; }
      if (inReading) { if (gap[i]) inReading = false; else continue; }
      if (rxHas(SY.staffHead, p)) { staffRole = rxHas(SY.ta, p) ? "ta" : "lecturer"; continue; }
      if (this.isClassLine(line, p, new Date(0), "UTC")) continue;
      const office = rxFirst(SY.office, p);
      let lineFolk = null;
      for (const seg of line.split(/\s*;\s*|\s+\|\s+|\s+·\s+/)) {
        const s = seg.toLowerCase(), so = rxFirst(SY.office, s);
        const ta = rxFirst(SY.ta, s), lec = rxFirst(SY.lecturer, s);
        const roleHit = ta && (!lec || ta.at <= lec.at) ? ta : lec;
        let role = roleHit ? (roleHit === ta ? "ta" : "lecturer") : staffRole;
        let name = null;
        if (roleHit && !(so && so.at < roleHit.at)) name = this.nameAt(seg.slice(syEnd(roleHit))) ?? this.nameBefore(seg.slice(0, roleHit.at));
        if (!name) {
          const h = rxFirst(SY.honorEN, seg) ?? rxFirst(SY.honorHE, seg);
          if (h && !(so && so.at < h.at)) { name = this.nameAt(seg.slice(h.at)); if (!roleHit) role = staffRole; }
          else if (!h && !so && staffRole && !roleHit) name = this.nameAt(seg);
        }
        const email = rxFirst(SY.email, seg)?.groups[0].toLowerCase() ?? null;
        if (name) {
          const who = add(role, name, i);
          if (who && email && !who.email) who.email = email;
          lineFolk = who ?? lineFolk;
        } else if (email) {
          const who = lineFolk ?? (last && i - lastLine <= 2 && !last.email ? last : null);
          if (who && !who.email) who.email = email;
        } else if (roleHit && !so && !name && line.split(/\s*;\s*|\s+\|\s+|\s+·\s+/).length === 1 && rxHas(String.raw`:\s*$`, s)) staffRole = role;
      }
      if (office) {
        const hours = this.hours(line.slice(office.at), p.slice(office.at));
        if (hours) pending.push({ hours, who: lineFolk, ta: rxHas(SY.ta, p.slice(0, office.at)) });
      }
    }
    for (const h of pending) {
      const who = h.who ?? (h.ta ? people.filter(x => x.role === "ta").at(-1) : people.find(x => x.role === "lecturer")) ?? people[0];
      if (who && !who.hours) who.hours = h.hours;
    }
    return people;
  },
  /** A name at the start of the text: "Prof. Daniel Kim", "Lior Ben-David", "ד״ר נועה ברק", "יואב כהן" (titles kept off). */
  nameAt(t) {
    let s = t.replace(/^[\s:|,–—-]+|^s\s*:\s*/g, "");
    for (let k = 0; k < 3; k++) s = s.replace(new RegExp("^" + SY.honorEN), "").replace(new RegExp("^" + SY.honorHE), "");
    let g = s.match(/^([A-Z][a-zA-Z'’]+(?:-[A-Z][a-zA-Z'’]+)?(?:\s+[A-Z]\.)?(?:\s+[A-Z][a-zA-Z'’]+(?:-[A-Z][a-zA-Z'’]+)?){1,2})(?![a-zA-Z])/);
    if (g) {
      const words = g[1].split(/\s+/).filter(w => !/^[A-Z]\.$/.test(w));
      const keep = [];
      for (const w of words) { if (SY_STOP_EN.has(w.toLowerCase())) break; keep.push(w); }
      return keep.length >= 2 ? keep.join(" ") : null;
    }
    g = s.match(/^[א-ת][א-ת"״'׳-]*(?:\s+[א-ת][א-ת"״'׳-]*){1,3}/);
    if (!g) return null;
    const keep = [];
    for (const w of g[0].split(/\s+/)) { if (SY_STOP_HE.has(w) || keep.length === 3) break; keep.push(w); }
    return keep.length >= 2 ? syHeQuotes(keep.join(" ")) : null;
  },
  /** The name just before a role word: "שירה אברהם, מתרגלת", "ד"ר אלון ברנע (מרצה)". */
  nameBefore(t) {
    const s = t.split(/[:|·;]/).at(-1).replace(/[\s,(–—-]+$/, "").trim();
    const words = s.split(/\s+/).filter(Boolean);
    for (let n = Math.min(4, words.length); n >= 2; n--) { const name = this.nameAt(words.slice(-n).join(" ")); if (name) return name; }
    return null;
  },
  /** Office hours as one short line: "Mon 15:00–16:00", "Tue 11:00–12:00, Fri 14:00–15:00", "יום ב׳ 14:00–15:00". */
  hours(line, p) {
    const he = /[א-ת]/.test(line.replace(new RegExp(SY.email, "g"), ""));
    const slots = this.slots(line, p);
    if (!slots.length) return null;
    return slots.map(s => `${(he ? HE_DAYS : EN_DAYS)[s.wd]} ${hm(s.from.h, s.from.m)}–${hm(s.to.h, s.to.m)}`).join(", ").slice(0, 120);
  },

  // MARK: Grades, reading, links, the course code

  /** The grade breakdown: [{item, percent}] — "Homework 20%, Midterm 30%, Final exam 50%", "Problem sets …… 30%", a
   *  "Component | Weight" table, "25% homework, 75% final exam", "הרכב הציון: מבחן 60%, תרגילים 30%". Late penalties and
   *  "(20% each)" aren't items. */
  grades(lines, low, gap) {
    const out = [];
    let block = false;
    for (let i = 0; i < lines.length; i++) {
      const p = low[i];
      const head = rxHas(SY.gradeHead, p), n = rxAll(SY.pct, p).length;
      if (gap[i]) block = false;
      if (head && n === 0) { block = true; continue; }
      if (n === 0) continue;
      if (!(block || head || n >= 2 || this.itemish(p))) continue;
      if (head) block = true;
      for (const sentence of lines[i].split(/\.\s+(?=[A-Zא-ת])/)) {
        const chunks = sentence.replace(/\((\d{1,3})\s*%\)/g, " – $1% ").replace(/\([^)]*\)/g, " ").split(/,(?!\d{3})|;|·|\||\s\/\s/).map(c => c.trim());
        for (let k = 0; k < chunks.length; k++) {
          const c = chunks[k], cl = c.toLowerCase(), g = rxFirst(SY.pct, cl);
          if (!g || rxHas(SY.gradeBad, cl)) continue;
          const percent = +(g.groups[1] ?? g.groups[2]);
          if (percent < 1 || percent > 100) continue;
          let item = this.gradeItem(c.slice(0, g.at)) ?? this.gradeItem(c.slice(syEnd(g))) ?? (k > 0 && !rxHas(SY.pct, chunks[k - 1].toLowerCase()) ? this.gradeItem(chunks[k - 1]) : null);
          if (!item || out.some(x => x.item.toLowerCase() === item.toLowerCase())) continue;
          out.push({ item, percent });
          if (out.length >= this.maxGrades) return out;
        }
      }
    }
    return out;
  },
  gradeItem(t) {
    let s = t;
    const colon = s.lastIndexOf(":");
    if (colon >= 0 && rxHas(SY.gradeHead, s.slice(0, colon).toLowerCase())) s = s.slice(colon + 1);
    else if (colon >= 0 && !s.slice(colon + 1).trim()) s = s.slice(0, colon);
    s = s.replace(/\.{2,}|…+/g, " ").replace(/^\s*(?:\d{1,2}[.)]|[-•*])\s+/, "");
    const cut = s.toLowerCase().search(new RegExp(String.raw`\s+(?:due|deadline|by)(?![a-z])|\s+(?:עד|להגשה)(?![א-ת])|\s+\d{1,2}[./]\d|\s[–—-]\s+\S`));
    if (cut >= 0) s = s.slice(0, cut);
    s = syTidy(s.replace(/[=]/g, " ")).replace(/\s+(?:of the (?:final )?grade|מהציון(?: הסופי)?)$/i, "").replace(/^(?:and|ו-?)\s+/i, "").replace(/^(?:הגשת)\s+/, "");
    s = syHeQuotes(syTidy(s));
    if (!s || s.length > 50 || s.split(" ").length > 6 || !/[a-zא-ת]/i.test(s) || rxHas(SY.gradeHead, s.toLowerCase()) && s.split(" ").length <= 2 && !/[א-ת]/.test(s)) return null;
    return syCap(s);
  },
  /** Books and articles under "Required reading", "Textbook:", "רשימת קריאה (חובה):", "ספר חובה: …": [{title, required}]. */
  reading(lines, low, gap) {
    const out = [];
    let on = null;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i], p = low[i];
      const en = p.replace(/^(?:[-•*]|\d{1,2}[.)])\s+/, "").match(new RegExp(SY.readHead)), he = en ? null : line.match(new RegExp(SY.readHeadHE));
      if (en || he) {
        on = { required: !rxHas(String.raw`recommended|optional|further|supplementary|suggested|רשות|נוספת|מומלצת`, (en ?? he)[0].toLowerCase()) };
        const rest = en ? en[2] ?? en[4] : he[3];
        if (rest && rest.trim().length >= 3) this.addReading(out, line.slice(line.length - rest.length), on.required);
        continue;
      }
      if (!on) continue;
      if (gap[i] || rxHas(SY.gradeHead, p) && rxHas(SY.pct, p)) { on = null; continue; }
      this.addReading(out, line, on.required);
    }
    return out.slice(0, this.maxReading);
  },
  addReading(out, t, required) {
    const title = syTidy(t.replace(/^\s*(?:[-•*]|\d{1,2}[.)])\s+/, "")).slice(0, 200);
    if (title.length >= 3 && /[a-zא-ת]/i.test(title) && !out.some(x => x.title === title)) out.push({ title, required });
  },
  /** https links with what the line calls them ("Course website", "Zoom link for all sessions", "GitHub Classroom"). */
  links(lines) {
    const out = [];
    for (const line of lines) {
      for (const g of rxAll(SY.url, line)) {
        const url = g.groups[0].replace(/[.,;:!?]+$/, "");
        if (out.some(x => x.url === url) || url.length > 2000) continue;
        const before = syTidy(line.slice(0, g.at).split(/[|·]/).at(-1).replace(/:\s*$/, ""));
        let host = ""; try { host = new URL(url).hostname.replace(/^www\./, ""); } catch { continue; }
        const name = before && before.length <= 40 && !rxHas(SY.email, before) ? before : host;
        out.push({ name: [...name].slice(0, 80).join(""), url });
        if (out.length >= this.maxLinks) return out;
      }
    }
    return out;
  },
  /** The course's code from the top of the page: "CS 2341", "PSY-100", "HIS2041", "234218", "0571-1102". */
  code(lines) {
    const top = lines.slice(0, 4).map(l => l.replace(new RegExp(SY.email, "g"), " ").replace(new RegExp(SY.url, "g"), " "));
    for (const l of top) { const g = rxFirst(SY.codeEN, l); if (g) return g.groups[0]; }
    for (const l of top) { const g = rxFirst(SY.codeNum, l); if (g) return g.groups[1]; }
    return null;
  },
});

// ——— "Here's what I found": the review's words, and a Word file's text (the same on the Mac: SharedSyllabus.swift) ———
const SY_ROLE = { lecturer: ["Lecturer", "מרצה"], ta: ["TA", "מתרגל"], other: ["Staff", "סגל"] };
export const SyllabusWords = Object.freeze({
  /** The review's title. */
  headline(lang = "en") { return lang === "he" ? "הנה מה שמצאתי" : "Here’s what I found"; },
  /** How many things it found: dates, people, the grade breakdown (one), books and links. */
  count(r) { return r.dates.length + r.people.length + (r.grades.length ? 1 : 0) + r.reading.length + r.links.length; },
  /** "Lecturer · dkim@uni.edu · Mon 15:00–16:00" / "מרצה · …". */
  person(p, lang = "en") { return [SY_ROLE[p.role]?.[lang === "he" ? 1 : 0] ?? SY_ROLE.other[0], p.email, p.hours].filter(Boolean).join(" · "); },
  /** "Final exam 50% · Midterm 30% · Homework 20%". */
  grades(list) { return list.map(g => `${g.item} ${g.percent}%`).join(" · "); },
  /** The course note the grade breakdown and the reading are saved as (one text sheet everyone sees). */
  note(grades, reading, lang = "en") {
    const he = lang === "he", out = [he ? "מהסילבוס" : "From the syllabus"];
    if (grades.length) out.push("", he ? "הרכב הציון" : "Grading", ...grades.map(g => `• ${g.item} — ${g.percent}%`));
    const req = reading.filter(r => r.required), more = reading.filter(r => !r.required);
    if (req.length) out.push("", he ? "קריאת חובה" : "Required reading", ...req.map(r => `• ${r.title}`));
    if (more.length) out.push("", he ? "קריאה נוספת" : "Recommended reading", ...more.map(r => `• ${r.title}`));
    return out.join("\n").slice(0, 5000);
  },
});

/** A Word file (.docx) as plain text: word/document.xml's paragraphs as lines, table cells split by tabs (which the
 *  syllabus reader treats as columns). The zip is opened by the page (DocxText.read) or the Mac (SyllabusFiles). */
export const DocxText = Object.freeze({
  maxBytes: 20 * 1024 * 1024,
  fromXML(xml) {
    const body = String(xml ?? "").replace(/<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g, cell => cell.replace(/<\/w:p>/g, " ")).replace(/<\/w:tr>/g, "\n").replace(/<w:tab\/>/g, "\t").replace(/<w:br\/>|<w:cr\/>/g, "\n").replace(/<\/w:tc>/g, "\t").replace(/<\/w:p>/g, "\n")
      .replace(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g, "\u0001$1\u0002").replace(/<[^>]+>/g, "");
    let out = "";
    for (const m of body.matchAll(/\u0001([^\u0002]*)\u0002|([\t\n])/g)) out += m[1] ?? m[2];
    return out.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
      .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, "&").replace(/\t+\n/g, "\n").trim();
  },
  /** The text of a .docx (bytes), or null: reads the zip's central directory and inflates word/document.xml with the
   *  browser's own DecompressionStream — no library. */
  async read(bytes) {
    try {
      const b = new Uint8Array(bytes); if (b.length > this.maxBytes || b.length < 22) return null;
      const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
      let e = b.length - 22; while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--;
      if (e < 0) return null;
      let p = v.getUint32(e + 16, true); const n = v.getUint16(e + 10, true);
      for (let k = 0; k < n && p + 46 <= b.length; k++) {
        if (v.getUint32(p, true) !== 0x02014b50) return null;
        const method = v.getUint16(p + 10, true), size = v.getUint32(p + 20, true), full = v.getUint32(p + 24, true);
        const nameLen = v.getUint16(p + 28, true), extra = v.getUint16(p + 30, true), note = v.getUint16(p + 32, true), at = v.getUint32(p + 42, true);
        const name = new TextDecoder().decode(b.subarray(p + 46, p + 46 + nameLen));
        if (name === "word/document.xml") {
          if (full > 40 * 1024 * 1024) return null;
          const start = at + 30 + v.getUint16(at + 26, true) + v.getUint16(at + 28, true), raw = b.subarray(start, start + size);
          const data = method === 0 ? raw : method === 8 ? new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer()) : null;
          return data ? this.fromXML(new TextDecoder().decode(data)) || null : null;
        }
        p += 46 + nameLen + extra + note;
      }
      return null;
    } catch { return null; }
  },
});

