# .claude/skills/repos/SKILL.md — list_pull_requests reports merged:false for a squash-merged PR

- Added: 2026-09-11
- Applies to: all skills that poll PR state through the GitHub MCP server
- Evidence: A PR squash-merged as a new commit on master came back from list_pull_requests with fields [number,state,merged,updated_at,head] as state "closed", merged false; git log on the freshly fetched base branch showed the squash commit carrying the change.
- Proposed change: Treat merged:false from list_pull_requests as unproven when state is closed — confirm by fetching the base branch and looking for the squash commit (or by pull_request_read get) before reporting a PR as closed without merging.
