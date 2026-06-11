---
name: pmm-manual-test
description: Guides PMM manual testing by reading a Jira ticket, syncing local repos, finding pmm-submodules build artifacts, analyzing flaky FB Tests for test insights, choosing pmm3-aws-staging-start or pmm3-deploy-services, determining all Jenkins parameters, generating a fully pre-filled parambuild URL, screenshotting FB test results with playwright-cli into Jira FB test screenshots field, and writing verified test steps. Use when the user asks for help with manual testing, PMM staging setup, FB test analysis, or wants a Jenkins job link to test a Jira ticket.
---

# PMM Manual Test

## Trigger

Start when the user asks for help with **manual testing**. **Always ask for the Jira ticket key** (e.g. `PMM-14915`) if not provided.

## Local repo layout

PMM repos are expected as **siblings** under one parent directory (repos root). This skill ships in **pmm-qa**; resolve paths from the pmm-qa clone.

| Repo              | Directory (under repos root) | Remote                          |
| ----------------- | ---------------------------- | ------------------------------- |
| pmm-qa            | `pmm-qa`                     | `percona/pmm-qa`                |
| pmm               | `pmm`                        | `percona/pmm`                   |
| grafana           | `grafana`                    | `percona/grafana`               |
| jenkins-pipelines | `jenkins-pipelines`          | `Percona-Lab/jenkins-pipelines` |

**pmm-submodules** — read PR comments and checks via `gh` only, never clone.

### Resolve repos root and paths

**Repos root** = parent directory of the `pmm-qa` git root.

```powershell
$pmmQaRoot = git -C "<path-to-pmm-qa>" rev-parse --show-toplevel
$ReposRoot = (Get-Item $pmmQaRoot).Parent.FullName
```

```bash
PMM_QA_ROOT="$(git -C pmm-qa rev-parse --show-toplevel)"
REPOS_ROOT="$(dirname "$PMM_QA_ROOT")"
```

| Variable                     | Example path                   |
| ---------------------------- | ------------------------------ |
| `$ReposRoot` / `$REPOS_ROOT` | `~/vscodeProjects/PMM`         |
| pmm                          | `$ReposRoot/pmm`               |
| grafana                      | `$ReposRoot/grafana`           |
| jenkins-pipelines            | `$ReposRoot/jenkins-pipelines` |
| pmm-qa                       | `$ReposRoot/pmm-qa`            |

### Clone if missing

If a sibling repo directory does not exist, clone it into **repos root**:

```powershell
$ReposRoot = (Get-Item (git rev-parse --show-toplevel)).Parent.FullName
$repos = @{
  pmm = "https://github.com/percona/pmm.git"
  grafana = "https://github.com/percona/grafana.git"
  "jenkins-pipelines" = "https://github.com/Percona-Lab/jenkins-pipelines.git"
}
foreach ($name in $repos.Keys) {
  $path = Join-Path $ReposRoot $name
  if (-not (Test-Path $path)) { git clone $repos[$name] $path }
}
```

```bash
REPOS_ROOT="$(dirname "$(git rev-parse --show-toplevel)")"
[ -d "$REPOS_ROOT/pmm" ] || git clone https://github.com/percona/pmm.git "$REPOS_ROOT/pmm"
[ -d "$REPOS_ROOT/grafana" ] || git clone https://github.com/percona/grafana.git "$REPOS_ROOT/grafana"
[ -d "$REPOS_ROOT/jenkins-pipelines" ] || git clone https://github.com/Percona-Lab/jenkins-pipelines.git "$REPOS_ROOT/jenkins-pipelines"
```

Then `git fetch` / `git pull --ff-only` in each repo that exists.

## Workflow checklist

