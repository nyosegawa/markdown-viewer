import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// Swap the async/Shiki-loading renderer for the sync, test-friendly one
// so Viewer's React.lazy resolves to plain HTML synchronously enough.
vi.mock("@/lib/markdown", async () => {
  const actual = await vi.importActual<typeof import("@/lib/markdown")>("@/lib/markdown");
  return {
    ...actual,
    MarkdownRenderer: actual.SyncMarkdownRenderer,
  };
});

import { Viewer } from "./Viewer";

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
