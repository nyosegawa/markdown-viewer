/**
 * Lightweight platform detection. We only distinguish macOS from everything
 * else because that is the split that matters for keyboard shortcut UX.
 */

export function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  // `navigator.platform` is deprecated but still the most reliable signal; fall
  // back to userAgent substring. `userAgentData.platform` is not universally
  // available at time of writing.
  const platform = navigator.platform ?? "";
  if (platform) return /mac/i.test(platform);
  return /Mac/i.test(navigator.userAgent ?? "");
}

export type ModifierKey = "mod" | "shift" | "alt" | "ctrl";

export interface Shortcut {
  keys: ModifierKey[];
  key: string;
}

const MAC_LABELS: Record<ModifierKey, string> = {
  mod: "⌘",
  shift: "⇧",
  alt: "⌥",
  ctrl: "⌃",
};

const PC_LABELS: Record<ModifierKey, string> = {
  mod: "Ctrl",
  shift: "Shift",
  alt: "Alt",
  ctrl: "Ctrl",
};

function prettyKey(key: string, mac: boolean): string {
  const map: Record<string, { mac: string; pc: string }> = {
    ArrowLeft: { mac: "←", pc: "←" },
    ArrowRight: { mac: "→", pc: "→" },
    ArrowUp: { mac: "↑", pc: "↑" },
    ArrowDown: { mac: "↓", pc: "↓" },
    Tab: { mac: "Tab", pc: "Tab" },
    Escape: { mac: "Esc", pc: "Esc" },
    Enter: { mac: "Return", pc: "Enter" },
    PageUp: { mac: "PageUp", pc: "PageUp" },
    PageDown: { mac: "PageDown", pc: "PageDown" },
  };
  const entry = map[key];
  if (entry) return mac ? entry.mac : entry.pc;
  return key.length === 1 ? key.toUpperCase() : key;
}

export function formatShortcut(shortcut: Shortcut, mac = isMac()): string {
  const labels = mac ? MAC_LABELS : PC_LABELS;
  const parts = shortcut.keys.map((k) => labels[k]);
  parts.push(prettyKey(shortcut.key, mac));
  return mac ? parts.join("") : parts.join("+");
}

/** Split a shortcut into its individual keycap tokens for UI rendering. */
export function shortcutTokens(shortcut: Shortcut, mac = isMac()): string[] {
  const labels = mac ? MAC_LABELS : PC_LABELS;
  return [...shortcut.keys.map((k) => labels[k]), prettyKey(shortcut.key, mac)];
}
