# CLAUDE.md — `pkill -f` matches the pattern in your own command line

- Added: 2026-09-08
- Applies to: all agents and routines in this repo
- Evidence: `pkill -f "pre-commit-lint-gate.sh"` in a compound Bash call killed the calling shell as well as the target, taking the command down with exit 144 and losing the staged work in progress.
- Proposed change: In the House style section, require killing by pid from a prior `pgrep` (`kill -9 <pid>`) rather than `pkill -f <pattern>`, since the agent's own command line contains the pattern.
