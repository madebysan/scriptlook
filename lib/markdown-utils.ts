// Replace a single ## section within a markdown document. The replacement
// should be a full section — i.e. `## Section Name\nbody...\n`. If the section
// isn't found, the original document is returned unchanged.

export function replaceMarkdownSection(
  md: string,
  sectionName: string,
  replacement: string,
): string {
  const heading = `## ${sectionName}`;
  const headingRegex = new RegExp(`^##\\s+${escapeRegex(sectionName)}\\s*$`, "m");
  const match = md.match(headingRegex);
  if (!match || match.index === undefined) {
    return md;
  }
  const start = match.index;
  // Find the next ## heading (or end of document).
  const afterStart = md.slice(start + heading.length);
  const nextHeadingMatch = afterStart.match(/\n##\s+/);
  const end =
    nextHeadingMatch && nextHeadingMatch.index !== undefined
      ? start + heading.length + nextHeadingMatch.index + 1
      : md.length;

  // Normalize the replacement so it fits cleanly: strip trailing whitespace,
  // ensure a single trailing newline before the next section.
  const trimmed = replacement.trim();
  const before = md.slice(0, start);
  const after = md.slice(end);
  const needsTrailingNewline = after.startsWith("##") ? "\n\n" : "\n";
  return before + trimmed + needsTrailingNewline + after;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
