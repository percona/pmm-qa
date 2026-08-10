# FB Tests — Analysis & Jira Documentation

FB Tests are the **GitHub Actions check-runs** on `pmm-submodules`. They are **often flaky** — treat failures as signals, not automatic blockers. Cross-check failed suites against the ticket scope before adding them to manual test steps.

> **`gh pr checks` 403s in cloud sessions** (GraphQL). Everywhere below, read checks via repo-scoped REST on the PR head SHA:
> ```bash
> SHA=$(gh api repos/Percona-Lab/pmm-submodules/pulls/<SUBMODULES_PR> --jq .head.sha)
> CHECKS() { gh api "repos/Percona-Lab/pmm-submodules/commits/$SHA/check-runs?per_page=100" \
>   --jq '.check_runs | group_by(.name) | map(max_by(.started_at))[]'; }  # latest run per check
> ```

**Ignore JNKPercona API test comments** (`API tests have succeded/failed`) — not part of this workflow.

## Source: GitHub Actions check-runs (latest FB build only)

```bash
CHECKS | jq -r '"\(.conclusion // .status)\t\(.name)"'
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
CHECKS | jq -r 'select(.app.slug=="github-actions") | .details_url' \
  | head -1 | sed 's|/job/.*||'
```

Then open: `https://github.com/Percona-Lab/pmm-submodules/actions/runs/<run_id>`

Jenkins submodules build is separate: `continuous-integration/jenkins/pr-head` → `pmm3-submodules/PR-XXXX` (not the FB Tests screenshot target).

## Analysis workflow

1. Run `CHECKS` and list **failed** / **passed** suites
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
CHECKS | jq '[select(.conclusion=="failure" or .conclusion=="timed_out")] | length'
```

| Result | Action |
|--------|--------|
| **`0`** | Screenshot + attach to Jira `customfield_10492` |
| **`> 0`** | **No screenshot** — update Jira with text only (run URL, failed suites, relevant/flaky notes) |

Failures still matter for manual test planning; they just do not get a green screenshot in Jira.

**Screenshot the FB Tests Actions run page** when all green — shows the full matrix (UI + CLI checks).

```bash
SHA=$(gh api repos/Percona-Lab/pmm-submodules/pulls/4376 --jq .head.sha)
run_url=$(gh api "repos/Percona-Lab/pmm-submodules/commits/$SHA/check-runs?per_page=100" \
  --jq '.check_runs | map(select(.app.slug=="github-actions"))[0].details_url' | sed 's|/job/.*||')
node .claude/scripts/pw-screenshot.js "$run_url" "/tmp/fb-test-PMM-14915-checks.png"
```

If the page renders blank, the repo is private and no GitHub session is loaded in the browser context — `gh auth status` confirms CLI auth, but the *browser* needs its own login; note this as a blocker rather than guessing.

## Update Jira

**Use the `jira` skill's curl-first REST recipes for all Jira writes** (reads, comments, attachments, field updates). Do **not** call the Atlassian MCP connector — it stalls routine runs on the #61015 approval prompt. The field IDs and templates below still apply; only the transport is REST, per `jira`.

### Comment visibility (mandatory)

**Every Jira comment** on `perconadev.atlassian.net` PMM tickets MUST be restricted to the **Developers** role. Omitting visibility posts a **public** comment (visible to reporters/customers) — never do that for QA notes, triage, or test results. On the REST path this is the `visibility: {"type":"role","value":"Developers"}` key (see `jira`).

If visibility can't be set on whatever path is available, **do not post** — show the draft to the user and ask them to paste it with **Restrict to → Developers**.

Updating custom fields (below) does **not** use comment visibility (different mechanism).

### Custom fields

| Field | ID | Use |
|-------|-----|-----|
| **FB test screenshots** | `customfield_10492` | FB test analysis summary + screenshot reference |
| **How to test** | `customfield_10083` | Manual test steps (adapt using FB failures + PR diff) |

### Update via the `jira` skill (curl-first REST)

**All checks passed** — attach the screenshot, then set the field. Both via the `jira` skill's recipes:
- Attach: `POST $J/issue/PMM-14915/attachments` with `-F "file=@/tmp/fb-test-PMM-14915-checks.png"`.
- Field: `PUT $J/issue/PMM-14915` with `{"fields":{"customfield_10492":"h2. FB Tests — PR-4376 (all green)\n\n*Run:* <run_url>\n\n!fb-test-PMM-14915-checks.png|width=900!"}}` (wiki markup; after upload Jira renders it inline).

**Any check failed** — text only, no attachment:
- Field: `PUT $J/issue/PMM-14915` with `{"fields":{"customfield_10492":"h2. FB Tests — PR-4376 (failures — no screenshot)\n\n*Run:* <run_url>\n\n*Failed:* @rta UI tests, CLI tests pmm-server container\n\n*Relevant to ticket:* none (flaky / out of scope)\n\n_Screenshot pending — waiting for all-green FB build._"}}`.

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
