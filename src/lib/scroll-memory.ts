/**
 * Per-tab memory of "topmost visible markdown source offset" in the Viewer.
 *
 * The Viewer writes this on scroll; App reads it when the user flips a tab
 * to edit mode, so the editor opens at roughly the same place they were
 * reading. Lives in a module-level Map because the Viewer and Editor are
 * conditionally rendered siblings — plain component state would be lost at
 * the very moment of the mode switch.
 */
const srcOffsetByTab = new Map<string, number>();

export function getSrcOffset(tabId: string): number | undefined {
  return srcOffsetByTab.get(tabId);
}

export function setSrcOffset(tabId: string, offset: number): void {
  srcOffsetByTab.set(tabId, offset);
}

export function clearSrcOffset(tabId: string): void {
  srcOffsetByTab.delete(tabId);
}
