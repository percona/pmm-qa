# .claude/skills/repos/SKILL.md — `actions_list` ignores `workflow_id`; filter client-side on `path`

- Added: 2026-09-05
- Applies to: target only
- Evidence: Two `mcp__github__actions_list` (list_workflow_runs) calls on percona/pmm-qa passing `workflow_id` of "e2e-tests-matrix.yml" and "gssapi-psmdb-tests-matrix.yml" both returned the unfiltered account-wide run list (Notify Investigator, Helm tests, PMM Integration Tests) at ~53KB each, every row carrying a full head_commit.message; `minimal_output: true` did not reduce it.
- Proposed change: In the "Big listings overflow the result cap" section, note that `list_workflow_runs` does not honor `workflow_id` and that a specific workflow's runs must be selected client-side by each row's `path` field (jq), or reached via the workflow source plus a targeted `get_job_logs` on a known job id.
