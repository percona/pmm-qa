# .claude/agents/investigator.md — the empty-Launchable-subset tell is not limited to fast jobs; zero junit_* artifacts is the cheap check

- Added: 2026-09-07
- Applies to: .claude/agents/investigator.md
- Evidence: The prior night's green nightly run was nearly cited as evidence the failing scenario had been passing; its `test execution / @nightly` job had logged `Launchable subset is empty. Test execution will be skipped.` and the whole run uploaded zero artifacts, so the scenario had not actually run since the dependency bump three days earlier.
- Proposed change: Broaden the existing "fast (~2 min) e2e/FB job" caveat to any green run cited as a control, and add that `list_workflow_run_artifacts` returning no `junit_*` artifact is a one-call tell that the run executed no tests.
