import { useEffect, useRef, useState } from "react";
import type { Theme } from "@/hooks/useTheme";

export type ViewMode = "view" | "edit";

export interface ToolbarProps {
  path: string | null;
  mode: ViewMode;
  onToggleMode: () => void;
  onOpen: () => void;
  theme: Theme;
  onToggleTheme: () => void;
  recent: string[];
  onPickRecent: (path: string) => void;
  onClearRecent: () => void;
}

function basename(path: string): string {
  const clean = path.replace(/[/\\]+$/, "");
  const parts = clean.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

export function Toolbar({
  path,
  mode,
  onToggleMode,
  onOpen,
  theme,
  onToggleTheme,
  recent,
  onPickRecent,
  onClearRecent,
}: ToolbarProps) {
  const [recentOpen, setRecentOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!recentOpen) return;
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setRecentOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setRecentOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [recentOpen]);

  return (
    <header className="toolbar" role="toolbar" aria-label="Main toolbar">
      <button type="button" className="toolbar-btn" onClick={onOpen} data-testid="open-btn">
        Open
      </button>

      <div className="recent-menu" ref={menuRef}>
        <button
          type="button"
          className="toolbar-btn"
          onClick={() => setRecentOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={recentOpen}
          disabled={recent.length === 0}
          data-testid="recent-btn"
        >
          Recent ▾
        </button>
        {recentOpen && recent.length > 0 ? (
          <div className="recent-menu-list" data-testid="recent-list">
            {recent.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  onPickRecent(p);
                  setRecentOpen(false);
                }}
                title={p}
              >
                {basename(p)}
              </button>
            ))}
            <div
              style={{
                borderTop: "1px solid var(--color-surface-border)",
                marginTop: "4px",
                paddingTop: "4px",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  onClearRecent();
                  setRecentOpen(false);
                }}
              >
                Clear recent
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        className="toolbar-btn"
        onClick={onToggleMode}
        aria-pressed={mode === "edit"}
        disabled={path === null}
        data-testid="mode-btn"
      >
        {mode === "edit" ? "Viewing" : "Edit"}
      </button>

      <span className="toolbar-title" data-testid="title">
        {path ? basename(path) : "No file"}
      </span>

      <button
        type="button"
        className="toolbar-btn"
        onClick={onToggleTheme}
        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
        data-testid="theme-btn"
      >
        {theme === "dark" ? "Light" : "Dark"}
      </button>
    </header>
  );
}
