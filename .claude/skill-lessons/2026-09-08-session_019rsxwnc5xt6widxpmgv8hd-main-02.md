# .claude/skills/repos/SKILL.md — a run's own inputs (server address, versions, install type) come from its logs zip, not another listing call

- Added: 2026-09-08
- Applies to: .claude/skills/repos/SKILL.md
- Evidence: `actions_list list_workflow_jobs` on one 18-job nightly run returned ~12k tokens of inline step lists; the per-run facts actually needed to compare four sibling nightlies — `SERVER_IP`, `PMM_CLIENT_VERSION`, `INSTALLATION_TYPE` and which shard failed — came from `get_workflow_run_logs_url` plus a local `curl | unzip | grep`, which costs no result tokens at all and answered all four runs.
- Proposed change: In the listing-economics section, add that a workflow run's env/input values are read by grepping its run-logs zip locally, so comparing several runs never needs a per-run jobs listing.
