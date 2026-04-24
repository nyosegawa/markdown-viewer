# 0005 — Multi-file tabs, keyboard shortcuts, and shortcut help

- Status: accepted
- Date: 2026-04-24

## Context

The viewer was built around a single `OpenedFile` state in `useMarkdownFile`. Opening a second file always replaced the first — fine for a "double-click to peek" workflow, hostile to anyone juggling a README + a design doc + a changelog. The Rust watcher mirrored this by only holding a single `WatcherHandle`.

Users want to keep several Markdown files open at once, move between them with the keyboard, and close them individually or in batches the same way browsers and editors work.

## Decision

### 1. Tabs live in the frontend, IPC stays thin

- Introduce `useTabs` (replaces `useMarkdownFile`). State shape: `{ tabs: Tab[]; activeId: string | null; recentlyClosed: ClosedTab[] }`, where each `Tab` owns `{ id, path, source, status, error, mode, scratchSource }`.
- Each tab has its own `ViewMode` — switching tabs restores the previous view/edit choice.
- The Rust layer exposes the same "read a file / watch a path" primitives; it does not know about tabs.

### 2. Rust watcher holds multiple paths

- `WatcherState.current: Option<WatcherHandle>` → `WatcherState.handles: HashMap<PathBuf, WatcherHandle>`.
- `watch_file(path)` is idempotent per-path and additive. `unwatch_file(path)` removes a single path. `unwatch_all()` is kept for teardown.
- Motivation: without per-path watching, a background tab silently drifts from disk. External-editor round-trips (Obsidian, Neovim, formatters on save) must reflect into every open tab in real time.

### 3. OS-aware keyboard shortcut layer

A new `useKeyboardShortcuts` hook owns the global key map and a `formatShortcut()` helper for display.

| Action | macOS | Windows / Linux |
|---|---|---|
| Open file (new tab) | `⌘O` | `Ctrl+O` |
| Close current tab | `⌘W` | `Ctrl+W` |
| Reopen closed tab | `⌘⇧T` | `Ctrl+Shift+T` |
| Next tab | `⌃Tab`, `⌘⌥→` | `Ctrl+Tab`, `Ctrl+PageDown` |
| Previous tab | `⌃⇧Tab`, `⌘⌥←` | `Ctrl+Shift+Tab`, `Ctrl+PageUp` |
| Jump to tab N (1–8) | `⌘1`…`⌘8` | `Ctrl+1`…`Ctrl+8` |
| Jump to last tab | `⌘9` | `Ctrl+9` |
| Shortcut help | `⌘?` (= `⌘⇧/`) | `Ctrl+?`, `F1` |
| Dismiss modal / search | `Esc` | `Esc` |
| Find in document | `⌘F` | `Ctrl+F` |

Rules:

- The `mod` key is `metaKey` on macOS, `ctrlKey` elsewhere. `Ctrl+Tab` is accepted on every platform because it's a near-universal tab affordance (and the user specifically asked for it).
- Edit-mode `Esc` still wins when the active tab is in edit mode; otherwise `Esc` is available for modals.
- Closing the last tab does **not** close the window — it returns to the empty state.

### 4. Right-click context menu on a tab

1. Close tab (`⌘W`)
2. Close other tabs
3. Close tabs to the right
4. Close all tabs
5. ── divider ──
6. Copy path
7. Show in Finder / Show in file manager

"Show in file manager" is backed by a new Rust command `reveal_in_file_manager(path)` which dispatches per-OS: `open -R` (macOS), `explorer /select,<path>` (Windows), `xdg-open <parent-dir>` (Linux — Linux lacks a standard file-selecting equivalent).

### 5. Drag-and-drop reordering

Tabs use the native HTML5 DnD API (`draggable`, `dragover`, `drop`) so no new dependency is added. The reorder just shuffles the `tabs[]` array.

### 6. Persistence

- `mdv.tabs` in `localStorage` stores `{ paths: string[]; activeIndex: number }`.
- On boot, the tabs are recreated and each file is re-read via `invokeReadMarkdown`; if a file is missing, the tab stays in the `error` state and the user can close it with `×`.
- `recentlyClosed` is kept in memory only — restart clears it. This is the browser precedent and avoids surprising "ghost" tabs on relaunch.

### 7. Shortcut help modal

- Triggered by `⌘?` / `Ctrl+?` / `F1`. Dismissed by `Esc`, overlay click, or its close button.
- Renders the table above, using `formatShortcut()` so the same component is correct on every OS.
- No routing, no portal dependency — plain fixed-positioned overlay.

### 8. External edits reflect live in every tab

The `file-changed` listener in `useTabs` iterates all tabs and re-reads any whose `path` matches. This keeps the promise made in 0001 (files on disk are the source of truth) without any additional IPC plumbing.

## Consequences

- `useMarkdownFile` and its test file are removed (superseded by `useTabs`). Call sites change from `file.*` to `activeTab.file.*`.
- `watch_file` / `unwatch_file` commands gain a `path` argument; `invokeUnwatchFile()` is replaced by `invokeUnwatchFile(path)`.
- The toolbar title now reflects the active tab; the tab bar is a new row between toolbar and body.
- Closing the last tab lands the user in the empty state — the window stays open because `⌘Q` is how Tauri apps quit.
- Users with huge numbers of tabs pay memory proportional to the combined source size; acceptable for Markdown.
