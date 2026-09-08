# .claude/skills/linode-docker-provisioning/SKILL.md — the session's own Bash call also caps at 600s, so a poll loop must be split across calls

- Added: 2026-09-08
- Applies to: .claude/skills/linode-docker-provisioning/SKILL.md
- Evidence: A single poll loop written as `for i in $(seq 1 16)` with `sleep 100` between `run.sh` checks was cut off and moved to the background at 600s despite a larger `timeout` argument, so its later polls and the final result read were lost and had to be reissued.
- Proposed change: Alongside the existing note about the exec-server's 600s command timeout, state that one Bash tool call is bounded the same way, so polling a detached run must be chunked into several calls (roughly five polls each) rather than one long loop.
