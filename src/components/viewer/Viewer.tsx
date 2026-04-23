import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { isTauri } from "@/lib/tauri";
import { SearchBar } from "./SearchBar";

const MarkdownRenderer = lazy(async () => {
  const mod = await import("@/lib/markdown");
  return { default: mod.MarkdownRenderer };
});

export interface ViewerProps {
  source: string;
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

export function Viewer({ source }: ViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);

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
