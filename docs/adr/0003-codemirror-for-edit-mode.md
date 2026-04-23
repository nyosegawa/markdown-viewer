# 0003 — CodeMirror 6 for Edit mode

- Status: accepted
- Date: 2026-04-23

## Context

The spec is view-centric; Edit is an opt-in toggle. We still need Markdown syntax hints, line numbers, and predictable keybindings without bloating the bundle (Monaco is ~4MB+).

## Decision

Use CodeMirror 6 with `@codemirror/lang-markdown`, `@codemirror/commands`, and `@codemirror/theme-one-dark` (dark mode only). The Editor component is code-split via `manualChunks` so it never loads until the user clicks Edit.

Edits stay in memory: changes reflect live when switching back to View, but we do not write back to disk. Disk saves would need an explicit follow-up ADR because they change the security and UX contract.

## Consequences

- Edit mode adds ~300KB compressed to the split chunk, paid only if the user toggles it.
- External file changes always win (watcher-triggered reload overwrites buffer), matching the view-first model.
