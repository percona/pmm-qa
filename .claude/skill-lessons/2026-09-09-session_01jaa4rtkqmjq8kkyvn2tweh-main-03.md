# .claude/skills/repos/SKILL.md — `get_status` is not a cheap stand-in for `get_check_runs`

- Added: 2026-09-09
- Applies to: .claude/skills/repos/SKILL.md
- Evidence: To avoid the known token cost of `pull_request_read` `get_check_runs`, the combined commit status was read first and returned `state: "pending", total_count: 0, statuses: []` on a PR whose 55 check runs were in fact complete — the repo publishes no legacy commit statuses, so the cheap call carried no information and `get_check_runs` had to be made anyway.
- Proposed change: In the tool map, note that repositories using GitHub Actions publish check runs and usually no commit statuses, so `get_status` returning `pending` with `total_count: 0` means "no statuses exist", never "checks are pending" — do not read it as a pass/fail signal.
