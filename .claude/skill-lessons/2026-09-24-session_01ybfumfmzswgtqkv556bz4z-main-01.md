# .claude/skills/jenkins-builds/SKILL.md — Read a parallel pkg-testing failure from an exported log, 40 lines above "Failed in branch"

- Added: 2026-09-24
- Applies to: target only
- Evidence: On nightly-package-testing-* builds, get_build_console_output with a timestamp-window regex returned ~7k tokens of verbose Ansible module output without reaching the error; export_build_log to the scratchpad, then grep -n 'Failed in branch' plus the 40 preceding lines, surfaced the terminal traceback of three builds in one call. A branch that fails with no failed=N PLAY RECAP died in a non-Ansible bootstrap sh step (apt-add-repository ppa: timing out on the Launchpad API), not in a playbook.
- Proposed change: In "A parallel build: stage map first, console second", add: for multi-MB consoles, export_build_log and grep locally; the failing branch's error sits immediately before its "Failed in branch <name>" marker, and a missing failed=N recap for that branch means a bootstrap sh step failed.
