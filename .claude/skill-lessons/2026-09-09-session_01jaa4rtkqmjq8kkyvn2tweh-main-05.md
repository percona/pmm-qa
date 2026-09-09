# .claude/skills/repos/SKILL.md — a field the `list_pull_requests` filter cannot supply is dropped, not reported

- Added: 2026-09-09
- Applies to: .claude/skills/repos/SKILL.md
- Evidence: `list_pull_requests` called with `fields` including `mergeable_state` and `comments` returned neither key and no error; both are only populated by the single-PR endpoint, so a caller checking "is there a conflict?" from that response would read an absent field as "no conflict".
- Proposed change: Note that `fields` on a list call silently omits anything the list endpoint does not populate — `mergeable_state`, `mergeable` and comment counts among them — so mergeability and conflict questions must go through `pull_request_read` `get`, and an absent key is never a negative answer.
