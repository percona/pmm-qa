# .claude/skills/qa-code-review/SKILL.md — section 6's posting mechanics assume `gh`; document the MCP review flow

- Added: 2026-09-03
- Applies to: .claude/skills/qa-code-review/SKILL.md
- Evidence: In a Claude Code web session reviewing percona/pmm-qa#1220, `gh pr comment --edit-last` and `confirmed: true` were unavailable (no `gh`; the GitHub MCP review tools take neither), and confirming the submitted review by paging `get_reviews` oldest-first cost four calls.
- Proposed change: Add the MCP route next to the `gh` one: `pull_request_review_write create` with `commitID` set to the head SHA, one `add_comment_to_pending_review` per thread (`startLine`/`line`, `side: RIGHT`, `subjectType: LINE`), `submit_pending` with `event: COMMENT`, then verify with a single `get_review_comments` call filtered by author and time.
