# /goal command

Implement the planned feature from `todo.md`, one phase per iteration.

Keep this goal prompt under 4000 characters. Prefer concise execution rules and absolute artifact paths over repeating details already present in research.md, plan.md, and todo.md.

# source artifact paths

- Research: `/absolute/path/to/.agent-work/features/<date>-<slug>/research.md`
- Plan: `/absolute/path/to/.agent-work/features/<date>-<slug>/plan.md`
- TODO: `/absolute/path/to/.agent-work/features/<date>-<slug>/todo.md`

# repo guidance paths

- `<repo-root>/AGENTS.md`
- `<repo-root>/README.md`
- `<repo-root>/docs/adr/`
- `<repo-root>/.agents/skills/markdown-viewer-feature-planning/references/repo-research-summary.md`

# branch and planning commit

- Branch:
- Planning commit:
- Remote:
- Push result:
- Continue implementation on this same branch. Do not create a separate implementation branch unless the user explicitly redirects.

# freshness policy and freshness result

- Read `research.md` Freshness Check first.
- Refresh external or time-sensitive facts only when they affect implementation; record sources.
- Freshness result:

# execution rules

- Follow `plan.md`; complete `todo.md` phases in order unless a recorded dependency change requires otherwise.
- Split a phase only when it is too broad, mixed, or hard to validate/review/commit coherently.
- Update `todo.md` with status and evidence after each phase.
- Record major discoveries, rejected approaches, and boundary decisions in `plan.md` or `research.md`.

# validation rules

- Run phase-specific validation before marking a phase complete.
- Minimum gate: `npm run test:run && (cd src-tauri && cargo test --lib)`.
- Add lint/typecheck/Rust fmt/clippy/build/E2E/Tauri build/install/launch checks when `plan.md` or repo guidance requires them.
- Record exact commands/results or the blocker.

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
- PR body summarizes phases, validation, review, risks, and skipped checks.

# CI follow-through rules

- Watch CI to success or failure when in scope.
- Fix in-scope failures, validate, commit, push, and keep watching; escalate unavailable credentials, protected environments, paid resources, or approvals.

# evidence rules

- Record implementation, validation, review, commit, push, PR, and CI evidence in `todo.md`.
- Do not claim completion without evidence.

# stop conditions

Stop only when all phases/tasks are complete, completion criteria are met, required validation passed or has a recorded user-approved exception, review evidence is recorded, commit/push evidence is recorded when applicable, and PR/CI has a concrete result when applicable.

# escalation conditions

Escalate conflicting requirements, unresolved architecture tradeoffs, unavailable required validation, repo guidance conflicts, forbidden edits, or branch/worktree state that prevents safe commits.
