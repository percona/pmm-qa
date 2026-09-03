# .claude/skills/repos/SKILL.md — read one Actions job with get_workflow_job, not a run-wide listing

- Added: 2026-09-03
- Applies to: .claude/skills/repos/SKILL.md
- Evidence: polling one FB helm job's status via `actions_list`/`list_workflow_jobs` returned every job's full step list — it overflowed the result cap at `perPage: 100` and still dumped hundreds of step objects at `perPage: 5`; `actions_get`/`get_workflow_job` with the job id answered the same question in one small response. `list_workflow_runs` behaves the same way, embedding each run's whole head_commit message.
- Proposed change: in the tool map, note that the listing calls are for enumerating, and that a known job or run should be read with `actions_get` (`get_workflow_job` / `get_workflow_run`) instead.
