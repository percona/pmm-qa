# .claude/skills/linode-docker-provisioning/SKILL.md — a `DONE_MARKER=130` in the sentinel means the detach did not hold, not that the command failed

- Added: 2026-09-09
- Applies to: target only
- Evidence: The documented `nohup bash -c '<cmd>; echo DONE_MARKER=$?' >log 2>&1 &` recipe returned promptly and completed cleanly for a short `docker pull`, but the same shape around a ~10-minute `pmm-framework --parallel` run was killed mid-playbook: the log ended inside an ansible task and the sentinel read `DONE_MARKER=130` (SIGINT from the exec-server's teardown reaching the grandchild), which reads as a setup failure. Relaunching the identical script as `setsid nohup bash -c '...' >log 2>&1 </dev/null &` ran to completion with `DONE_MARKER=0`.
- Proposed change: Alongside the detached-launch recipe, note that `nohup … &` can look fine on a short command and only fail past the exec-server's round trip, and that a sentinel value of 130 (or any 128+N) means the launch was not fd-detached — relaunch with `setsid` and `</dev/null` rather than investigating the command.
