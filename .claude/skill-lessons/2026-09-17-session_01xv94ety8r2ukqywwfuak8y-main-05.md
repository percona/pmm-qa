# .claude/agents/investigator.md — a re-raised finding joins the old thread, so resolving it hides the live one

- Added: 2026-09-17
- Applies to: any agent handling review events on a PR it drives (investigator.md "Handling a review event" is the nearest owner)
- Evidence: A reviewer restated a blocking finding against a new head. Intending to resolve only the outdated comment and leave the live restatement open, `resolve_review_thread` was called on the older thread id — but GitHub had appended the new comment to that same thread (same file and line), so `get_review_comments` showed one thread of 4 comments and the resolve collapsed the standing blocker out of sight. It had to be undone with `unresolve_review_thread`.
- Proposed change: Add to the review-event paragraph that a re-raised finding on the same file and line appends to the existing thread rather than opening a new one, so "resolve the outdated one, keep the new one open" is not possible — read the thread's full comment list before resolving, and leave the thread open whenever its newest comment is still unaddressed.
