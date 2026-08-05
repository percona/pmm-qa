# FB Tests — Analysis & Jira Documentation

FB Tests are the **GitHub PR checks** on `pmm-submodules` (`gh pr checks`). They are **often flaky** — treat failures as signals, not automatic blockers. Cross-check failed suites against the ticket scope before adding them to manual test steps.

**Ignore JNKPercona API test comments** (`API tests have succeded/failed`) — not part of this workflow.

## Source: GitHub PR checks (latest FB build only)

```bash
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

```text
https://github.com/Percona-Lab/pmm-submodules/actions/runs/<run_id>
```

**Do not use** `https://github.com/Percona-Lab/pmm-submodules/pull/<PR>/checks` — that tab is often empty on `pmm-submodules` PRs. Screenshot the **Actions run** page instead (workflow name: `FB Tests`).

### Get the run URL for the latest FB build

```bash
gh pr checks <SUBMODULES_PR> -R Percona-Lab/pmm-submodules 2>&1 \
  | grep -oE 'actions/runs/[0-9]+' | head -1
```

Then open: `https://github.com/Percona-Lab/pmm-submodules/actions/runs/<run_id>`

Or via API (latest commit on PR):

```bash
sha=$(gh api repos/Percona-Lab/pmm-submodules/pulls/<SUBMODULES_PR> --jq .head.sha)
gh api "repos/Percona-Lab/pmm-submodules/commits/$sha/check-runs" \
  --jq '[.check_runs[] | select(.app.slug=="github-actions")] | .[0].details_url' \
  | sed 's|/job/.*||'
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

## Screenshot with the local Playwright/Chromium

Use `.claude/scripts/pw-screenshot.js` (see `ui-evidence`) instead of any browser extension or manual capture.

### Screenshot only when all checks pass

```bash
gh pr checks <SUBMODULES_PR> -R Percona-Lab/pmm-submodules 2>&1 | grep -E '\tfail\t'
```

| Result | Action |
|--------|--------|
| **No fail lines** | Screenshot + attach to Jira `customfield_10492` |
| **Any fail** | **No screenshot** — update Jira with text only (run URL, failed suites, relevant/flaky notes) |

Failures still matter for manual test planning; they just do not get a green screenshot in Jira.

**Screenshot the FB Tests Actions run page** when all green — shows the full matrix (UI + CLI checks).

```bash
run_id=$(gh pr checks 4376 -R Percona-Lab/pmm-submodules 2>&1 | grep -oE 'actions/runs/[0-9]+' | head -1 | cut -d/ -f2)
node .claude/scripts/pw-screenshot.js \
  "https://github.com/Percona-Lab/pmm-submodules/actions/runs/${run_id}" \
  "/tmp/fb-test-PMM-14915-checks.png"
```

If the page renders blank, the repo is private and no GitHub session is loaded in the browser context — `gh auth status` confirms CLI auth, but the *browser* needs its own login; note this as a blocker rather than guessing.

## Update Jira

### Comment visibility (mandatory)

**Every Jira comment** on `perconadev.atlassian.net` PMM tickets MUST be restricted to the **Developers** role. Omitting visibility posts a **public** comment (visible to reporters/customers) — never do that for QA notes, triage, or test results.

**Always** pass visibility when calling a comment tool (Atlassian MCP `addCommentToJiraIssue`, `commentVisibility: {"type": "role", "value": "Developers"}`).

If the MCP tool does not accept a visibility parameter, **do not post** — show the draft to the user and ask them to paste it with **Restrict to → Developers**.

Updating custom fields (below) does **not** use comment visibility (different mechanism).

### Custom fields

| Field | ID | Use |
|-------|-----|-----|
| **FB test screenshots** | `customfield_10492` | FB test analysis summary + screenshot reference |
| **How to test** | `customfield_10083` | Manual test steps (adapt using FB failures + PR diff) |

### Update via Atlassian MCP

**All checks passed** — attach screenshot and update fields in one call:

```json
{
  "issue_key": "PMM-14915",
  "fields": "{\"customfield_10492\": \"## FB Tests — PR-4376 (all green)\\n\\n**Run:** https://github.com/Percona-Lab/pmm-submodules/actions/runs/27009345670\\n\\n!fb-test-PMM-14915-checks.png|width=900!\"}",
  "attachments": "/tmp/fb-test-PMM-14915-checks.png"
}
```

After attachment upload, Jira may render images inline: `!fb-test-PMM-14915-checks.png|width=900!`

**Any check failed** — text only, no attachment:

```json
{
  "issue_key": "PMM-14915",
  "fields": "{\"customfield_10492\": \"## FB Tests — PR-4376 (failures — no screenshot)\\n\\n**Run:** https://github.com/Percona-Lab/pmm-submodules/actions/runs/27009345670\\n\\n**Failed:** @rta UI tests, @pmm-ps-integration UI tests, CLI tests pmm-server container\\n\\n**Relevant to ticket:** none (flaky / out of scope)\\n\\n_Screenshot pending — waiting for all-green FB build._\"}"
}
```

Update **How to test** separately when manual steps are finalized (`customfield_10083`).

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
