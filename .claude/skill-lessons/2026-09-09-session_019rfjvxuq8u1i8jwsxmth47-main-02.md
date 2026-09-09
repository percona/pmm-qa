# .claude/agents/investigator.md — a review-comment wake carries one comment, not the review

- Added: 2026-09-09
- Applies to: any agent handling PR review events
- Evidence: a review wake on an own PR delivered exactly one review comment; it was fixed and pushed, and only the `get_review_comments` call afterwards revealed four open threads — two of them a distinct, more serious finding (a diagnostic asserting a cause its exit code could not establish) that would have been left open had the notification been treated as the whole review. Cost an extra commit-and-push round on top of the near-miss.
- Proposed change: on a review event, fetch the PR's full thread list before making any change, and address every open thread in one round; the comment in the wake is one item from a review that may carry several, and a companion thread on a second file is common when the same change was applied twice.
