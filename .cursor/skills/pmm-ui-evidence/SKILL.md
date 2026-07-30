---
name: pmm-ui-evidence
description: Capture PMM UI screenshots and screen recordings with computer use on the cloud VM. Use when documenting manual test results or FB Actions screenshots.
---

# PMM UI evidence

Use **computer use** (cloud agent browser) for all UI verification and screenshots.

1. Open `PMM_UI_URL` or `https://127.0.0.1` (ignore TLS warnings on MicroVM).
2. Log in with PMM admin credentials — **not** the Grafana login form.
3. Navigate, interact, capture screenshots or recordings as artifacts.

## FB Actions run screenshot (Test Reporter, all checks green)

1. Resolve run URL from `gh pr checks <PR> -R Percona-Lab/pmm-submodules`.
2. Open the **FB Tests** Actions run page with computer use.
3. Capture screenshot → attach via `pmm-jira` (`customfield_10492`).

## Artifacts

Name files with the ticket key (e.g. `PMM-15196-settings.png`). Reference paths in Jira Developers-only comments when the role requires it.
