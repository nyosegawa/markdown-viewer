import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readStoredTabs, TABS_STORAGE_KEY, useTabPersistence } from "./useTabPersistence";

describe("useTabPersistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    window.localStorage.clear();
  });

  it("writes paths + active index when tabs are present", () => {
    renderHook(() => useTabPersistence(["/a.md", "/b.md"], 1));
    const raw = window.localStorage.getItem(TABS_STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw ?? "{}")).toEqual({ paths: ["/a.md", "/b.md"], activeIndex: 1 });
  });

  it("removes the key when tabs are empty", () => {
    window.localStorage.setItem(TABS_STORAGE_KEY, "seed");
    renderHook(() => useTabPersistence([], 0));
    expect(window.localStorage.getItem(TABS_STORAGE_KEY)).toBeNull();
  });

  it("readStoredTabs round-trips a valid payload", () => {
    window.localStorage.setItem(
      TABS_STORAGE_KEY,
      JSON.stringify({ paths: ["/a.md", "/b.md"], activeIndex: 1 }),
    );
    expect(readStoredTabs()).toEqual({ paths: ["/a.md", "/b.md"], activeIndex: 1 });
  });

  it("readStoredTabs clamps the active index", () => {
    window.localStorage.setItem(
      TABS_STORAGE_KEY,
      JSON.stringify({ paths: ["/a.md"], activeIndex: 99 }),
    );
    expect(readStoredTabs()?.activeIndex).toBe(0);
  });

  it("readStoredTabs returns null for broken JSON", () => {
    window.localStorage.setItem(TABS_STORAGE_KEY, "{not-json");
    expect(readStoredTabs()).toBeNull();
  });

  it("readStoredTabs returns null when paths is empty", () => {
    window.localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify({ paths: [], activeIndex: 0 }));
    expect(readStoredTabs()).toBeNull();
  });
});
