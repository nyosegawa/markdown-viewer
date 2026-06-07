# Review Rubric

Use this rubric before declaring a planning package ready.

## Planning Quality

- The plan answers what the user wants, why it matters, affected surfaces, goals, non-goals, and completion criteria.
- Assumptions are explicit and conservative.
- Open questions are real blockers or notable uncertainties, not hidden implementation tasks.
- No feature implementation is performed during planning.

## Repo Fit

- The plan preserves the Tauri IPC boundary: Rust handles file IO/watch/open events; Markdown work stays in frontend.
- View mode remains default; edit mode and disk writes respect existing ADRs.
- Protected harness/config files are not edited unless the user explicitly changes repo policy.
- Validation commands match `AGENTS.md`, README, and CI.
- User-facing app changes include build/install/launch verification expectations unless explicitly waived.

## Execution Shape

- `todo.md` is phase-first, with task checklists inside phases.
- Each phase has validation, review, commit, push, PR/CI, and evidence fields.
- Phases are reviewable and committable units.
- `goal-prompt.md` includes stop and escalation conditions.

## Freshness

- Freshness check outcome is recorded in `research.md`.
- Changed watched inputs trigger targeted refresh before planning.
- Live research is used or explicitly skipped with a reason.

