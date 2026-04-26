import { describe, expect, it } from "vitest";
import { computeFitFontScale, FIT_MATH_MIN_SCALE } from "./fit-math";

describe("computeFitFontScale", () => {
  it("returns 1 when content fits the container", () => {
    expect(computeFitFontScale(800, 600)).toBe(1);
  });

  it("returns 1 when content matches the container exactly", () => {
    expect(computeFitFontScale(800, 800)).toBe(1);
  });

  it("tolerates sub-pixel rounding overflow without scaling", () => {
    // Browsers report scrollWidth as a rounded-up integer, so a flex layout
    // with fractional widths can be reported as 1px wider than its parent.
    // Treat a 1px overflow as a fit so short formulas don't shrink.
    expect(computeFitFontScale(800, 801)).toBe(1);
  });

  it("scales down to the container/content ratio when overflowing", () => {
    // 820 / 1100 ≈ 0.745, comfortably above the readability floor.
    expect(computeFitFontScale(820, 1100)).toBeCloseTo(820 / 1100, 5);
  });

  it("clamps the result at the minimum scale to keep math readable", () => {
    // A formula 10x wider than the gutter would otherwise shrink to 0.1em,
    // which is illegible. Floor at the published minimum and let the
    // hidden-scrollbar fallback handle the residual overflow.
    const tinyContainer = 80;
    const enormousContent = 800;
    expect(computeFitFontScale(tinyContainer, enormousContent)).toBe(FIT_MATH_MIN_SCALE);
  });

  it("respects a caller-provided minimum scale", () => {
    expect(computeFitFontScale(100, 1000, 0.3)).toBe(0.3);
  });

  it("returns 1 for nonsense measurements (zero, negative, or NaN)", () => {
    expect(computeFitFontScale(0, 100)).toBe(1);
    expect(computeFitFontScale(100, 0)).toBe(1);
    expect(computeFitFontScale(-10, 100)).toBe(1);
    expect(computeFitFontScale(Number.NaN, 100)).toBe(1);
    expect(computeFitFontScale(100, Number.NaN)).toBe(1);
  });
});
