# .claude/skills/repos/SKILL.md — `gh pr create` is GraphQL-backed and 403s; use the MCP tool

- Added: 2026-09-05
- Applies to: target only
- Evidence: `gh pr create --repo percona/pmm-qa --base main --head <branch> --title ... --body-file ...` failed with "HTTP 403: This GraphQL query is not enabled for this session — only the pinned set of PR-review operations is served."; `mcp__github__create_pull_request` with the same arguments succeeded and returned the PR URL.
- Proposed change: Add `gh pr create` to the skill's named list of GraphQL-backed `gh` commands that 403 even where `gh` exists, and add an "Open a PR" row to the tool map pointing at `create_pull_request`.