```
- [ ] 1. Get Jira ticket key from user
- [ ] 2. Read ticket via Atlassian MCP (summary, description, comments, linked PRs, acceptance criteria)
- [ ] 3. Identify affected repos (pmm, grafana, or both) and read PR body, diff, issue comments, review summaries, and inline review comments
- [ ] 4. Resolve repos root; clone missing siblings; update local repos (git pull)
- [ ] 5. Find pmm-submodules PR and latest JNKPercona build comment — older comments are not valid
- [ ] 6. Analyze FB Tests from latest FB build (`gh pr checks` on pmm-submodules PR)
- [ ] 6a. Compare ticket context vs PR context; if mismatch exists, inform the user before Jenkins setup
- [ ] 7. Choose Jenkins job (pmm3-aws-staging-start vs pmm3-deploy-services)
- [ ] 8. Determine required job parameters to setup instance based on ticket scope and PR diffs
- [ ] 9. Build complete parambuild URL (all relevant params, not just DOCKER_VERSION + CLIENT_VERSION)
- [ ] 10. Review PR diffs — do not trust "How to test" blindly
- [ ] 11. Write test instructions in chat (adapt using FB test failures where relevant)
- [ ] 12. Screenshot FB Tests Actions run (playwright-cli) and update Jira FB test screenshots field
- [ ] 13. Open Jenkins parambuild URL in browser, then immediately ask the user to provide the PMM instance URL once Jenkins finishes provisioning
- [ ] 14. When the user provides the PMM instance URL, execute the generated manual test steps through MCP
```

## Step 1: Get Jira ticket key

Ask if missing. Proceed once you have the key (e.g. `PMM-14915`).

## Step 2: Read Jira ticket

Use **Atlassian MCP** (`jira_get_issue`, `jira_get_issue_development_info`):

- Summary, description, QA notes, acceptance criteria
- Ticket comments, newest first when possible
- Existing **How to test** (`customfield_10083`) and **FB test screenshots** (`customfield_10492`)
- Development panel: linked GitHub PRs/branches
- Environment or setup hints

Treat ticket comments as first-class testing input. Newer ticket comments may supersede stale description text, acceptance criteria, or existing **How to test** content. Extract late scope changes, retest requests, QA clarifications, feature flags, setup hints, known limitations, related links, and readiness/blocker notes.

**Setup is ticket-specific.** Pay attention to:

- Which subsystems change (server, UI/grafana, clients, telemetry, advisors, etc.)
- Whether monitored databases are needed
- Required **PMM server environment variables** (`DOCKER_ENV_VARIABLE`) — job defaults are often wrong for the test (e.g. default `PMM_ENABLE_TELEMETRY=0`)
- PMM Settings changes the user must apply after provisioning

## Step 3: Identify affected repos and read PR discussion

| Change area | Repo |
|-------------|------|
| Backend, API, managed services | `percona/pmm` |
| Grafana UI, dashboards, frontend | `percona/grafana` |
| Both | Check both PRs |

Grafana-only tickets still need an FB **server** image from pmm-submodules.

For every linked or discovered PR in `percona/pmm`, `percona/grafana`, and `Percona-Lab/pmm-submodules`, read the PR body, implementation diff, issue comments, review summaries, and inline review comments.

```powershell
gh pr view <n> -R owner/repo --json title,body,url,state,mergeStateStatus,comments,reviews,reviewDecision,files
gh pr diff <n> -R owner/repo
```

Use GitHub CLI for all PR context. Start with `gh pr view` and `gh pr diff`.
Use `gh api` only when `gh pr view` does not expose enough detail, especially for inline review comments with file path and line context or when complete discussion details are needed:

```powershell
gh api repos/OWNER/REPO/issues/<PR_NUMBER>/comments `
  --jq '[.[] | {created_at, author: .user.login, body}]'

gh api repos/OWNER/REPO/pulls/<PR_NUMBER>/comments `
  --jq '[.[] | {created_at, author: .user.login, path, line, body}]'

gh api repos/OWNER/REPO/pulls/<PR_NUMBER>/reviews `
  --jq '[.[] | {submitted_at, author: .user.login, state, body}]'
