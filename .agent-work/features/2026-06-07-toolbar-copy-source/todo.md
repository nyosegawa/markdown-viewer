# Status Summary

- Overall: implementation, local validation, and independent review complete; commit/push/PR/CI pending.
- Active phase: P001.
- Last validation: `npm run lint`, `npm run typecheck`, `npm run test:run`, `(cd src-tauri && cargo test --lib)`, and `npm run tauri build` passed on 2026-06-07.
- Last review: independent subagent review completed with no actionable issues.

# Phase Checklist

- [ ] P001 Toolbar source copy implementation
  - Goal: add a toolbar action that copies the active tab's current markdown source in both view and edit modes.
  - Scope: frontend UI, app handler, and focused tests.
  - Expected files/areas: `src/App.tsx`, `src/components/Toolbar.tsx`, `src/components/Toolbar.test.tsx`, `src/App.test.tsx`, optionally `src/styles/index.css`.
  - Validation: targeted Vitest during development, then `npm run lint`, `npm run typecheck`, `npm run test:run`, and `(cd src-tauri && cargo test --lib)`.
  - Review: independent review or fresh self-review of diff, tests, accessibility labels, and clipboard failure handling.
  - Commit: commit after validation and review.
  - Push: push the implementation branch after commit.
  - PR/CI: create/update PR and watch GitHub Actions to concrete success or failure unless user waives.
  - Evidence:
    - Implementation: Added a right-side toolbar `Copy markdown source` icon button, wired `App` to copy `activeTab.source`, and added App/Toolbar tests for view-mode and edit-mode in-memory source copy.
    - Validation: `npm run lint` passed; `npm run typecheck` passed; targeted `npm run test:run -- src/components/Toolbar.test.tsx src/App.test.tsx` passed twice; `npm run test:run` passed 25 files / 187 tests; `(cd src-tauri && cargo test --lib)` passed 17 tests; `npm run tauri build` passed and produced `.app` plus DMG; `/Applications/markdown-viewer.app` replaced and launched as pid 7749.
    - Review: independent subagent review completed with no actionable issues; minor residual gap noted that rejected clipboard writes are not explicitly unit-tested, but the code catches rejections and mirrors existing path-copy handling.
    - Commit: pending.
    - Push: pending.
  - Tasks:
    - [x] T001 Add App-level source copy handler
      - Expected files/areas: `src/App.tsx`
      - Validation note: ensure handler uses `activeTab.source`, not file path or rendered DOM text.
    - [x] T002 Add toolbar button and props
      - Expected files/areas: `src/components/Toolbar.tsx`, optionally `src/styles/index.css`
      - Validation note: accessible name should distinguish source copy from path copy; button disabled when no active file.
    - [x] T003 Add focused tests
      - Expected files/areas: `src/components/Toolbar.test.tsx`, `src/App.test.tsx`
      - Validation note: stub `navigator.clipboard.writeText`; include view-mode and edit/current-source coverage where practical.
    - [x] T004 Run validation and user-facing build/install checks
      - Expected files/areas: no code changes expected unless validation finds issues.
      - Validation note: run required test gates plus Tauri build/install/launch unless waived.
    - [ ] T005 Commit, push, PR, and CI follow-through
      - Expected files/areas: git/GitHub only.
      - Validation note: record branch, commit hash, PR URL, and CI result.

# Task Checklist By Phase

## P001 Toolbar source copy implementation

- [x] T001 Add App-level source copy handler
  - Expected files/areas: `src/App.tsx`
  - Validation note: copy `activeTab.source` with `navigator.clipboard.writeText`; catch and log failures.
- [x] T002 Add toolbar button and props
  - Expected files/areas: `src/components/Toolbar.tsx`, optionally `src/styles/index.css`
  - Validation note: disabled state and accessible name must be covered by tests.
- [x] T003 Add focused tests
  - Expected files/areas: `src/components/Toolbar.test.tsx`, `src/App.test.tsx`
  - Validation note: use clipboard stubs and avoid depending on real OS clipboard.
- [x] T004 Run validation and user-facing build/install checks
  - Expected files/areas: validation evidence only.
  - Validation note: include `npm run test:run && (cd src-tauri && cargo test --lib)`.
- [ ] T005 Commit, push, PR, and CI follow-through
  - Expected files/areas: git/GitHub evidence only.
  - Validation note: do not include unrelated working tree changes.

# Implementation Notes

- Recommended prop shape:
  - `onCopySource?: () => void`
  - derive disabled state from `path === null` or an explicit `canCopySource` prop if the implementation needs more precision.
- Recommended handler shape:
  - `handleCopySource = useCallback((source: string) => { void navigator.clipboard.writeText(source).catch(...) }, [])`
  - pass `() => { if (activeTab) handleCopySource(activeTab.source); }` to `Toolbar`.
- Keep `handleCopyPath` and `TAB_SHORTCUTS.copyPath` unchanged.
- Do not add a keyboard shortcut in the first implementation to avoid collision with existing copy/path semantics.

# Validation Evidence

- `npm run lint`: passed, Biome checked 65 files.
- `npm run typecheck`: passed.
- `npm run test:run -- src/components/Toolbar.test.tsx src/App.test.tsx`: passed twice, 2 files / 18 tests.
- `npm run test:run`: passed, 25 files / 187 tests.
- `(cd src-tauri && cargo test --lib)`: passed, 17 tests.
- `npm run tauri build`: passed; built `/Users/sakasegawa/src/github.com/nyosegawa/markdown-viewer/src-tauri/target/release/bundle/macos/markdown-viewer.app` and `/Users/sakasegawa/src/github.com/nyosegawa/markdown-viewer/src-tauri/target/release/bundle/dmg/markdown-viewer_0.1.0_aarch64.dmg`.
- Install/launch: replaced `/Applications/markdown-viewer.app` with the release app; `open -n /Applications/markdown-viewer.app` launched process `7749 /Applications/markdown-viewer.app/Contents/MacOS/markdown-viewer`.

# Review Evidence

- Independent subagent review completed by agent `019ea178-3f27-7a71-a3e5-adf0fd4b17bf`.
- Result: no actionable issues found.
- Covered: toolbar/global mode-independent placement, accessible name/title, disabled state with no file, copying `activeTab.source` including in-memory edit-mode changes, preservation of active-path copy shortcut/tab wiring, clipboard rejection catch/log behavior, and validation evidence.
- Residual gap: no explicit test for rejected `navigator.clipboard.writeText`; accepted because implementation catches rejection and matches existing path-copy handling.

# Commit Log

- Pending.

# Final Checklist

- [ ] Every phase is complete.
- [ ] Every task is complete.
- [ ] Completion criteria in `plan.md` are satisfied.
- [ ] Required validation evidence is recorded.
- [ ] Review evidence is recorded.
- [ ] Commit evidence is recorded when commits were required.
- [ ] Push evidence is recorded when push was required.
- [ ] PR and CI evidence is recorded when applicable.
