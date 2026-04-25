import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Tab } from "@/hooks/useTabs";
import { formatShortcut, isMac, type Shortcut, TAB_SHORTCUTS } from "@/lib/platform";

// Min pixel distance before a pointerdown is promoted to a drag.
const DRAG_THRESHOLD_PX = 4;

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

interface DragState {
  fromIndex: number;
  pathLabel: string;
  x: number;
  y: number;
  // Insertion point in 0..tabs.length. `k` = "insert between tab k-1 and k".
  insertAt: number | null;
  started: boolean;
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
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const mac = useMemo(() => isMac(), []);
  const shortcutHint = useCallback((sc: Shortcut) => formatShortcut(sc, mac), [mac]);
  const [drag, setDrag] = useState<DragState | null>(null);
  // Mirror in a ref so document-level pointer listeners always see the
  // current value (closure capture makes setState-only variants stale).
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;
  // The spurious click that fires on pointerup after a successful drag
  // would re-activate the source tab; this flag swallows exactly one click.
  const suppressClickRef = useRef(false);

  const closeMenu = useCallback(() => {
    setMenu(null);
    setMenuPos(null);
  }, []);

  // Clamp menu position into the viewport once we know the menu's measured
  // size — opening at the raw click point causes overflow when the user
  // right-clicks near the right or bottom edge.
  useLayoutEffect(() => {
    if (!menu) {
      setMenuPos(null);
      return;
    }
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = rect.width || el.offsetWidth || 0;
    const height = rect.height || el.offsetHeight || 0;
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const maxX = Math.max(margin, vw - width - margin);
    const maxY = Math.max(margin, vh - height - margin);
    const x = Math.max(margin, Math.min(menu.x, maxX));
    const y = Math.max(margin, Math.min(menu.y, maxY));
    setMenuPos({ x, y });
  }, [menu]);

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

  const computeInsertAt = useCallback((clientX: number): number => {
    const bar = barRef.current;
    if (!bar) return 0;
    const rows = Array.from(bar.querySelectorAll<HTMLDivElement>('[data-role="tab"]'));
    if (rows.length === 0) return 0;
    for (let k = 0; k < rows.length; k++) {
      const r = rows[k].getBoundingClientRect();
      if (clientX < r.left + r.width / 2) return k;
    }
    return rows.length;
  }, []);

  // Pointer-based DnD. Tauri's `dragDropEnabled: true` consumes native drag
  // events at the window level and breaks HTML5 element DnD on macOS, so we
  // implement reordering with pointer events — completely independent of the
  // OS drag pipeline.
  const beginDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, index: number, t: Tab) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest(".tab-close")) return;
      const startX = e.clientX;
      const startY = e.clientY;
      const initial: DragState = {
        fromIndex: index,
        pathLabel: basename(t.path),
        x: startX,
        y: startY,
        insertAt: null,
        started: false,
      };
      dragRef.current = initial;
      setDrag(initial);

      const onMove = (ev: PointerEvent) => {
        const cur = dragRef.current;
        if (!cur) return;
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        let started = cur.started;
        if (!started) {
          if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
          started = true;
        }
        const insertAt = computeInsertAt(ev.clientX);
        const next: DragState = { ...cur, x: ev.clientX, y: ev.clientY, insertAt, started };
        dragRef.current = next;
        setDrag(next);
      };

      const teardown = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onCancelPtr);
        document.removeEventListener("keydown", onKey);
      };

      const finish = (commit: boolean) => {
        teardown();
        const cur = dragRef.current;
        dragRef.current = null;
        setDrag(null);
        if (!cur) return;
        if (commit && cur.started && cur.insertAt !== null) {
          let targetIdx = cur.insertAt;
          if (targetIdx > cur.fromIndex) targetIdx -= 1;
          if (targetIdx !== cur.fromIndex) onReorder(cur.fromIndex, targetIdx);
          suppressClickRef.current = true;
        }
      };

      const onUp = () => finish(true);
      const onCancelPtr = () => finish(false);
      const onKey = (ev: KeyboardEvent) => {
        if (ev.key === "Escape") finish(false);
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onCancelPtr);
      document.addEventListener("keydown", onKey);
    },
    [computeInsertAt, onReorder],
  );

  if (tabs.length === 0) return null;

  const menuIndex = menu?.tabIndex ?? -1;
  const hasRight = menuIndex >= 0 && menuIndex < tabs.length - 1;
  const hasOthers = tabs.length > 1;

  const activeDrag = drag?.started ? drag : null;
  // Hide the indicator for drops that are no-ops (onto either of the source's
  // own sides).
  const effectiveInsertAt = (() => {
    if (!activeDrag || activeDrag.insertAt === null) return null;
    const { fromIndex, insertAt } = activeDrag;
    if (insertAt === fromIndex || insertAt === fromIndex + 1) return null;
    return insertAt;
  })();

  return (
    <>
      <div
        className="tab-bar"
        role="tablist"
        aria-label="Open files"
        data-testid="tab-bar"
        ref={barRef}
      >
        {tabs.map((t, i) => {
          const isActive = t.id === activeId;
          const isDirty = t.status === "error";
          const isSource = activeDrag?.fromIndex === i;
          const showBefore = effectiveInsertAt === i;
          const showAfter = effectiveInsertAt === i + 1 && i === tabs.length - 1;
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
              data-role="tab"
              data-testid={`tab-${i}`}
              onPointerDown={(e) => beginDrag(e, i, t)}
              onClick={() => {
                if (suppressClickRef.current) {
                  suppressClickRef.current = false;
                  return;
                }
                onActivate(t.id);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onActivate(t.id);
                }
              }}
              onAuxClick={(e) => {
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
                onPointerDown={(e) => e.stopPropagation()}
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
            style={{
              left: menuPos?.x ?? menu.x,
              top: menuPos?.y ?? menu.y,
              visibility: menuPos ? "visible" : "hidden",
            }}
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
              <span className="tab-context-label">Close tab</span>
              <span className="tab-context-shortcut" aria-hidden="true">
                {shortcutHint(TAB_SHORTCUTS.closeTab)}
              </span>
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
              <span className="tab-context-label">Close other tabs</span>
              <span className="tab-context-shortcut" aria-hidden="true">
                {shortcutHint(TAB_SHORTCUTS.closeOthers)}
              </span>
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
              <span className="tab-context-label">Close tabs to the right</span>
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
              <span className="tab-context-label">Close all tabs</span>
              <span className="tab-context-shortcut" aria-hidden="true">
                {shortcutHint(TAB_SHORTCUTS.closeAll)}
              </span>
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
              <span className="tab-context-label">Copy path</span>
              <span className="tab-context-shortcut" aria-hidden="true">
                {shortcutHint(TAB_SHORTCUTS.copyPath)}
              </span>
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
              <span className="tab-context-label">Show in file manager</span>
              <span className="tab-context-shortcut" aria-hidden="true">
                {shortcutHint(TAB_SHORTCUTS.revealInFileManager)}
              </span>
            </button>
          </div>
        ) : null}
      </div>

      {activeDrag ? (
        <div
          className="tab-drag-ghost"
          style={{ transform: `translate(${activeDrag.x + 10}px, ${activeDrag.y + 8}px)` }}
          aria-hidden="true"
          data-testid="tab-drag-ghost"
        >
          {activeDrag.pathLabel}
        </div>
      ) : null}
    </>
  );
}
