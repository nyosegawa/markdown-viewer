# Summary

Add a PDF output button directly to the right of the toolbar Markdown-copy button, and bind Command+P / Ctrl+P to the same output path. Implement it as a print-to-PDF command using `window.print()` plus print CSS.

# Background

The app is a rendered Markdown viewer with an explicit Markdown source-copy action. Users on macOS expect PDF creation from the print dialog, and Command+P is the conventional entry point.

# Current State

`Toolbar` renders the right-side command cluster in this order: copy source, edit/view toggle, theme, help. `App` wires toolbar actions and global keyboard shortcuts. `useKeyboardShortcuts` has no print handler today. No print CSS exists.

# Goals

- Show a PDF/print button immediately after `Copy markdown source`.
- Support Command+P on macOS and Ctrl+P elsewhere via the existing shortcut hook.
- Print the active rendered Markdown document, not app chrome.
- Keep the implementation frontend-only and testable.

# Non-Goals

- Directly writing a `.pdf` file without a dialog.
- Adding Rust/Tauri PDF generation.
- Changing Markdown rendering semantics.
- Changing edit-mode autosave behavior.

# Repo-Specific Constraints

- Protected files: Do not edit protected harness/config files listed in `AGENTS.md`.
- Frontend/backend boundary: Keep Markdown/print work in React/CSS; Rust stays thin.
- View/edit persistence: Respect ADR 0006 autosave; do not add new disk export state.
- Validation: Required gate is `npm run test:run && (cd src-tauri && cargo test --lib)`.
- User-facing app release/install expectations: Run `npm run tauri build`, replace `/Applications/markdown-viewer.app`, verify launch, push, and watch GitHub Actions unless user waives it during implementation.

# Design Decisions

- Add a `PrintIcon`/PDF-style icon in `Toolbar.tsx` and an `onPrintPdf` prop.
- Place the button immediately after `copy-source-btn`; use `aria-label="Export PDF"` or `aria-label="Print to PDF"` and a stable test id.
- Add `onPrintPdf` in `App.tsx`, guarded for active ready tabs and `typeof window.print === "function"`.
- Extend `ShortcutHandlers` with `onPrintPdf` and add the `mod+p` branch before generic command handling.
- Add a canonical shortcut in `src/lib/platform.ts` if the help UI or title should display it.
- Add print CSS in existing style files: hide toolbar/tabs/empty/error chrome for print and make `.app-body` / `.markdown-body` printable with page-friendly margins and color.

# Impacted Areas

- `src/components/Toolbar.tsx`
- `src/App.tsx`
- `src/hooks/useKeyboardShortcuts.ts`
- `src/lib/platform.ts`
- `src/components/ShortcutsHelp.tsx` if print should appear in the shortcut help modal
- `src/styles/index.css` and/or `src/styles/markdown.css`
- `src/App.test.tsx`
- `src/hooks/useKeyboardShortcuts.test.tsx`

# Validation Plan

- Minimum required: `npm run test:run && (cd src-tauri && cargo test --lib)`.
- Frontend: `npm run lint`, `npm run typecheck`, targeted Vitest coverage, and full Vitest.
- Rust: No Rust code expected; still run `cargo test --lib` for the required gate.
- E2E: Optional unless implementation touches app launch/open flow.
- Build/install/launch: `npm run tauri build`, replace `/Applications/markdown-viewer.app`, launch installed app and verify it opens.

# Commit, PR, And CI Plan

- Commit: One implementation commit is enough unless print CSS and shortcut wiring become separately reviewable.
- Push: Push `codex/pdf-export-button-plan`.
- PR: Open a PR after validation and installed-app smoke.
- CI follow-through: Watch pushed CI to success/failure and fix in-scope failures.

# Risks

- WebView print behavior differs by platform.
- Unit tests can verify invocation but not PDF layout quality.
- Print CSS may need iteration to avoid clipped content, dark-theme colors, or app chrome leakage.

# Completion Criteria

- Button appears immediately right of Markdown copy and is disabled/harmless when no active document exists.
- Command+P/Ctrl+P invokes the same print/PDF path.
- Printed/PDF output contains only the active rendered Markdown with readable styling.
- Tests cover the new toolbar and shortcut behavior.
- Required validation, build/install/launch, push, PR, and CI evidence are recorded.

# Open Questions

- Exact label: prefer `Print to PDF` for clarity unless product language should be `Export PDF`.
- Edit mode behavior: print current rendered document from current source if practical; otherwise disable/escalate rather than printing editor chrome.
