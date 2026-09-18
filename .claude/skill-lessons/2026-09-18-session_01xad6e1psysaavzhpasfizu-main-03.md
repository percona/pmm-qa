# .claude/skills/qa-code-review/SKILL.md — try/catch around a CodeceptJS `I.*` step does not catch

- Added: 2026-09-18
- Applies to: qa-code-review skill only
- Evidence: A retry helper wrapped `await I.waitForElement(locator, 30)` in try/catch so a straggler panel could get a longer second wait. It shipped, linted clean, and never executed its catch: CodeceptJS drives steps through its own recorder, so the failing wait rejected the test. Two nightly lanes failed with the original 30s timeout reported from inside the helper meant to rescue them.
- Proposed change: Add a review check — a try/catch, `.catch()` or conditional around an `I.*` step in codeceptjs-e2e is dead code unless the `tryTo` plugin is enabled in the codecept config; the non-throwing form is a grab (e.g. `grabNumberOfVisibleElements`, which returns 0) tested before committing to a step that can fail.
