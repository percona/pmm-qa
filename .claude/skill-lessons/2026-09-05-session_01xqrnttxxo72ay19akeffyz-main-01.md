# .claude/agents/investigator.md — a green FB/e2e job may have run zero tests; check the Launchable subset before citing it as evidence

- Added: 2026-09-05
- Applies to: target only
- Evidence: On a PR fixing the CodeceptJS harness, several "FB E2E tests" check runs reported `success` in ~2 minutes; the job log read `Launchable subset is empty. Downstream setup and tests will be skipped.` / `No tests selected by Launchable subset.` — so the green jobs never exercised the change at all. The agent file already warns that Launchable can mute a *failing* result, but not that an empty subset makes a *passing* job vacuous.
- Proposed change: In the CI trigger payload section, note that a fast green e2e/FB job must be checked for `Launchable subset is empty` before it is treated as evidence that a change was exercised — an empty subset means zero tests ran, so the job's green is not a signal either way.
