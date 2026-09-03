# .claude/skills/linode-docker-provisioning/SKILL.md — a detached run's log is block-buffered, so tailing it understates progress

- Added: 2026-09-02
- Applies to: target only
- Evidence: a detached Node test runner writing to a redirected log showed only 2 completed scenarios for many minutes while its screenshot output directory proved the run had advanced well past that, prompting repeated pointless progress polls and a false "hung" read.
- Proposed change: note that a process whose stdout is a file rather than a TTY flushes in blocks, so progress should be judged from side effects (artifact mtimes) or by waiting for the process to exit and reading the whole log once, not from tailing it.
