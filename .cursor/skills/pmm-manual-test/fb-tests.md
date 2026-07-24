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

### Update with Atlassian MCP

**All checks passed** — attach screenshot and update fields in one call:


```json
jira_update_issue(
  issue_key: "PMM-14915",
  fields: "{\"customfield_10492\": \"## FB Tests — PR-4376 (all green)\\n\\n**Run:** https://github.com/Percona-Lab/pmm-submodules/actions/runs/27009345670\\n\\n!fb-test-PMM-14915-checks.png|width=900!\"}",
  attachments: "/path/to/fb-test-PMM-14915-checks.png"
)
```

After attachment upload, Jira may render images inline: `!fb-test-PMM-14915-checks.png|width=900!`

**Any check failed** — text only, no attachment:

```json
jira_update_issue(
  issue_key: "PMM-14915",
  fields: "{\"customfield_10492\": \"## FB Tests — PR-4376 (failures — no screenshot)\\n\\n**Run:** https://github.com/Percona-Lab/pmm-submodules/actions/runs/27009345670\\n\\n**Failed:** @rta UI tests, @pmm-ps-integration UI tests, CLI tests pmm-server container\\n\\n**Relevant to ticket:** none (flaky / out of scope)\\n\\n_Screenshot pending — waiting for all-green FB build._\"}"
)
```

Update **How to test** separately when manual steps are finalized:

```json
jira_update_issue(
  issue_key: "PMM-14915",
  fields: "{\"customfield_10083\": \"1. Provision FB staging (link in comment)...\\n2. DevTools: no /v1/ui-events/Store calls...\"}"
)
```

**Ask the user before writing to Jira** if they did not explicitly request the update in this session.

### FB test screenshots field template

```markdown
## FB Tests — PR-<submodules_pr>

**FB Tests run:** https://github.com/Percona-Lab/pmm-submodules/actions/runs/<run_id>

### Failures (latest)
- `@suite` — [relevant|flaky|out of scope]: <one-line reason>

### Passed (ticket-relevant)
- list suites that cover the change area

### Screenshot
!fb-test-<TICKET>-checks.png|width=900!
```
