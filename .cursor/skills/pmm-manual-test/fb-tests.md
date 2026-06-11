# FB Tests — Analysis & Jira Documentation

FB Tests are the **GitHub PR checks** on `pmm-submodules` (`gh pr checks`). They are **often flaky** — treat failures as signals, not automatic blockers. Cross-check failed suites against the ticket scope before adding them to manual test steps.

**Ignore JNKPercona API test comments** (`API tests have succeded/failed`) — not part of this workflow.

## Source: GitHub PR checks (latest FB build only)

```powershell
gh pr checks <SUBMODULES_PR> -R Percona-Lab/pmm-submodules
```

Returns matrix jobs from `pmm-qa-fb-checks.yml` and Jenkins:

| Check pattern | Type |
|---------------|------|
| `@* UI tests` | Playwright UI suites in pmm-qa |
| `CLI tests *` | CLI/integration package tests |
| `continuous-integration/jenkins/pr-head` | `pmm3-submodules` Jenkins build |
| `actions/workflows/helm-tests` | Helm tests |

All matrix checks share one **FB Tests** workflow run:

```
https://github.com/Percona-Lab/pmm-submodules/actions/runs/<run_id>
```

**Do not use** `https://github.com/Percona-Lab/pmm-submodules/pull/<PR>/checks` — that tab is often empty on `pmm-submodules` PRs. Screenshot the **Actions run** page instead (workflow name: `FB Tests`).

### Get the run URL for the latest FB build

```powershell
# run_id from any check line in gh pr checks
gh pr checks <SUBMODULES_PR> -R Percona-Lab/pmm-submodules 2>&1 |
  Select-String -Pattern 'actions/runs/(\d+)' |
  ForEach-Object { $_.Matches[0].Groups[1].Value } |
  Select-Object -First 1 -Unique
```

Then open: `https://github.com/Percona-Lab/pmm-submodules/actions/runs/<run_id>`

Or via API (latest commit on PR):

```powershell
$sha = gh api repos/Percona-Lab/pmm-submodules/pulls/<SUBMODULES_PR> --jq .head.sha
gh api "repos/Percona-Lab/pmm-submodules/commits/$sha/check-runs" `
  --jq '[.check_runs[] | select(.app.slug=="github-actions")] | .[0].details_url' |
  ForEach-Object { $_ -replace '/job/.*','' }
```

Jenkins submodules build is separate: `continuous-integration/jenkins/pr-head` → `pmm3-submodules/PR-XXXX` (not the FB Tests screenshot target).

## Analysis workflow

1. Run `gh pr checks` and list **failed** / **passed** suites
2. For each failure, note suite name (e.g. `@rta UI tests`, `CLI tests pmm-server container`)
3. **Filter by ticket relevance:**
   - In scope → add explicit manual verification to How to test
   - Out of scope / known flaky → mention as FYI, do not expand manual test scope
4. Open failed job logs on GitHub Actions only when the failure might be ticket-related

### Flaky test guidance

- UI matrix suites (`@fb-*`, `@rbac`, etc.) fail often on infrastructure timing
- A failure unrelated to the PR diff (e.g. MySQL integration failing on a telemetry-only ticket) → note flakiness, skip from manual plan
- Multiple failures in one area related to the change → prioritize in manual test steps

## Screenshot with playwright-cli

Prefer **playwright-cli** over Playwright MCP (simpler for one-off screenshots).

### Screenshot only when all checks pass

```powershell
gh pr checks <SUBMODULES_PR> -R Percona-Lab/pmm-submodules 2>&1 | Select-String '\tfail\t'
```

| Result | Action |
|--------|--------|
| **No fail lines** | Screenshot + attach to Jira `customfield_10492` |
| **Any fail** | **No screenshot** — update Jira with text only (run URL, failed suites, relevant/flaky notes) |

Failures still matter for manual test planning (step 6/11); they just do not get a green screenshot in Jira.

**Screenshot the FB Tests Actions run page** when all green — shows the full matrix (UI + CLI checks).

```powershell
# 1. Resolve run_id (example: 27009345670 for PR-4376)
$runId = gh pr checks 4376 -R Percona-Lab/pmm-submodules 2>&1 |
  Select-String -Pattern 'actions/runs/(\d+)' |
  ForEach-Object { $_.Matches[0].Groups[1].Value } |
  Select-Object -First 1

# 2. Screenshot the workflow run summary
playwright-cli open "https://github.com/Percona-Lab/pmm-submodules/actions/runs/$runId"
playwright-cli resize 1920 1080
playwright-cli screenshot --filename="fb-test-PMM-14915-checks.png"
playwright-cli close
```

Requires GitHub login in the browser session if the repo is private — log in first if the page is blank.

Save screenshots to a temp path the user can find (e.g. workspace root or `%TEMP%`).

**Tips:**

- Resize if needed: `playwright-cli resize 1920 1080` before screenshot
- For long Jenkins pages: screenshot after scrolling to the failure section using `playwright-cli eval "window.scrollTo(0, document.body.scrollHeight)"` then screenshot
- Close browser when done: `playwright-cli close`

## Update Jira

### Custom fields

| Field | ID | Use |
|-------|-----|-----|
| **FB test screenshots** | `customfield_10492` | FB test analysis summary + screenshot reference |
| **How to test** | `customfield_10083` | Manual test steps (adapt using FB failures + PR diff) |

### How to update `customfield_10492` (verified on PMM-15074)

**Do not use:** Jira web UI / Playwright (agent browser is not logged in). **Do not** send wiki markdown (`!image.png|width=900!`) or plain text — Jira returns *Operation value must be an Atlassian Document*.

**Use:** Jira REST API v3, or Atlassian MCP only if it sends **ADF** for this field. Credentials: `JIRA_USERNAME`, `JIRA_API_TOKEN`, `JIRA_URL` (or `mcp-atlassian` env in `~/.cursor/mcp.json`).

1. Upload the screenshot:

```bash
curl -sS -u "$JIRA_USERNAME:$JIRA_API_TOKEN" \
  -H "X-Atlassian-Token: no-check" \
  -F "file=@fb-test-PMM-XXXX-checks.png" \
  "$JIRA_URL/rest/api/3/issue/PMM-XXXX/attachments"
```

Note the numeric `id` from the response.

2. `PUT $JIRA_URL/rest/api/3/issue/PMM-XXXX` with `customfield_10492` as ADF (`type: doc`). Embed the image with `mediaSingle` → `media` → `type: external` → `url` = `$JIRA_URL/rest/api/3/attachment/content/<id>`.

**Ask the user before writing to Jira** unless they explicitly requested the update in this session.
