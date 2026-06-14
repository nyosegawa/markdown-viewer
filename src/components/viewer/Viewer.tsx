import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { parseLocalLinkHref } from "@/lib/links";
import { consumePendingAnchor } from "@/lib/pending-anchor";
import { getSrcOffset, setSrcOffset } from "@/lib/scroll-memory";
import { isTauri } from "@/lib/tauri";
import { SearchBar } from "./SearchBar";

const MarkdownRenderer = lazy(async () => {
  const mod = await import("@/lib/markdown");
  return { default: mod.MarkdownRenderer };
});

export interface ViewerProps {
  source: string;
  /** When present, scroll position is saved per-tab so switching tabs restores
   *  the reader's place instead of remounting the Viewer (which re-instantiates
   *  the Shiki highlighter and costs hundreds of ms). */
  tabId?: string;
  /** Active tab's filesystem path. When provided, local link clicks inside the
   *  rendered body are intercepted and forwarded to `onOpenLocalLink` so they
   *  can be opened in-app (markdown) or via the OS shell (everything else). */
  basePath?: string;
  /** Receives raw hrefs of local links that were not handled inline (e.g. not
   *  `#anchor`, not `http(s):`/`mailto:`). The host App resolves and routes
   *  them. */
  onOpenLocalLink?: (rawHref: string) => void;
}

interface SearchState {
  open: boolean;
  query: string;
  focusToken: number;
}

const DEFAULT_SEARCH_STATE: SearchState = {
  open: false,
  query: "",
  focusToken: 0,
};

