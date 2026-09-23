# .claude/skills/repos/SKILL.md — `gh api --paginate` 403s on page 2 through the agent proxy

- Added: 2026-09-23
- Applies to: every `gh api --paginate` fallback in skills and agents
- Evidence: `gh api --paginate "repos/percona/pmm-qa/actions/runs/<id>/jobs?per_page=100"` printed page 1 then exited 1 with HTTP 403 `Numeric-ID repository paths (repositories/{id}/...) are not supported through this proxy`, because GitHub's `Link: next` header points at `repositories/<id>/...`; an explicit `?per_page=100&page=N` loop on the `repos/{owner}/{repo}` path returned every page.
- Proposed change: Replace the `gh api --paginate` fallback in the tool map (the List PRs row) with an explicit `&page=N` loop that stops on a short page, and state that `--paginate` cannot pass the proxy.
