# .claude/skills/linode-docker-provisioning/SKILL.md — pkill/pgrep -f on the box match run.sh's own argv, so they self-kill and report phantom processes

- Added: 2026-09-08
- Applies to: target only
- Evidence: `pkill -9 -f pmm-framework` sent inside a `run.sh` command whose own argv contained "pmm-framework" killed its own launching shell, so the detached relaunch on the following line never ran and its log file was never created; the follow-up `pgrep -c -f pmm-framework` then returned 1 by matching the wrapper itself, which read as "the process is running". Acting on that reading started a duplicate setup that removed containers the first run still needed, corrupting the environment.
- Proposed change: In the "Accessing the VM" section, warn that every `pgrep`/`pkill -f` pattern sent through `run.sh` also matches the remote shell carrying it — so target a pidfile or an exact program path instead, and confirm a launch or a kill by the state it changes (a log file growing, containers gone) rather than by a process count on that pattern.
