/**
 * Local-link parsing for the viewer's click handler.
 *
 * A "local link" is any href that points at a file on disk — relative paths,
 * absolute paths, and `file://` URLs. Web schemes (`http`, `https`, `mailto`,
 * `tel`, `data`, `javascript`, etc.) and bare in-page anchors (`#id`) are
 * explicitly excluded; the viewer handles those separately.
 */

export interface LocalLink {
  /** URL-decoded path portion, never URL-encoded, may be relative or absolute. */
  path: string;
  /** URL-decoded fragment, without the leading `#`, or null if absent. */
  fragment: string | null;
}

const NON_LOCAL_SCHEME = /^(?:[a-z][a-z0-9+.-]*:)/i;

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export function parseLocalLinkHref(href: string): LocalLink | null {
  if (!href) return null;
  // Bare in-page anchor — handled by the existing scroll-to-id branch.
  if (href.startsWith("#")) return null;

  // file:// URLs are local but parseable only via URL().
  if (/^file:\/\//i.test(href)) {
    try {
      const u = new URL(href);
      // u.pathname is already URL-encoded; decode for filesystem use. Strip a
      // leading slash on Windows paths like `/C:/...` so PathBuf parses them.
      let p = safeDecode(u.pathname);
      if (/^\/[a-zA-Z]:/.test(p)) p = p.slice(1);
      const frag = u.hash ? safeDecode(u.hash.slice(1)) : null;
      return { path: p, fragment: frag };
    } catch {
      return null;
    }
  }

  // Any other scheme (`http:`, `mailto:`, `vscode:`, `tel:`, etc.) is non-local.
  if (NON_LOCAL_SCHEME.test(href)) return null;

  // Relative or absolute filesystem path. Split off the fragment ourselves —
  // URL() requires a base to parse a relative href, and we want to keep the
  // raw path string for resolution by Tauri's path API.
  const hashIdx = href.indexOf("#");
  const rawPath = hashIdx >= 0 ? href.slice(0, hashIdx) : href;
  const fragment = hashIdx >= 0 ? safeDecode(href.slice(hashIdx + 1)) : null;
  // Strip any query string the same way; markdown editors occasionally embed
  // `?` in image links to bust caches.
  const qIdx = rawPath.indexOf("?");
  const cleanPath = qIdx >= 0 ? rawPath.slice(0, qIdx) : rawPath;
  if (cleanPath.length === 0 && fragment === null) return null;
  return { path: safeDecode(cleanPath), fragment };
}

const MARKDOWN_EXT = /\.(md|markdown|mdx)$/i;

export function isMarkdownPath(path: string): boolean {
  return MARKDOWN_EXT.test(path);
}
