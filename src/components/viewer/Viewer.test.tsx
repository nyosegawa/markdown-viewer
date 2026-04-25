import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearSrcOffset, setSrcOffset } from "@/lib/scroll-memory";

// Swap the async/Shiki-loading renderer for the sync, test-friendly one
// so Viewer's React.lazy resolves to plain HTML synchronously enough.
vi.mock("@/lib/markdown", async () => {
  const actual = await vi.importActual<typeof import("@/lib/markdown")>("@/lib/markdown");
  return {
    ...actual,
    MarkdownRenderer: actual.SyncMarkdownRenderer,
  };
});

import { scrollToSourceOffset, Viewer } from "./Viewer";

async function renderViewer(source: string) {
  const view = render(<Viewer source={source} />);
  // Wait until the lazy MarkdownRenderer has mounted real content.
  // (Suspense fallback also uses data-testid="markdown-body", so we
  // poll for the absence of the fallback paragraph.)
  await screen.findByText((_, el) => {
    if (!el || el.tagName.toLowerCase() !== "article") return false;
    return el.textContent?.includes("Loading renderer") === false;
  });
  return view;
}

describe("Viewer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the markdown inside a scroll container", async () => {
    await renderViewer("# Hi\n\nbody");
    expect(screen.getByTestId("viewer-scroll")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Hi");
  });

  it("fragment link click calls scrollIntoView on the target heading", async () => {
    const spy = vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(() => {});
    await renderViewer("## Target\n\n[jump](#target)\n");

    const link = await screen.findByRole("link", { name: "jump" });
    await userEvent.click(link);
    expect(spy).toHaveBeenCalled();
  });

  it("external http link routes through window.open (non-Tauri fallback)", async () => {
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
    await renderViewer("[tauri](https://tauri.app)\n");

    const link = await screen.findByRole("link", { name: "tauri" });
    await userEvent.click(link);
    // Give the async openExternal microtask a beat.
    await Promise.resolve();
    expect(openSpy).toHaveBeenCalledWith(
      "https://tauri.app",
      "_blank",
      expect.stringContaining("noopener"),
    );
  });

  it("Cmd/Ctrl+F opens the search bar; Escape closes it", async () => {
    await renderViewer("# Hello\n");
    expect(screen.queryByTestId("search-input")).toBeNull();

    await userEvent.keyboard("{Meta>}f{/Meta}");
    expect(screen.getByTestId("search-input")).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByTestId("search-input")).toBeNull();
  });

  describe("scrollToSourceOffset", () => {
    function makeBody(offsets: number[]): { root: HTMLElement; body: HTMLElement } {
      const root = document.createElement("div");
      const body = document.createElement("article");
      body.setAttribute("data-testid", "markdown-body");
      for (const o of offsets) {
        const p = document.createElement("p");
        p.setAttribute("data-srcstart", String(o));
        p.setAttribute("data-srcend", String(o + 50));
        body.appendChild(p);
      }
      root.appendChild(body);
      return { root, body };
    }

    function mockRect(el: HTMLElement, top: number) {
      el.getBoundingClientRect = () =>
        ({
          top,
          bottom: top + 30,
          left: 0,
          right: 100,
          width: 100,
          height: 30,
          x: 0,
          y: top,
        }) as DOMRect;
    }

    it("scrolls so the largest [data-srcstart] ≤ targetOffset lands at the root's top", () => {
      const { root, body } = makeBody([0, 100, 200, 300]);
      mockRect(root, 0);
      // Layout starts after the user has already scrolled 200px down.
      Object.defineProperty(root, "scrollTop", { value: 200, writable: true });
      // Each paragraph 100px tall, top relative to scrolled root.
      const ps = body.querySelectorAll("p");
      mockRect(ps[0] as HTMLElement, -200);
      mockRect(ps[1] as HTMLElement, -100);
      mockRect(ps[2] as HTMLElement, 0);
      mockRect(ps[3] as HTMLElement, 100);

      // Target offset 250 → matches the [data-srcstart=200] paragraph (the
      // largest start ≤ 250). It's already at the top, so scrollTop should
      // stay the same after restoration.
      expect(scrollToSourceOffset(root, body, 250)).toBe(true);
      expect(root.scrollTop).toBe(200);
    });

    it("returns false when there are no [data-srcstart] elements", () => {
      const root = document.createElement("div");
      const body = document.createElement("article");
      root.appendChild(body);
      expect(scrollToSourceOffset(root, body, 100)).toBe(false);
    });

    it("returns false when no offset matches (target before all elements)", () => {
      const { root, body } = makeBody([100, 200]);
      // Target 50 is before any data-srcstart; nothing to anchor on.
      expect(scrollToSourceOffset(root, body, 50)).toBe(false);
    });
  });

  it("on mount, scrolls to the stored source offset for tabId (edit→view return)", async () => {
    // Simulate the editor having recorded a scroll position for this tab.
    setSrcOffset("tab-edit-return", 200);
    try {
      const source = "# A\n\npara A\n\n## B\n\npara B\n\n## C\n\npara C\n";
      // Mock layout so scrollToSourceOffset has something to bite on once
      // the lazy renderer mounts.
      const realGet = HTMLElement.prototype.getBoundingClientRect;
      HTMLElement.prototype.getBoundingClientRect = function () {
        if (this.dataset.testid === "viewer-scroll") {
          return {
            top: 0,
            bottom: 600,
            left: 0,
            right: 400,
            width: 400,
            height: 600,
            x: 0,
            y: 0,
          } as DOMRect;
        }
        if (this.hasAttribute("data-srcstart")) {
          // Each block 50px tall, stacked from y=0 downwards.
          const idx = Array.from(
            this.parentElement?.querySelectorAll("[data-srcstart]") ?? [],
          ).indexOf(this);
          const top = idx * 50;
          return {
            top,
            bottom: top + 50,
            left: 0,
            right: 400,
            width: 400,
            height: 50,
            x: 0,
            y: top,
          } as DOMRect;
        }
        return realGet.call(this);
      };
      try {
        const { container } = render(<Viewer source={source} tabId="tab-edit-return" />);
        await screen.findByText((_, el) => {
          if (!el || el.tagName.toLowerCase() !== "article") return false;
          return el.textContent?.includes("Loading renderer") === false;
        });
        // Wait one microtask cycle for the MutationObserver→scroll path.
        await new Promise<void>((r) => setTimeout(r, 0));
        const scroll = container.querySelector('[data-testid="viewer-scroll"]') as HTMLElement;
        // We don't assert an exact pixel — only that the Viewer attempted a
        // non-zero scroll restore (any positive scrollTop proves the offset
        // path ran rather than the legacy "always reset to 0" behaviour).
        expect(scroll.scrollTop).toBeGreaterThan(0);
      } finally {
        HTMLElement.prototype.getBoundingClientRect = realGet;
      }
    } finally {
      clearSrcOffset("tab-edit-return");
    }
  });

  it("copy rewrites clipboard text/plain with the original markdown source", async () => {
    const source = "# Title\n\nfirst paragraph with **bold** word.\n\nsecond paragraph.\n";
    await renderViewer(source);

    const scroll = screen.getByTestId("viewer-scroll");
    const firstP = scroll.querySelector("p");
    expect(firstP).not.toBeNull();

    // Select the full text of the first paragraph, then fire a copy event
    // that bubbles up to the scroll container listener.
    const selection = window.getSelection();
    expect(selection).not.toBeNull();
    const range = document.createRange();
    if (firstP) range.selectNodeContents(firstP);
    selection?.removeAllRanges();
    selection?.addRange(range);

    const data = new DataTransfer();
    const event = new ClipboardEvent("copy", {
      bubbles: true,
      cancelable: true,
      clipboardData: data,
    });
    firstP?.dispatchEvent(event);

    // Block granularity: copying inside a paragraph yields the whole paragraph
    // source, which matches the markdown file exactly (including `**bold**`).
    expect(data.getData("text/plain")).toContain("**bold**");
    expect(data.getData("text/plain")).toContain("first paragraph");
    expect(data.getData("text/plain")).not.toContain("second paragraph");
  });
});
