// Course names that mean the same course (docs/shared/NEW-COURSE.md "Smart search"): the rules find_courses uses on the
// server (migration 20261027_shared_find_by_name.sql, generated from this file by scripts/hub/course-match-sql.mjs),
// mirrored in StashCore CourseMatch.swift; cases: test/course-match-cases.json (all three run them).
//   course_words: lower-case, no niqqud, Hebrew final letters as plain ones, no quote marks (חדו"א = חדו״א = חדוא),
//                 letters and digits split ("physics1"), roman numerals and Hebrew letter numbers as digits
//                 ("Calculus I", "חדו״א א׳" → 1), small words dropped (and, of, to, ו, של…), "מבוא ל…" → "מבוא …".
//   course_key:   course_words with known course words in one language ("Intro to CS" = "מבוא למדעי המחשב" = "intro cs").
//   score:        exact 900 · same words in any order 880 · starts with 800 · every word starts one 700 ·
//                 a typo (trigram similarity ≥ 0.45, only when the known course words agree) 300 + 600 × similarity.
//                 Different numbers never match ("Calculus 1" ≠ "Calculus 2"). "close" (≥ 810) = it's the same course.

/** [what people write, the one word for it]. Normalized with courseWords when used; longest first. */
export const COURSE_ALIASES = [
  ["introduction", "intro"], ["introductory", "intro"], ["מבוא", "intro"],
  ["computer science", "cs"], ["comp sci", "cs"], ["מדעי המחשב", "cs"], ["מדמ״ח", "cs"],
  ["calculus", "calculus"], ["calc", "calculus"], ["infinitesimal calculus", "calculus"], ["חדו״א", "calculus"],
  ["חשבון דיפרנציאלי ואינטגרלי", "calculus"], ["אינפי", "calculus"], ["חשבון אינפיניטסימלי", "calculus"],
  ["linear algebra", "linalg"], ["אלגברה לינארית", "linalg"], ["אלגברה ליניארית", "linalg"],
  ["data structures", "datastructures"], ["מבני נתונים", "datastructures"], ["מבנ״ת", "datastructures"],
  ["algorithms", "algorithms"], ["algorithm", "algorithms"], ["algo", "algorithms"], ["algos", "algorithms"],
  ["אלגוריתמים", "algorithms"], ["אלגו", "algorithms"],
  ["probability", "probability"], ["prob", "probability"], ["הסתברות", "probability"],
  ["statistics", "statistics"], ["stats", "statistics"], ["stat", "statistics"], ["סטטיסטיקה", "statistics"],
  ["discrete mathematics", "discretemath"], ["discrete math", "discretemath"], ["discrete maths", "discretemath"],
  ["מתמטיקה בדידה", "discretemath"], ["בדידה", "discretemath"],
  ["mathematics", "math"], ["maths", "math"], ["מתמטיקה", "math"],
  ["physics", "physics"], ["phys", "physics"], ["פיזיקה", "physics"], ["פיסיקה", "physics"],
  ["mechanics", "mechanics"], ["מכניקה", "mechanics"],
  ["electricity and magnetism", "em"], ["electromagnetism", "em"], ["חשמל ומגנטיות", "em"],
  ["chemistry", "chemistry"], ["chem", "chemistry"], ["כימיה", "chemistry"],
  ["organic", "organic"], ["אורגנית", "organic"], ["general", "general"], ["כללית", "general"],
  ["biology", "biology"], ["bio", "biology"], ["ביולוגיה", "biology"], ["cell", "cell"], ["התא", "cell"],
  ["microeconomics", "micro economics"], ["מיקרו כלכלה", "micro economics"], ["מיקרו", "micro"],
  ["macroeconomics", "macro economics"], ["מקרו כלכלה", "macro economics"], ["מקרו", "macro"],
  ["economics", "economics"], ["econ", "economics"], ["כלכלה", "economics"],
  ["psychology", "psychology"], ["psych", "psychology"], ["psy", "psychology"], ["פסיכולוגיה", "psychology"],
  ["research methods", "researchmethods"], ["שיטות מחקר", "researchmethods"],
  ["law of contracts", "contracts"], ["contract law", "contracts"], ["contracts", "contracts"], ["דיני חוזים", "contracts"], ["חוזים", "contracts"],
  ["law of torts", "torts"], ["tort law", "torts"], ["torts", "torts"], ["דיני נזיקין", "torts"], ["נזיקין", "torts"],
  ["criminal law", "criminallaw"], ["משפט פלילי", "criminallaw"], ["דיני עונשין", "criminallaw"],
  ["constitutional law", "constitutional"], ["משפט חוקתי", "constitutional"],
  ["operating systems", "os"], ["operating system", "os"], ["מערכות הפעלה", "os"],
  ["computer architecture", "comparch"], ["computer organization", "comparch"], ["מבנה מחשבים", "comparch"], ["ארכיטקטורת מחשבים", "comparch"],
  ["ordinary differential equations", "ode"], ["differential equations", "ode"], ["odes", "ode"], ["משוואות דיפרנציאליות", "ode"], ["מד״ר", "ode"],
  ["machine learning", "ml"], ["למידת מכונה", "ml"], ["למידה חישובית", "ml"],
  ["artificial intelligence", "ai"], ["בינה מלאכותית", "ai"],
  ["database systems", "databases"], ["databases", "databases"], ["database", "databases"], ["db", "databases"],
  ["מסדי נתונים", "databases"], ["בסיסי נתונים", "databases"],
  ["computer networks", "networks"], ["networking", "networks"], ["networks", "networks"], ["רשתות תקשורת", "networks"], ["רשתות מחשבים", "networks"],
  ["software engineering", "softeng"], ["הנדסת תוכנה", "softeng"],
  ["programming", "programming"], ["תכנות", "programming"],
  ["logic", "logic"], ["לוגיקה", "logic"], ["set theory", "settheory"], ["תורת הקבוצות", "settheory"],
  ["computational complexity", "complexity"], ["complexity", "complexity"], ["סיבוכיות", "complexity"],
  ["automata theory", "automata"], ["automata", "automata"], ["אוטומטים", "automata"],
  ["compilers", "compilers"], ["compilation", "compilers"], ["קומפילציה", "compilers"],
  ["accounting", "accounting"], ["חשבונאות", "accounting"], ["marketing", "marketing"], ["שיווק", "marketing"],
  ["sociology", "sociology"], ["סוציולוגיה", "sociology"],
  ["academic english", "english"], ["english", "english"], ["אנגלית אקדמית", "english"], ["אנגלית", "english"],
  ["electric circuits", "circuits"], ["electrical circuits", "circuits"], ["circuits", "circuits"], ["מעגלים חשמליים", "circuits"],
  ["statics", "statics"], ["סטטיקה", "statics"], ["thermodynamics", "thermo"], ["thermo", "thermo"], ["תרמודינמיקה", "thermo"],
  ["signals and systems", "signals"], ["אותות ומערכות", "signals"], ["game theory", "gametheory"], ["תורת המשחקים", "gametheory"],
  ["numerical analysis", "numerical"], ["numerical methods", "numerical"], ["אנליזה נומרית", "numerical"], ["שיטות נומריות", "numerical"],
  ["laboratory", "lab"], ["lab", "lab"], ["מעבדה", "lab"], ["seminar", "seminar"], ["סמינר", "seminar"], ["סמינריון", "seminar"],
];

