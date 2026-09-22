# .claude/agents/investigator.md — a claim that a tag has no pull-request coverage must come from the PR's own check-run list

- Added: 2026-09-22
- Applies to: target only
- Evidence: A fix PR's body asserted "the `@docker-configuration` tag is not exercised by any pull-request workflow, so this PR's own checks will not re-run it". The PR's check runs on that head listed two `FB E2E tests / Docker configuration tests / e2e tests: @docker-configuration` jobs, so the claim was false and had to be corrected on a live PR. The agent file tells you to check what the branch's own CI already proved before writing a "only the next run can confirm" caveat, and separately to flag tags no PR workflow exercises — but nothing says where that second fact is established.
- Proposed change: Extend the "check what the branch's own CI already proved" paragraph so the *negative* claim is covered too: whether a tag runs on pull requests is read from the PR head's check-run list (or the workflow's `on:` triggers), never asserted from assumption, and a body that names a check the PR does run must quote that job's result once it completes.
