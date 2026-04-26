import { act, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFitDisplayMath } from "./useFitDisplayMath";

/**
 * happy-dom does not implement layout, so `clientWidth` / `scrollWidth` are
 * always 0. We patch the prototype getters to return values from a per-test
 * map keyed by element. This lets us drive the auto-fit logic deterministically
 * without needing a headless browser.
 */
const sizeMap = new WeakMap<Element, { clientWidth: number; scrollWidth: number }>();
let originalClientWidth: PropertyDescriptor | undefined;
let originalScrollWidth: PropertyDescriptor | undefined;

beforeEach(() => {
  originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
  originalScrollWidth = Object.getOwnPropertyDescriptor(Element.prototype, "scrollWidth");
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get(this: HTMLElement) {
      return sizeMap.get(this)?.clientWidth ?? 0;
    },
  });
  Object.defineProperty(Element.prototype, "scrollWidth", {
    configurable: true,
    get(this: Element) {
      return sizeMap.get(this)?.scrollWidth ?? 0;
    },
  });
});

afterEach(() => {
  if (originalClientWidth) {
    Object.defineProperty(HTMLElement.prototype, "clientWidth", originalClientWidth);
  }
  if (originalScrollWidth) {
    Object.defineProperty(Element.prototype, "scrollWidth", originalScrollWidth);
  }
});

function Harness({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useFitDisplayMath(ref);
  return (
    <div ref={ref} data-testid="root">
      {children}
    </div>
  );
}

async function flushFrame() {
  // The hook coalesces work into a rAF callback; advance one frame so it runs.
  await act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
}

describe("useFitDisplayMath", () => {
  it("shrinks display math whose content overflows the container", async () => {
    const { container } = render(
      <Harness>
        <span className="katex-display">
          <span className="katex">f(x)</span>
        </span>
      </Harness>,
    );
    const block = container.querySelector(".katex-display") as HTMLElement;
    const inner = block.firstElementChild as HTMLElement;
    sizeMap.set(block, { clientWidth: 820, scrollWidth: 820 });
    sizeMap.set(inner, { clientWidth: 1100, scrollWidth: 1100 });

    await flushFrame();

    // 820 / 1100 ≈ 0.7454, above the 0.6 floor — exact ratio applies.
    expect(Number.parseFloat(block.style.fontSize)).toBeCloseTo(820 / 1100, 4);
    expect(block.style.fontSize).toMatch(/em$/);
  });

  it("leaves font-size untouched when the math already fits", async () => {
    const { container } = render(
      <Harness>
        <span className="katex-display">
          <span className="katex">x^2</span>
        </span>
      </Harness>,
    );
    const block = container.querySelector(".katex-display") as HTMLElement;
    const inner = block.firstElementChild as HTMLElement;
    sizeMap.set(block, { clientWidth: 820, scrollWidth: 820 });
    sizeMap.set(inner, { clientWidth: 120, scrollWidth: 120 });

    await flushFrame();

    expect(block.style.fontSize).toBe("");
  });

  it("does not shrink for a 1px sub-pixel overflow", async () => {
    const { container } = render(
      <Harness>
        <span className="katex-display">
          <span className="katex">x</span>
        </span>
      </Harness>,
    );
    const block = container.querySelector(".katex-display") as HTMLElement;
    const inner = block.firstElementChild as HTMLElement;
    sizeMap.set(block, { clientWidth: 820, scrollWidth: 820 });
    sizeMap.set(inner, { clientWidth: 821, scrollWidth: 821 });

    await flushFrame();

    expect(block.style.fontSize).toBe("");
  });

  it("re-fits when new display math is appended to the subtree", async () => {
    const { container, getByTestId } = render(<Harness>{null}</Harness>);
    const root = getByTestId("root");
    await flushFrame();

    // Append a new .katex-display node directly so we control measurement
    // ordering: set the mocked sizes BEFORE the MutationObserver flushes,
    // otherwise its rAF callback would run with empty sizeMap and skip
    // scaling.
    const block = document.createElement("span");
    block.className = "katex-display";
    const inner = document.createElement("span");
    inner.className = "katex";
    inner.textContent = "long formula";
    block.appendChild(inner);
    sizeMap.set(block, { clientWidth: 820, scrollWidth: 820 });
    sizeMap.set(inner, { clientWidth: 1230, scrollWidth: 1230 });

    await act(async () => {
      root.appendChild(block);
    });
    await flushFrame();

    // 820 / 1230 ≈ 0.6667 — above the 0.6 floor, so we use the exact ratio.
    expect(container.querySelector(".katex-display")).toBe(block);
    expect(Number.parseFloat(block.style.fontSize)).toBeCloseTo(820 / 1230, 4);
  });

  it("is a no-op when ResizeObserver is missing in the environment", async () => {
    const original = globalThis.ResizeObserver;
    // @ts-expect-error — simulating an environment without ResizeObserver
    globalThis.ResizeObserver = undefined;
    const spy = vi.spyOn(globalThis, "MutationObserver");
    try {
      render(
        <Harness>
          <span className="katex-display">
            <span className="katex">x</span>
          </span>
        </Harness>,
      );
      await flushFrame();
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
      globalThis.ResizeObserver = original;
    }
  });
});
