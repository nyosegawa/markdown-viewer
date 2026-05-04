import { useCallback, useEffect, useRef, useState } from "react";
import {
  invokeReadMarkdown,
  invokeUnwatchFile,
  invokeWatchFile,
  listenFileChanged,
} from "@/lib/tauri";

export type TabStatus = "loading" | "ready" | "error";
export type TabMode = "view" | "edit";

export interface Tab {
  id: string;
  path: string;
  source: string;
  status: TabStatus;
  error: string | null;
  mode: TabMode;
}

export interface ClosedTab {
  path: string;
  insertIndex: number;
}

export interface TabsState {
  tabs: Tab[];
  activeId: string | null;
  recentlyClosed: ClosedTab[];
}

const EMPTY: TabsState = {
  tabs: [],
  activeId: null,
  recentlyClosed: [],
};

const MAX_RECENTLY_CLOSED = 20;

function genId(): string {
  return `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useTabs() {
  const [state, setState] = useState<TabsState>(EMPTY);
  const stateRef = useRef(state);
  stateRef.current = state;

  const openPath = useCallback(async (path: string): Promise<string | null> => {
    if (!path) return null;

    // If already open, just activate it.
    const existing = stateRef.current.tabs.find((t) => t.path === path);
    if (existing) {
      setState((prev) => ({ ...prev, activeId: existing.id }));
      return existing.id;
    }

    const id = genId();
    setState((prev) => ({
      ...prev,
      tabs: [...prev.tabs, { id, path, source: "", status: "loading", error: null, mode: "view" }],
      activeId: id,
    }));

    try {
      const source = await invokeReadMarkdown(path);
      setState((prev) => ({
        ...prev,
        tabs: prev.tabs.map((t) =>
          t.id === id ? { ...t, source, status: "ready", error: null } : t,
        ),
      }));
      try {
        await invokeWatchFile(path);
      } catch (err) {
        console.warn("watch_file failed", err);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState((prev) => ({
        ...prev,
        tabs: prev.tabs.map((t) =>
          t.id === id ? { ...t, source: "", status: "error", error: message } : t,
        ),
      }));
    }
    return id;
  }, []);

  const activate = useCallback((id: string) => {
    setState((prev) => (prev.tabs.some((t) => t.id === id) ? { ...prev, activeId: id } : prev));
  }, []);

  const activateIndex = useCallback((index: number) => {
    setState((prev) => {
      if (prev.tabs.length === 0) return prev;
      const clamped = Math.max(0, Math.min(index, prev.tabs.length - 1));
      const next = prev.tabs[clamped];
      return next ? { ...prev, activeId: next.id } : prev;
    });
  }, []);

  const activateLast = useCallback(() => {
    setState((prev) => {
      if (prev.tabs.length === 0) return prev;
      const last = prev.tabs[prev.tabs.length - 1];
      return last ? { ...prev, activeId: last.id } : prev;
    });
  }, []);

  const rotate = useCallback((direction: 1 | -1) => {
    setState((prev) => {
      if (prev.tabs.length === 0 || prev.activeId === null) return prev;
      const idx = prev.tabs.findIndex((t) => t.id === prev.activeId);
      if (idx < 0) return prev;
      const len = prev.tabs.length;
      const next = prev.tabs[(idx + direction + len) % len];
      return next ? { ...prev, activeId: next.id } : prev;
    });
  }, []);

  const nextTab = useCallback(() => rotate(1), [rotate]);
  const prevTab = useCallback(() => rotate(-1), [rotate]);

  const closeTab = useCallback(async (id: string) => {
    const current = stateRef.current;
    const idx = current.tabs.findIndex((t) => t.id === id);
    const removed = idx >= 0 ? current.tabs[idx] : null;
    if (!removed) return;

    setState((prev) => {
      const i = prev.tabs.findIndex((t) => t.id === id);
      if (i < 0) return prev;
      const gone = prev.tabs[i];
      if (!gone) return prev;
      const nextTabs = prev.tabs.filter((t) => t.id !== id);
      let nextActive = prev.activeId;
      if (prev.activeId === id) {
        const neighbor = nextTabs[i] ?? nextTabs[i - 1] ?? null;
        nextActive = neighbor?.id ?? null;
      }
      return {
        tabs: nextTabs,
        activeId: nextActive,
        recentlyClosed: [{ path: gone.path, insertIndex: i }, ...prev.recentlyClosed].slice(
          0,
          MAX_RECENTLY_CLOSED,
        ),
      };
    });
    try {
      await invokeUnwatchFile(removed.path);
    } catch {
      /* ignore */
    }
  }, []);

  const closeOthers = useCallback(async (keepId: string) => {
    const current = stateRef.current;
    const keeper = current.tabs.find((t) => t.id === keepId);
    if (!keeper) return;
    const removedPaths = current.tabs.filter((t) => t.id !== keepId).map((t) => t.path);
    const closedEntries: ClosedTab[] = current.tabs
      .filter((t) => t.id !== keepId)
      .map((t, i) => ({ path: t.path, insertIndex: i }));

    setState((prev) => ({
      tabs: prev.tabs.filter((t) => t.id === keepId),
      activeId: keepId,
      recentlyClosed: [...closedEntries, ...prev.recentlyClosed].slice(0, MAX_RECENTLY_CLOSED),
    }));
    for (const p of removedPaths) {
      try {
        await invokeUnwatchFile(p);
      } catch {
        /* ignore */
      }
    }
  }, []);

  const closeRight = useCallback(async (pivotId: string) => {
    const current = stateRef.current;
    const idx = current.tabs.findIndex((t) => t.id === pivotId);
    if (idx < 0) return;
    const closed = current.tabs.slice(idx + 1);
    const removedPaths = closed.map((t) => t.path);
    const closedEntries: ClosedTab[] = closed.map((t, i) => ({
      path: t.path,
      insertIndex: idx + 1 + i,
    }));

    setState((prev) => {
      const i = prev.tabs.findIndex((t) => t.id === pivotId);
      if (i < 0) return prev;
      const kept = prev.tabs.slice(0, i + 1);
      const nextActive =
        prev.activeId && kept.some((t) => t.id === prev.activeId) ? prev.activeId : pivotId;
      return {
        tabs: kept,
        activeId: nextActive,
        recentlyClosed: [...closedEntries, ...prev.recentlyClosed].slice(0, MAX_RECENTLY_CLOSED),
      };
    });
    for (const p of removedPaths) {
      try {
        await invokeUnwatchFile(p);
      } catch {
        /* ignore */
      }
    }
  }, []);

  const closeAll = useCallback(async () => {
    const current = stateRef.current;
    const removedPaths = current.tabs.map((t) => t.path);
    const closedEntries: ClosedTab[] = current.tabs.map((t, i) => ({
      path: t.path,
      insertIndex: i,
    }));

    setState((prev) => ({
      tabs: [],
      activeId: null,
      recentlyClosed: [...closedEntries, ...prev.recentlyClosed].slice(0, MAX_RECENTLY_CLOSED),
    }));
    for (const p of removedPaths) {
      try {
        await invokeUnwatchFile(p);
      } catch {
        /* ignore */
      }
    }
  }, []);

  const reopenClosed = useCallback(async () => {
    const pop = stateRef.current.recentlyClosed[0];
    if (!pop) return;
    setState((prev) => ({ ...prev, recentlyClosed: prev.recentlyClosed.slice(1) }));
    await openPath(pop.path);
  }, [openPath]);

  const moveTab = useCallback((fromIndex: number, toIndex: number) => {
    setState((prev) => {
      if (fromIndex === toIndex) return prev;
      if (fromIndex < 0 || fromIndex >= prev.tabs.length) return prev;
      const bounded = Math.max(0, Math.min(toIndex, prev.tabs.length - 1));
      if (fromIndex === bounded) return prev;
      const next = prev.tabs.slice();
      const [moved] = next.splice(fromIndex, 1);
      if (!moved) return prev;
      next.splice(bounded, 0, moved);
      return { ...prev, tabs: next };
    });
  }, []);

  const setActiveMode = useCallback((mode: TabMode) => {
    setState((prev) => {
      if (prev.activeId === null) return prev;
      return {
        ...prev,
        tabs: prev.tabs.map((t) => (t.id === prev.activeId ? { ...t, mode } : t)),
      };
    });
  }, []);

  const toggleActiveMode = useCallback(() => {
    setState((prev) => {
      if (prev.activeId === null) return prev;
      return {
        ...prev,
        tabs: prev.tabs.map((t) =>
          t.id === prev.activeId ? { ...t, mode: t.mode === "view" ? "edit" : "view" } : t,
        ),
      };
    });
  }, []);

  const setActiveSource = useCallback((source: string) => {
    setState((prev) => {
      if (prev.activeId === null) return prev;
      return {
        ...prev,
        tabs: prev.tabs.map((t) =>
          t.id === prev.activeId ? { ...t, source, status: "ready", error: null } : t,
        ),
      };
    });
  }, []);

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | null = null;
    listenFileChanged((changedPath, canonicalPath) => {
      const matches = stateRef.current.tabs.filter(
        (t) => t.path === changedPath || t.path === canonicalPath,
      );
      if (matches.length === 0) return;
      for (const t of matches) {
        void invokeReadMarkdown(t.path).then((source) => {
          if (!active) return;
          setState((prev) => ({
            ...prev,
            tabs: prev.tabs.map((x) => (x.id === t.id ? { ...x, source } : x)),
          }));
        });
      }
    })
      .then((u) => {
        if (!active) {
          u();
          return;
        }
        unlisten = u;
      })
      .catch((err) => console.warn("listen file-changed failed", err));

    return () => {
      active = false;
      if (unlisten) unlisten();
    };
  }, []);

  const activeTab = state.activeId
    ? (state.tabs.find((t) => t.id === state.activeId) ?? null)
    : null;

  return {
    tabs: state.tabs,
    activeId: state.activeId,
    activeTab,
    recentlyClosed: state.recentlyClosed,
    openPath,
    activate,
    activateIndex,
    activateLast,
    nextTab,
    prevTab,
    closeTab,
    closeOthers,
    closeRight,
    closeAll,
    reopenClosed,
    moveTab,
    setActiveMode,
    toggleActiveMode,
    setActiveSource,
  };
}
