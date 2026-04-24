import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { setSrcOffset } from "@/lib/scroll-memory";
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
}

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

/**
 * Find the smallest source range [srcstart, srcend) that covers every rendered
 * element the selection currently touches. Block granularity: a half-paragraph
 * selection still returns the whole paragraph source — good enough and avoids
 * trying to reconstruct markdown markup from a DOM text offset.
 */
function rangeToSourceSlice(body: HTMLElement, range: Range, source: string): string | null {
  const elements = body.querySelectorAll<HTMLElement>("[data-srcstart]");
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const el of elements) {
    if (!range.intersectsNode(el)) continue;
    const s = Number(el.dataset.srcstart);
    const e = Number(el.dataset.srcend);
    if (Number.isFinite(s) && s < min) min = s;
    if (Number.isFinite(e) && e > max) max = e;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) return null;
  return source.slice(min, Math.min(max, source.length));
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

export function Viewer({ source, tabId }: ViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  // Per-tab scroll positions. Kept in a ref so writes don't trigger rerenders.
  const scrollByTabRef = useRef<Map<string, number>>(new Map());
  const lastTabRef = useRef<string | undefined>(tabId);
  // Latest source, so the copy handler (stable across renders) always slices
  // from the current file.
  const sourceRef = useRef(source);
  useEffect(() => {
    sourceRef.current = source;
  }, [source]);
  const tabIdRef = useRef(tabId);
  useEffect(() => {
    tabIdRef.current = tabId;
  }, [tabId]);

  // Save outgoing tab's scroll and restore incoming tab's scroll synchronously
  // before paint, so switching feels instant.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const prev = lastTabRef.current;
    if (prev !== undefined && prev !== tabId) {
      scrollByTabRef.current.set(prev, el.scrollTop);
    }
    if (tabId !== undefined) {
      // Temporarily disable smooth scrolling so the restore is an instant
      // jump; otherwise the CSS `scroll-behavior: smooth` used for anchor
      // links animates the restore and makes tab switches feel laggy.
      const prevBehavior = el.style.scrollBehavior;
      el.style.scrollBehavior = "auto";
      el.scrollTop = scrollByTabRef.current.get(tabId) ?? 0;
      el.style.scrollBehavior = prevBehavior;
    }
    lastTabRef.current = tabId;
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
      }
    }
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, []);

  // Copy-as-markdown: rewrite clipboard text/plain with the underlying source.
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
      const slice = rangeToSourceSlice(body, range, sourceRef.current);
      if (slice === null || slice.length === 0) return;
      e.preventDefault();
      e.clipboardData?.setData("text/plain", slice);
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
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const closeSearch = useCallback(() => setSearchOpen(false), []);

  return (
    <div className="viewer">
      {searchOpen ? <SearchBar containerRef={scrollRef} onClose={closeSearch} /> : null}
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
