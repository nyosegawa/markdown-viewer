import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("svg2pdf.js", () => ({
  svg2pdf: vi.fn(async () => undefined),
}));

import { svg2pdf } from "svg2pdf.js";
import { drawMathSvg } from "./math";

describe("drawMathSvg", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("rasterizes math SVGs with Japanese text before adding them to the PDF", async () => {
    const drawImage = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      if (tagName === "canvas") {
        return {
          getContext: () => ({ drawImage }),
          toDataURL: () => "data:image/png;base64,math",
          width: 0,
          height: 0,
        } as unknown as HTMLElement;
      }
      return originalCreateElement(tagName);
    });
    vi.stubGlobal(
      "Image",
      class {
        complete = true;
        onerror: (() => void) | null = null;
        onload: (() => void) | null = null;

        set src(_value: string) {
          this.onload?.();
        }
      },
    );

    const addImage = vi.fn();

    await drawMathSvg(
      { addImage } as never,
      {
        aspectRatio: 1,
        svg: '<svg viewBox="0 0 10 10"><text>日本語</text></svg>',
      },
      1,
      2,
      30,
      12,
    );

    expect(drawImage).toHaveBeenCalledTimes(1);
    expect(addImage).toHaveBeenCalledWith("data:image/png;base64,math", "PNG", 1, 2, 30, 12);
    expect(document.createElement("canvas").width).toBeLessThanOrEqual(2400);
  });

  it("bounds Japanese math rasterization to the requested PDF draw size", async () => {
    let canvasWidth = 0;
    let canvasHeight = 0;
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      if (tagName === "canvas") {
        return {
          getContext: () => ({ drawImage: vi.fn() }),
          toDataURL: () => "data:image/png;base64,math",
          get width() {
            return canvasWidth;
          },
          set width(value: number) {
            canvasWidth = value;
          },
          get height() {
            return canvasHeight;
          },
          set height(value: number) {
            canvasHeight = value;
          },
        } as unknown as HTMLElement;
      }
      return originalCreateElement(tagName);
    });
    vi.stubGlobal(
      "Image",
      class {
        complete = true;
        onerror: (() => void) | null = null;
        onload: (() => void) | null = null;

        set src(_value: string) {
          this.onload?.();
        }
      },
    );

    await drawMathSvg(
      { addImage: vi.fn() } as never,
      {
        aspectRatio: 1,
        svg: '<svg viewBox="0 0 33520 7413"><text>日本語</text></svg>',
      },
      0,
      0,
      80,
      12,
    );

    expect(canvasWidth).toBeLessThan(1000);
    expect(canvasHeight).toBeLessThan(200);
  });

  it("falls back to SVG drawing when Japanese math rasterization fails", async () => {
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      if (tagName === "canvas") {
        return {
          getContext: () => ({ drawImage: vi.fn() }),
          toDataURL: () => "data:image/png;base64,math",
          width: 0,
          height: 0,
        } as unknown as HTMLElement;
      }
      return originalCreateElement(tagName);
    });
    vi.stubGlobal(
      "Image",
      class {
        complete = true;
        onerror: (() => void) | null = null;
        onload: (() => void) | null = null;

        set src(_value: string) {
          this.onerror?.();
        }
      },
    );
    const addImage = vi.fn();

    await drawMathSvg(
      { addImage } as never,
      {
        aspectRatio: 1,
        svg: '<svg viewBox="0 0 10 10"><text>日本語</text></svg>',
      },
      1,
      2,
      30,
      12,
    );

    expect(addImage).not.toHaveBeenCalled();
    expect(svg2pdf).toHaveBeenCalledTimes(1);
  });

  it("falls back to SVG drawing when math PNG encoding fails", async () => {
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      if (tagName === "canvas") {
        return {
          getContext: () => ({ drawImage: vi.fn() }),
          toDataURL: () => {
            throw new Error("canvas is not origin clean");
          },
          width: 0,
          height: 0,
        } as unknown as HTMLElement;
      }
      return originalCreateElement(tagName);
    });
    vi.stubGlobal(
      "Image",
      class {
        complete = true;
        onerror: (() => void) | null = null;
        onload: (() => void) | null = null;

        set src(_value: string) {
          this.onload?.();
        }
      },
    );
    const addImage = vi.fn();

    await drawMathSvg(
      { addImage } as never,
      {
        aspectRatio: 1,
        svg: '<svg viewBox="0 0 10 10"><text>日本語</text></svg>',
      },
      1,
      2,
      30,
      12,
    );

    expect(addImage).not.toHaveBeenCalled();
    expect(svg2pdf).toHaveBeenCalledTimes(1);
  });
});
