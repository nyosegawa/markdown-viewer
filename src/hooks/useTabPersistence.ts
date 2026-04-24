import { useEffect } from "react";

const STORAGE_KEY = "mdv.tabs";

export interface PersistedTabs {
  paths: string[];
  activeIndex: number;
}

export function readStoredTabs(): PersistedTabs | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const obj = parsed as Record<string, unknown>;
    const paths = Array.isArray(obj.paths)
      ? obj.paths.filter((p): p is string => typeof p === "string" && p.length > 0)
      : [];
    const activeIndex =
      typeof obj.activeIndex === "number" && Number.isFinite(obj.activeIndex)
        ? Math.max(0, Math.min(paths.length - 1, Math.floor(obj.activeIndex)))
        : 0;
    if (paths.length === 0) return null;
    return { paths, activeIndex };
  } catch {
    return null;
  }
}

function persist(payload: PersistedTabs | null) {
  if (typeof window === "undefined") return;
  try {
    if (!payload || payload.paths.length === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function useTabPersistence(paths: string[], activeIndex: number) {
  useEffect(() => {
    if (paths.length === 0) {
      persist(null);
      return;
    }
    persist({ paths, activeIndex });
  }, [paths, activeIndex]);
}

export const TABS_STORAGE_KEY = STORAGE_KEY;
