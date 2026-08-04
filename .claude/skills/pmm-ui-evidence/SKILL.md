---
name: pmm-ui-evidence
description: Capture PMM UI screenshots and screen recordings using the pre-installed local Chromium/Playwright. Use when documenting manual test results or FB Actions screenshots.
---

# PMM UI evidence

This environment ships Chromium pre-installed with Playwright already pointed at it (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`) — no separate browser install or "computer use" is needed. Three small helper scripts under `.claude/scripts/` (`npm install` run once by the SessionStart hook) do the driving:

- `pmm-ui-login.js` — logs into PMM as `admin`, bypassing the Grafana login form and self-signed TLS on the Linode box, and saves a reusable Playwright storage state.
- `pw-screenshot.js` — generic one-off screenshot of any URL, optionally reusing a saved login session.
- `pw-record.js` — screen recording via Playwright's own video capture, transcoded to `.mp4` with `ffmpeg` (installed by the SessionStart hook) for easier viewing/attaching.

## Log into PMM UI and screenshot

```bash
PMM_URL="https://<linode-ip>" ADMIN_PASSWORD='pmm3admin!' \
  node .claude/scripts/pmm-ui-login.js PMM-14576

node .claude/scripts/pw-screenshot.js \
  "https://<linode-ip>/graph/d/some-dashboard" \
  "/tmp/PMM-14576-settings.png" \
  PMM-14576
```

Session name `PMM-14576` above — reuse the same ticket key for follow-up screenshots (or a recording) so the login isn't repeated.

## Record a short clip instead of a screenshot

For a flow that's clearer as motion than a still (e.g. an alert firing, a dashboard panel updating):

```bash
node .claude/scripts/pw-record.js \
  "https://<linode-ip>/graph/d/some-dashboard" \
  "/tmp/PMM-14576-alert-firing.mp4" \
  PMM-14576 \
  20
```

The last argument is dwell time in seconds (default 15) — how long it sits on the page after load before stopping. For anything more interactive (clicking through a flow, not just loading one page and watching it), copy `pw-record.js` and add real Playwright actions between the `goto()` and the dwell; it's a plain script, not a fixed tool.

## FB Actions run screenshot (Test Reporter, all checks green)

1. Resolve run URL from `gh pr checks <PR> -R Percona-Lab/pmm-submodules` (see `pmm-fb-tests`).
2. `node .claude/scripts/pw-screenshot.js "<actions-run-url>" "/tmp/fb-test-<PR>-checks.png"`.
3. Attach via `pmm-jira` (`customfield_10492`).

If the GitHub Actions page renders blank, the repo is private and the browser has no GitHub session — report this as a blocker rather than guessing at the screenshot content.

## Artifacts

Name files with the ticket key (e.g. `PMM-15196-settings.png`). Save under `/tmp` and reference the path in Jira Developers-only comments when the role requires it.
