# .claude/skills/repos/SKILL.md — add_repo attaches an unattached percona/* repo for reads; only the push is refused

- Added: 2026-09-15
- Applies to: .claude/skills/repos/SKILL.md ("An unattached `percona/*` repo is the same case")
- Evidence: `add_repo` (owner `percona`, repo `percona-helm-charts`, `access: "push"`) returned `"status": "appended"` with `"push_check": "refused"` and reported the session holding 2 repos; a `list_pull_requests` call that had just failed with "not configured for this session" then succeeded, as did `search_pull_requests`. The skill currently states add_repo returns `read_available`, attaches nothing, and refuses `access: "push"` outright.
- Proposed change: correct that section to say `access: "push"` on an unattached same-org repo may attach it for reads and downgrade only git push (`push_check: "refused"`), so a session needing GitHub MCP reads (PR search by `head:`, check runs, PR metadata) should try add_repo rather than falling back to anonymous git, which cannot serve those reads.
