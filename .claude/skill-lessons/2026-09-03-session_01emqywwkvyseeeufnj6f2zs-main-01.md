# .claude/agents/investigator.md — every job red at checkout means the head branch is gone, not a test failure

- Added: 2026-09-03
- Applies to: target only
- Evidence: an `E2E tests Matrix` run went red across ~30 jobs, each in under 40s; every job died in `actions/checkout` retrying `git fetch --depth=1 origin +refs/heads/<pr-branch>*` because the PR had merged and its head branch was deleted six seconds after the run started.
- Proposed change: in step 3's "Didn't reproduce" branch, before triaging an all-jobs-red run, check the PR's merged/closed state and whether the head branch still exists — a checkout-step failure on a deleted branch is not this PR's failure, cannot be re-run, and needs no fix.
