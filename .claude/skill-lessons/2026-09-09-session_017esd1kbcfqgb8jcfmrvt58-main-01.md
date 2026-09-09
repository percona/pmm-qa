# .claude/skills/qa-code-review/references/playwright-suite.md — an afterEach cleanup must assert its own success, not just run

- Added: 2026-09-09
- Applies to: .claude/skills/qa-code-review/references/playwright-suite.md
- Evidence: percona/pmm-qa#1353, discussion_r3967336987. A human reviewer flagged that a `catch` around a password-restore call could swallow a failed restore and let the corrupted (unrestored) password leak into the next test — a case the review passed over. The author's fix (discussion_r3968131401, applied in b33c4231) did not just move the cleanup into `afterEach`; it made `afterEach` call `getDataSourceByName()` after the restore so a failed restore now fails that test loudly instead of silently breaking the next one.
- Proposed change: extend the existing "cleanup in afterEach, not try/finally" guidance (playwright-suite.md:78) to state that an afterEach cleanup/restore step must itself assert success (or call an API whose failure surfaces), not merely be invoked — an unchecked cleanup failure can silently leak corrupted state into the next test.
