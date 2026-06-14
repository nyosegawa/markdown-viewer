# Status Summary

- Overall: Planning artifacts validated; planning commit/push pending.
- Active phase: P001.
- Last validation: `node .agents/skills/markdown-viewer-feature-planning/scripts/validate-artifacts.mjs .agent-work/features/2026-06-14-editor-save-watch` passed.
- Last review: Planning self-review completed against required artifact contract and review rubric.

# Branch And Planning Commit

- Branch: `codex/editor-save-watch-plan`
- Planning commit: pending
- Remote: `origin ssh://git@github.com/nyosegawa/markdown-viewer.git`
- Push result: pending
- Blockers: none

# Phase Checklist

- [ ] P001 Copy behavior and autosave ADR
  - Goal: Make the product contract explicit and remove Markdown-source interception from normal view copy.
  - Scope: ADR plus view copy implementation/tests.
  - Expected files/areas: `docs/adr/`, `src/components/viewer/Viewer.tsx`, `src/components/viewer/Viewer.test.tsx`, possibly `src/App.test.tsx`/`Toolbar.test.tsx` for source-copy wording.
  - Validation: `npm run test:run` for frontend behavior touched in this phase.
  - Review: Confirm normal selection copy writes rendered text with line breaks and explicit toolbar source copy remains unambiguous.
  - Commit: Commit phase after validation/review.
  - Push: Push after phase commit if sharing incrementally.
  - PR/CI: Not required until all phases complete unless user asks for early PR.
  - Evidence:
    - Implementation:
    - Validation:
    - Review:
    - Commit:
    - Push:
  - Tasks:
    - [ ] T001 Add autosave ADR
      - Expected files/areas: `docs/adr/`
      - Validation note: Documentation review; no code validation alone.
    - [ ] T002 Remove or replace view copy-as-Markdown handler
      - Expected files/areas: `src/components/viewer/Viewer.tsx`
      - Validation note: Component tests must assert plain rendered text, not Markdown source.
    - [ ] T003 Update copy tests
      - Expected files/areas: `src/components/viewer/Viewer.test.tsx`, optional app/toolbar tests
      - Validation note: Cover bold text and multi-block newline preservation.

- [ ] P002 Thin disk write IPC and autosave state model
  - Goal: Add safe autosave with explicit dirty/save/error metadata centralized in tab lifecycle.
  - Scope: Rust write command, TS wrapper, `useTabs` autosave scheduling/reconciliation, minimal UI status if needed.
  - Expected files/areas: `src-tauri/src/commands.rs`, `src-tauri/src/lib.rs`, `src/lib/tauri.ts`, `src/hooks/useTabs.ts`, `src/hooks/useTabs.test.tsx`, `src/App.tsx`, `src/components/Toolbar.tsx`.
  - Validation: `npm run test:run && (cd src-tauri && cargo test --lib)`.
  - Review: Check race handling, failed-save retention, hook dependencies, and thin IPC boundary.
  - Commit: Commit phase after validation/review.
  - Push: Push after phase commit if sharing incrementally.
  - PR/CI: Not required until all phases complete unless user asks for early PR.
  - Evidence:
    - Implementation:
    - Validation:
    - Review:
    - Commit:
    - Push:
  - Tasks:
    - [ ] T004 Add `write_markdown` command and wrapper
      - Expected files/areas: `src-tauri/src/commands.rs`, `src-tauri/src/lib.rs`, `src/lib/tauri.ts`, tests
      - Validation note: Rust unit tests plus tauri wrapper tests.
    - [ ] T005 Extend tab state with save metadata
      - Expected files/areas: `src/hooks/useTabs.ts`
      - Validation note: Unit tests for initial clean state and edit dirty state.
    - [ ] T006 Implement debounced autosave
      - Expected files/areas: `src/hooks/useTabs.ts`
      - Validation note: Fake timer tests for debounce, success, failure, and cleanup on close/rename.
    - [ ] T007 Surface save/error/conflict status minimally
      - Expected files/areas: `src/App.tsx`, `src/components/Toolbar.tsx`, CSS if needed
      - Validation note: Component tests or accessible status assertion.

