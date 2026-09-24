# .claude/skills/qa-code-review/references/playwright-suite.md — a CodeceptJS port keeps each PMM-T case's id and title as the source had them

- Added: 2026-09-24
- Applies to: qa-code-review on CodeceptJS→Playwright migration PRs
- Evidence: On a migration PR the author declined a 🔵 to fix a ported title's missing `+` separator and a 🟡 to fold PMM-T1467 into the identical PMM-T659, because migrated titles stay verbatim for Zephyr/CodeceptJS traceability and each id runs on a different surface (https://github.com/percona/pmm-qa/pull/1488#discussion_r4093683963, https://github.com/percona/pmm-qa/pull/1488#discussion_r4093683185).
- Proposed change: Add a migration row: a port preserves every PMM-T case and its title exactly as the CodeceptJS source had them, so a title-format nit or a merge of two same-bodied cases is out of scope for the port (raise it as a separate follow-up, not a finding on the migration).
