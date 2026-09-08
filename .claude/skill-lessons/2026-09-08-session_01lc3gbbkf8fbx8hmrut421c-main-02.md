# CLAUDE.md — check a third-party action's own inputs before hand-rolling behaviour inside it

- Added: 2026-09-08
- Applies to: all agents and routines (House style)
- Evidence: To make a `actions/github-script@v7` poll survive a transient GitHub API 500, a session wrote ~30 lines of retry/backoff JS into the inline `script:` and pasted it into three workflow files; review pointed out the action already takes a `retries` input that enables `@octokit/plugin-retry` on the same `github` client, covering `github.paginate` too, so the whole 93-line change collapsed to one `retries: 5` line per step.
- Proposed change: Add a House style rule that before implementing retry, pagination, auth, logging or timeout behaviour inside a third-party action's inline script or config, read that action's own `action.yml` inputs first (for a pinned ref, e.g. `curl raw.githubusercontent.com/<owner>/<repo>/<ref>/action.yml`) and prefer an existing input over hand-rolled equivalents.
