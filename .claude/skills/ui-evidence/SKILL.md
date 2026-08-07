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

1. Resolve run URL from `gh pr checks <PR> -R Percona-Lab/pmm-submodules` (see `fb-tests`).
2. `node .claude/scripts/pw-screenshot.js "<actions-run-url>" "/tmp/fb-test-<PR>-checks.png"`.
3. Attach via `jira` (`customfield_10492`).

If the GitHub Actions page renders blank, the repo is private and the browser has no GitHub session — report this as a blocker rather than guessing at the screenshot content.

## Behind an intercepting egress proxy (Claude Code cloud sessions)

Handled automatically by `lib/proxy.js` — no flags to pass. Worth knowing when
something still fails:

- Chromium does not read `HTTPS_PROXY`, so the scripts pass it explicitly.
- The proxy resets Chromium's **TLS 1.3** handshake (CONNECT succeeds, then the
  ClientHello draws a TCP reset → `ERR_CONNECTION_RESET` on every URL,
  `example.com` included). The scripts cap the browser-to-proxy leg at TLS 1.2,
  which the proxy handles. Disabling ECH or post-quantum key agreement does not
  help. Drop the cap once the proxy handles a 1.3 hello.
- No extra CA work is needed: the proxy's CA is already trusted, so a
  self-signed PMM cert arrives re-signed by it. `PMM_CERT_PATH` still matters
  for the direct, no-proxy path.
- Override with `PW_PROXY_SERVER`; set it empty to force a direct connection.

## Grafana needs to settle before the screenshot

`networkidle` fires while PMM is still showing its "Loading Percona Monitoring
and Management" splash. `pw-screenshot.js` waits for the splash to clear and
then settles for `PW_SETTLE_MS` (default 3000). Dashboards with panels need
longer — use `PW_SETTLE_MS=15000`, or `PW_WAIT_SELECTOR` to wait on a specific
element instead.

Saved login sessions go stale (Grafana rotates auth tokens), and a stale one
silently screenshots the **login page**. Always check the image; re-run
`pmm-ui-login.js` and re-shoot if it looks wrong.

## Artifacts

Name files with the ticket key (e.g. `PMM-15196-settings.png`). Save under `/tmp` and reference the path in Jira Developers-only comments when the role requires it.
