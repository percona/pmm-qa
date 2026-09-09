# .claude/skills/repos/SKILL.md — a `create_pull_request` error can arrive after the PR exists

- Added: 2026-09-09
- Applies to: .claude/skills/repos/SKILL.md
- Evidence: `mcp__github__create_pull_request` returned "failed to request reviewers: Validation Failed" and no URL, yet the PR had been created (#1399, reviewers attached); a retry would have opened a duplicate, and `list_pull_requests` filtered on the head branch was what showed it.
- Proposed change: In the PR-creation guidance, state that this tool creates the PR before requesting reviewers, so on any error check `list_pull_requests` for the head branch before retrying, and treat a missing URL as unknown rather than failed.
