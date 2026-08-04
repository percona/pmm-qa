---
name: pmm-ui-evidence
description: Capture PMM UI screenshots and screen recordings using the pre-installed local Chromium/Playwright. Use when documenting manual test results or FB Actions screenshots.
---

# PMM UI evidence

This environment ships Chromium pre-installed with Playwright already pointed at it (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`) — no separate browser install or "computer use" is needed. Two small helper scripts under `.claude/scripts/` (`npm install` run once by the SessionStart hook) do the driving:

- `pmm-ui-login.js` — logs into PMM as `admin`, bypassing the Grafana login form and self-signed TLS on the Linode box, and saves a reusable Playwright storage state.
- `pw-screenshot.js` — generic one-off screenshot of any URL, optionally reusing a saved login session.

## Log into PMM UI and screenshot

```bash
PMM_URL="https://<linode-ip>" ADMIN_PASSWORD='pmm3admin!' \
  node .claude/scripts/pmm-ui-login.js PMM-14576

node .claude/scripts/pw-screenshot.js \
  "https://<linode-ip>/graph/d/some-dashboard" \
  "/tmp/PMM-14576-settings.png" \
  PMM-14576
```

Session name `PMM-14576` above — reuse the same ticket key for follow-up screenshots so the login isn't repeated.

## FB Actions run screenshot (Test Reporter, all checks green)

1. Resolve run URL from `gh pr checks <PR> -R Percona-Lab/pmm-submodules` (see `pmm-fb-tests`).
2. `node .claude/scripts/pw-screenshot.js "<actions-run-url>" "/tmp/fb-test-<PR>-checks.png"`.
3. Attach via `pmm-jira` (`customfield_10492`).

If the GitHub Actions page renders blank, the repo is private and the browser has no GitHub session — report this as a blocker rather than guessing at the screenshot content.

## Artifacts

Name files with the ticket key (e.g. `PMM-15196-settings.png`). Save under `/tmp` and reference the path in Jira Developers-only comments when the role requires it.
