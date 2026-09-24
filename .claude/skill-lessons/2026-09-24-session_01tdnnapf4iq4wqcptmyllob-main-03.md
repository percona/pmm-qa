# .claude/skills/fb-tests/SKILL.md — the empty-Launchable-subset caveat also applies to CLI jobs

- Added: 2026-09-24
- Applies to: .claude/skills/fb-tests/SKILL.md, .claude/agents/fb-reporter.md
- Evidence: For the FB run of a PR that changed pmm-admin's env-var error text, every `CLI / Integration / PSMDB Replica *` job was green in about 50s. Its log shows `Launchable subset is empty. Downstream setup and tests will be skipped.`, so PMM-T2129, which the PR breaks, never ran. The skill's green-means-ran check is written for "pmm-qa e2e jobs" only.
- Proposed change: Extend the "green is evidence only if tests executed" rule to `runner-integration-cli-tests.yml` jobs (skip step `No tests selected by Launchable subset`), and have Test Runner/FB Reporter list the empty-subset jobs in the ticket report instead of treating them as coverage.
