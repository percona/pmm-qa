# .claude/skills/jira/SKILL.md — the relay `search` action does not paginate with startAt or nextPageToken

- Added: 2026-09-05
- Applies to: .claude/skills/jira/SKILL.md
- Evidence: Six consecutive relay `search` calls passing `startAt` (and then the returned `nextPageToken`) each returned the same first 100 issues, so a 219-issue JQL result was silently read as 600 duplicates.
- Proposed change: Document that a result set over 100 must be paged with a JQL cursor — `ORDER BY created ASC` plus `created >= "<created of the last issue, to the minute>"` on each following call — and deduplicated by key.
