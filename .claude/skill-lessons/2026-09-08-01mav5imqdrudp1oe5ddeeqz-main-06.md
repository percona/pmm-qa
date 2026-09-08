# .claude/skills/repos/SKILL.md — tally many check runs with a jq-filtered `gh api`, not the MCP check-runs listing

- Added: 2026-09-08
- Applies to: .claude/skills/repos/SKILL.md
- Evidence: Answering "is anything red?" on a PR with 37 check runs cost roughly 7k tokens per call through the GitHub MCP `pull_request_read` `get_check_runs`, which returns every run's full object, and the same question was asked on three consecutive PR-activity wakes. `gh api "repos/<o>/<r>/commits/<sha>/check-runs?per_page=100" --jq` grouped by conclusion answered it in a few lines; it is a plain REST path, so it is not subject to the `search/*` and GraphQL 403s documented in the same skill.
- Proposed change: In the tool map, note that a pass/fail tally across many check runs should use a jq-filtered `gh api .../check-runs` where `gh` is present, reserving the MCP `get_check_runs` for when the individual run objects are actually needed.
