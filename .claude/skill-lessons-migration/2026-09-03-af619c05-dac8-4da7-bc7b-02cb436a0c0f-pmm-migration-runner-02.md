# .claude/skills/codeceptjs-migration/branch-workflow.md — run the whole new grep expression, not the list of newly-selected files

- Added: 2026-09-03
- Applies to: target only
- Evidence: The "When the edit newly selects tests outside the migrated file, run them" paragraph directs the runner at the newly-selected tests specifically; on row 4 running the edit's own expression instead (`npx playwright test --grep '@settings' --workers=1`, 12 tests across the migrated file and `portalRemoval.test.ts`) cost one run rather than two, discharged the same advisory, and additionally reproduced exactly what the new CI job selects and the order and concurrency it runs it at — evidence the per-file run cannot produce.
- Proposed change: In that paragraph, tell the runner to execute the edited job's full grep expression once at the job's own worker count, rather than only the newly-selected tests, and to report that command as the coverage-edit execution evidence.
