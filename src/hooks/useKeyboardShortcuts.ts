import { useEffect, useRef } from "react";
import { isMac } from "@/lib/platform";

export interface ShortcutHandlers {
  /** ⌘O / Ctrl+O */
  onOpenDialog: () => void;
  /** ⌘W / Ctrl+W */
  onCloseTab: () => void;
  /** ⌘⇧T / Ctrl+Shift+T */
  onReopenClosed: () => void;
  /** ⌃Tab / Ctrl+Tab (and Ctrl+PageDown on PC, ⌘⌥→ on mac) */
  onNextTab: () => void;
  /** ⌃⇧Tab / Ctrl+Shift+Tab (and Ctrl+PageUp on PC, ⌘⌥← on mac) */
  onPrevTab: () => void;
  /** ⌘1–⌘8 / Ctrl+1–8 */
  onJumpToIndex: (index: number) => void;
  /** ⌘9 / Ctrl+9 — jump to last tab */
  onJumpToLast: () => void;
  /** ⌘? / Ctrl+? / F1 */
  onShowHelp: () => void;
  /** Esc — only fires when no upstream handler intercepted it first. */
  onEscape: () => void;
}

function isTypingInFormField(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  // Keep the latest handlers in a ref so we don't re-bind on every render.
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const mac = isMac();

    function onKey(e: KeyboardEvent) {
      // Cross-platform modifier: we accept either ⌘ or Ctrl for "common"
      // shortcuts so muscle memory from both platforms works. This matches
      // what VS Code does on macOS.
      const mod = e.metaKey || e.ctrlKey;

      // Help (works even when typing, so users never feel trapped).
      // Primary: ⌘/ (Ctrl+/). We also accept Shift variant (⌘? = ⌘⇧/) for
      // users migrating from other apps, and F1 for PC muscle memory.
      if (e.key === "F1" || (mod && (e.key === "/" || e.key === "?"))) {
        e.preventDefault();
        handlersRef.current.onShowHelp();
        return;
      }

      // Skip shortcuts when focus is in a form field — users want native
      // text editing defaults there.
      if (isTypingInFormField(e.target)) return;

      // Escape fallback. Upstream Esc handlers run first (they attach before
      // this hook) so we only see unhandled Escs here.
      if (e.key === "Escape" && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        handlersRef.current.onEscape();
        return;
      }

      if (mod && !e.shiftKey && !e.altKey && (e.key === "o" || e.key === "O")) {
        e.preventDefault();
        handlersRef.current.onOpenDialog();
        return;
      }

      if (mod && !e.shiftKey && !e.altKey && (e.key === "w" || e.key === "W")) {
        e.preventDefault();
        handlersRef.current.onCloseTab();
        return;
      }

      if (mod && e.shiftKey && (e.key === "t" || e.key === "T")) {
        e.preventDefault();
        handlersRef.current.onReopenClosed();
        return;
      }

      // Ctrl+Tab / Ctrl+Shift+Tab — accepted on every platform.
      if (e.ctrlKey && e.key === "Tab") {
        e.preventDefault();
        if (e.shiftKey) handlersRef.current.onPrevTab();
        else handlersRef.current.onNextTab();
        return;
      }

      // PC extras.
      if (!mac && e.ctrlKey && e.key === "PageDown") {
        e.preventDefault();
        handlersRef.current.onNextTab();
        return;
      }
      if (!mac && e.ctrlKey && e.key === "PageUp") {
        e.preventDefault();
        handlersRef.current.onPrevTab();
        return;
      }

      // Mac extras: ⌘⌥→ / ⌘⌥←  (browser parity).
      if (mac && e.metaKey && e.altKey && e.key === "ArrowRight") {
        e.preventDefault();
        handlersRef.current.onNextTab();
        return;
      }
      if (mac && e.metaKey && e.altKey && e.key === "ArrowLeft") {
        e.preventDefault();
        handlersRef.current.onPrevTab();
        return;
      }

      // ⌘1 … ⌘8 (jump to index), ⌘9 (jump to last).
      if (mod && !e.shiftKey && !e.altKey && e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        if (e.key === "9") handlersRef.current.onJumpToLast();
        else handlersRef.current.onJumpToIndex(Number(e.key) - 1);
        return;
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
