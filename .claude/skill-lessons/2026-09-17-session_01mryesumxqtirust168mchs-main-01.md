# .claude/skills/linode-docker-provisioning/SKILL.md — a short `tail -N` still overflows run.sh's payload cap on an ansible log

- Added: 2026-09-17
- Applies to: .claude/skills/linode-docker-provisioning/SKILL.md
- Evidence: Polling a detached `pmm-framework` setup with `run.sh <id> -- "tail -5 /root/setup_pxc.log; grep -c DONE_MARKER ..."` aborted the whole call with `/usr/local/bin/python3: Argument list too long` and returned nothing. `pmm-framework --verbose` runs Ansible, whose per-task result lines are tens of KiB each, so five lines exceeded the 128 KiB MAX_ARG_STRLEN that run.sh's single-argv response hits — the line count is not the bound, the byte count is. The identical poll with `| cut -c1-220` appended returned normally and was used for every later poll.
- Proposed change: In "run.sh cannot return a large payload" (or the "Judge a detached run's progress" paragraph), state that a small `tail -N` is not automatically safe and that any poll of an ansible/playbook log must bound line width too — `tail -3 <log> | cut -c1-200` — since the existing guidance only warns about commands that obviously produce bulk output.
