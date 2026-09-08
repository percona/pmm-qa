# .claude/skills/repos/SKILL.md — `gh pr create` is GraphQL-backed and 403s like the read commands already listed

- Added: 2026-09-08
- Applies to: target only
- Evidence: `gh pr create --repo … --base … --body-file …` returned `HTTP 403: This GraphQL query is not enabled for this session — only the pinned set of PR-review operations is served`; the skill's GraphQL-backed 403 list names `gh pr diff/view/list --json` and `gh pr checks` but not the write commands, so the failure looked like a permissions problem on the repo rather than the documented class.
- Proposed change: add `gh pr create` (and PR-write commands generally) to the GraphQL-backed 403 list, with `mcp__github__create_pull_request` named as the replacement in the tool map's row for opening a PR.