```

Use review comments to understand implementation constraints, unresolved concerns, setup requirements, and reviewer-requested behavior changes.

## Step 4: Update local repos

Resolve `$ReposRoot` (see above). Clone any missing sibling, then pull:

```powershell
git -C "$ReposRoot/pmm" fetch origin
git -C "$ReposRoot/pmm" pull --ff-only
```

Repeat for `grafana`, `jenkins-pipelines`, and `pmm-qa` as needed.

## Step 5: Find linked PRs and build artifacts

### Find PRs

```powershell
gh search prs "PMM-14915" --repo percona/pmm --json number,title,url
gh search prs "PMM-14915" --repo percona/grafana --json number,title,url
```

```powershell
gh pr view <n> --repo percona/pmm --json title,body,url,files
gh pr diff <n> --repo percona/pmm
```

### pmm-submodules PR

Read the FB link in the pmm PR body (e.g. `Percona-Lab/pmm-submodules/pull/4376`). **Submodules PR number ≠ pmm PR number.**

### JNKPercona build comment

```powershell
gh api repos/Percona-Lab/pmm-submodules/issues/<SUBMODULES_PR>/comments `
  --jq '[.[] | select(.user.login == "JNKPercona" and (.body | contains("Staging instance:"))) | {created_at, body}] | sort_by(.created_at) | .[-1]'
```

Extract from the **latest** build-summary comment (older FB builds are invalid):

| Field | Param |
|-------|-------|
| `Server docker:` | `DOCKER_VERSION` |
| `Watchtower docker:` | `WATCHTOWER_VERSION` |
| `Client tarball:` | `CLIENT_VERSION` |
| `Client docker:` | **ignore** for `CLIENT_VERSION` |

## Step 6: Analyze FB Tests

FB Tests = **GitHub PR checks** on `pmm-submodules` (`gh pr checks`). They are **often flaky** but give useful hints — use failures to **adapt** manual test steps when they overlap the ticket scope.

**Ignore** JNKPercona `API tests have succeded/failed` comments — not relevant for this workflow.

### Collect results

```powershell
gh pr checks <SUBMODULES_PR> -R Percona-Lab/pmm-submodules
```

### What to extract

| Source | Data |
|--------|------|
| `gh pr checks` | Failed/passed UI (`@* UI tests`) and CLI (`CLI tests *`) matrix |
| Check links | Actions run URL, Jenkins `pmm3-submodules/PR-XXXX` build |

### How to use failures

1. List failures from the **latest** FB build only
2. Mark each: **relevant** (overlaps ticket) / **flaky** / **out of scope**
3. **Relevant** failures → add explicit checks to manual test plan (step 11) and Jenkins params (step 8) if setup-related
4. **Flaky/out of scope** → note in FB test screenshots field, do not expand manual scope

Full reference: [fb-tests.md](fb-tests.md)

## Pre-Jenkins mismatch gate

Before choosing, generating, or opening any Jenkins job, compare ticket context against PR context:

- Ticket context: summary, description, acceptance criteria, QA notes, existing **How to test**, and ticket comments
- PR context: PR body, implementation diff, issue comments, review summaries, inline review comments, and review state

Check for mismatches in implemented behavior, setup needs, PMM server env vars, DB topology, feature flags, PMM Settings, readiness, and test scope.

If any mismatch can affect setup or testing, stop and inform the user before proceeding:

```markdown
Blocked before setup: ticket/PR mismatch

- Ticket says: <short fact>
- PR/review says or implements: <short fact>
- Impact: <setup/test risk>
- Need: <specific decision or confirmation>
```

If no mismatch exists, continue with Jenkins job selection and parameter planning.

## Step 7: Choose Jenkins job

| Scenario | Job |
|----------|-----|
| Server/UI/API; optional **local** clients on same VM via `CLIENTS` | **pmm3-aws-staging-start** |
| Separate client VMs, multi-node DB topologies, external exporters | **pmm3-deploy-services** |

FB test failures may inform this choice (e.g. CLI integration failure on a DB type → consider `CLIENTS` or `DEPLOY_*_GROUP`).

### staging-start with local clients (`CLIENTS`)

`CLIENTS` feeds `pmm-framework.py` in this repo (`qa-integration/pmm_qa/pmm-framework.py`) on the same EC2 instance.

**Limitations:** single VM only; no multi-VM topologies. Use **deploy-services** for those.

Leave `CLIENTS` empty for server-only tests (UI, API, settings, network-tab checks).

See [jenkins-jobs.md](jenkins-jobs.md) for all parameters. Groovy source: `$ReposRoot/jenkins-pipelines/pmm/v3/`.

