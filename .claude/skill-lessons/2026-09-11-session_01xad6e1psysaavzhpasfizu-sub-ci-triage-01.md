# .claude/skills/fb-tests/SKILL.md — A green pmm-qa e2e job may be a Launchable no-op, not a pass

- Added: 2026-09-11
- Applies to: fb-tests only
- Evidence: Checking whether "PDPGSQL SSL tests / e2e tests: @ssl-postgres" is red on main, three nightly runs (2026-09-05/06/07) reported conclusion `success` in 2.6-2.9 min while the job's `steps[]` showed "Check if launchable subset is empty" -> "Skip notice" success and "Setup PMM Server", "Setup PMM-Client", "Run Setup for E2E Tests" and "Execute e2e tests ... with launchable" all `skipped`; real runs took 15-19.5 min with those steps `success`.
- Proposed change: In the check-reading guidance, add that for pmm-qa e2e jobs a green conclusion is only evidence of a pass when the job's `steps[]` (already included in the `actions/runs/<id>/jobs?per_page=100&filter=latest` payload, no extra call) shows the "Execute e2e tests" step concluded `success` rather than `skipped`; a ~2-3 min green job with skipped setup/execute steps is an empty Launchable subset and proves nothing.
