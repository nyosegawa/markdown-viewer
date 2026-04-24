import { Fragment, useEffect, useMemo, useRef } from "react";
import { isMac, type Shortcut, shortcutTokens } from "@/lib/platform";

export interface ShortcutsHelpProps {
  open: boolean;
  onClose: () => void;
}

interface Row {
  label: string;
  shortcuts: Shortcut[];
  /** Additional PC-only alternative (e.g. Ctrl+PageDown). */
  pcExtras?: Shortcut[];
  /** Additional mac-only alternative (e.g. ⌘⌥→). */
  macExtras?: Shortcut[];
}

const ROWS: Row[] = [
  {
    label: "Open file (new tab)",
    shortcuts: [{ keys: ["mod"], key: "O" }],
  },
  {
    label: "Close current tab",
    shortcuts: [{ keys: ["mod"], key: "W" }],
  },
  {
    label: "Reopen closed tab",
    shortcuts: [{ keys: ["mod", "shift"], key: "T" }],
  },
  {
    label: "Next tab",
    shortcuts: [{ keys: ["ctrl"], key: "Tab" }],
    pcExtras: [{ keys: ["ctrl"], key: "PageDown" }],
    macExtras: [{ keys: ["mod", "alt"], key: "ArrowRight" }],
  },
  {
    label: "Previous tab",
    shortcuts: [{ keys: ["ctrl", "shift"], key: "Tab" }],
    pcExtras: [{ keys: ["ctrl"], key: "PageUp" }],
    macExtras: [{ keys: ["mod", "alt"], key: "ArrowLeft" }],
  },
  {
    label: "Jump to tab 1–8",
    shortcuts: [{ keys: ["mod"], key: "1" }],
  },
  {
    label: "Jump to last tab",
    shortcuts: [{ keys: ["mod"], key: "9" }],
  },
  {
    label: "Toggle view / edit",
    shortcuts: [],
  },
  {
    label: "Find in document",
    shortcuts: [{ keys: ["mod"], key: "F" }],
  },
  {
    label: "Shortcut help",
    shortcuts: [{ keys: ["mod"], key: "/" }],
    pcExtras: [{ keys: [], key: "F1" }],
  },
  {
    label: "Dismiss modal / search",
    shortcuts: [{ keys: [], key: "Escape" }],
  },
];

export function ShortcutsHelp({ open, onClose }: ShortcutsHelpProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const mac = useMemo(() => isMac(), []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    }
    // Capture-phase so we beat any nested Esc handler (search bar, etc.).
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    closeBtnRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: overlay is only a mouse dismiss target; Esc + close button cover keyboard.
    <div
      className="shortcut-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      data-testid="shortcut-overlay"
    >
      <div
        ref={dialogRef}
        className="shortcut-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcut-dialog-title"
        data-testid="shortcut-dialog"
      >
        <div className="shortcut-dialog-header">
          <h2 id="shortcut-dialog-title" className="shortcut-dialog-title">
            Keyboard shortcuts
          </h2>
          <button
            ref={closeBtnRef}
            type="button"
            className="shortcut-dialog-close"
            aria-label="Close"
            onClick={onClose}
            data-testid="shortcut-dialog-close"
          >
            ×
          </button>
        </div>
        <table className="shortcut-table">
          <tbody>
            {ROWS.map((row) => {
              const extras = mac ? row.macExtras : row.pcExtras;
              const all = [...row.shortcuts, ...(extras ?? [])];
              return (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  <td>
                    {all.length === 0 ? (
                      <span className="shortcut-none">—</span>
                    ) : (
                      all.map((sc, idx) => {
                        const tokens = shortcutTokens(sc, mac);
                        return (
                          <span
                            // biome-ignore lint/suspicious/noArrayIndexKey: static label list.
                            key={`${row.label}-${idx}`}
                            className="shortcut-keys"
                          >
                            {tokens.map((tok, tIdx) => (
                              // biome-ignore lint/suspicious/noArrayIndexKey: static token list.
                              <Fragment key={tIdx}>
                                {tIdx > 0 ? <span className="shortcut-plus">+</span> : null}
                                <kbd>{tok}</kbd>
                              </Fragment>
                            ))}
                            {idx < all.length - 1 ? <span className="shortcut-or">or</span> : null}
                          </span>
                        );
                      })
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
