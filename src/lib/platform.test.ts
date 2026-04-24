import { describe, expect, it } from "vitest";
import { formatShortcut, shortcutTokens } from "./platform";

describe("formatShortcut", () => {
  it("renders mac labels without separators", () => {
    expect(formatShortcut({ keys: ["mod"], key: "O" }, true)).toBe("⌘O");
    expect(formatShortcut({ keys: ["mod", "shift"], key: "T" }, true)).toBe("⌘⇧T");
    expect(formatShortcut({ keys: ["ctrl"], key: "Tab" }, true)).toBe("⌃Tab");
    expect(formatShortcut({ keys: ["mod", "alt"], key: "ArrowRight" }, true)).toBe("⌘⌥→");
  });

  it("renders PC labels joined with '+'", () => {
    expect(formatShortcut({ keys: ["mod"], key: "O" }, false)).toBe("Ctrl+O");
    expect(formatShortcut({ keys: ["mod", "shift"], key: "T" }, false)).toBe("Ctrl+Shift+T");
    expect(formatShortcut({ keys: ["ctrl"], key: "PageDown" }, false)).toBe("Ctrl+PageDown");
  });

  it("renders plain keys with no modifier", () => {
    expect(formatShortcut({ keys: [], key: "F1" }, false)).toBe("F1");
    expect(formatShortcut({ keys: [], key: "Escape" }, false)).toBe("Esc");
  });
});

describe("shortcutTokens", () => {
  it("splits a mac shortcut into discrete keycap tokens", () => {
    expect(shortcutTokens({ keys: ["mod"], key: "O" }, true)).toEqual(["⌘", "O"]);
    expect(shortcutTokens({ keys: ["mod", "shift"], key: "T" }, true)).toEqual(["⌘", "⇧", "T"]);
    expect(shortcutTokens({ keys: ["mod", "alt"], key: "ArrowRight" }, true)).toEqual([
      "⌘",
      "⌥",
      "→",
    ]);
  });

  it("splits a PC shortcut into discrete keycap tokens with full words", () => {
    expect(shortcutTokens({ keys: ["mod"], key: "O" }, false)).toEqual(["Ctrl", "O"]);
    expect(shortcutTokens({ keys: ["mod", "shift"], key: "T" }, false)).toEqual([
      "Ctrl",
      "Shift",
      "T",
    ]);
    expect(shortcutTokens({ keys: [], key: "F1" }, false)).toEqual(["F1"]);
  });
});
