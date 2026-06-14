# Status Summary

- Overall: P001, P002, and P003 complete; final commit/push/PR/CI follow-through pending.
- Active phase: Final follow-through.
- Last validation: full validation, `npm run tauri build`, `/Applications/markdown-viewer.app` replacement, and installed-app launch verification passed after P003.
- Last review: P003 self-review completed; stale reads, self-save watcher events, and dirty external conflicts are covered by tests.

# Branch And Planning Commit

- Branch: `codex/editor-save-watch-plan`
- Planning commit: `58436dd` (`Plan editor save watch fixes`)
- Remote: `origin ssh://git@github.com/nyosegawa/markdown-viewer.git`
- Push result: pushed `codex/editor-save-watch-plan` to `origin` and set upstream
- Blockers: none

# Phase Checklist

- [x] P001 Copy behavior and autosave ADR
  - Goal: Make the product contract explicit and remove Markdown-source interception from normal view copy.
  - Scope: ADR plus view copy implementation/tests.
  - Expected files/areas: `docs/adr/`, `src/components/viewer/Viewer.tsx`, `src/components/viewer/Viewer.test.tsx`, possibly `src/App.test.tsx`/`Toolbar.test.tsx` for source-copy wording.
  - Validation: `npm run test:run` for frontend behavior touched in this phase.
  - Review: Confirm normal selection copy writes rendered text with line breaks and explicit toolbar source copy remains unambiguous.
  - Commit: Commit phase after validation/review.
  - Push: Push after phase commit if sharing incrementally.
  - PR/CI: Not required until all phases complete unless user asks for early PR.
  - Evidence:
    - Implementation: Added ADR 0006; changed Viewer copy handler to serialize rendered text instead of Markdown source; updated copy tests.
    - Validation: `npm run test:run` passed.
    - Review: Confirmed toolbar copy remains `Copy markdown source`; normal view selection copy no longer emits Markdown syntax and preserves block breaks.
    - Commit: `b61e2bf` Fix view copy behavior
    - Push:
  - Tasks:
    - [x] T001 Add autosave ADR
      - Expected files/areas: `docs/adr/`
      - Validation note: Documentation review; no code validation alone.
    - [x] T002 Remove or replace view copy-as-Markdown handler
      - Expected files/areas: `src/components/viewer/Viewer.tsx`
      - Validation note: Component tests must assert plain rendered text, not Markdown source.
    - [x] T003 Update copy tests
      - Expected files/areas: `src/components/viewer/Viewer.test.tsx`, optional app/toolbar tests
      - Validation note: Cover bold text and multi-block newline preservation.

- [x] P002 Thin disk write IPC and autosave state model
  - Goal: Add safe autosave with explicit dirty/save/error metadata centralized in tab lifecycle.
  - Scope: Rust write command, TS wrapper, `useTabs` autosave scheduling/reconciliation, minimal UI status if needed.
  - Expected files/areas: `src-tauri/src/commands.rs`, `src-tauri/src/lib.rs`, `src/lib/tauri.ts`, `src/hooks/useTabs.ts`, `src/hooks/useTabs.test.tsx`, `src/App.tsx`, `src/components/Toolbar.tsx`.
  - Validation: `npm run test:run && (cd src-tauri && cargo test --lib)`.
  - Review: Check race handling, failed-save retention, hook dependencies, and thin IPC boundary.
  - Commit: Commit phase after validation/review.
  - Push: Push after phase commit if sharing incrementally.
  - PR/CI: Not required until all phases complete unless user asks for early PR.
  - Evidence:
    - Implementation: Added `write_markdown` Rust command and TS wrapper; extended tab save metadata; implemented debounced autosave; added save/error/conflict status display.
    - Validation: `npm run lint`, `npm run typecheck`, `npm run test:run`, and `(cd src-tauri && cargo test --lib)` passed.
    - Review: Confirmed Rust only performs thin file write; debounce/save/error/conflict policy lives in frontend; failed saves keep local source.
    - Commit: `6fe4d6f` Add edit autosave lifecycle
    - Push:
  - Tasks:
    - [x] T004 Add `write_markdown` command and wrapper
      - Expected files/areas: `src-tauri/src/commands.rs`, `src-tauri/src/lib.rs`, `src/lib/tauri.ts`, tests
      - Validation note: Rust unit tests plus tauri wrapper tests.
    - [x] T005 Extend tab state with save metadata
      - Expected files/areas: `src/hooks/useTabs.ts`
      - Validation note: Unit tests for initial clean state and edit dirty state.
    - [x] T006 Implement debounced autosave
      - Expected files/areas: `src/hooks/useTabs.ts`
      - Validation note: Fake timer tests for debounce, success, failure, and cleanup on close/rename.
    - [x] T007 Surface save/error/conflict status minimally
      - Expected files/areas: `src/App.tsx`, `src/components/Toolbar.tsx`, CSS if needed
      - Validation note: Component tests or accessible status assertion.

