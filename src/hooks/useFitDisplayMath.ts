import { type RefObject, useEffect } from "react";
import { computeFitFontScale } from "../lib/fit-math";

/**
 * Watches a markdown container and shrinks the `font-size` of any
 * `.katex-display` block whose rendered width exceeds its parent. KaTeX
 * uses `em` for every internal length, so adjusting the wrapper's
 * `font-size` proportionally scales every glyph and bracket — unlike
 * `transform: scale()`, which leaves the layout box unchanged and would
 * produce overlapping text or stale baselines.
 *
 * The hook re-fits whenever:
 *   - the container is resized (window resize, sidebar toggle),
 *   - the markdown source changes (MutationObserver on subtree),
 *   - KaTeX finishes its async glyph layout one frame after mount.
 */
export function useFitDisplayMath(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (typeof ResizeObserver === "undefined" || typeof MutationObserver === "undefined") return;

    const apply = () => {
      const blocks = root.querySelectorAll<HTMLElement>(".katex-display");
      for (const block of blocks) {
        // Reset any previously applied scaling before measuring, otherwise
        // we'd be measuring the already-shrunk content and slowly converge
        // to a too-small size on every resize.
        block.style.fontSize = "";
        const inner = block.firstElementChild;
        if (!(inner instanceof HTMLElement)) continue;
        const scale = computeFitFontScale(block.clientWidth, inner.scrollWidth);
        if (scale < 1) {
          block.style.fontSize = `${scale}em`;
        }
      }
    };

    let pending = false;
    let rafId = 0;
    const schedule = () => {
      if (pending) return;
      pending = true;
      rafId = requestAnimationFrame(() => {
        pending = false;
        apply();
      });
    };

    schedule();

    const ro = new ResizeObserver(schedule);
    ro.observe(root);

    // KaTeX inserts its rendered spans asynchronously after rehype runs.
    // Watching the subtree catches that as well as future source changes.
    const mo = new MutationObserver(schedule);
    mo.observe(root, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      mo.disconnect();
    };
  }, [ref]);
}
