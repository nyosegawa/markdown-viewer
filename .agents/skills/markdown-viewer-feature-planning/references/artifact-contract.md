# Artifact Contract

Feature planning artifacts must live only under `.agent-work/features/<date>-<slug>/`.

Required files:

- `research.md`
- `plan.md`
- `todo.md`
- `goal-prompt.md`

## Markdown Section Matching

Validators treat a required top-level section as present when a Markdown heading matches the required section name after normalization:

- accept `#`, `##`, or `###`
- strip leading/trailing whitespace
- ignore case
- treat repeated internal whitespace as one space
- ignore optional trailing punctuation only at the end
- ignore headings inside fenced code blocks

## research.md

Required sections:

- Scope
- Freshness Check
- Branch Setup
- Investigation Method
- Subagent Rounds
- Sources Inspected
- Findings
- Repo Guidance Findings
- Architecture / Boundary Findings
- Validation / CI Findings
- Existing Skill / Command Findings
- Web / Current-State Findings
- Freshness / Staleness Findings
- Generated / Vendored / Protected File Findings
- Risks
- Decisions
- Rejected Approaches
- Remaining Unknowns

## plan.md

Required sections:

- Summary
- Background
- Current State
- Goals
- Non-Goals
- Repo-Specific Constraints
- Design Decisions
- Impacted Areas
- Validation Plan
- Commit, PR, And CI Plan
- Risks
- Completion Criteria
- Open Questions

## todo.md

Required sections:

- Status Summary
- Branch And Planning Commit
- Phase Checklist
- Task Checklist By Phase
- Implementation Notes
- Validation Evidence
- Review Evidence
- Commit Log
- Final Checklist

`Branch And Planning Commit` must include:

- Branch:
- Planning commit:
- Remote:
- Push result:
- Blockers:

Each phase must include:

- checkbox
- phase id
- title
- goal
- scope
- expected files/areas
- validation
- review
- commit
- push
- PR/CI
- evidence fields
- included task checklist

Each task inside a phase must include:

- checkbox
- task id
- title
- expected files/areas when different from the phase
- validation note when different from the phase validation

## goal-prompt.md

`goal-prompt.md` must be 4000 characters or fewer. Count characters, not bytes.

Required sections:

- `/goal` command
- source artifact paths
- repo guidance paths
- branch and planning commit
- freshness policy and freshness result
- execution rules
- validation rules
- review rules
- commit rules
- push rules
- PR rules
- CI follow-through rules
- evidence rules
- stop conditions
- escalation conditions

The generated `goal-prompt.md` must:

- include absolute paths to `research.md`, `plan.md`, and `todo.md`
- include the branch name
- instruct `/goal` to continue implementation on the same branch used for planning
- refer to `research.md`, `plan.md`, and `todo.md` for detail instead of duplicating long content
- avoid private home-directory paths and machine-specific guidance paths except the active repo artifact paths required above

Reusable templates must use placeholders such as `<repo-root>` and must not hardcode user-local paths.

## Validator Contract

`scripts/validate-artifacts.mjs` must:

- accept the feature artifact directory path as an argument
- verify required files and sections
- verify `goal-prompt.md` is 4000 characters or fewer
- verify `todo.md` contains `Branch And Planning Commit`
- verify `todo.md` contains branch name, planning commit field, remote field, push result field, and blockers field
- verify `todo.md` contains at least one `P###` phase
- verify each phase has required fields and at least one `T###` task unless explicitly planning-only or validation-only
- verify `goal-prompt.md` contains absolute paths to `research.md`, `plan.md`, and `todo.md`
- verify `goal-prompt.md` contains the branch name and a same-branch implementation rule
- print clear pass/fail details
- exit non-zero on validation failure
