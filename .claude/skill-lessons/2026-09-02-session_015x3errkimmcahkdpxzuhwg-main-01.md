# .claude/skills/qa-code-review/SKILL.md — a remedy that deletes a CI job is the author's trade-off, not a directive

- Added: 2026-09-02
- Applies to: target only
- Evidence: A review thread on a pmm-qa PR closed with the imperative "Drop this job; `fb_tests` already covers PR-CI and scheduled runs" after correctly establishing that a new `server-logs` job in `e2e-tests-matrix.yml` and the `settings` job reached through `fb_tests` both ran the same three tests in one PR-CI build; the job was deleted and pushed on the strength of that wording, and the author then reversed it, wanting the dedicated job kept despite the duplicate run — costing a push, a revert push and a correction on the thread.
- Proposed change: In section 3 item 7 (Over-engineering), say that when the remedy for a duplication finding is to remove a CI job, a workflow entry or a test, the finding states the cost and asks the author to confirm rather than prescribing the deletion, because run-cost against dedicated coverage is a trade-off only the author can settle.
