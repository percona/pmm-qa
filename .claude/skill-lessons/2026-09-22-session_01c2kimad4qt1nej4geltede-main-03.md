# .claude/agents/investigator.md — remote-nightly artifacts carry no server logs, so the trace is the only server-side evidence

- Added: 2026-09-22
- Applies to: target only
- Evidence: The agent file directs reading `logs/pmm-managed.log`, `logs/grafana.log`, `supervisorctl_status.log` and `client/status.json` from a nightly's artifacts, but both `artifacts_*` bundles of run 35742361771 (32MB and 143MB) held only `tests/output` screenshots and Playwright traces — no `logs/` directory at all — so the 143MB download returned nothing.
- Proposed change: Correct the nightly artifact guidance to say the `runner-e2e-tests-*-remote-nightly-*.yml` runners collect no `logs/` directory, and that server-side state comes from a failing scenario's `*.failed.zip` trace instead — `trace.network` resource-snapshot entries give each request's status and headers, with response bodies resolved through the `_sha1` names under `resources/`.