function decodeHash(hash: string): string {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

async function openExternal(url: string): Promise<void> {
  if (!isTauri()) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  try {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } catch (err) {
    console.warn("openUrl failed", err);
  }
}

const BLOCK_TAGS = new Set([
  "ADDRESS",
  "ARTICLE",
  "ASIDE",
  "BLOCKQUOTE",
  "DD",
  "DIV",
  "DL",
  "DT",
  "FIGCAPTION",
  "FIGURE",
  "FOOTER",
  "FORM",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "HEADER",
  "HR",
  "LI",
  "MAIN",
  "NAV",
  "OL",
  "P",
  "PRE",
  "SECTION",
  "TABLE",
  "TBODY",
  "TD",
  "TFOOT",
  "TH",
  "THEAD",
  "TR",
  "UL",
]);

function appendLineBreak(parts: string[], maxBreaks: 1 | 2) {
  while (parts.length > 0 && /[ \t]/.test(parts[parts.length - 1] ?? "")) {
    parts.pop();
  }
  const joined = parts.join("");
  const existing = joined.match(/\n+$/)?.[0].length ?? 0;
  for (let i = existing; i < maxBreaks; i += 1) parts.push("\n");
}

function nodeToPlainText(node: Node, parts: string[]) {
  if (node.nodeType === Node.TEXT_NODE) {
    parts.push(node.textContent ?? "");
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as HTMLElement;
  if (el.tagName === "BR") {
    appendLineBreak(parts, 1);
    return;
  }
  const isBlock = BLOCK_TAGS.has(el.tagName);
  const breakCount = el.tagName === "LI" || el.tagName === "TR" ? 1 : 2;
  if (isBlock && parts.join("").trim().length > 0 && !parts.join("").endsWith("\n")) {
    appendLineBreak(parts, 1);
  }
  for (const child of Array.from(el.childNodes)) {
    nodeToPlainText(child, parts);
  }
  if (isBlock) appendLineBreak(parts, breakCount as 1 | 2);
}

function normalizeCopiedText(text: string): string {
  return text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function rangeToRenderedText(body: HTMLElement, range: Range): string {
  const selectedBlocks = Array.from(body.querySelectorAll<HTMLElement>("[data-srcstart]"))
    .filter((el) => range.intersectsNode(el))
    .filter((el, _index, all) => !all.some((other) => other !== el && other.contains(el)));
  if (selectedBlocks.length > 1) {
    return normalizeCopiedText(
      selectedBlocks.map((el) => normalizeCopiedText(el.textContent ?? "")).join("\n\n"),
    );
  }

  const fragment = range.cloneContents();
  const parts: string[] = [];
  for (const child of Array.from(fragment.childNodes)) {
    nodeToPlainText(child, parts);
  }
  return normalizeCopiedText(parts.join(""));
}

/**
 * Pick the source offset of the first [data-srcstart] element whose bottom
 * crosses the scroll container's top edge. querySelectorAll is DOM-ordered,
 * so we can break on the first miss past the viewport.
 */
function topmostVisibleSrcOffset(scrollEl: HTMLElement, body: HTMLElement): number | null {
  const rootRect = scrollEl.getBoundingClientRect();
  const elements = body.querySelectorAll<HTMLElement>("[data-srcstart]");
  for (const el of elements) {
    const rect = el.getBoundingClientRect();
    if (rect.bottom <= rootRect.top) continue;
    if (rect.top >= rootRect.bottom) break;
    const offset = Number(el.dataset.srcstart);
    if (Number.isFinite(offset)) return offset;
  }
  return null;
}

/**
 * Scroll `root` so the rendered element nearest a given source offset lands
 * at the top. The DOM order of `[data-srcstart]` matches the source so we can
 * pick the largest start ≤ targetOffset in a single pass.
 *
 * Returns true when a target was found and a scroll was attempted (even if
 * targetOffset == 0 and the element was already at the top).
 */
export function scrollToSourceOffset(
  root: HTMLElement,
  body: HTMLElement,
  targetOffset: number,
): boolean {
  const elements = body.querySelectorAll<HTMLElement>("[data-srcstart]");
  if (elements.length === 0) return false;
  let target: HTMLElement | null = null;
  for (const el of elements) {
    const s = Number(el.dataset.srcstart);
    if (!Number.isFinite(s)) continue;
    if (s <= targetOffset) target = el;
    else break;
  }
  if (!target) return false;
  const targetRect = target.getBoundingClientRect();
  const rootRect = root.getBoundingClientRect();
  const prevBehavior = root.style.scrollBehavior;
  root.style.scrollBehavior = "auto";
  root.scrollTop += targetRect.top - rootRect.top;
  root.style.scrollBehavior = prevBehavior;
  return true;
}

export function Viewer({ source, tabId, basePath, onOpenLocalLink }: ViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // Stash these in refs so the click handler — which is bound exactly once
  // for the lifetime of the scroll container — always sees the latest values.
  const basePathRef = useRef<string | undefined>(basePath);
  useEffect(() => {
    basePathRef.current = basePath;
  }, [basePath]);
  const onOpenLocalLinkRef = useRef<typeof onOpenLocalLink>(onOpenLocalLink);
  useEffect(() => {
    onOpenLocalLinkRef.current = onOpenLocalLink;
  }, [onOpenLocalLink]);
  const searchKey = tabId ?? "__single_viewer__";
  const [searchByTab, setSearchByTab] = useState<Record<string, SearchState>>({});
  const currentSearch = searchByTab[searchKey] ?? DEFAULT_SEARCH_STATE;
  // Per-tab scroll positions. Kept in a ref so writes don't trigger rerenders.
  const scrollByTabRef = useRef<Map<string, number>>(new Map());
  const lastTabRef = useRef<string | undefined>(tabId);
  const tabIdRef = useRef(tabId);
  useEffect(() => {
    tabIdRef.current = tabId;
  }, [tabId]);

  // True only on the very first run of the layout effect below — used to skip
  // the pixel-cache restore on Viewer (re)mounts so we can fall back to the
  // cross-mode offset restore (edit → view returns).
  const isFirstLayoutRunRef = useRef(true);

  // Save outgoing tab's scroll and restore incoming tab's scroll synchronously
  // before paint, so switching feels instant.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const prev = lastTabRef.current;
    if (prev !== undefined && prev !== tabId) {
      scrollByTabRef.current.set(prev, el.scrollTop);
    }
    // On Viewer (re)mount we leave scrollTop alone — the offset-based effect
    // below handles edit→view restoration. After the first run we treat this
    // as an in-Viewer tab switch and pixel-restore from the cache (instant
    // and exact, which is what tab switches should feel like).
    if (tabId !== undefined && !isFirstLayoutRunRef.current) {
      // Temporarily disable smooth scrolling so the restore is an instant
      // jump; otherwise the CSS `scroll-behavior: smooth` used for anchor
      // links animates the restore and makes tab switches feel laggy.
      const prevBehavior = el.style.scrollBehavior;
      el.style.scrollBehavior = "auto";
      el.scrollTop = scrollByTabRef.current.get(tabId) ?? 0;
      el.style.scrollBehavior = prevBehavior;
    }
    isFirstLayoutRunRef.current = false;
    lastTabRef.current = tabId;
  }, [tabId]);

  // Edit→view restoration: when the editor wrote a source offset for this
  // tab, scroll to the matching `[data-srcstart]` anchor as soon as the lazy
  // markdown body is in the DOM. Skipped when the in-ref pixel cache already
  // has an exact entry (in-Viewer tab switch wins; instant + exact).
  useEffect(() => {
    const root = scrollRef.current;
    if (!root || !tabId) return;
    if (scrollByTabRef.current.has(tabId)) return;
    const stored = getSrcOffset(tabId);
    if (typeof stored !== "number" || stored <= 0) return;
    const targetOffset: number = stored;
    function attempt(): boolean {
      if (!root) return false;
      const body = root.querySelector<HTMLElement>('[data-testid="markdown-body"]');
      if (!body) return false;
      return scrollToSourceOffset(root, body, targetOffset);
    }
    if (attempt()) return;
    const observer = new MutationObserver(() => {
      if (attempt()) observer.disconnect();
    });
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [tabId]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    function onClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement | null)?.closest("a");
      if (!anchor || !root?.contains(anchor)) return;
      const href = anchor.getAttribute("href");
      if (!href) return;

      if (href.startsWith("#")) {
        e.preventDefault();
        const id = decodeHash(href);
        if (!id || !root) return;
        const target =
          (root.ownerDocument?.getElementById(id) as HTMLElement | null) ??
          (root.querySelector(`#${CSS.escape(id)}`) as HTMLElement | null);
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      if (/^(https?:|mailto:)/i.test(href)) {
        e.preventDefault();
        void openExternal(href);
        return;
      }

      // Local link (relative path, absolute path, or `file://`). Hand off to
      // the host so it can decide between "open as a new markdown tab" and
      // "open with the OS default app".
      const local = parseLocalLinkHref(href);
      if (local && basePathRef.current && onOpenLocalLinkRef.current) {
        e.preventDefault();
        onOpenLocalLinkRef.current(href);
      }
    }
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, []);

  // Pending-anchor handoff: when App stashed an anchor for this tab (because
  // a click on a local `.md#sec` link triggered openPath), scroll to the
  // matching id once the markdown body is in the DOM. Runs alongside (and
  // wins against) the source-offset restore — explicit anchor target beats a
  // remembered scroll position.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root || !tabId) return;
    const pending = consumePendingAnchor(tabId);
    if (!pending) return;
    const anchor: string = pending;
    function scrollToAnchor(): boolean {
      if (!root) return false;
      const doc = root.ownerDocument;
      if (!doc) return false;
      const target =
        (doc.getElementById(anchor) as HTMLElement | null) ??
        (root.querySelector(`#${CSS.escape(anchor)}`) as HTMLElement | null);
      if (!target) return false;
      target.scrollIntoView({ behavior: "auto", block: "start" });
      return true;
    }
    if (scrollToAnchor()) return;
    const observer = new MutationObserver(() => {
      if (scrollToAnchor()) observer.disconnect();
    });
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [tabId]);

  // Normal view-mode copy should copy the rendered text, not the markdown
  // source. The handler only intervenes to preserve block line breaks.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    function onCopy(e: ClipboardEvent) {
      const selection = root?.ownerDocument?.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      const body = root?.querySelector<HTMLElement>('[data-testid="markdown-body"]');
      if (!body) return;
      if (!body.contains(range.commonAncestorContainer)) return;
      const text = rangeToRenderedText(body, range);
      if (text.length === 0) return;
      e.preventDefault();
      e.clipboardData?.setData("text/plain", text);
    }
    root.addEventListener("copy", onCopy);
    return () => root.removeEventListener("copy", onCopy);
  }, []);

  // Record topmost visible source offset per tab on scroll so the editor can
  // open at roughly the same place when the user flips to edit mode.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    let rafId: number | null = null;
    function sample() {
      rafId = null;
      const id = tabIdRef.current;
      if (!id || !root) return;
      const body = root.querySelector<HTMLElement>('[data-testid="markdown-body"]');
      if (!body) return;
      const offset = topmostVisibleSrcOffset(root, body);
      if (offset !== null) setSrcOffset(id, offset);
    }
    function onScroll() {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(sample);
    }
    root.addEventListener("scroll", onScroll, { passive: true });
    // Capture an initial sample once the markdown is in the DOM. The renderer
    // is lazy + Suspense-gated, so we watch for mutations and sample once.
    const observer = new MutationObserver(() => {
      const body = root.querySelector<HTMLElement>('[data-testid="markdown-body"]');
      if (body?.querySelector("[data-srcstart]")) {
        sample();
      }
    });
    observer.observe(root, { childList: true, subtree: true });
    return () => {
      root.removeEventListener("scroll", onScroll);
      observer.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === "f" || e.key === "F")) {
        e.preventDefault();
        setSearchByTab((prev) => {
          const current = prev[searchKey] ?? DEFAULT_SEARCH_STATE;
          return {
            ...prev,
            [searchKey]: {
              ...current,
              open: true,
              focusToken: current.focusToken + 1,
            },
          };
        });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchKey]);

  const closeSearch = useCallback(() => {
    setSearchByTab((prev) => {
      const current = prev[searchKey] ?? DEFAULT_SEARCH_STATE;
      return { ...prev, [searchKey]: { ...current, open: false } };
    });
  }, [searchKey]);

  const setSearchQuery = useCallback(
    (query: string) => {
      setSearchByTab((prev) => {
        const current = prev[searchKey] ?? DEFAULT_SEARCH_STATE;
        return { ...prev, [searchKey]: { ...current, query } };
      });
    },
    [searchKey],
  );

  return (
    <div className="viewer">
      {currentSearch.open ? (
        <SearchBar
          containerRef={scrollRef}
          query={currentSearch.query}
          focusToken={currentSearch.focusToken}
          onQueryChange={setSearchQuery}
          onClose={closeSearch}
        />
      ) : null}
      <div className="viewer-scroll" data-testid="viewer-scroll" ref={scrollRef}>
        <Suspense
          fallback={
            <article className="markdown-body" data-testid="markdown-body">
              <p>Loading renderer…</p>
            </article>
          }
        >
          <MarkdownRenderer source={source} />
        </Suspense>
      </div>
    </div>
  );
}
