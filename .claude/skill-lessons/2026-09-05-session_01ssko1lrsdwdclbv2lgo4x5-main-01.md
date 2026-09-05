# .claude/agents/investigator.md — dedup an FB firing against the submodules PR's own comment thread

- Added: 2026-09-05
- Applies to: target only
- Evidence: An FB firing for pmm-submodules PR #4417 re-triaged two @rta failures in full before the relay step revealed that a previous run of this same Routine had already posted an identical triage comment for the identical failures on the prior feature build of that PR — an FB rebuild re-fires the Routine on an unchanged, deterministic failure, and the step 1 dedup sweep (open pmm-qa PRs + Jira) is blind to a verdict recorded only as a PR comment.
- Proposed change: In step 1, for the FB source, read the submodules PR's existing comments (`pull_request_read`, `method: get_comments`) before the pmm-qa PR sweep; a prior Investigator triage comment naming the same failing tests, still accurate, is a stop condition — report it and post no duplicate comment.
