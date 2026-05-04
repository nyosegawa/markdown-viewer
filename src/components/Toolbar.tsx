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
  onShowHelp?: () => void;
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

function FileOpenIcon() {
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
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M10 14h7" />
      <path d="M14 11l3 3-3 3" />
    </svg>
  );
}

function HistoryIcon() {
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
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function PencilIcon() {
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
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

function EyeIcon() {
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
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
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
  onShowHelp,
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
        <button
          type="button"
          className="toolbar-btn toolbar-icon-btn"
          onClick={onOpen}
          aria-label="Open file"
          title="Open file"
          data-testid="open-btn"
        >
          <FileOpenIcon />
        </button>

        <div className="recent-menu" ref={menuRef}>
          <button
            type="button"
            className="toolbar-btn toolbar-icon-btn"
            onClick={() => setRecentOpen((v) => !v)}
            aria-label="Open recent files"
            aria-haspopup="menu"
            aria-expanded={recentOpen}
            disabled={recent.length === 0}
            title="Recent files"
            data-testid="recent-btn"
          >
            <HistoryIcon />
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
          className="toolbar-btn toolbar-icon-btn"
          onClick={onToggleMode}
          aria-label={mode === "edit" ? "Switch to view mode" : "Switch to edit mode"}
          aria-pressed={mode === "edit"}
          disabled={path === null}
          title={mode === "edit" ? "View mode" : "Edit mode"}
          data-testid="mode-btn"
        >
          {mode === "edit" ? <EyeIcon /> : <PencilIcon />}
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

        {onShowHelp ? (
          <button
            type="button"
            className="toolbar-btn toolbar-icon-btn"
            onClick={onShowHelp}
            aria-label="Show keyboard shortcuts"
            title="Keyboard shortcuts"
            data-testid="help-btn"
          >
            <svg
              className="toolbar-btn-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              style={{ width: 16, height: 16 }}
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 1-1 1.7" />
              <circle cx="12" cy="17" r="0.6" fill="currentColor" />
            </svg>
          </button>
        ) : null}
      </div>
    </header>
  );
}
