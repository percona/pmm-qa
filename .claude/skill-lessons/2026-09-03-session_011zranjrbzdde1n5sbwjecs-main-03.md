# .claude/agents/investigator.md — run the pre-change implementation on the same environment before attributing a regression

- Added: 2026-09-03
- Applies to: target only
- Evidence: after a test change turned a green CI job red, the change was reported as the sole regression. Running the immediately preceding commit's implementation on the same provisioned box showed it failed 3 of 6 cases there too — nightly-only tests no pull-request CI exercises, so the breakage had never been visible. The conclusion changed from "this change regressed the suite" to "the suite was already broken and this change fixes more than it broke".
- Proposed change: in the classify step, require that before attributing a failure to a specific change, the pre-change revision is run on the same environment, and that any test whose tag no pull-request workflow runs is called out as previously unverified rather than assumed to have been passing.
