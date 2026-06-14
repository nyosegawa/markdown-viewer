# 0006 — Edit mode autosaves opened files

- Status: accepted
- Date: 2026-06-14
- Supersedes: the "edits stay in memory" part of ADR 0003

## Context

ADR 0003 made Edit mode an in-memory scratch buffer. That matched the original
view-first contract, but it now creates a broken round trip: users can edit text
in the app, switch back to View and see the change, then lose it because nothing
was written to disk. The app also promises hot reload from external editors, so
the internal model must distinguish local drafts, successful app writes, and
external file changes.

## Decision

Edit mode remains opt-in, but edits to an opened file autosave back to that same
file after a short debounce. Rust exposes only a thin write command; the frontend
owns debounce timing, dirty state, save status, and conflict policy.

The tab lifecycle tracks both the current editor source and the last known saved
source. A successful autosave marks the tab clean. A failed autosave keeps the
local draft intact and surfaces an error instead of pretending the write worked.

External disk changes continue to refresh open tabs. Clean tabs accept external
content immediately. Dirty tabs preserve the local draft when the on-disk content
changes underneath them; the app surfaces a conflict rather than silently
overwriting either side.

Normal View-mode selection copy copies rendered plain text, not Markdown source.
The toolbar source-copy button remains an explicit Markdown source copy action.

## Consequences

- The opened file on disk becomes the persistence target for Edit mode.
- Edit mode is no longer a scratch buffer; users who enter Edit mode should
  expect their changes to save.
- Autosave and watcher feedback must be reconciled so the app's own save events
  do not cause flicker or stale overwrites.
- Conflict handling is intentionally conservative: preserving local edits is
  more important than forcing an automatic merge.
