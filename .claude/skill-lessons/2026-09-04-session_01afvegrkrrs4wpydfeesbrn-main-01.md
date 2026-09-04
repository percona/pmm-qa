# .claude/skills/repos/SKILL.md — get_files also spills, and spilled entries have non-uniform keys

- Added: 2026-09-04
- Applies to: .claude/skills/repos/SKILL.md
- Evidence: the "Big listings overflow the result cap" table lists only `actions_list` and `list_pull_requests`, but `pull_request_read` with `method: get_files` on an 11-file pmm-qa PR also exceeded the cap and spilled to a file; the saved payload is a bare top-level list, and subscripting `f['deletions']` raised `KeyError` on an entry that carried no such key after the first entry parsed fine.
- Proposed change: add a `pull_request_read → get_files` row to that table with shape "bare top-level list", and state that per-item keys are not uniformly present in spilled payloads — parse with `.get(...)`, never bare subscripting.
