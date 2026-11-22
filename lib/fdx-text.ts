// Final Draft (.fdx) files are XML. Sending the raw markup to the extraction
// model spends most of the token budget on tags, and hides scene headings from
// the INT./EXT. check on the intake screen. This reduces an FDX document to the
// screenplay's plain text, one line per paragraph, in the browser.
//
// Returns the input unchanged when it is not parseable FDX, so a mislabeled
// plain-text file still goes through.

// Paragraph types that continue the block above them (a character cue followed
// by its parenthetical and dialogue) instead of starting a new one.
const CONTINUATION_TYPES = new Set(["Dialogue", "Parenthetical"]);

export function fdxToPlainText(xml: string): string {
  if (typeof DOMParser === "undefined" || !/<FinalDraft[\s>]/.test(xml)) return xml;

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(xml, "application/xml");
  } catch {
    return xml;
  }
  if (doc.getElementsByTagName("parsererror").length > 0) return xml;

  const root = doc.documentElement;
  const script = childrenNamed(root, "Content")[0];
  if (!script) return xml;

  const titlePage = childrenNamed(root, "TitlePage")[0];
  const titleContent = titlePage ? childrenNamed(titlePage, "Content")[0] : undefined;

  const blocks = [
    ...(titleContent ? paragraphLines(titleContent, true) : []),
    ...paragraphLines(script, false),
  ];
  const text = blocks.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return text || xml;
}

function childrenNamed(parent: Element, name: string): Element[] {
  return Array.from(parent.children).filter((child) => child.tagName === name);
}

// Elements whose <Paragraph> children are screenplay text. Final Draft also
// nests paragraphs inside a script paragraph for material that is not part of
// the script: script notes, scene summaries, character arc beats. Those are the
// writer's private working notes and must not reach the model as scene text.
const SCRIPT_PARAGRAPH_PARENTS = new Set(["Content", "DualDialogue"]);

// One output line per script <Paragraph> that directly holds <Text> runs.
// Wrapper paragraphs (dual dialogue) have no direct text and are skipped; the
// paragraphs nested inside them are visited on their own.
function paragraphLines(content: Element, compact: boolean): string[] {
  const lines: string[] = [];
  for (const paragraph of Array.from(content.getElementsByTagName("Paragraph"))) {
    if (!SCRIPT_PARAGRAPH_PARENTS.has(paragraph.parentElement?.tagName ?? "")) continue;
    const line = childrenNamed(paragraph, "Text")
      .map((run) => run.textContent ?? "")
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    if (!line) continue;
    const type = paragraph.getAttribute("Type") ?? "";
    const startsBlock = !compact && !CONTINUATION_TYPES.has(type) && lines.length > 0;
    if (startsBlock) lines.push("");
    lines.push(line);
  }
  if (compact && lines.length > 0) lines.push("");
  return lines;
}
