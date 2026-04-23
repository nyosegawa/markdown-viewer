import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useTheme } from "./useTheme";

describe("useTheme", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
    window.localStorage.clear();
  });

  it("applies data-theme on the root element", () => {
    const { result } = renderHook(() => useTheme());
    expect(["light", "dark"]).toContain(document.documentElement.getAttribute("data-theme"));
    expect(["light", "dark"]).toContain(result.current.theme);
  });

  it("toggleTheme flips between light and dark", () => {
    const { result } = renderHook(() => useTheme());
    const before = result.current.theme;
    act(() => result.current.toggleTheme());
    expect(result.current.theme).not.toBe(before);
    expect(document.documentElement.getAttribute("data-theme")).toBe(result.current.theme);
  });

  it("persists the selected theme to localStorage", () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setTheme("light"));
    expect(window.localStorage.getItem("mdv.theme")).toBe("light");
    act(() => result.current.setTheme("dark"));
    expect(window.localStorage.getItem("mdv.theme")).toBe("dark");
  });

  it("reads the stored theme on initial mount", () => {
    window.localStorage.setItem("mdv.theme", "light");
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
});
