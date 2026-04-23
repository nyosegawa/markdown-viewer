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

import { useMarkdownFile } from "./useMarkdownFile";

describe("useMarkdownFile", () => {
  beforeEach(() => {
    mocks.invokeReadMarkdown.mockReset();
    mocks.invokeWatchFile.mockReset().mockResolvedValue(undefined);
    mocks.invokeUnwatchFile.mockReset().mockResolvedValue(undefined);
    mocks.listenFileChanged.mockReset().mockResolvedValue(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("starts idle with no file", () => {
    const { result } = renderHook(() => useMarkdownFile());
    expect(result.current.file).toMatchObject({
      path: null,
      source: "",
      status: "idle",
      error: null,
    });
  });

  it("openPath transitions idle → ready and starts watching", async () => {
    mocks.invokeReadMarkdown.mockResolvedValue("# content\n");
    const { result } = renderHook(() => useMarkdownFile());

    await act(async () => {
      await result.current.openPath("/a.md");
    });

    expect(result.current.file).toMatchObject({
      path: "/a.md",
      source: "# content\n",
      status: "ready",
      error: null,
    });
    expect(mocks.invokeReadMarkdown).toHaveBeenCalledWith("/a.md");
    expect(mocks.invokeWatchFile).toHaveBeenCalledWith("/a.md");
  });

  it("openPath with a read failure transitions to error", async () => {
    mocks.invokeReadMarkdown.mockRejectedValue(new Error("ENOENT"));
    const { result } = renderHook(() => useMarkdownFile());

    await act(async () => {
      await result.current.openPath("/missing.md");
    });

    expect(result.current.file.status).toBe("error");
    expect(result.current.file.error).toBe("ENOENT");
    expect(result.current.file.source).toBe("");
    // watch should NOT start on error
    expect(mocks.invokeWatchFile).not.toHaveBeenCalled();
  });

  it("setInlineSource updates the source without touching path / status", async () => {
    mocks.invokeReadMarkdown.mockResolvedValue("orig");
    const { result } = renderHook(() => useMarkdownFile());

    await act(async () => {
      await result.current.openPath("/a.md");
    });

    act(() => result.current.setInlineSource("edited"));
    expect(result.current.file).toMatchObject({
      path: "/a.md",
      source: "edited",
      status: "ready",
    });
  });

  it("closeFile resets state and calls unwatch", async () => {
    mocks.invokeReadMarkdown.mockResolvedValue("x");
    const { result } = renderHook(() => useMarkdownFile());

    await act(async () => {
      await result.current.openPath("/a.md");
    });
    await act(async () => {
      await result.current.closeFile();
    });

    expect(mocks.invokeUnwatchFile).toHaveBeenCalled();
    expect(result.current.file.path).toBeNull();
    expect(result.current.file.status).toBe("idle");
  });

  it("file-changed event for the current path re-reads source", async () => {
    mocks.invokeReadMarkdown.mockResolvedValueOnce("first").mockResolvedValueOnce("second");
    let registered: ((path: string) => void) | null = null;
    mocks.listenFileChanged.mockImplementation(async (handler) => {
      registered = handler;
      return () => {};
    });

    const { result } = renderHook(() => useMarkdownFile());
    await waitFor(() => expect(registered).not.toBeNull());

    await act(async () => {
      await result.current.openPath("/a.md");
    });
    expect(result.current.file.source).toBe("first");

    await act(async () => {
      registered?.("/a.md");
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.file.source).toBe("second"));
  });

  it("unmount triggers the unlisten cleanup", async () => {
    const unlisten = vi.fn();
    mocks.listenFileChanged.mockResolvedValue(unlisten);
    const { unmount } = renderHook(() => useMarkdownFile());
    await waitFor(() => expect(mocks.listenFileChanged).toHaveBeenCalled());
    unmount();
    expect(unlisten).toHaveBeenCalled();
  });
});
