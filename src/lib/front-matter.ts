export interface FrontMatterEntry {
  key: string;
  value: string;
}

export interface FrontMatterMatch {
  /** Parsed key/value pairs (flat, in source order). Empty when no entries
   *  could be extracted but the delimiters were still present. */
  entries: FrontMatterEntry[];
  /** Byte offset (inclusive) of the opening `---` in the original source. */
  start: number;
  /** Byte offset (exclusive) of the byte immediately after the trailing
   *  newline of the closing `---`. */
  end: number;
}

// Matches a YAML front-matter block at the very start of the document:
//   ^---\n ... \n---(\n)?
// Newline tolerance: \r\n on Windows-saved files.
const FRONT_MATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

/**
 * Extract a YAML front-matter block from the head of `source` and parse its
 * flat `key: value` lines. We do NOT pull in `js-yaml` — viewer-side display
 * only needs to surface metadata, and the typical files we see in this app
 * use flat scalars. Anything more complex (lists, nested mappings) renders as
 * the raw line so it stays visible rather than disappearing.
 */
export function extractFrontMatter(source: string): FrontMatterMatch | null {
  const match = FRONT_MATTER_RE.exec(source);
  if (!match) return null;
  const body = match[1] ?? "";
  const entries: FrontMatterEntry[] = [];
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const colon = trimmed.indexOf(":");
    if (colon <= 0) {
      entries.push({ key: "", value: trimmed });
      continue;
    }
    const key = trimmed.slice(0, colon).trim();
    let value = trimmed.slice(colon + 1).trim();
    // Strip a single matching pair of surrounding quotes.
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }
    entries.push({ key, value });
  }
  return { entries, start: 0, end: match[0].length };
}
