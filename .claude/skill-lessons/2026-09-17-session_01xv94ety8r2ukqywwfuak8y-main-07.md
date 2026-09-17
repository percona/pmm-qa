# .claude/agents/test-runner.md — a new test tag gets its own e2e job, not a widened grep on the nearest one

- Added: 2026-09-17
- Applies to: .claude/agents/test-runner.md (step 8, Automation decision)
- Evidence: A new tag was folded into the existing `inventory` job's `pmm_test_flag` because that job already provisioned the right database. Both the PR reviewer and the maintainer objected independently that a red `Inventory|Image renderer tests` points at the wrong suite. Splitting it out then exposed a second cost the grouping had hidden: `.claude/hooks/lint-changed.sh` rejects a new job until it is listed in `notify_investigator.needs` ("its failures would never reach Investigator"), so the grouped tag had been reaching that routine under another job's name.
- Proposed change: In step 8, state that a new test tag with no existing job gets its own entry in `e2e-tests-matrix.yml` (name it after what it runs, add it to `notify_investigator.needs`), and that widening another job's `pmm_test_flag` is only for a tag that genuinely belongs to that job's subject — reusing a runner because it happens to provision the right database is not a reason.
