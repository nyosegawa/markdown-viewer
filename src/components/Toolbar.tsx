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

function dirname(path: string): string {
  const clean = path.replace(/[/\\]+$/, "");
  const parts = clean.split(/[\\/]/);
  parts.pop();
  return parts.join("/");
}

function SunIcon() {
  return (
    <svg
      className="toolbar-btn-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className="toolbar-btn-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
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
    <header className="toolbar" role="toolbar" aria-label="Main toolbar" data-tauri-drag-region>
      <div className="toolbar-group">
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
            Recent
            <svg
              className="toolbar-btn-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              style={{ width: 10, height: 10, marginLeft: 2 }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {recentOpen && recent.length > 0 ? (
            <div className="recent-menu-list" data-testid="recent-list">
              {recent.map((p) => (
                <button
                  key={p}
                  type="button"
                  className="recent-menu-item"
                  onClick={() => {
                    onPickRecent(p);
                    setRecentOpen(false);
                  }}
                  title={p}
                >
                  <span className="name">{basename(p)}</span>
                  <span className="dir">{dirname(p)}</span>
                </button>
              ))}
              <div className="recent-menu-divider" />
              <button
                type="button"
                className="recent-menu-clear"
                onClick={() => {
                  onClearRecent();
                  setRecentOpen(false);
                }}
              >
                Clear recent
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <span className="toolbar-title" data-testid="title">
        {path ? basename(path) : "No file"}
      </span>

      <div className="toolbar-group">
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

        <button
          type="button"
          className="toolbar-btn toolbar-icon-btn"
          onClick={onToggleTheme}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          data-testid="theme-btn"
        >
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
        </button>
      </div>
    </header>
  );
}
