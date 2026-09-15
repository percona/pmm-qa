# .claude/skills/linode-docker-provisioning/SKILL.md — a remote poll loop's TOTAL duration, not each sleep, must fit the 600s exec-server cap

- Added: 2026-09-15
- Applies to: .claude/skills/linode-docker-provisioning/SKILL.md
- Evidence: A single `run.sh` call carrying `for i in 1..5; do ...; sleep 120; done` obeyed the documented "keep an in-command sleep under ~240s" rule for each individual sleep, but its ~600s total hit the exec-server cap and the call died with `curl: (52) Empty reply from server` / "failed to reach exec-server", returning none of the polls. The detached job it was watching was unaffected. Replacing it with a session-side Monitor issuing one short `run.sh` per iteration worked.
- Proposed change: In "Keep an in-command `sleep` under ~240s, and chunk the polling", state that the cap applies to the whole command's wall clock, so a multi-iteration poll loop must keep its total under it; prefer a session-side Monitor that issues one short `run.sh` per iteration over any in-command loop.
