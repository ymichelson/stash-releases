// The words inside a PDF, read on the device (the dates card's "Found 6 dates — add them?" reads a syllabus). pdf.js
// (vendor/, Apache-2.0) is loaded only when someone picks a PDF for this; nothing is sent anywhere. Twin on the Mac:
// PDFKit's PDFDocument.string.
const PDFJS = "./vendor/pdf-4.10.38.min.js", WORKER = "./vendor/pdf.worker-4.10.38.min.js";
export const PDFText = {
  maxPages: 40, maxBytes: 20 * 1024 * 1024,
  /** Lines of text, page by page; null when it can't be read (scanned, locked, too big). */
  async read(bytes, { lib, worker } = {}) {
    if (!bytes || bytes.byteLength > this.maxBytes) return null;
    try {
      const pdfjs = lib ?? await import(new URL(PDFJS, import.meta.url).href);
      pdfjs.GlobalWorkerOptions.workerSrc = worker ?? new URL(WORKER, import.meta.url).href;
      const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, disableFontFace: true, useSystemFonts: false }).promise;
      const out = [];
      for (let n = 1; n <= Math.min(doc.numPages, this.maxPages); n++) {
        const page = await doc.getPage(n), { items } = await page.getTextContent();
        out.push(this.lines(items));
      }
      await doc.destroy();
      const text = out.join("\n").trim();
      return text || null;
    } catch (e) { this.lastError = e; return null; }
  },
  /** pdf.js's text pieces → lines: a piece that ends a line, or one that sits lower on the page, starts a new one. */
  lines(items) {
    const rows = []; let row = null, y = null;
    for (const it of items) {
      const top = it.transform ? Math.round(it.transform[5]) : y;
      if (row && y != null && top != null && Math.abs(top - y) > 2) { rows.push(row); row = null; }
      (row ??= []).push(it); y = top;
      if (it.hasEOL) { rows.push(row); row = null; y = null; }
    }
    if (row) rows.push(row);
    return rows.map(r => this.line(r)).filter(Boolean).join("\n");
  },
  /** One line. Right-to-left pieces come as words in reading order but laid out left to right on the page; a line that's
   *  mostly Hebrew or Arabic is put back in reading order (12:00-14:00 and Room 204 stay as they are). */
  line(r) {
    const pieces = [...r].sort((a, b) => (a.transform?.[4] ?? 0) - (b.transform?.[4] ?? 0));
    const visual = pieces.map(i => (i.dir === "rtl" ? [...i.str].reverse().join("") : i.str)).join("");
    const rtl = (visual.match(RTL_G) || []).length > (visual.match(LTR_G) || []).length;
    return (rtl ? this.logical(visual) : r.map(i => i.str).join("")).replace(/\s+/g, " ").trim();
  },
  /** Left-to-right page order → reading order for a right-to-left line (the Unicode bidi rules, cut down to what a
   *  syllabus needs): everything turns around except Latin words and numbers — 12:00-14:00, 20%, Room 204 stay as they
   *  are — and brackets in the Hebrew flip back. */
  logical(visual) {
    const ch = [...visual];
    const type = ch.map(c => (RTL.test(c) ? "R" : /\p{N}/u.test(c) ? "EN" : LTR.test(c) ? "L" : /[,.:/]/.test(c) ? "CS" : /[+\-]/.test(c) ? "ES" : /[%#$°‰€₪£]/.test(c) ? "ET" : "N"));
    for (let i = 1; i < ch.length - 1; i++) if ((type[i] === "CS" || type[i] === "ES") && type[i - 1] === "EN" && type[i + 1] === "EN") type[i] = "EN";
    for (let i = 0; i < ch.length; i++) if (type[i] === "ET") {   // a % or ₪ touching a number is part of it
      let j = i; while (j < ch.length && type[j] === "ET") j++;
      if (type[i - 1] === "EN" || type[j] === "EN") for (let k = i; k < j; k++) type[k] = "EN";
    }
    for (let i = 0; i < ch.length; i++) if (type[i] === "EN") {   // a number after a Latin word goes with it (Room 204)
      let j = i - 1; while (j >= 0 && !["R", "L"].includes(type[j])) j--;
      if (j >= 0 && type[j] === "L") type[i] = "L";
    }
    const dir = t => (t === "L" ? "L" : t === "R" || t === "EN" ? "R" : null);
    const level = ch.map((c, i) => {
      if (type[i] === "L" || type[i] === "EN") return 2;
      if (type[i] === "R") return 1;
      let a = null, b = null;
      for (let j = i - 1; j >= 0 && !a; j--) a = dir(type[j]);
      for (let j = i + 1; j < ch.length && !b; j++) b = dir(type[j]);
      return a === "L" && b === "L" ? 2 : 1;
    });
    const out = []; let run = [];
    for (let i = ch.length - 1; i >= 0; i--) {
      if (level[i] === 2) { run.unshift(ch[i]); continue; }
      if (run.length) { out.push(...run); run = []; }
      out.push(MIRROR[ch[i]] ?? ch[i]);
    }
    out.push(...run);
    return out.join("");
  },
};
const RTL = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/, RTL_G = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/g;
const LTR = /[\p{L}\p{N}]/u, LTR_G = /(?![\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF])[\p{L}]/gu;
const MIRROR = { "(": ")", ")": "(", "[": "]", "]": "[", "{": "}", "}": "{", "<": ">", ">": "<" };
