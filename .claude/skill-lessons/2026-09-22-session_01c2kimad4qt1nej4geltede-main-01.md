# .claude/agents/investigator.md — a nightly whose failures all start at one wall-clock moment is a server-teardown check, not a test investigation

- Added: 2026-09-22
- Applies to: target only
- Evidence: In run 35742361771 every failure across unrelated suites began at 15:11; Jenkins `pmm3-ui-tests-nightly-gha` #719 had been cancelled at 15:09:38 and its `post { always }` ran `aws-staging-stop`, terminating the EC2 instance at 15:10:02 while the dispatched GH run still had ~19 minutes of tests to go.
- Proposed change: In the nightly branch of "Being invoked", instruct that when failures across unrelated test classes share one onset timestamp, the dispatching Jenkins build's end time and `post`/teardown block are checked before any test or product work — the build whose console calls `wait-for-gh-run-completion.sh <run-id>` owns that run's server, and `get_build_history` on `pmm3-ui-tests-nightly-gha` (master `pmm`) plus one console tail identifies it.
