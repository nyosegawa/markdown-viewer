/**
 * Pure helper for the display-math auto-fit logic. Display math rendered by
 * KaTeX is laid out with `white-space: nowrap`, so a long formula like the
 * RLHF objective easily exceeds the article's 820px gutter. The default
 * remedy — `overflow-x: auto` — paints a scrollbar on every formula on
 * macOS WebKit (the OS honors "Always show" globally), which is what users
 * complain about. Instead, we shrink the formula's `font-size` until it
 * fits, falling back to a hidden-but-scrollable container only past the
 * minimum readable size.
 *
 * KaTeX renders entirely in `em` units, so reducing `font-size` on the
 * `.katex-display` wrapper proportionally scales every glyph and bracket
 * without breaking baseline alignment the way `transform: scale()` would.
 */
export const FIT_MATH_MIN_SCALE = 0.6;

// Sub-pixel rounding can leave content 0.5–1px wider than its container,
// which would trigger spurious scaling on math that visually fits.
const PIXEL_TOLERANCE = 1;

export function computeFitFontScale(
  containerPx: number,
  contentPx: number,
  minScale: number = FIT_MATH_MIN_SCALE,
): number {
  if (!Number.isFinite(containerPx) || !Number.isFinite(contentPx)) return 1;
  if (containerPx <= 0 || contentPx <= 0) return 1;
  if (contentPx <= containerPx + PIXEL_TOLERANCE) return 1;
  const ratio = containerPx / contentPx;
  return Math.max(minScale, ratio);
}
