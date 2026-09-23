# .claude/skills/repos/SKILL.md — search_pull_requests reaches an unattached percona/pmm while pull_request_read is refused

- Added: 2026-09-22
- Applies to: target only
- Evidence: in a session scoped to `percona/pmm-qa`, `mcp__github__search_pull_requests` with `repo:percona/pmm <JIRA-KEY>` returned the ticket's PR including its full `body` (which carried the pmm-submodules FB link), while `mcp__github__pull_request_read` on the same PR was refused with "repository is not configured for this session"; `gh api repos/percona/pmm/pulls` 403'd as well.
- Proposed change: in the MCP-first tool map, record that for an unattached but public repo the searches still work and are the way to get a PR number and its body (with `fields` including `body`), while `pull_request_read`/`gh api` are refused — so the PR body and number come from `search_pull_requests` and the diff from the anonymous-git recipe in the `git-diff` skill.
