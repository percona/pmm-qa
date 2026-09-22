# .claude/skills/repos/SKILL.md — `gh api .../actions/jobs/<id>/logs` fails without `--allow-escape-sequences`

- Added: 2026-09-22
- Applies to: target only
- Evidence: `gh api repos/percona/pmm-qa/actions/jobs/<id>/logs > job.log` exited 1 with `the response contains terminal escape sequences; pass --allow-escape-sequences to output it anyway` and left a zero-byte file; the identical call with that flag returned the full 4353-line log.
- Proposed change: In the GitHub-access tool map, note that the `gh` fallback for a single job's log is `gh api --allow-escape-sequences repos/{o}/{r}/actions/jobs/<id>/logs` — CI logs always carry ANSI colour, so the flag is not optional.
