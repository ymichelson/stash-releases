// The first page of a PDF as a small JPEG, made on the device when a PDF is added from the page, so classmates see the
// real first page instead of a drawn one (launch QA S4). Same rule as the Mac's thumbnails: a JPEG under 1 MB, stored
// next to the file (add_material p_has_thumb → thumb_path; material_ready checks it). pdf.js (vendor/, Apache-2.0)
// loads only when a PDF is added. Nothing here leaves the device except through the normal upload.
const PDFJS = "./vendor/pdf-4.10.38.min.js", WORKER = "./vendor/pdf.worker-4.10.38.min.js";
export const PDFThumb = {
  width: 480, maxBytes: 1_000_000, maxFile: 50 * 1024 * 1024,
  /** A JPEG Blob of page 1 (white behind it, at most twice as tall as wide), or null when the PDF can't be drawn. */
  async make(file, { lib, worker } = {}) {
    if (!file || !file.size || file.size > this.maxFile) return null;
    try {
      const pdfjs = lib ?? await import(new URL(PDFJS, import.meta.url).href);
      pdfjs.GlobalWorkerOptions.workerSrc = worker ?? new URL(WORKER, import.meta.url).href;
      const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
      try {
        const page = await doc.getPage(1), base = page.getViewport({ scale: 1 });
        const vp = page.getViewport({ scale: this.width / base.width });
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(vp.width); canvas.height = Math.min(Math.round(vp.height), this.width * 2);
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        for (const q of [0.82, 0.6, 0.4]) {
          const blob = await new Promise(r => canvas.toBlob(r, "image/jpeg", q));
          if (blob && blob.size <= this.maxBytes) return blob;
        }
        return null;
      } finally { await doc.destroy(); }
    } catch (e) { this.lastError = e; return null; }
  },
};
