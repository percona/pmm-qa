# .claude/skills/linode-docker-provisioning/SKILL.md — pgrep -f through run.sh matches the poller, so a liveness poll never terminates

- Added: 2026-09-03
- Applies to: target only
- Evidence: polling a detached job with `pgrep -f <script> && echo RUNNING || echo DONE` over the exec channel returned RUNNING indefinitely, including after the job had finished with exit 0, because the pattern matches the exec-server's own wrapper carrying it; two wait loops burned their full 10-minute Bash cap on an already-finished job. Polling instead for a sentinel the script writes (`echo DONE_MARKER=$?` appended to its log) returned immediately and correctly. Distinct from the recorded `pkill -f` entry, which kills the caller's shell rather than mis-reporting liveness.
- Proposed change: alongside the existing detached-launch guidance, say to end every detached script with a sentinel line and poll for that sentinel in the log, never `pgrep -f`/`pkill -f` on the script name, since `-f` also matches the exec-server wrapper carrying the poll.
