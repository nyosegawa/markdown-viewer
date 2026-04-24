import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invokeReadMarkdown: vi.fn(),
  invokeWatchFile: vi.fn(),
  invokeUnwatchFile: vi.fn(),
  listenFileChanged: vi.fn(),
}));

vi.mock("@/lib/tauri", () => ({
  invokeReadMarkdown: mocks.invokeReadMarkdown,
  invokeWatchFile: mocks.invokeWatchFile,
  invokeUnwatchFile: mocks.invokeUnwatchFile,
  listenFileChanged: mocks.listenFileChanged,
}));

import { useTabs } from "./useTabs";

describe("useTabs", () => {
  beforeEach(() => {
    mocks.invokeReadMarkdown.mockReset();
    mocks.invokeWatchFile.mockReset().mockResolvedValue(undefined);
    mocks.invokeUnwatchFile.mockReset().mockResolvedValue(undefined);
    mocks.listenFileChanged.mockReset().mockResolvedValue(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("starts empty", () => {
    const { result } = renderHook(() => useTabs());
    expect(result.current.tabs).toHaveLength(0);
    expect(result.current.activeId).toBeNull();
    expect(result.current.activeTab).toBeNull();
  });

  it("openPath creates a tab, reads the file, and starts watching", async () => {
    mocks.invokeReadMarkdown.mockResolvedValue("# one\n");
    const { result } = renderHook(() => useTabs());

    await act(async () => {
      await result.current.openPath("/a.md");
    });

    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.tabs[0]).toMatchObject({
      path: "/a.md",
      source: "# one\n",
      status: "ready",
      mode: "view",
    });
    expect(result.current.activeId).toBe(result.current.tabs[0]?.id);
    expect(mocks.invokeWatchFile).toHaveBeenCalledWith("/a.md");
  });

  it("opening the same path twice just activates the existing tab", async () => {
    mocks.invokeReadMarkdown.mockResolvedValue("x");
    const { result } = renderHook(() => useTabs());

    await act(async () => {
      await result.current.openPath("/a.md");
    });
    await act(async () => {
      await result.current.openPath("/b.md");
    });
    await act(async () => {
      await result.current.openPath("/a.md");
    });

    expect(result.current.tabs).toHaveLength(2);
    expect(result.current.tabs.map((t) => t.path)).toEqual(["/a.md", "/b.md"]);
    expect(result.current.tabs[0]?.id).toBe(result.current.activeId);
  });

  it("closeTab removes the tab, unwatches, and records it in recentlyClosed", async () => {
    mocks.invokeReadMarkdown.mockResolvedValue("x");
    const { result } = renderHook(() => useTabs());

    await act(async () => {
      await result.current.openPath("/a.md");
    });
    const id = result.current.tabs[0]?.id ?? "";

    await act(async () => {
      await result.current.closeTab(id);
    });

    expect(result.current.tabs).toHaveLength(0);
    expect(result.current.activeId).toBeNull();
    expect(mocks.invokeUnwatchFile).toHaveBeenCalledWith("/a.md");
    expect(result.current.recentlyClosed[0]?.path).toBe("/a.md");
  });

  it("closing the active middle tab activates its right neighbour", async () => {
    mocks.invokeReadMarkdown.mockResolvedValue("x");
    const { result } = renderHook(() => useTabs());

    await act(async () => {
      await result.current.openPath("/a.md");
      await result.current.openPath("/b.md");
      await result.current.openPath("/c.md");
    });
    const [, bId] = result.current.tabs.map((t) => t.id);
    act(() => result.current.activate(bId ?? ""));

    await act(async () => {
      await result.current.closeTab(bId ?? "");
    });

    expect(result.current.tabs.map((t) => t.path)).toEqual(["/a.md", "/c.md"]);
    expect(result.current.activeTab?.path).toBe("/c.md");
  });

  it("closeOthers keeps only the specified tab", async () => {
    mocks.invokeReadMarkdown.mockResolvedValue("x");
    const { result } = renderHook(() => useTabs());

    await act(async () => {
      await result.current.openPath("/a.md");
      await result.current.openPath("/b.md");
      await result.current.openPath("/c.md");
    });
    const [, bId] = result.current.tabs.map((t) => t.id);

    await act(async () => {
      await result.current.closeOthers(bId ?? "");
    });

    expect(result.current.tabs.map((t) => t.path)).toEqual(["/b.md"]);
    expect(result.current.activeId).toBe(bId);
  });

  it("closeRight closes tabs to the right of the pivot", async () => {
    mocks.invokeReadMarkdown.mockResolvedValue("x");
    const { result } = renderHook(() => useTabs());

    await act(async () => {
      await result.current.openPath("/a.md");
      await result.current.openPath("/b.md");
      await result.current.openPath("/c.md");
      await result.current.openPath("/d.md");
    });
    const [, bId] = result.current.tabs.map((t) => t.id);

    await act(async () => {
      await result.current.closeRight(bId ?? "");
    });

    expect(result.current.tabs.map((t) => t.path)).toEqual(["/a.md", "/b.md"]);
  });

  it("closeAll drops every tab and remembers them for reopen", async () => {
    mocks.invokeReadMarkdown.mockResolvedValue("x");
    const { result } = renderHook(() => useTabs());

    await act(async () => {
      await result.current.openPath("/a.md");
      await result.current.openPath("/b.md");
    });

    await act(async () => {
      await result.current.closeAll();
    });

    expect(result.current.tabs).toHaveLength(0);
    expect(result.current.activeId).toBeNull();
    expect(result.current.recentlyClosed.map((c) => c.path)).toContain("/a.md");
    expect(result.current.recentlyClosed.map((c) => c.path)).toContain("/b.md");
  });

  it("reopenClosed pops the last closed tab and reopens it", async () => {
    mocks.invokeReadMarkdown.mockResolvedValue("hello");
    const { result } = renderHook(() => useTabs());

    await act(async () => {
      await result.current.openPath("/a.md");
    });
    const id = result.current.tabs[0]?.id ?? "";
    await act(async () => {
      await result.current.closeTab(id);
    });
    expect(result.current.tabs).toHaveLength(0);

    await act(async () => {
      await result.current.reopenClosed();
    });

    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.tabs[0]?.path).toBe("/a.md");
    expect(result.current.recentlyClosed).toHaveLength(0);
  });

  it("nextTab / prevTab wrap around", async () => {
    mocks.invokeReadMarkdown.mockResolvedValue("x");
    const { result } = renderHook(() => useTabs());

    await act(async () => {
      await result.current.openPath("/a.md");
      await result.current.openPath("/b.md");
      await result.current.openPath("/c.md");
    });
    // active is /c.md (last opened)
    act(() => result.current.nextTab());
    expect(result.current.activeTab?.path).toBe("/a.md");
    act(() => result.current.prevTab());
    expect(result.current.activeTab?.path).toBe("/c.md");
  });

  it("activateIndex clamps and jumps", async () => {
    mocks.invokeReadMarkdown.mockResolvedValue("x");
    const { result } = renderHook(() => useTabs());

    await act(async () => {
      await result.current.openPath("/a.md");
      await result.current.openPath("/b.md");
      await result.current.openPath("/c.md");
    });

    act(() => result.current.activateIndex(1));
    expect(result.current.activeTab?.path).toBe("/b.md");
    act(() => result.current.activateIndex(99));
    expect(result.current.activeTab?.path).toBe("/c.md");
  });

  it("activateLast jumps to the final tab", async () => {
    mocks.invokeReadMarkdown.mockResolvedValue("x");
    const { result } = renderHook(() => useTabs());

    await act(async () => {
      await result.current.openPath("/a.md");
      await result.current.openPath("/b.md");
      await result.current.openPath("/c.md");
    });

    act(() => result.current.activateIndex(0));
    act(() => result.current.activateLast());
    expect(result.current.activeTab?.path).toBe("/c.md");
  });

  it("moveTab reorders the list", async () => {
    mocks.invokeReadMarkdown.mockResolvedValue("x");
    const { result } = renderHook(() => useTabs());

    await act(async () => {
      await result.current.openPath("/a.md");
      await result.current.openPath("/b.md");
      await result.current.openPath("/c.md");
    });
    act(() => result.current.moveTab(0, 2));
    expect(result.current.tabs.map((t) => t.path)).toEqual(["/b.md", "/c.md", "/a.md"]);
  });

  it("toggleActiveMode flips mode on the active tab only", async () => {
    mocks.invokeReadMarkdown.mockResolvedValue("x");
    const { result } = renderHook(() => useTabs());

    await act(async () => {
      await result.current.openPath("/a.md");
      await result.current.openPath("/b.md");
    });
    act(() => result.current.toggleActiveMode());
    // active = /b.md
    expect(result.current.tabs[1]?.mode).toBe("edit");
    expect(result.current.tabs[0]?.mode).toBe("view");
  });

  it("setActiveSource writes to the active tab", async () => {
    mocks.invokeReadMarkdown.mockResolvedValue("orig");
    const { result } = renderHook(() => useTabs());

    await act(async () => {
      await result.current.openPath("/a.md");
    });
    act(() => result.current.setActiveSource("edited"));
    expect(result.current.tabs[0]?.source).toBe("edited");
  });

  it("error opens produce an error tab (no watch call)", async () => {
    mocks.invokeReadMarkdown.mockRejectedValue(new Error("ENOENT"));
    const { result } = renderHook(() => useTabs());

    await act(async () => {
      await result.current.openPath("/missing.md");
    });

    expect(result.current.tabs[0]).toMatchObject({ status: "error", error: "ENOENT" });
    expect(mocks.invokeWatchFile).not.toHaveBeenCalled();
  });

  it("file-changed re-reads only matching tabs", async () => {
    mocks.invokeReadMarkdown.mockResolvedValueOnce("a1");
    mocks.invokeReadMarkdown.mockResolvedValueOnce("b1");
    let registered: ((path: string) => void) | null = null;
    mocks.listenFileChanged.mockImplementation(async (handler) => {
      registered = handler;
      return () => {};
    });

    const { result } = renderHook(() => useTabs());
    await waitFor(() => expect(registered).not.toBeNull());

    await act(async () => {
      await result.current.openPath("/a.md");
      await result.current.openPath("/b.md");
    });

    mocks.invokeReadMarkdown.mockResolvedValueOnce("a2");
    await act(async () => {
      registered?.("/a.md");
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.tabs[0]?.source).toBe("a2"));
    expect(result.current.tabs[1]?.source).toBe("b1");
  });
});
