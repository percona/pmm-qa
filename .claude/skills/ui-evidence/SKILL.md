---
name: ui-evidence
description: Capture PMM UI screenshots and screen recordings using the pre-installed local Chromium/Playwright. Use when documenting manual test results or FB Actions screenshots.
---

# PMM UI evidence

This environment ships Chromium pre-installed with Playwright already pointed at it (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`) — no separate browser install or "computer use" is needed. Three small helper scripts under `.claude/scripts/` (`npm install` run once by the SessionStart hook) do the driving:

- `pmm-ui-login.js` — logs into PMM as `admin`, pinning PMM's own cert (see below) instead of trusting any cert, and saves a reusable Playwright storage state.
- `pw-screenshot.js` — generic one-off screenshot of any URL, optionally reusing a saved login session.
- `pw-record.js` — screen recording via Playwright's own video capture, transcoded to `.mp4` with `ffmpeg` (installed by the SessionStart hook) for easier viewing/attaching.

All three accept an optional `PMM_CERT_PATH` env var — set it to the cert `linode-provisioning` step 2 fetched (`terraform/linode-runner/runs/<run_id>/pmm_cert.pem`) whenever the URL is PMM's own, so the browser pins that exact cert (via Chromium's `--ignore-certificate-errors-spki-list`) instead of falling back to `ignoreHTTPSErrors`. Omit it for non-PMM URLs (e.g. a GitHub Actions run), which already have a real CA.

## Log into PMM UI and screenshot

```bash
PMM_HOST="https://$(cat terraform/linode-runner/runs/<run_id>/ip | tr '.' '-').nip.io"

# Read from the files linode-provisioning step 2 wrote -- unique per run,
# never a fixed literal or trust-anything cert, and reading them from disk
# (not exported shell variables) survives even if this runs in a separate
# shell from provisioning.
ADMIN_PASSWORD="$(cat terraform/linode-runner/runs/<run_id>/admin_password)"
PMM_CERT_PATH="terraform/linode-runner/runs/<run_id>/pmm_cert.pem"
PMM_URL="$PMM_HOST" ADMIN_PASSWORD="$ADMIN_PASSWORD" PMM_CERT_PATH="$PMM_CERT_PATH" \
  node .claude/scripts/pmm-ui-login.js PMM-14576

PMM_CERT_PATH="$PMM_CERT_PATH" node .claude/scripts/pw-screenshot.js \
  "$PMM_HOST/graph/d/some-dashboard" \
  "/tmp/PMM-14576-settings.png" \
  PMM-14576
```

Session name `PMM-14576` above — reuse the same ticket key for follow-up screenshots (or a recording) so the login isn't repeated.

## Record a short clip instead of a screenshot

For a flow that's clearer as motion than a still (e.g. an alert firing, a dashboard panel updating):

```bash
PMM_CERT_PATH="$PMM_CERT_PATH" node .claude/scripts/pw-record.js \
  "$PMM_HOST/graph/d/some-dashboard" \
  "/tmp/PMM-14576-alert-firing.mp4" \
  PMM-14576 \
  20
```

The last argument is dwell time in seconds (default 15) — how long it sits on the page after load before stopping. For anything more interactive (clicking through a flow, not just loading one page and watching it), copy `pw-record.js` and add real Playwright actions between the `goto()` and the dwell; it's a plain script, not a fixed tool.

## FB Actions run screenshot (FB Reporter, all checks green)

1. Resolve the FB Actions **run** URL with the `fb-tests` "Get the run URL for the latest FB build" recipe — it picks the run the FB matrix shares and strips the `/job/<id>` suffix, so you screenshot the whole run page, not one job (`gh pr checks` 403s here, so don't use it).
2. `node .claude/scripts/pw-screenshot.js "<actions-run-url>" "/tmp/fb-test-<PR>-checks.png"`.
3. Attach via `jira` (`customfield_10492`).

If the GitHub Actions page renders blank, the repo is private and the browser has no GitHub session — report this as a blocker rather than guessing at the screenshot content.

## Two things that silently produce a useless screenshot

Proxy handling in cloud sessions is automatic — nothing to pass. These two are
not:

- **Dashboards need longer than the default settle.** Pass
  `PW_SETTLE_MS=15000` for any dashboard with panels, or `PW_WAIT_SELECTOR` to
  wait on a specific element; the 3000 ms default catches panels still
  spinning.
- **A stale login session screenshots the login page**, not an error — Grafana
  rotates auth tokens. Always look at the image before attaching it; re-run
  `pmm-ui-login.js` and re-shoot if it's wrong.

## Artifacts

Name files with the ticket key (e.g. `PMM-15196-settings.png`). Save under `/tmp` and reference the path in Jira Developers-only comments when the role requires it.
