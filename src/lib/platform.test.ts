import { describe, expect, it } from "vitest";
import { formatShortcut } from "./platform";

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
