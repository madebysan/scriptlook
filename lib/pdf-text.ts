// Client-side PDF → text extraction via PDF.js. Runs in the browser so the
// server never has to process a feature-length PDF document block (the
// benchmark found clean text → Haiku extracts cleaner than the PDF block).
// Line breaks are reconstructed from each text item's `hasEOL` flag so
// screenplay structure (slug lines, character cues) survives for Stage 0.

export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");

  // Bundle the worker from the same package version so the API and worker
  // never drift. Turbopack resolves `new URL(..., import.meta.url)` to a
  // bundled asset URL.
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;

  const lines: string[] = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    let line = "";
    for (const item of content.items) {
      if (!("str" in item)) continue;
      line += item.str;
      if (item.hasEOL) {
        lines.push(line);
        line = "";
      }
    }
    if (line) lines.push(line);
  }

  return lines.join("\n").trim();
}