## Step 8: Determine required job parameters

Derive **every** param that differs from defaults. The user should not need to edit the Jenkins form. Use ticket comments and PR review comments as inputs, not just the ticket description and PR diff.

Include **all** params in the `parambuild` URL for the chosen job — not only `DOCKER_VERSION` + `CLIENT_VERSION`. Walk through the full list below; keep defaults only when they are correct for this ticket.

### Always set from FB build

- `DOCKER_VERSION`, `CLIENT_VERSION`, `WATCHTOWER_VERSION`

### Adapt from ticket + PR diffs + FB test insights

| Concern | Params to review |
|---------|------------------|
| PMM server env vars | `DOCKER_ENV_VARIABLE` — read PR diff + `$ReposRoot/pmm/managed/CONTRIBUTING.md` + docker env docs |
| Monitored databases | `CLIENTS` (staging-start) or `DEPLOY_*_GROUP` flags (deploy-services) |
| DB versions | `PS_VERSION`, `MS_VERSION`, `PXC_VERSION`, `PGSQL_VERSION`, `PDPGSQL_VERSION`, `PSMDB_VERSION`, `MODB_VERSION` |
| SSH access | `SSH_KEY` |
| Client repo channel | `PMM_CLIENT_REPO` (staging-start only) |
| Provisioner scripts | `PMM_QA_GIT_BRANCH` |
| Instance lifetime | `DAYS` (staging-start) |
| Pull mode | `ENABLE_PULL_MODE` |
| Server install type | `SERVER_TYPE` (deploy-services only) |
| FB failure pointed at specific suite | Match setup (e.g. PSMDB failure → `--database psmdb` or `DEPLOY_MONGO_GROUP=true`) |

### pmm3-aws-staging-start — review every param

| Param | Default | When to override |
|-------|---------|------------------|
| `DOCKER_VERSION` | `perconalab/pmm-server:3-dev-latest` | Always → FB server image |
| `WATCHTOWER_VERSION` | `perconalab/watchtower:dev-latest` | Always → FB watchtower image |
| `CLIENT_VERSION` | `3-dev-latest` | Always → FB client **tarball** URL |
| `SSH_KEY` | *(empty)* | When SSH access to EC2 is needed |
| `ADMIN_PASSWORD` | `pmm3admin!` | When test docs use a different password |
| `PMM_CLIENT_REPO` | `experimental` | `testing` / `release` for RC or release client tests |
| `ENABLE_PULL_MODE` | `no` | `yes` when testing pull-mode clients |
| `DAYS` | `1` | `0` to disable auto-stop; higher if long test |
| `DOCKER_ENV_VARIABLE` | `-e PMM_DEBUG=1 -e PMM_ENABLE_TELEMETRY=0` | **Often wrong by default** — set per ticket |
| `PXC_VERSION` | `8.4` | When `CLIENTS` uses `pxc` |
| `PS_VERSION` | `8.0` | When `CLIENTS` uses `ps` |
| `MS_VERSION` | `8.0` | When `CLIENTS` uses `mysql` |
| `PGSQL_VERSION` | `16` | When `CLIENTS` uses `pgsql` |
| `PDPGSQL_VERSION` | `16` | When `CLIENTS` uses `pdpgsql` |
| `PSMDB_VERSION` | `8.0` | When `CLIENTS` uses `psmdb` |
| `MODB_VERSION` | `8.0` | When `CLIENTS` uses `modb` |
| `CLIENTS` | `--database ps=5.7,...` | Empty for server-only; set `--database ...` for local clients |
| `NOTIFY` | `false` | Usually keep `false` |
| `CLIENT_INSTANCE` | `no` | `yes` only when this VM is a client node for another server |
| `SERVER_IP` | `0.0.0.0` | Required when `CLIENT_INSTANCE=yes` |
| `PMM_QA_GIT_BRANCH` | `main` | Branch with provisioner fixes for the test |

### pmm3-deploy-services — review every param