- [x] P003 External refresh reliability and end-to-end verification
  - Goal: Make external editor changes reflect quickly without overwriting local dirty drafts or reacting badly to this app's own saves.
  - Scope: File-changed coalescing/read retry/stale token handling, conflict behavior, integration-style tests, full validation/build/install/CI.
  - Expected files/areas: `src/hooks/useTabs.ts`, `src/hooks/useTabs.test.tsx`, `src-tauri/src/watcher.rs`, optional E2E/manual smoke notes.
  - Validation: `npm run lint`, `npm run typecheck`, `npm run test:run`, `(cd src-tauri && cargo fmt --check)`, `(cd src-tauri && cargo clippy --all-targets -- -D warnings)`, `(cd src-tauri && cargo test --lib)`, `npm run tauri build`, installed app launch verification.
  - Review: Independent review or fresh self-review focused on data-loss and race conditions.
  - Commit: Commit final implementation phase after validation/review.
  - Push: Push branch and create/update PR.
  - PR/CI: Create PR and watch GitHub Actions to concrete success/failure.
  - Evidence:
    - Implementation: Added coalesced file-change refresh, stale read tokens, own-save reconciliation, dirty conflict preservation, and race-focused tests.
    - Validation: `npm run lint`, `npm run typecheck`, `npm run test:run`, `(cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test --lib)`, `npm run tauri build`, `/Applications/markdown-viewer.app` replacement, and installed app launch check passed.
    - Review: Fresh self-review focused on data-loss risks; clean tabs refresh, dirty drafts are preserved, and own-save watcher events do not overwrite newer drafts.
    - Commit:
    - Push:
  - Tasks:
    - [x] T008 Coalesce watcher refreshes and guard stale async reads
      - Expected files/areas: `src/hooks/useTabs.ts`
      - Validation note: Tests with out-of-order read promises.
    - [x] T009 Distinguish own-save refresh from external refresh
      - Expected files/areas: `src/hooks/useTabs.ts`
      - Validation note: Tests that own-save watcher events do not reset editor unnecessarily.
    - [x] T010 Preserve dirty drafts on external conflicts
      - Expected files/areas: `src/hooks/useTabs.ts`, UI status surface
      - Validation note: Test dirty local source remains intact when disk changes externally.
    - [x] T011 Run full user-facing app validation and release-local install
      - Expected files/areas: build/install artifacts, no generated files committed
      - Validation note: Record exact commands and installed app launch result.

# Task Checklist By Phase

## P001 Copy behavior and autosave ADR

- [x] T001 Add autosave ADR
  - Expected files/areas: `docs/adr/`
  - Validation note: Documentation review; no code validation alone.
- [x] T002 Remove or replace view copy-as-Markdown handler
  - Expected files/areas: `src/components/viewer/Viewer.tsx`
  - Validation note: Component tests must assert plain rendered text, not Markdown source.
- [x] T003 Update copy tests
  - Expected files/areas: `src/components/viewer/Viewer.test.tsx`, optional app/toolbar tests
  - Validation note: Cover bold text and multi-block newline preservation.

## P002 Thin disk write IPC and autosave state model

