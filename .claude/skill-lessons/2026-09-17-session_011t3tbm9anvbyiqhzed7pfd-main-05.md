# .claude/skills/qa-code-review/references/ci-workflows.md — a retry loop that falls through is only a defect when nothing after it re-attempts and fails loudly

- Added: 2026-09-17
- Applies to: .claude/skills/qa-code-review/references/ci-workflows.md (the sibling rule lives in references/provisioning.md, Timeouts and retries)
- Evidence: A review raised the image-pull loops in `runner-e2e-tests-codeceptjs.yml` and `runner-e2e-tests-playwright.yml` for not failing after the third attempt. The author verified and rejected it: the fallthrough to `docker compose up -d` is the point of the loop — the compose files fetch nine images and a token failure aborts the whole `pull` even when eight are already local, so `up -d` re-attempts only what is missing and, if it cannot, exits non-zero naming the image it could not get. https://github.com/percona/pmm-qa/pull/1444#issuecomment-5707768731
- Proposed change: Add that before faulting a retry loop for not exiting on exhaustion, check the step that follows it — where that step re-attempts the same work on a narrower input and fails loudly, the fallthrough is the design and the finding does not stand.