| Param | Default | When to override |
|-------|---------|------------------|
| `SERVER_TYPE` | `docker` | `ovf` / `ami` / `helm` / `ha` when ticket tests those install paths |
| `DOCKER_VERSION` | `perconalab/pmm-server:3-dev-latest` | Always → FB server image (docker/helm/ha) |
| `OVA_VERSION` | `PMM3-Server-OVF-3.0.0-latest.ova` | When `SERVER_TYPE=ovf` |
| `AMI_ID` | `ami-0669b163befffb6c3` | When `SERVER_TYPE=ami` |
| `CLIENT_VERSION` | `3-dev-latest` | Always → FB client **tarball** URL |
| `ENABLE_PULL_MODE` | `no` | `yes` for pull-mode client tests |
| `ADMIN_PASSWORD` | `pmm3admin!` | When test requires specific password |
| `SSH_KEY` | *(empty)* | When SSH access to client/server VMs is needed |
| `DEPLOY_EXTERNAL` | `false` | `true` for external node + HAProxy tests |
| `DEPLOY_MYSQL_GROUP` | `false` | `true` for GR, PXC, async repl, standalone MySQL VMs |
| `DEPLOY_MONGO_GROUP` | `false` | `true` for sharded + PSS Mongo VMs |
| `DEPLOY_POSTGRES_GROUP` | `false` | `true` for PG, PDPGSQL, Patroni VMs |
| `DEPLOY_VALKEY` | `false` | `true` for Valkey tests |
| `GENERATE_DASHBOARD_SCREENSHOTS` | `false` | `true` only when screenshot generation is the goal |
| `SCREENSHOTS_SLACK_TARGET` | `@catalina.adam` | When screenshots enabled |
| `PXC_VERSION` | `8.0` | Match DB versions under test |
| `PS_VERSION` | `8.4` | |
| `MS_VERSION` | `8.4` | |
| `PGSQL_VERSION` | `17` | |
| `PDPGSQL_VERSION` | `17` | |
| `PSMDB_VERSION` | `8.0` | |
| `MODB_VERSION` | `8.0` | |
| `HELM_CHART_BRANCH` | `pmmha-v3` | When `SERVER_TYPE=ha` |
| `OPENSHIFT_VERSION` | `latest` | When `SERVER_TYPE=helm` |
| `K8S_VERSION` | `1.34` | When `SERVER_TYPE=ha` |
| `WATCHTOWER_VERSION` | `perconalab/watchtower:dev-latest` | Always → FB watchtower image |
| `PMM_QA_GIT_BRANCH` | `main` | Branch with provisioner fixes |

**Note:** `deploy-services` nested `runStagingServer` uses a fixed `DOCKER_ENV_VARIABLE`. For env-var-heavy tickets, prefer **staging-start** unless multi-VM clients are required.

### `DOCKER_ENV_VARIABLE` — common mistake

Job default (staging-start): `-e PMM_DEBUG=1 -e PMM_ENABLE_TELEMETRY=0` — override when the ticket requires different server config.

Full defaults and CLIENTS syntax: [jenkins-jobs.md](jenkins-jobs.md).

## Step 9: Build complete parambuild URL

**Pre-fill all parameters** from step 8 — every param from the chosen job table that applies.

Base URLs:

- staging-start: `https://pmm.cd.percona.com/job/pmm3-aws-staging-start/parambuild/`
- deploy-services: `https://pmm.cd.percona.com/job/pmm3-deploy-services/parambuild/`

URL-encode `DOCKER_ENV_VARIABLE` and `CLIENTS`. Full reference: [jenkins-jobs.md](jenkins-jobs.md).

## Step 10: Review PR diffs

Do **not** trust PR "How to test" or Jira QA bullets without verifying code.

1. Read diffs in `percona/pmm` and/or `percona/grafana`
2. Map changes to concrete UI/API/network steps
3. Cross-check with ticket comments, PR comments/reviews, and FB test failures marked **relevant**
4. Note post-provision steps (PMM Settings toggles, etc.)

## Step 11: Write test instructions

Post in chat **before** Jira update and browser:

1. Job chosen and why
2. Params set and why
3. Ticket/PR mismatch result: either `No ticket/PR mismatch found` or the mismatch resolution used before setup
4. FB test summary (failures relevant to this ticket)
5. Provision → configure → exercise → expected result
6. DevTools / logs / PMM Settings checks

