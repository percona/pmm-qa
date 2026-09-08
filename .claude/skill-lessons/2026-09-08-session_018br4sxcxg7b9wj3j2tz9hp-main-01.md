# .claude/skills/add-ha-test/SKILL.md — "Running them" omits the two overrides the HA suite needs in a cloud session

- Added: 2026-09-08
- Applies to: target only
- Evidence: Following the section's `npx playwright test --grep "@pmm-ha"` verbatim against a relay-provisioned LKE cluster failed twice for reasons unrelated to the test: first `browserType.launch: Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1234` (the workspace pins @playwright/test 1.62.1; the sandbox ships revision 1194), then `ensureServing` timing out on HTTP 503 whose body was `upstream connect error or disconnect/reset before headers` — the egress gateway, not PMM, since the same request via curl and via a request context given `proxy: {server: HTTPS_PROXY}` both returned 200. The 503 cost two four-minute cluster runs misdiagnosed as cluster instability.
- Proposed change: In "Running them", state that a cloud session must run the suite through a scratch config (`--config`, never editing the tracked one) pinning `executablePath: '/opt/pw-browsers/chromium'` and `proxy` from `HTTPS_PROXY`, and that a 503 with an `upstream connect error` body is the gateway rather than a broken cluster.
