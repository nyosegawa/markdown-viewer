import { afterEach, describe, expect, it, vi } from "vitest";
import { drawMathSvg } from "./math";

describe("drawMathSvg", () => {
  afterEach(() => {
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
  });
});
