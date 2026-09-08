# .claude/skills/linode-docker-provisioning/SKILL.md — a codeceptjs run needs `--verbose` or its `I.say` output never appears

- Added: 2026-09-08
- Applies to: .claude/skills/linode-docker-provisioning/SKILL.md
- Evidence: A diagnostic scenario whose whole purpose was to print measured values via `I.say` was run without `--verbose`; it passed and its log held only `PROBE_RC=0`, with none of the measurements, so the entire detached run had to be repeated with the flag added.
- Proposed change: In the section on running the suites on the box, note that `I.say` output is only emitted under `--verbose`, so any run whose value is the reported measurements must pass it.
