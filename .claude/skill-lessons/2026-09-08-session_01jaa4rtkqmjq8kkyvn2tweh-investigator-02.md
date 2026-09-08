# .claude/skills/fb-tests/SKILL.md — distinguish runner starvation from slow tests, and read per-step timings

- Added: 2026-09-08
- Applies to: target only
- Evidence: four GitHub Actions runs whose job summaries looked identical turned out to have wedged in two different steps once `get_workflow_job` per-step `started_at`/`completed_at` was read; separately, a run stuck at run-level `status: queued` with jobs carrying no `runner_id` was runner-concurrency exhaustion rather than any test failure.
- Proposed change: add that a run-level `status` of `queued` (or jobs with no `runner_id` in `list_workflow_jobs`) means runner starvation rather than a failing test, that `get_workflow_job` per-step timestamps are the cheapest way to locate the step that actually wedged, and that `runs-on: ubuntu-*` means GitHub-hosted so shared-egress/NAT explanations are excluded before measuring.
