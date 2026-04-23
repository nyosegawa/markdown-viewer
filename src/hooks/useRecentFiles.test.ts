import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { MAX_RECENT, useRecentFiles } from "./useRecentFiles";

describe("useRecentFiles", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("starts empty when nothing is stored", () => {
    const { result } = renderHook(() => useRecentFiles());
    expect(result.current.recent).toEqual([]);
  });

  it("adds new paths to the front and dedupes", () => {
    const { result } = renderHook(() => useRecentFiles());
    act(() => result.current.addRecent("/a.md"));
    act(() => result.current.addRecent("/b.md"));
    act(() => result.current.addRecent("/a.md"));
    expect(result.current.recent).toEqual(["/a.md", "/b.md"]);
  });

  it("caps the list at MAX_RECENT entries", () => {
    const { result } = renderHook(() => useRecentFiles());
    for (let i = 0; i < MAX_RECENT + 3; i++) {
      const path = `/file-${i}.md`;
      act(() => result.current.addRecent(path));
    }
    expect(result.current.recent).toHaveLength(MAX_RECENT);
    expect(result.current.recent[0]).toBe(`/file-${MAX_RECENT + 2}.md`);
  });

  it("clearRecent empties the list", () => {
    const { result } = renderHook(() => useRecentFiles());
    act(() => result.current.addRecent("/a.md"));
    act(() => result.current.clearRecent());
    expect(result.current.recent).toEqual([]);
  });

  it("persists entries to localStorage", () => {
    const { result } = renderHook(() => useRecentFiles());
    act(() => result.current.addRecent("/a.md"));
    expect(window.localStorage.getItem("mdv.recentFiles")).toBe(JSON.stringify(["/a.md"]));
  });
});