- [ ] P003 External refresh reliability and end-to-end verification
  - Goal: Make external editor changes reflect quickly without overwriting local dirty drafts or reacting badly to this app's own saves.
  - Scope: File-changed coalescing/read retry/stale token handling, conflict behavior, integration-style tests, full validation/build/install/CI.
  - Expected files/areas: `src/hooks/useTabs.ts`, `src/hooks/useTabs.test.tsx`, `src-tauri/src/watcher.rs`, optional E2E/manual smoke notes.
  - Validation: `npm run lint`, `npm run typecheck`, `npm run test:run`, `(cd src-tauri && cargo fmt --check)`, `(cd src-tauri && cargo clippy --all-targets -- -D warnings)`, `(cd src-tauri && cargo test --lib)`, `npm run tauri build`, installed app launch verification.
  - Review: Independent review or fresh self-review focused on data-loss and race conditions.
  - Commit: Commit final implementation phase after validation/review.
  - Push: Push branch and create/update PR.
  - PR/CI: Create PR and watch GitHub Actions to concrete success/failure.
  - Evidence:
    - Implementation:
    - Validation:
    - Review:
    - Commit:
    - Push:
  - Tasks:
    - [ ] T008 Coalesce watcher refreshes and guard stale async reads
      - Expected files/areas: `src/hooks/useTabs.ts`
      - Validation note: Tests with out-of-order read promises.
    - [ ] T009 Distinguish own-save refresh from external refresh
      - Expected files/areas: `src/hooks/useTabs.ts`
      - Validation note: Tests that own-save watcher events do not reset editor unnecessarily.
    - [ ] T010 Preserve dirty drafts on external conflicts
      - Expected files/areas: `src/hooks/useTabs.ts`, UI status surface
      - Validation note: Test dirty local source remains intact when disk changes externally.
    - [ ] T011 Run full user-facing app validation and release-local install
      - Expected files/areas: build/install artifacts, no generated files committed
      - Validation note: Record exact commands and installed app launch result.

# Task Checklist By Phase

## P001 Copy behavior and autosave ADR

- [ ] T001 Add autosave ADR
  - Expected files/areas: `docs/adr/`
  - Validation note: Documentation review; no code validation alone.
- [ ] T002 Remove or replace view copy-as-Markdown handler
  - Expected files/areas: `src/components/viewer/Viewer.tsx`
  - Validation note: Component tests must assert plain rendered text, not Markdown source.
- [ ] T003 Update copy tests
  - Expected files/areas: `src/components/viewer/Viewer.test.tsx`, optional app/toolbar tests
  - Validation note: Cover bold text and multi-block newline preservation.

## P002 Thin disk write IPC and autosave state model

- [ ] T004 Add `write_markdown` command and wrapper
  - Expected files/areas: `src-tauri/src/commands.rs`, `src-tauri/src/lib.rs`, `src/lib/tauri.ts`, tests
  - Validation note: Rust unit tests plus tauri wrapper tests.
- [ ] T005 Extend tab state with save metadata
  - Expected files/areas: `src/hooks/useTabs.ts`
  - Validation note: Unit tests for initial clean state and edit dirty state.
- [ ] T006 Implement debounced autosave
  - Expected files/areas: `src/hooks/useTabs.ts`
  - Validation note: Fake timer tests for debounce, success, failure, and cleanup on close/rename.
- [ ] T007 Surface save/error/conflict status minimally
  - Expected files/areas: `src/App.tsx`, `src/components/Toolbar.tsx`, CSS if needed
  - Validation note: Component tests or accessible status assertion.

## P003 External refresh reliability and end-to-end verification

- [ ] T008 Coalesce watcher refreshes and guard stale async reads
  - Expected files/areas: `src/hooks/useTabs.ts`
  - Validation note: Tests with out-of-order read promises.
- [ ] T009 Distinguish own-save refresh from external refresh
  - Expected files/areas: `src/hooks/useTabs.ts`
  - Validation note: Tests that own-save watcher events do not reset editor unnecessarily.
- [ ] T010 Preserve dirty drafts on external conflicts
  - Expected files/areas: `src/hooks/useTabs.ts`, UI status surface
  - Validation note: Test dirty local source remains intact when disk changes externally.
- [ ] T011 Run full user-facing app validation and release-local install
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

# Review Evidence

- Planning self-review found the package covers scope, freshness, branch setup, repo constraints, phase-first tasks, validation, commit/push/PR/CI expectations, and stop/escalation rules.

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
