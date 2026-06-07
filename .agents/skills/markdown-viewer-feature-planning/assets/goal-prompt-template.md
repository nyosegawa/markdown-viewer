# /goal command

Implement the planned feature one TODO phase per iteration by default.

# source artifact paths

- Research: `/absolute/path/to/.agent-work/features/<date>-<slug>/research.md`
- Plan: `/absolute/path/to/.agent-work/features/<date>-<slug>/plan.md`
- TODO: `/absolute/path/to/.agent-work/features/<date>-<slug>/todo.md`

# repo guidance paths

- Replace `<repo-root>` with the absolute repository root when generating the final `goal-prompt.md`.
- `<repo-root>/AGENTS.md`
- `<repo-root>/README.md`
- `<repo-root>/docs/adr/`
- `<repo-root>/.agents/skills/markdown-viewer-feature-planning/references/repo-research-summary.md`

# freshness policy and freshness result

- Read the research artifact's `Freshness Check` section before implementing.
- If external or time-sensitive facts affect implementation, do web/current-state research and record sources in `research.md` or `todo.md`.
- Freshness result:

# execution rules

- Execute exactly one TODO phase per iteration by default.
- Complete all tasks in the active phase before validation and review.
- Split a phase before implementation if it is too large, mixes unrelated responsibilities, has incompatible validation methods, or cannot be reviewed/committed coherently.
- Use task-level execution only when phase-level execution is unsafe; record the reason in `todo.md`.
- Work in phase order unless `plan.md` justifies a dependency change.
- Update `todo.md` after each phase attempt with statuses, evidence, and split/merge decisions.
- Append major discoveries, rejected approaches, and boundary decisions to `plan.md` or `research.md`.

# validation rules

- Run phase-specific validation before marking a phase complete.
- Minimum completion gate: `npm run test:run && (cd src-tauri && cargo test --lib)`.
- Use `npm run lint`, `npm run typecheck`, Rust fmt/clippy, `npm run build`, or E2E when the plan calls for them.
- For user-facing app changes, run `npm run tauri build`, replace `/Applications/markdown-viewer.app`, and verify installed app launch unless the user explicitly waived it.
- Record exact commands or verification methods and results. If validation cannot run, record why and escalate when it blocks completion.

# review rules

- Spawn an independent reviewer subagent after completing a phase and running phase validation.
- The reviewer inspects the phase diff, task statuses, repo rules, and validation evidence, but does not implement fixes.
- If rejected, fix the issue, rerun validation, and rerun review.
- If subagents are unavailable, perform a separate fresh review pass and record that limitation.

# commit rules

- Prefer one commit per completed TODO phase.
- Commit only after phase validation and reviewer approval unless `plan.md` explicitly defines a red-phase commit.
- Use concise imperative commit messages.
- Record commit hashes in `todo.md`.
- Do not commit unrelated working tree changes.

# push rules

- Push completed phase commits before creating or updating a PR when sharing/PR work is required.
- Record branch, remote, pushed commit hash, and push result in `todo.md`.
- Escalate blocked pushes caused by authentication, remote protection, network failure, missing upstream configuration, or repo policy.

# PR rules

- After all implementation phases are complete and final validation passes, create a PR with `gh` when GitHub and `gh` are available and PR creation is in scope.
- PR body must summarize implemented phases, validation evidence, review evidence, known risks, and skipped checks.

# CI follow-through rules

- Watch GitHub Actions or repo CI to concrete success or failure when PR/CI follow-through is in scope.
- If CI fails, inspect logs, fix in-scope failures, rerun validation, commit, push, and continue watching.
- Escalate when CI requires unavailable credentials, external services, paid resources, protected environments, or approvals.

# evidence rules

- Record implementation, validation, review, commit, push, PR, and CI evidence in `todo.md`.
- Do not claim completion without evidence.

# stop conditions

Stop only when every TODO phase and task is complete, completion criteria are satisfied, required validation passed or a user-approved exception is recorded, review evidence is recorded, commit/push evidence is recorded when applicable, and PR/CI follow-through has a concrete result when applicable.

# escalation conditions

Escalate when requirements conflict, architecture tradeoffs cannot be resolved from the plan, required validation needs unavailable resources, repo guidance conflicts, proceeding would require forbidden edits, or branch/worktree state makes safe commits impossible.
