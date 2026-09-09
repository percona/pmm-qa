# .claude/skills/repos/SKILL.md — poll a watched PR with the list call, escalate to `get` only when `updated_at` moves

- Added: 2026-09-09
- Applies to: .claude/skills/repos/SKILL.md
- Evidence: Four hourly check-ins on one PR each called `pull_request_read` `get`, which returns the full PR body — roughly 9k tokens per poll of a description the same session had written — and every poll returned an unchanged `updated_at`, state and head.
- Proposed change: For a recurring watch, poll `list_pull_requests` filtered to the head branch with `fields` limited to state/merged/updated_at/head, and call `pull_request_read` `get` only when one of those moves or when mergeability is actually in question.
