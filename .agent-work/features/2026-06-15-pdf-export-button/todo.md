# Status Summary

- Overall: Planned, not implemented.
- Active phase: P001.
- Last validation: `node .agents/skills/markdown-viewer-feature-planning/scripts/validate-artifacts.mjs .agent-work/features/2026-06-15-pdf-export-button` passed.
- Last review: Planning self-review completed.

# Branch And Planning Commit

- Branch: `codex/pdf-export-button-plan`
- Planning commit: Pending.
- Remote: `origin ssh://git@github.com/nyosegawa/markdown-viewer.git`
- Push result: Pending.
- Blockers: None.

# Phase Checklist

- [ ] P001 PDF output command, toolbar button, shortcut, and print CSS
  - Goal: Add a single frontend PDF/print command reachable from the toolbar and Command+P/Ctrl+P.
  - Scope: Toolbar UI, App wiring, shortcut hook, shortcut labels/help as needed, print CSS, unit tests.
  - Expected files/areas: `src/components/Toolbar.tsx`, `src/App.tsx`, `src/hooks/useKeyboardShortcuts.ts`, `src/lib/platform.ts`, `src/components/ShortcutsHelp.tsx` if help text is updated, `src/styles/index.css`, `src/styles/markdown.css`, frontend tests.
  - Validation: `npm run lint`, `npm run typecheck`, `npm run test:run`, `(cd src-tauri && cargo test --lib)`, `npm run tauri build`, installed-app launch smoke.
  - Review: Independent reviewer subagent when available; otherwise fresh self-review focused on shortcut conflicts, print CSS leakage, and disabled/no-tab behavior.
  - Commit: Commit after validation and review.
  - Push: Push branch after commit.
  - PR/CI: Open PR and watch CI to a concrete success/failure result.
  - Evidence:
    - Implementation:
    - Validation:
    - Review:
    - Commit:
    - Push:
  - Tasks:
    - [ ] T001 Add the toolbar PDF/print button immediately after copy source
      - Expected files/areas: `src/components/Toolbar.tsx`, `src/App.test.tsx`
      - Validation note: Assert placement/availability and accessible name.
    - [ ] T002 Wire the print command in App
      - Expected files/areas: `src/App.tsx`, `src/App.test.tsx`
      - Validation note: Mock `window.print` and assert toolbar click invokes it only for an active document.
    - [ ] T003 Add Command+P/Ctrl+P shortcut support
      - Expected files/areas: `src/hooks/useKeyboardShortcuts.ts`, `src/lib/platform.ts`, `src/hooks/useKeyboardShortcuts.test.tsx`
      - Validation note: Assert `mod+p` prevents default and calls the print handler; confirm form-field behavior intentionally.
    - [ ] T004 Add print/PDF styles for active rendered Markdown
      - Expected files/areas: `src/styles/index.css`, `src/styles/markdown.css`
      - Validation note: Verify app chrome is hidden and Markdown remains readable in print/PDF.
    - [ ] T005 Perform final app validation and release-style follow-through
      - Expected files/areas: repo root and installed app.
      - Validation note: Run required gate, Tauri build, install replacement, launch smoke, push, PR, and CI watch.

# Task Checklist By Phase

## P001 PDF output command, toolbar button, shortcut, and print CSS

- [ ] T001 Add the toolbar PDF/print button immediately after copy source
  - Expected files/areas: `src/components/Toolbar.tsx`, `src/App.test.tsx`
  - Validation note: Assert placement/availability and accessible name.
- [ ] T002 Wire the print command in App
  - Expected files/areas: `src/App.tsx`, `src/App.test.tsx`
  - Validation note: Mock `window.print` and assert toolbar click invokes it only for an active document.
- [ ] T003 Add Command+P/Ctrl+P shortcut support
  - Expected files/areas: `src/hooks/useKeyboardShortcuts.ts`, `src/lib/platform.ts`, `src/hooks/useKeyboardShortcuts.test.tsx`
  - Validation note: Assert `mod+p` prevents default and calls the print handler; confirm form-field behavior intentionally.
- [ ] T004 Add print/PDF styles for active rendered Markdown
  - Expected files/areas: `src/styles/index.css`, `src/styles/markdown.css`
  - Validation note: Verify app chrome is hidden and Markdown remains readable in print/PDF.
- [ ] T005 Perform final app validation and release-style follow-through
  - Expected files/areas: repo root and installed app.
  - Validation note: Run required gate, Tauri build, install replacement, launch smoke, push, PR, and CI watch.

# Implementation Notes

- Keep this frontend-only unless `window.print()` is proven unusable in Tauri WebView.
- Prefer one shared `handlePrintPdf` path for toolbar and shortcut.
- Do not print editor chrome. Resolve edit-mode behavior explicitly before shipping.

# Validation Evidence

- Planning artifact validation: Passed with `node .agents/skills/markdown-viewer-feature-planning/scripts/validate-artifacts.mjs .agent-work/features/2026-06-15-pdf-export-button`.
- Goal prompt length: 3660 characters, under the 4000-character limit.

# Review Evidence

- Planning self-review: Checked required sections, frontend/backend boundary, protected-file constraints, same-branch handoff, phase-first TODO shape, validation expectations, and goal-prompt length.

# Commit Log

- Planning commit: Pending.
- Implementation commits: Pending.

# Final Checklist

- [ ] Every phase is complete.
- [ ] Every task is complete.
- [ ] Completion criteria in `plan.md` are satisfied.
- [ ] Required validation evidence is recorded.
- [ ] Review evidence is recorded.
- [ ] Commit evidence is recorded when commits were required.
- [ ] Push evidence is recorded when push was required.
- [ ] PR and CI evidence is recorded when applicable.