## Step 12: Screenshot FB Tests run → Jira

### When to screenshot

**Attach a screenshot to Jira only when all `gh pr checks` are green** (no `fail` lines).

If any check failed: skip screenshot; text-only update to `customfield_10492`.

If **all passed**: screenshot the **FB Tests** Actions run:

```powershell
$runId = gh pr checks <SUBMODULES_PR> -R Percona-Lab/pmm-submodules 2>&1 |
  Select-String -Pattern 'actions/runs/(\d+)' |
  ForEach-Object { $_.Matches[0].Groups[1].Value } |
  Select-Object -First 1

playwright-cli open "https://github.com/Percona-Lab/pmm-submodules/actions/runs/$runId"
playwright-cli resize 1920 1080
playwright-cli screenshot --filename="fb-test-<TICKET>-checks.png"
playwright-cli close
```

Jira fields: `customfield_10492` (FB test screenshots), `customfield_10083` (How to test).

**Ask the user before writing to Jira** unless they explicitly requested the update.

Details: [fb-tests.md](fb-tests.md)

## Step 13: Open browser

```powershell
Start-Process "<full-parambuild-url>"
```

## Step 14: Execute generated manual test steps through MCP

Do **not** wait for or poll Jenkins after opening the parambuild URL. Immediately ask the user:

```text
Please provide the PMM instance URL once Jenkins finishes provisioning.
```

When the user provides the PMM instance URL, execute the generated manual test steps. Use default credentials:

- Username: `admin`
- Password: `pmm3admin!`

Do **not** generate an `Execution Handoff`. Execute the already generated manual test steps exactly as the test scope; do not invent or expand coverage beyond those steps unless the user explicitly asks.

Before MCP execution, read and follow these workflow files. Do this quietly; do not narrate workflow-file reads, auth setup, or browser setup:

1. Read/use `.agents/workflows/pmmLogin.md` first and immediately log in with Basic Auth using the user-provided PMM instance URL and default credentials.
2. After login, read/use `.agents/workflows/mcpRules.md` for execution behavior.
3. Use `.agents/workflows/apiIndex.md` only if API setup or API checks are needed.

Prefer API setup first when possible, and use UI only for verification. When navigating between pages, verify the actual expected page content, route, or page-specific controls. Do not treat HTTP `200` as proof that the correct page loaded.

Final MCP result must be short and use one of these formats:

- `Fixed: <one-sentence evidence>` when expected behavior passes.
- `Not fixed: <one-sentence evidence>` when the issue reproduces.
- `Blocked: <short reason>` when execution cannot complete.

## gh CLI quick reference

| Task | Command |
|------|---------|
| FB Tests (PR checks) | `gh pr checks <n> -R Percona-Lab/pmm-submodules` |
| View PR | `gh pr view <n> -R owner/repo` |
| PR diff | `gh pr diff <n> -R owner/repo` |
| Search by ticket | `gh search prs "PMM-XXXX" --repo percona/pmm` |
| PR comments | `gh api repos/OWNER/REPO/issues/<n>/comments` |

## Done criteria

1. Jira read, including ticket comments; scope understood
2. PR body, diff, issue comments, review summaries, and inline review comments read
3. Ticket/PR mismatch gate completed before Jenkins setup; user informed if any mismatch exists
4. Latest JNKPercona build comment used
5. FB Tests analyzed; relevant failures reflected in manual plan
6. Correct job + **complete** parambuild URL
7. Test instructions posted in chat
8. Jira `FB test screenshots` updated — screenshot only if all checks passed (when user approves)
9. Browser opened to parambuild URL, then user asked to provide the PMM instance URL once Jenkins finishes provisioning
10. User-provided PMM instance URL collected, generated manual test steps executed through `.agents/workflows`, and final result reported as `Fixed:`, `Not fixed:`, or `Blocked:`

## Additional resources

- [jenkins-jobs.md](jenkins-jobs.md) — all Jenkins parameters
- [fb-tests.md](fb-tests.md) — FB test sources, flaky guidance, screenshot & Jira templates
