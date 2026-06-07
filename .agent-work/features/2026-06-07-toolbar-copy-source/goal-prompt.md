# /goal command

Implement the toolbar markdown-source copy feature. Use the TODO phase order.

# source artifact paths

- Research: `/Users/sakasegawa/src/github.com/nyosegawa/markdown-viewer/.agent-work/features/2026-06-07-toolbar-copy-source/research.md`
- Plan: `/Users/sakasegawa/src/github.com/nyosegawa/markdown-viewer/.agent-work/features/2026-06-07-toolbar-copy-source/plan.md`
- TODO: `/Users/sakasegawa/src/github.com/nyosegawa/markdown-viewer/.agent-work/features/2026-06-07-toolbar-copy-source/todo.md`

# repo guidance paths

- `/Users/sakasegawa/src/github.com/nyosegawa/markdown-viewer/AGENTS.md`
- `/Users/sakasegawa/src/github.com/nyosegawa/markdown-viewer/README.md`
- `/Users/sakasegawa/src/github.com/nyosegawa/markdown-viewer/docs/adr/`
- `/Users/sakasegawa/src/github.com/nyosegawa/markdown-viewer/.agents/skills/markdown-viewer-feature-planning/references/repo-research-summary.md`

# freshness policy and freshness result

- Read `research.md` first. Freshness check passed: watched inputs changed none.
- Use web/current-state research only if implementation starts depending on external or time-sensitive facts.

# execution rules

- Execute one TODO phase at a time, splitting only if a phase is too large or mixes incompatible validation/review boundaries.
- Update `todo.md` with status and evidence after each phase attempt.
- Implement a toolbar button, not an editor-local button.
- Do not limit the action to edit mode.
- Copy the active tab's current markdown source, including in-memory edits.
- Keep existing active-path copy behavior and shortcuts unchanged.

# validation rules

- Run phase-specific tests before marking a phase complete.
- Minimum gate: `npm run test:run && (cd src-tauri && cargo test --lib)`.
- Also run `npm run lint` and `npm run typecheck`.
- For this user-facing app change, run `npm run tauri build`, replace `/Applications/markdown-viewer.app`, and verify installed launch unless waived.
- Record exact command results in `todo.md`; escalate if required validation cannot run.

# review rules

- After validation, get an independent review when available; otherwise do a fresh self-review and record that limitation.
- Review must cover diff scope, repo rules, accessibility label/disabled state, clipboard failure handling, and validation evidence.
- Fix rejected findings, rerun validation, and rerun review.

# commit rules

- Prefer one commit for the completed implementation phase.
- Commit only validated and reviewed changes; do not include unrelated worktree changes.
- Suggested message: `Add toolbar markdown copy button`.
- Record commit hash in `todo.md`.

# push rules

- Push the completed commit when PR/sharing is in scope.
- Record branch, remote, pushed hash, and result in `todo.md`.
- Escalate auth, network, protected-branch, or upstream-configuration failures.

# PR rules

- Create/update a PR with `gh` when PR work is in scope.
- PR body should summarize implementation, validation, review, risks, and skipped checks.

# CI follow-through rules

- Watch GitHub Actions to concrete success or failure when PR/CI follow-through is in scope.
- Fix in-scope CI failures and continue watching; escalate unavailable credentials, approvals, or external-service blockers.

# evidence rules

- Record implementation, validation, review, commit, push, PR, and CI evidence in `todo.md`.
- Do not claim completion without evidence.

# stop conditions

Stop only when every TODO task is done, completion criteria in `plan.md` are met, required validation passed or an approved exception is recorded, review evidence exists, commit/push evidence exists when applicable, and PR/CI has a concrete result when applicable.

# escalation conditions

Escalate conflicting requirements, unresolved architecture tradeoffs, forbidden-file edits, unavailable required validation, or unsafe branch/worktree state.
