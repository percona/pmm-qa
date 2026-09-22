# .claude/agents/investigator.md — a Launchable-gated job hides the failing test name in its "Record launchable test results" step

- Added: 2026-09-22
- Applies to: target only
- Evidence: In `E2E tests Matrix` run 35679211444 the only failing job's test step (`Execute e2e tests …`) reported **success**, because `runner-e2e-tests-codeceptjs.yml` wraps codeceptjs in `set +e`; the job went red on step 17, `Record launchable test results`, whose log carries the counts table and an `Actionable Failure Details` block naming the spec, scenario and error. The agent file warns that a later Launchable step can fail the job, but not where the test identity lives.
- Proposed change: In the CI-trigger section, add that when the failing step is `Record launchable test results`, the failing spec/test/tag comes from that step's `Actionable Failure Details` block near the end of the job log — fetch the whole job log once and `grep -n '##\[group\]Run '` to land on it, since a tail window stops past it.
