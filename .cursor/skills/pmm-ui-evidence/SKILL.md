---
name: pmm-ui-evidence
description: Capture PMM UI screenshots and screen recordings with computer use on the cloud VM. Use when documenting manual test results or FB Actions screenshots.
---

# PMM UI evidence

Prefer **computer use** (browser automation in the cloud agent) for PMM UI verification and evidence capture.

## PMM UI testing

1. Open `PMM_UI_URL` or `https://127.0.0.1` (ignore TLS warnings on MicroVM).
2. Log in with Basic Auth / PMM admin credentials — **not** the Grafana login form.
3. Navigate, interact, and capture screenshots or recordings as artifacts.

Workflow reference for selectors and login patterns: [.agents/workflows/pmmLogin.md](../../../.agents/workflows/pmmLogin.md) (IDE workflow prompts — not Cursor subagents).

## FB Actions run screenshot (Test Reporter, all checks green)

1. Resolve run URL from `gh pr checks <PR> -R Percona-Lab/pmm-submodules`.
2. Use computer use to open the **FB Tests** Actions run page (not the PR checks summary).
3. Capture full-page screenshot → attach via `pmm-jira` (`customfield_10492`).

## Artifacts

Save files with ticket key in the name (e.g. `PMM-15196-settings-toggle.png`). Reference paths in Jira Developers-only comments.
