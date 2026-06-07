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
- Phase Checklist
- Task Checklist By Phase
- Implementation Notes
- Validation Evidence
- Review Evidence
- Commit Log
- Final Checklist

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

Required sections:

- `/goal` command
- source artifact paths
- repo guidance paths
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

## Validator Contract

`scripts/validate-artifacts.mjs` must:

- accept the feature artifact directory path as an argument
- verify required files and sections
- verify `todo.md` contains at least one `P###` phase
- verify each phase has required fields and at least one `T###` task unless explicitly planning-only or validation-only
- verify `goal-prompt.md` contains absolute paths to `research.md`, `plan.md`, and `todo.md`
- print clear pass/fail details
- exit non-zero on validation failure

