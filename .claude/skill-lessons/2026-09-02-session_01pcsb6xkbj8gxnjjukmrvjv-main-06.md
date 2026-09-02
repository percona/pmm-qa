# .claude/agents/investigator.md — the fix branch's own E2E matrix verifies the test, before claiming only CI can

- Added: 2026-09-02
- Applies to: target only
- Evidence: A PR fixing the setup behind an `@fb-instances` failure was opened saying the suite itself could only be confirmed by "the next FB/nightly run", because the repro VM could not host the CodeceptJS compose file. Within 40 minutes the PR's own `E2E tests Matrix` run had executed the identical job on the branch — `FB E2E tests / Instances UI tests / e2e tests: @fb-instances`, 35 tests found, 35 passed at `LAUNCHABLE_CONFIDENCE: 100%`, with the setup step that runs the new assertion green — so the PR body understated the evidence available and had to be edited.
- Proposed change: In the fix-verification step, say that after pushing the branch the pmm-qa PR's own `E2E tests Matrix` / `FB E2E tests` run usually re-executes the failing job's tag, so check that run's job for the tag before writing any "only the next CI/nightly run can confirm this" caveat, and quote its Launchable counts as the end-to-end evidence.