const STOP = ["and", "of", "the", "to", "for", "in", "a", "an", "on", "with", "ו", "של", "עמ", "ל"];
const NUMERALS = { i: "1", ii: "2", iii: "3", iv: "4", v: "5", "א": "1", "ב": "2", "ג": "3", "ד": "4" };
const LETTER = "a-z0-9à-ſא-ת";
const FINALS = { "ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ" };

/** The words of a course name, the same however it's typed. */
export function courseWords(t) {
  let s = String(t ?? "").replace(/[A-Z]/g, c => c.toLowerCase());
  s = s.replace(/־/g, " ").replace(/[֑-ׇ]/g, "").replace(/[ךםןףץ]/g, c => FINALS[c]);
  s = s.replaceAll("c++", " cpp ").replaceAll("c#", " csharp ");
  s = s.replace(/['"`׳״‘’“”´]/g, "").replaceAll("&", " and ");
  s = s.replace(new RegExp(`[^${LETTER}]+`, "g"), " ");
  s = s.replace(/([a-zà-ſא-ת])([0-9])/g, "$1 $2").replace(/([0-9])([a-zà-ſא-ת])/g, "$1 $2");
  const out = [];
  for (let w of s.split(" ")) {
    if (!w) continue;
    w = NUMERALS[w] ?? w;
    if (STOP.includes(w)) continue;
    if (out[out.length - 1] === "מבוא" && w.startsWith("ל") && w.length >= 3) w = w.slice(1);
    out.push(w);
  }
  return out.join(" ");
}

const ALIASES = COURSE_ALIASES.map(([f, c]) => [courseWords(f), c]).filter(([f, c]) => f && f !== c)
  .sort((a, b) => b[0].split(" ").length - a[0].split(" ").length || b[0].length - a[0].length || (a[0] < b[0] ? -1 : 1));
export const CANONICAL = new Set(COURSE_ALIASES.flatMap(([, c]) => c.split(" ")));
/** The aliases as the server gets them: normalized, longest first (scripts/hub/course-match-sql.mjs). */
export const courseAliasesNormalized = () => ALIASES.map(a => a.slice());

/** courseWords, with known course words in one language. */
export function courseKey(t) {
  let s = " " + courseWords(t) + " ";
  for (let pass = 0; pass < 2; pass++) for (const [f, c] of ALIASES) s = s.split(` ${f} `).join(` ${c} `);
  return s.split(" ").filter(Boolean).join(" ");
}

/** pg_trgm-style trigrams ("  w " windows of each word) and their Jaccard similarity. */
export function grams(k) {
  const g = new Set();
  for (const w of k.split(" ").filter(Boolean)) { const p = `  ${w} `; for (let i = 0; i + 3 <= p.length; i++) g.add(p.slice(i, i + 3)); }
  return g;
}
export function similarity(a, b) {
  const A = grams(a), B = grams(b); if (!A.size || !B.size) return 0;
  let n = 0; for (const x of A) if (B.has(x)) n++;
  return n / (A.size + B.size - n);
}

const toks = k => k.split(" ").filter(Boolean);
const nums = k => toks(k).filter(w => /^[0-9]+$/.test(w)).sort().join(" ");
const sameSet = (a, b) => toks(a).sort().join(" ") === toks(b).sort().join(" ");
const everyPrefix = (q, n) => { const nt = toks(n); return toks(q).length > 0 && toks(q).every(w => nt.some(x => x.startsWith(w))); };

/** How well a typed query fits a course name: 0 = not shown; ≥ 810 = the same course ("close"). */
export function courseScore(query, name) {
  const qk = courseKey(query), qr = courseWords(query), nk = courseKey(name), nr = courseWords(name);
  return scoreKeys(qk, qr, nk, nr);
}
export function scoreKeys(qk, qr, nk, nr) {
  if (!qk && !qr) return 0;
  const qn = nums(qk), nn = nums(nk);
  if (qn && nn && qn !== nn) return 0;                       // Calculus 1 is never Calculus 2
  const pen = qn && !nn ? 100 : 0;
  let s = 0;
  if (qk === nk) s = 900;
  else if (sameSet(qk, nk)) s = 880;
  else if (nk.startsWith(qk) || nr.startsWith(qr)) s = 800;
  else if (everyPrefix(qk, nk) || everyPrefix(qr, nr)) s = 700;
  else if (toks(qk).filter(w => CANONICAL.has(w)).every(w => toks(nk).includes(w))) {   // a typo, but never Statics for Statistics
    const sim = Math.max(similarity(qk, nk), similarity(qr, nr));
    if (sim >= 0.45) s = 300 + 600 * sim;
  }
  return Math.max(0, Math.round((s - pen) * 1000) / 1000);
}
export const CLOSE = 810;

/** find_courses as you type (StashCore CourseFindCache): 3+ letters, after a pause; the same words typed again are
 *  answered from the last minutes. No filtering a longer name from a shorter one's answer: the server matches typos and
 *  other languages, so a longer name can find courses the shorter one didn't. Kept 9 minutes (join tokens last 10). */
export class CourseFindCache {
  static keepMs = 9 * 60 * 1000;
  static shown = 3;
  static key(q) { return courseWords(q); }
  constructor() { this.entries = []; }
  answer(query, now = Date.now()) {
    const q = CourseFindCache.key(query);
    return this.entries.find(e => e.query === q && now - e.at < CourseFindCache.keepMs)?.cards ?? null;
  }
  store(query, cards, now = Date.now()) {
    const q = CourseFindCache.key(query);
    this.entries = this.entries.filter(e => e.query !== q && now - e.at < CourseFindCache.keepMs);
    this.entries.push({ query: q, cards, at: now });
  }
  spend(token) { this.entries = this.entries.filter(e => !e.cards.some(c => c.find_token === token)); }
}
