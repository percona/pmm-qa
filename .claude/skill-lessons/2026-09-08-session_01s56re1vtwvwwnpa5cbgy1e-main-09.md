# .claude/agents/investigator.md — a review-comment wake relays one thread; fetch them all before acting

- Added: 2026-09-08
- Applies to: all agents that act on PR review events
- Evidence: A `pull_request_review_comment.created` wake carried a single comment-style nit, while `pull_request_read` (`get_review_comments`) on the same PR returned four threads — including the one finding that mattered, that the fix never reached a duplicated download path in another file.
- Proposed change: State that on any review-comment event the first action is `pull_request_read` with `get_review_comments` for the whole thread list, because the wake relays one comment and acting on it alone can leave the substantive findings unread.
