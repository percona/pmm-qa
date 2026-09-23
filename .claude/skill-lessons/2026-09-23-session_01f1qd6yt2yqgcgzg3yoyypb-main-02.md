# .claude/skills/qa-code-review/SKILL.md — Client-upgrade steps must verify the RUNNING pmm-agent, not the on-disk binary

- Added: 2026-09-23
- Applies to: pmm-qa upgrade GitHub Actions workflows (.github/workflows/upgrade-pmm-*.yml)
- Evidence: An upgrade runner verified only `pmm-admin --version` (binary) after restarting pmm-agent, reporting success while `pmm-admin status` showed the OLD version still running — QA DB containers start pmm-agent via `nohup` holding 127.0.0.1:7777, so `systemctl restart` (Type=simple) returns 0 before the new service fails to bind that port and crash-loops, and the `|| fallback` never ran.
- Proposed change: In a client-upgrade step, stop every agent instance (`systemctl stop` + `pkill -x pmm-agent`) and wait for the port/process to free before restart, then poll `pmm-admin status` for the new version to fail the step if the running agent is stale; keep the workflow's client-container filter in sync with the test's nonClientContainers.
