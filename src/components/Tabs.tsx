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
  // Drag source index (0..N-1). Kept as a ref so dragover handlers always see
  // the current value; using state-only caused stale-closure dragovers to skip
  // preventDefault, which disabled drops entirely.
  const dragFromRef = useRef<number | null>(null);
  const dropAtRef = useRef<number | null>(null);
  const [dragFromIdx, setDragFromIdx] = useState<number | null>(null);
  // Drop *insertion* index in 0..tabs.length. dropAt = k means "insert between
  // tab k-1 and tab k"; dropAt = 0 = before first, dropAt = N = after last.
  const [dropAt, setDropAt] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const clearDrag = useCallback(() => {
    dragFromRef.current = null;
    dropAtRef.current = null;
    setDragFromIdx(null);
    setDropAt(null);
  }, []);

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
    <div
      className="tab-bar"
      role="tablist"
      aria-label="Open files"
      data-testid="tab-bar"
      onDragOver={(e) => {
        if (dragFromRef.current === null) return;
        // Allow dropping in the empty space after the last tab.
        const target = e.target as HTMLElement;
        if (!target.closest(".tab")) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          const insertAt = tabs.length;
          if (dropAtRef.current !== insertAt) {
            dropAtRef.current = insertAt;
            setDropAt(insertAt);
          }
        }
      }}
      onDrop={(e) => {
        if (dragFromRef.current === null) return;
        const target = e.target as HTMLElement;
        if (target.closest(".tab")) return; // Per-tab handler wins.
        e.preventDefault();
        const from = dragFromRef.current;
        const to = dropAtRef.current ?? tabs.length;
        clearDrag();
        let dest = to;
        if (dest > from) dest -= 1;
        if (dest !== from) onReorder(from, dest);
      }}
      onDragLeave={(e) => {
        // Clear preview when the pointer leaves the tabbar entirely.
        if (
          dragFromRef.current !== null &&
          !e.currentTarget.contains(e.relatedTarget as Node | null)
        ) {
          dropAtRef.current = null;
          setDropAt(null);
        }
      }}
    >
      {tabs.map((t, i) => {
        const isActive = t.id === activeId;
        const isDirty = t.status === "error";
        const isSource = dragFromIdx === i;
        // Suppress the drop indicator for no-op drops (dropping a tab onto
        // either of its own sides).
        const effectiveDropAt =
          dropAt !== null &&
          dragFromIdx !== null &&
          (dropAt === dragFromIdx || dropAt === dragFromIdx + 1)
            ? null
            : dropAt;
        const showBefore = effectiveDropAt === i;
        const showAfter = effectiveDropAt === i + 1 && i === tabs.length - 1;
        const classes = [
          "tab",
          isActive ? "is-active" : "",
          isSource ? "is-dragging" : "",
          showBefore ? "is-drop-before" : "",
          showAfter ? "is-drop-after" : "",
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
              dragFromRef.current = i;
              setDragFromIdx(i);
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", String(i));
            }}
            onDragOver={(e) => {
              if (dragFromRef.current === null) return;
              // Must preventDefault on every dragover to mark the element as
              // a valid drop target — otherwise the browser disallows drop.
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              const rect = e.currentTarget.getBoundingClientRect();
              const isLeftHalf = e.clientX < rect.left + rect.width / 2;
              const insertAt = isLeftHalf ? i : i + 1;
              if (dropAtRef.current !== insertAt) {
                dropAtRef.current = insertAt;
                setDropAt(insertAt);
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              const from = dragFromRef.current;
              const to = dropAtRef.current;
              clearDrag();
              if (from === null || to === null) return;
              // `to` is the *insertion* index. When removing `from` first,
              // any target at a higher index shifts left by 1.
              let target = to;
              if (target > from) target -= 1;
              if (target !== from) onReorder(from, target);
            }}
            onDragEnd={clearDrag}
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
