---
name: pmm-ui-evidence
description: Capture PMM UI screenshots and screen recordings with playwright-cli or pmm-ui-login.sh on the cloud VM. Use when documenting manual test results, FB Actions screenshots, or recording PMM UI verification steps.
---

# PMM UI evidence

## Headed login + recording (MicroVM)

```bash
export PMM_URL='https://127.0.0.1'
export ADMIN_PASSWORD='pmm3admin!'
qa-integration/scripts/pmm-ui-login.sh PMM-<TICKET>
```

Headed by default (maximized 1920×1200). Opt out: `PMM_UI_HEADED=0`. Config: `.playwright/cli.config.json`.

Workflow details: [.agents/workflows/pmmLogin.md](.agents/workflows/pmmLogin.md).

## playwright-cli (generic UI steps)

```bash
playwright-cli open https://127.0.0.1 --ignore-https-errors
playwright-cli resize 1920 1080
playwright-cli snapshot
playwright-cli screenshot --filename=tester-<TICKET>-<step>.png
playwright-cli close
```

## FB Actions run screenshot (all checks green)

```bash
runId=$(gh pr checks <PR> -R Percona-Lab/pmm-submodules 2>&1 | grep -oP 'actions/runs/\K[0-9]+' | head -1)
playwright-cli open "https://github.com/Percona-Lab/pmm-submodules/actions/runs/$runId"
playwright-cli resize 1920 1080
playwright-cli screenshot --filename=fb-test-<TICKET>-checks.png
playwright-cli close
```

Attach via `pmm-jira` skill (`customfield_10492`).

## Fallback

Computer use is allowed when `playwright-cli` cannot reach private GitHub (authenticate in browser first).
