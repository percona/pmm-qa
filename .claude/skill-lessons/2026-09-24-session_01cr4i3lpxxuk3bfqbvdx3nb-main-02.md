# CLAUDE.md — "Kill by pid" still self-kills when the pid comes from `pgrep -f <pattern>`

- Added: 2026-09-24
- Applies to: House style section of CLAUDE.md
- Evidence: Following the rule literally, `for p in $(pgrep -f "port-forward svc/…"); do kill -9 $p; done` matched the calling shell (its own command line carries the pattern) and killed it, silently dropping the cleanup commands chained after it.
- Proposed change: Say to take the pid from where the process was started (`$!`, a pid file, or the harness task id) — or, if `pgrep -f` is unavoidable, exclude `$$`/`$PPID` and anchor the pattern on the binary (`pgrep -f '^kubectl .*port-forward'`).
