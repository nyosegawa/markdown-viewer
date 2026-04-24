import { useCallback, useEffect, useRef, useState } from "react";
import type { Tab } from "@/hooks/useTabs";

export interface TabsProps {
  tabs: Tab[];
  activeId: string | null;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onCloseOthers: (id: string) => void;
  onCloseRight: (id: string) => void;
  onCloseAll: () => void;
  onCopyPath: (path: string) => void;
  onRevealInFileManager: (path: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

function basename(path: string): string {
  const clean = path.replace(/[/\\]+$/, "");
  const parts = clean.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

interface MenuState {
  tabId: string;
  tabIndex: number;
  tabPath: string;
  x: number;
  y: number;
}

export function Tabs({
  tabs,
  activeId,
  onActivate,
  onClose,
  onCloseOthers,
  onCloseRight,
  onCloseAll,
  onCopyPath,
  onRevealInFileManager,
  onReorder,
}: TabsProps) {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => setMenu(null), []);

  useEffect(() => {
    if (!menu) return;
    function onDocDown(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) closeMenu();
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") closeMenu();
    }
    function onBlur() {
      closeMenu();
    }
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onEsc);
    window.addEventListener("blur", onBlur);
    window.addEventListener("resize", onBlur);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onEsc);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("resize", onBlur);
    };
  }, [menu, closeMenu]);

  if (tabs.length === 0) return null;

  const menuIndex = menu?.tabIndex ?? -1;
  const hasRight = menuIndex >= 0 && menuIndex < tabs.length - 1;
  const hasOthers = tabs.length > 1;

  return (
    <div className="tab-bar" role="tablist" aria-label="Open files" data-testid="tab-bar">
      {tabs.map((t, i) => {
        const isActive = t.id === activeId;
        const isDirty = t.status === "error";
        const classes = [
          "tab",
          isActive ? "is-active" : "",
          dragOverIndex === i && dragIndex !== null && dragIndex !== i ? "is-drop-target" : "",
          dragIndex === i ? "is-dragging" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <div
            key={t.id}
            role="tab"
            tabIndex={isActive ? 0 : -1}
            aria-selected={isActive}
            className={classes}
            title={t.path}
            draggable
            onClick={() => onActivate(t.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onActivate(t.id);
              }
            }}
            onAuxClick={(e) => {
              // Middle-click closes.
              if (e.button === 1) {
                e.preventDefault();
                onClose(t.id);
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenu({
                tabId: t.id,
                tabIndex: i,
                tabPath: t.path,
                x: e.clientX,
                y: e.clientY,
              });
            }}
            onDragStart={(e) => {
              setDragIndex(i);
              e.dataTransfer.effectAllowed = "move";
              try {
                e.dataTransfer.setData("text/plain", String(i));
              } catch {
                /* some browsers disallow */
              }
            }}
            onDragOver={(e) => {
              if (dragIndex === null) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (dragOverIndex !== i) setDragOverIndex(i);
            }}
            onDragLeave={() => {
              if (dragOverIndex === i) setDragOverIndex(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragIndex !== null && dragIndex !== i) onReorder(dragIndex, i);
              setDragIndex(null);
              setDragOverIndex(null);
            }}
            onDragEnd={() => {
              setDragIndex(null);
              setDragOverIndex(null);
            }}
            data-testid={`tab-${i}`}
          >
            <span className="tab-label">{basename(t.path)}</span>
            <button
              type="button"
              className="tab-close"
              aria-label={`Close ${basename(t.path)}`}
              onClick={(e) => {
                e.stopPropagation();
                onClose(t.id);
              }}
              tabIndex={-1}
              data-testid={`tab-close-${i}`}
            >
              {isDirty ? "!" : "×"}
            </button>
          </div>
        );
      })}

      {menu ? (
        <div
          ref={menuRef}
          className="tab-context-menu"
          style={{ left: menu.x, top: menu.y }}
          role="menu"
          data-testid="tab-context-menu"
        >
          <button
            type="button"
            role="menuitem"
            className="tab-context-item"
            onClick={() => {
              onClose(menu.tabId);
              closeMenu();
            }}
          >
            Close tab
          </button>
          <button
            type="button"
            role="menuitem"
            className="tab-context-item"
            disabled={!hasOthers}
            onClick={() => {
              onCloseOthers(menu.tabId);
              closeMenu();
            }}
          >
            Close other tabs
          </button>
          <button
            type="button"
            role="menuitem"
            className="tab-context-item"
            disabled={!hasRight}
            onClick={() => {
              onCloseRight(menu.tabId);
              closeMenu();
            }}
          >
            Close tabs to the right
          </button>
          <button
            type="button"
            role="menuitem"
            className="tab-context-item"
            onClick={() => {
              onCloseAll();
              closeMenu();
            }}
          >
            Close all tabs
          </button>
          <div className="tab-context-divider" />
          <button
            type="button"
            role="menuitem"
            className="tab-context-item"
            onClick={() => {
              onCopyPath(menu.tabPath);
              closeMenu();
            }}
          >
            Copy path
          </button>
          <button
            type="button"
            role="menuitem"
            className="tab-context-item"
            onClick={() => {
              onRevealInFileManager(menu.tabPath);
              closeMenu();
            }}
          >
            Show in file manager
          </button>
        </div>
      ) : null}
    </div>
  );
}