- [x] T004 Add `write_markdown` command and wrapper
  - Expected files/areas: `src-tauri/src/commands.rs`, `src-tauri/src/lib.rs`, `src/lib/tauri.ts`, tests
  - Validation note: Rust unit tests plus tauri wrapper tests.
- [x] T005 Extend tab state with save metadata
  - Expected files/areas: `src/hooks/useTabs.ts`
  - Validation note: Unit tests for initial clean state and edit dirty state.
- [x] T006 Implement debounced autosave
  - Expected files/areas: `src/hooks/useTabs.ts`
  - Validation note: Fake timer tests for debounce, success, failure, and cleanup on close/rename.
- [x] T007 Surface save/error/conflict status minimally
  - Expected files/areas: `src/App.tsx`, `src/components/Toolbar.tsx`, CSS if needed
  - Validation note: Component tests or accessible status assertion.

## P003 External refresh reliability and end-to-end verification

- [x] T008 Coalesce watcher refreshes and guard stale async reads
  - Expected files/areas: `src/hooks/useTabs.ts`
  - Validation note: Tests with out-of-order read promises.
- [x] T009 Distinguish own-save refresh from external refresh
  - Expected files/areas: `src/hooks/useTabs.ts`
  - Validation note: Tests that own-save watcher events do not reset editor unnecessarily.
- [x] T010 Preserve dirty drafts on external conflicts
  - Expected files/areas: `src/hooks/useTabs.ts`, UI status surface
  - Validation note: Test dirty local source remains intact when disk changes externally.
- [x] T011 Run full user-facing app validation and release-local install
  - Expected files/areas: build/install artifacts, no generated files committed
  - Validation note: Record exact commands and installed app launch result.

# Implementation Notes

- Prefer a small save-state reducer/helper inside `useTabs` before extracting abstractions.
- Use `useRef` for mutable timer maps and generation counters to avoid hook dependency suppression.
- Cancel pending autosave timers when tabs close, paths rename, or component unmounts.
- Do not overwrite dirty local source on external refresh. Preserve local draft and surface conflict.
- Watcher changes should be minimal; start by hardening frontend reconciliation.

# Validation Evidence

- Planning artifact validation passed with `node .agents/skills/markdown-viewer-feature-planning/scripts/validate-artifacts.mjs .agent-work/features/2026-06-14-editor-save-watch`.
- P001 validation passed with `npm run test:run` (`25 passed`, `188 passed`).
- P002 validation passed with `npm run lint`, `npm run typecheck`, `npm run test:run` (`25 passed`, `193 passed`), and `(cd src-tauri && cargo test --lib)` (`18 passed`).
- P003 validation passed with `npm run lint`, `npm run typecheck`, `npm run test:run` (`25 passed`, `195 passed`), `(cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test --lib)`, `npm run tauri build`, replacement of `/Applications/markdown-viewer.app`, and installed-app launch verification via `open -na /Applications/markdown-viewer.app` plus `pgrep -fl markdown-viewer`.

# Review Evidence

- Planning self-review found the package covers scope, freshness, branch setup, repo constraints, phase-first tasks, validation, commit/push/PR/CI expectations, and stop/escalation rules.
- P001 self-review: ADR supersedes ADR 0003's in-memory edit policy; view copy emits rendered text and line breaks; toolbar source-copy behavior is unchanged and explicit.
- P002 self-review: write IPC is thin; autosave runs from `useTabs`; save failure and external conflict keep local draft instead of overwriting.
- P003 self-review: file-change refreshes are coalesced; stale read results are ignored; own-save watcher events do not reset newer drafts; external dirty conflicts stop autosave and keep local text visible.

# Commit Log

- `58436dd` Plan editor save watch fixes
- `b61e2bf` Fix view copy behavior
- `6fe4d6f` Add edit autosave lifecycle

# Final Checklist

- [x] Every phase is complete.
- [x] Every task is complete.
- [x] Completion criteria in `plan.md` are satisfied.
- [x] Required validation evidence is recorded.
- [x] Review evidence is recorded.
- [ ] Commit evidence is recorded when commits were required.
- [ ] Push evidence is recorded when push was required.
- [ ] PR and CI evidence is recorded when applicable.
