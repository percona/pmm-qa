# .claude/skills/repos/SKILL.md — GitHub `search/*` REST endpoints are refused by the proxy; use the GitHub MCP search tools

- Added: 2026-09-04
- Applies to: .claude/skills/repos/SKILL.md
- Evidence: `gh api search/issues?q=repo:percona/pmm-qa+launchable` and `gh api search/commits` both returned HTTP 403 "sessions are bound to their configured repositories", while the GitHub MCP `search_pull_requests` with `owner`/`repo` set answered the same question (PRs 824, 860, 903 dated the Launchable rollout) in one call.
- Proposed change: In the GitHub access section, state that `search/*` REST paths are blocked and that PR/issue/commit searches must go through the MCP `search_*` tools scoped with owner and repo, or through `repos/<owner>/<repo>/commits?path=` for file history.
