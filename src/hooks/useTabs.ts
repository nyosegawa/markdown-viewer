import { useCallback, useEffect, useRef, useState } from "react";
import {
  invokeReadMarkdown,
  invokeRenameMarkdown,
  invokeUnwatchFile,
  invokeWatchFile,
  invokeWriteMarkdown,
  listenFileChanged,
} from "@/lib/tauri";

export type TabStatus = "loading" | "ready" | "error";
export type TabMode = "view" | "edit";
export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error" | "conflict";

export interface Tab {
  id: string;
  path: string;
  source: string;
  savedSource: string;
  status: TabStatus;
  error: string | null;
  mode: TabMode;
  dirty: boolean;
  saveStatus: SaveStatus;
  lastSaveError: string | null;
  conflictSource: string | null;
  lastWrittenSource: string | null;
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
const AUTOSAVE_DEBOUNCE_MS = 400;
const FILE_REFRESH_DEBOUNCE_MS = 60;

function genId(): string {
  return `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function messageFromUnknown(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function cleanSaveState(source: string) {
  return {
    savedSource: source,
    dirty: false,
    saveStatus: "idle" as SaveStatus,
    lastSaveError: null,
    conflictSource: null,
    lastWrittenSource: null,
  };
}

export function useTabs() {
  const [state, setState] = useState<TabsState>(EMPTY);
  const stateRef = useRef(state);
  stateRef.current = state;
  const saveTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const refreshTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const saveSeqRef = useRef(0);
  const latestSaveSeqRef = useRef<Map<string, number>>(new Map());
  const refreshSeqRef = useRef(0);
  const latestRefreshSeqRef = useRef<Map<string, number>>(new Map());
  const saveTabRef = useRef<(id: string) => void>(() => undefined);
  const refreshTabRef = useRef<(id: string) => void>(() => undefined);

  const clearSaveTimer = useCallback((id: string) => {
    const timer = saveTimersRef.current.get(id);
    if (timer) clearTimeout(timer);
    saveTimersRef.current.delete(id);
  }, []);

  const clearRefreshTimer = useCallback((id: string) => {
    const timer = refreshTimersRef.current.get(id);
    if (timer) clearTimeout(timer);
    refreshTimersRef.current.delete(id);
  }, []);

  const scheduleAutosave = useCallback(
    (id: string) => {
      clearSaveTimer(id);
      saveTimersRef.current.set(
        id,
        setTimeout(() => {
          saveTimersRef.current.delete(id);
          saveTabRef.current(id);
        }, AUTOSAVE_DEBOUNCE_MS),
      );
    },
    [clearSaveTimer],
  );

  const scheduleRefresh = useCallback(
    (id: string) => {
      clearRefreshTimer(id);
      refreshTimersRef.current.set(
        id,
        setTimeout(() => {
          refreshTimersRef.current.delete(id);
          refreshTabRef.current(id);
        }, FILE_REFRESH_DEBOUNCE_MS),
      );
    },
    [clearRefreshTimer],
  );

  async function saveTab(id: string) {
    await saveTabInner(id);
  }

  async function refreshTabFromDisk(id: string) {
    await refreshTabFromDiskInner(id);
  }

  saveTabRef.current = (id: string) => {
    void saveTab(id);
  };
  refreshTabRef.current = (id: string) => {
    void refreshTabFromDisk(id);
  };

  async function saveTabInner(id: string) {
    const tab = stateRef.current.tabs.find((t) => t.id === id);
    if (!tab || tab.status === "error" || !tab.dirty || tab.source === tab.savedSource) return;
    if (tab.saveStatus === "conflict" && tab.conflictSource !== null) return;

    const seq = saveSeqRef.current + 1;
    saveSeqRef.current = seq;
    latestSaveSeqRef.current.set(id, seq);
    const path = tab.path;
    const source = tab.source;

    setState((prev) => ({
      ...prev,
      tabs: prev.tabs.map((t) =>
        t.id === id && t.path === path && t.source === source
          ? { ...t, saveStatus: "saving", lastSaveError: null }
          : t,
      ),
    }));

    try {
      await invokeWriteMarkdown(path, source);
    } catch (err) {
      if (latestSaveSeqRef.current.get(id) !== seq) return;
      const message = messageFromUnknown(err);
      setState((prev) => ({
        ...prev,
        tabs: prev.tabs.map((t) =>
          t.id === id && t.path === path && t.source === source
            ? { ...t, dirty: true, saveStatus: "error", lastSaveError: message }
            : t,
        ),
      }));
      return;
    }

    if (latestSaveSeqRef.current.get(id) !== seq) return;
    const currentAfterSave = stateRef.current.tabs.find((t) => t.id === id && t.path === path);
    const shouldReschedule =
      currentAfterSave !== undefined &&
      currentAfterSave.source !== source &&
      currentAfterSave.conflictSource === null;
    setState((prev) => ({
      ...prev,
      tabs: prev.tabs.map((t) => {
        if (t.id !== id || t.path !== path) return t;
        if (t.source === source) {
          return {
            ...t,
            savedSource: source,
            dirty: false,
            saveStatus: "saved",
            lastSaveError: null,
            conflictSource: null,
            lastWrittenSource: source,
          };
        }
        return {
          ...t,
          savedSource: source,
          dirty: true,
          saveStatus: t.conflictSource ? "conflict" : "dirty",
          lastSaveError: null,
          lastWrittenSource: source,
        };
      }),
    }));
    if (shouldReschedule) scheduleAutosave(id);
  }

  async function refreshTabFromDiskInner(id: string) {
    const tab = stateRef.current.tabs.find((t) => t.id === id);
    if (!tab || tab.status === "error") return;
    const path = tab.path;
    const seq = refreshSeqRef.current + 1;
    refreshSeqRef.current = seq;
    latestRefreshSeqRef.current.set(id, seq);

    let diskSource: string;
    try {
      diskSource = await invokeReadMarkdown(path);
    } catch (err) {
      const message = messageFromUnknown(err);
      if (latestRefreshSeqRef.current.get(id) !== seq) return;
      setState((prev) => ({
        ...prev,
        tabs: prev.tabs.map((t) =>
          t.id === id && t.path === path ? { ...t, status: "error", error: message } : t,
        ),
      }));
      return;
    }

    if (latestRefreshSeqRef.current.get(id) !== seq) return;
    const currentBeforeApply = stateRef.current.tabs.find((t) => t.id === id && t.path === path);
    const shouldClearSaveTimer =
      currentBeforeApply?.dirty === true &&
      currentBeforeApply.source !== diskSource &&
      currentBeforeApply.lastWrittenSource !== diskSource;
    setState((prev) => ({
      ...prev,
      tabs: prev.tabs.map((t) => {
        if (t.id !== id || t.path !== path) return t;
        if (t.source === diskSource) {
          return {
            ...t,
            savedSource: diskSource,
            dirty: false,
            saveStatus: t.saveStatus === "saving" ? t.saveStatus : "saved",
            lastSaveError: null,
            conflictSource: null,
            lastWrittenSource: t.lastWrittenSource,
          };
        }
        if (t.dirty) {
          if (diskSource === t.lastWrittenSource) {
            return {
              ...t,
              savedSource: diskSource,
              dirty: true,
              saveStatus: t.conflictSource ? "conflict" : "dirty",
              lastSaveError: null,
            };
          }
          return {
            ...t,
            savedSource: diskSource,
            dirty: true,
            saveStatus: "conflict",
            lastSaveError: "File changed on disk while this tab has unsaved edits.",
            conflictSource: diskSource,
          };
        }
        return {
          ...t,
          source: diskSource,
          savedSource: diskSource,
          status: "ready",
          error: null,
          dirty: false,
          saveStatus: "saved",
          lastSaveError: null,
          conflictSource: null,
          lastWrittenSource: diskSource === t.lastWrittenSource ? t.lastWrittenSource : null,
        };
      }),
    }));
    if (shouldClearSaveTimer) clearSaveTimer(id);
  }

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
      tabs: [
        ...prev.tabs,
        {
          id,
          path,
          source: "",
          status: "loading",
          error: null,
          mode: "view",
          ...cleanSaveState(""),
        },
      ],
      activeId: id,
    }));

    try {
      const source = await invokeReadMarkdown(path);
      setState((prev) => ({
        ...prev,
        tabs: prev.tabs.map((t) =>
          t.id === id
            ? { ...t, source, status: "ready", error: null, ...cleanSaveState(source) }
            : t,
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
          t.id === id
            ? { ...t, source: "", status: "error", error: message, ...cleanSaveState("") }
            : t,
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

  const closeTab = useCallback(
    async (id: string) => {
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
      clearSaveTimer(id);
      clearRefreshTimer(id);
    },
    [clearRefreshTimer, clearSaveTimer],
  );

  const closeOthers = useCallback(
    async (keepId: string) => {
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
      for (const t of current.tabs) {
        if (t.id !== keepId) {
          clearSaveTimer(t.id);
          clearRefreshTimer(t.id);
        }
      }
    },
    [clearRefreshTimer, clearSaveTimer],
  );

  const closeRight = useCallback(
    async (pivotId: string) => {
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
      for (const t of closed) {
        clearSaveTimer(t.id);
        clearRefreshTimer(t.id);
      }
    },
    [clearRefreshTimer, clearSaveTimer],
  );

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
    for (const t of current.tabs) {
      clearSaveTimer(t.id);
      clearRefreshTimer(t.id);
    }
  }, [clearRefreshTimer, clearSaveTimer]);

  const reopenClosed = useCallback(async () => {
    const pop = stateRef.current.recentlyClosed[0];
    if (!pop) return;
    setState((prev) => ({ ...prev, recentlyClosed: prev.recentlyClosed.slice(1) }));
    await openPath(pop.path);
  }, [openPath]);

  const renameTab = useCallback(
    async (id: string, filenameStem: string): Promise<string | null> => {
      const tab = stateRef.current.tabs.find((t) => t.id === id);
      if (!tab) return null;
      const nextPath = await invokeRenameMarkdown(tab.path, filenameStem);
      if (nextPath === tab.path) return nextPath;

      setState((prev) => ({
        ...prev,
        tabs: prev.tabs.map((t) =>
          t.id === id ? { ...t, path: nextPath, status: "ready", error: null } : t,
        ),
        recentlyClosed: prev.recentlyClosed.map((closed) =>
          closed.path === tab.path ? { ...closed, path: nextPath } : closed,
        ),
      }));

      try {
        await invokeUnwatchFile(tab.path);
      } catch {
        /* ignore */
      }
      try {
        await invokeWatchFile(nextPath);
      } catch (err) {
        console.warn("watch_file failed", err);
      }
      return nextPath;
    },
    [],
  );

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

  const setActiveSource = useCallback(
    (source: string) => {
      const tab = stateRef.current.activeId
        ? stateRef.current.tabs.find((t) => t.id === stateRef.current.activeId)
        : null;
      if (!tab) return;
      const dirty = source !== tab.savedSource;
      setState((prev) => {
        if (prev.activeId === null) return prev;
        return {
          ...prev,
          tabs: prev.tabs.map((t) =>
            t.id === prev.activeId
              ? {
                  ...t,
                  source,
                  status: "ready",
                  error: null,
                  dirty,
                  saveStatus: dirty ? (t.conflictSource ? "conflict" : "dirty") : "saved",
                  lastSaveError: dirty ? (t.conflictSource ? t.lastSaveError : null) : null,
                  conflictSource: dirty ? t.conflictSource : null,
                }
              : t,
          ),
        };
      });
      if (dirty && tab.conflictSource === null) scheduleAutosave(tab.id);
      else clearSaveTimer(tab.id);
    },
    [clearSaveTimer, scheduleAutosave],
  );

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | null = null;
    listenFileChanged((changedPath, canonicalPath) => {
      const matches = stateRef.current.tabs.filter(
        (t) => t.path === changedPath || t.path === canonicalPath,
      );
      if (matches.length === 0) return;
      for (const t of matches) {
        if (active) scheduleRefresh(t.id);
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
      for (const timer of saveTimersRef.current.values()) clearTimeout(timer);
      for (const timer of refreshTimersRef.current.values()) clearTimeout(timer);
      saveTimersRef.current.clear();
      refreshTimersRef.current.clear();
    };
  }, [scheduleRefresh]);

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
    renameTab,
    moveTab,
    setActiveMode,
    toggleActiveMode,
    setActiveSource,
  };
}
