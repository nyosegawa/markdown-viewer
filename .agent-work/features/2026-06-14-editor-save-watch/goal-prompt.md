# /goal command

Implement the planned `editor-save-watch` feature from `todo.md`, one phase per iteration.

# source artifact paths

- Research: `/Users/sakasegawa/src/github.com/nyosegawa/markdown-viewer/.agent-work/features/2026-06-14-editor-save-watch/research.md`
- Plan: `/Users/sakasegawa/src/github.com/nyosegawa/markdown-viewer/.agent-work/features/2026-06-14-editor-save-watch/plan.md`
- TODO: `/Users/sakasegawa/src/github.com/nyosegawa/markdown-viewer/.agent-work/features/2026-06-14-editor-save-watch/todo.md`

# repo guidance paths

- `<repo-root>/AGENTS.md`
- `<repo-root>/README.md`
- `<repo-root>/docs/adr/`
- `<repo-root>/.agents/skills/markdown-viewer-feature-planning/references/repo-research-summary.md`

# branch and planning commit

- Branch: `codex/editor-save-watch-plan`
- Planning commit: pending
- Remote: `origin ssh://git@github.com/nyosegawa/markdown-viewer.git`
- Push result: pending
- Continue implementation on this same branch. Do not create a separate implementation branch unless the user explicitly redirects.

# freshness policy and freshness result

- Read `research.md` Freshness Check first.
- Refresh external or time-sensitive facts only when they affect implementation; record sources.
- Freshness result: fast freshness check passed; no watched input changes.

# execution rules

- Follow `plan.md`; complete `todo.md` phases in order unless a recorded dependency change requires otherwise.
- Split a phase only when it is too broad, mixed, or hard to validate/review/commit coherently.
- Update `todo.md` with status and evidence after each phase.
- Record major discoveries, rejected approaches, and boundary decisions in `plan.md` or `research.md`.

# validation rules

- Run phase-specific validation before marking a phase complete.
- Minimum gate: `npm run test:run && (cd src-tauri && cargo test --lib)`.
- For this user-facing app change, also run lint, typecheck, Rust fmt/clippy, `npm run tauri build`, replace `/Applications/markdown-viewer.app`, and verify installed app launch unless the user waives it.
- Record exact commands/results or blockers.

# review rules

- After validation, use an independent reviewer subagent when available.
- If unavailable, do a fresh self-review and record that limitation.
- Fix rejected issues, then rerun validation and review before commit.

# commit rules

- Prefer one commit per completed phase after validation and review.
- Use concise imperative messages, avoid unrelated changes, and record commit hashes in `todo.md`.

# push rules

- Push completed phase commits when sharing/PR work is required.
- Record branch, remote, pushed hash, and push result; escalate auth/protection/network/remote/upstream blockers.

# PR rules

- After all phases and final validation, create a PR with `gh` when available and in scope.
- PR body summarizes ADR change, copy UX, autosave, watcher reconciliation, validation, review, risks, and skipped checks.

# CI follow-through rules

- Watch CI to success or failure.
- Fix in-scope failures, validate, commit, push, and keep watching; escalate unavailable credentials, protected environments, paid resources, or approvals.

# evidence rules

- Record implementation, validation, review, commit, push, PR, and CI evidence in `todo.md`.
- Do not claim completion without evidence.

# stop conditions

Stop only when all phases/tasks are complete, completion criteria are met, required validation passed or has a recorded user-approved exception, review evidence is recorded, commit/push evidence is recorded when applicable, and PR/CI has a concrete result when applicable.

# escalation conditions

Escalate conflicting requirements, data-loss risk without clear policy, unavailable required validation, repo guidance conflicts, forbidden edits, or branch/worktree state that prevents safe commits.
