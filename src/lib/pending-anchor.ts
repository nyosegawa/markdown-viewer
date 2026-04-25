/**
 * Per-tab "scroll to this id once the body is rendered" handoff.
 *
 * Lives in a module-level Map so App.tsx can stash a target right after
 * `openPath()` resolves, and the Viewer can pick it up when the markdown body
 * mounts — without the two having to share component state through props for
 * a one-shot effect.
 */
const anchorByTab = new Map<string, string>();

export function setPendingAnchor(tabId: string, anchor: string): void {
  anchorByTab.set(tabId, anchor);
}

export function consumePendingAnchor(tabId: string): string | null {
  const v = anchorByTab.get(tabId);
  if (v === undefined) return null;
  anchorByTab.delete(tabId);
  return v;
}

export function clearPendingAnchor(tabId: string): void {
  anchorByTab.delete(tabId);
}
