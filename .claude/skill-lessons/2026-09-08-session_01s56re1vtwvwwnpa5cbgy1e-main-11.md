# .claude/agents/investigator.md — fetch the PR head before implementing a review suggestion; the author may have applied it

- Added: 2026-09-08
- Applies to: .claude/agents/investigator.md
- Evidence: A suggestion from the PR author was implemented, validated and committed locally, and the push was rejected non-fast-forward because the author had already committed the identical change through GitHub's apply-suggestion button ("Apply suggestion from @…"), so the local commit had to be discarded and the branch reset.
- Proposed change: Add that a review suggestion, especially from the PR author, starts with a fetch of the PR head — an already-applied suggestion needs no commit, and a redundant one costs a discarded push and a reset.
