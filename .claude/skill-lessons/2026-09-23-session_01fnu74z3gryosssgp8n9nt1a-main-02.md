# .claude/skills/repos/SKILL.md — `gh api .../actions/jobs/<id>/logs` fails without `--allow-escape-sequences` (recurrence)

- Added: 2026-09-23
- Applies to: target only
- Evidence: A second session hit the same refusal (`the response contains terminal escape sequences`, exit 1) fetching a nightly job's log, and succeeded on retry with `--allow-escape-sequences`.
- Proposed change: Same as the 2026-09-22 entry — the tool map's single-job-log fallback carries `--allow-escape-sequences`.
