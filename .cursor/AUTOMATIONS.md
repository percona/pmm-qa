# PMM — Cursor Cloud Automations

Two **separate** automations. Environment **`PMM`** (`percona/pmm` + `percona/pmm-qa`). Config: `pmm-qa/.cursor/environment.json`.

Create at [cursor.com/automations](https://cursor.com/automations).

---

## Overview

| Automation | Trigger | Purpose |
|------------|---------|---------|
| **Tester** | Jira → **Ready for QA** (webhook) | Manual QA: read ticket, plan tests, provision PMM, test via terminal + `playwright-cli`, optionally automate → PR `pmm-qa` |
| **Test Healer** | `pmm-submodules` **Actions / FB Tests** completed | On failure: prod bug → stop; test bug → repro with **same setup as FB workflow** → fix → PR `pmm-qa` |

Do not combine these roles in one automation.

---

## Shared: environment `PMM`

| Item | Value |
|------|--------|
| Name | `PMM` |
| Repos | `percona/pmm` + `percona/pmm-qa` |
| `environment.json` | `pmm-qa/.cursor/environment.json` (includes `playwright-cli` + browsers) |
| `pmm-submodules` | **`gh` only** — never clone |

After pushing `environment.json`, refresh the environment snapshot on [cursor.com/agents](https://cursor.com/agents).

**Integrations:** GitHub + Atlassian MCP (`atlassian`).

### `gh` CLI on the cloud VM

`environment.json` installs **`gh`** via apt. After refreshing the `PMM` snapshot, verify in a test run:

```bash
gh --version
gh auth status
```

**Auth (required for private repos like `Percona-Lab/pmm-submodules`):**

1. Create a GitHub PAT (classic) with `repo` scope, or a fine-grained token with read on `pmm-submodules`, `pmm`, `grafana`.
2. Cursor dashboard → **Secrets** (team or environment-scoped for `PMM`).
3. Add secret **`GH_TOKEN`** = your token.

Cloud agents pick up `GH_TOKEN` automatically; `gh` uses it without `gh auth login`.

Without `GH_TOKEN`, `gh pr checks` on private repos will fail.

---

# Automation 1 — Tester

## Editor fields

| Field | Value |
|-------|-------|
| **Name** | `Tester` |
| **Description** | When a Jira ticket moves to Ready for QA, read requirements and verify how to test against code, provision full PMM staging, execute manual QA with terminal and playwright-cli, then open a pmm-qa PR only if automation is worthwhile with minimal changes. |
| **Environment** | `PMM` |
| **Repositories** | Environment `PMM` |
| **Memory** | Off |

## Trigger

**Webhook** (Cursor has no native Jira trigger).

### Webhook URL

After saving the automation, Cursor shows:

- **URL:** `https://api2.cursor.sh/automations/webhook/<uuid>`
- **API key:** click **Generate auth header** in the automation editor (token looks like `crsr_...`)

Every request must include:

```
Authorization: Bearer crsr_<your-token>
Content-Type: application/json
```

### Test from your machine

```bash
curl -X POST "https://api2.cursor.sh/automations/webhook/1a3ca82b-7590-11f1-a8a0-cafc5ef88358" \
  -H "Authorization: Bearer crsr_<YOUR_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"issueKey": "PMM-12345"}'
```

Replace `PMM-12345` with a real ticket in **Ready for QA**. Check the run in [cursor.com/automations](https://cursor.com/automations) → your automation → **Runs**.

If you get **401**: regenerate the token in the UI (known issue — use a fresh token from **Generate auth header**).

### Jira Automation rule (Ready for QA)

**Jira** → **Project settings** → **Automation** → **Create rule**:

| Step | Config |
|------|--------|
| **Trigger** | Issue transitioned → To status **Ready for QA** |
| **Action** | Send web request |
| **URL** | `https://api2.cursor.sh/automations/webhook/1a3ca82b-7590-11f1-a8a0-cafc5ef88358` |
| **Method** | POST |
| **Headers** | `Authorization` = `Bearer crsr_<YOUR_TOKEN>` |
| | `Content-Type` = `application/json` |
| **Body** (custom data / JSON) | `{"issueKey": "{{issue.key}}"}` |

Jira must allow custom headers on **Send web request** (Jira Cloud supports this). If your Jira plan blocks custom headers, use a small proxy (Cloudflare Worker / Zapier) that adds the `Authorization` header and forwards the body.

Your **Tester** prompt must read `issueKey` from the webhook payload.

## Tools

| Tool | Enable |
|------|--------|
| MCP `atlassian` | Yes |
| Pull request creation | Yes (`percona/pmm-qa` only) |
| Computer use | Yes (fallback; prefer `playwright-cli`) |
| Comment on PR | Optional |

## Prompt

```
You are Tester — PMM manual QA cloud agent.

Triggered when a Jira ticket is Ready for QA (webhook issueKey or explicit key in prompt).

## 1 — Read the ticket (do not trust dev blindly)

Atlassian MCP on PMM-XXXX:
- Summary, description, acceptance criteria
- How to test (customfield_10083)
- FB test screenshots (customfield_10492) if present
- All comments and QA notes
- Development links → percona/pmm and/or percona/grafana PRs

gh pr diff on linked product PRs. Read changed files in workspace (pmm/) when cloned.
Cross-check "How to test" against actual code changes. Note gaps and extra cases dev missed.

## 2 — Plan testing

Write a short test plan in your run output:
- What to verify (mapped to acceptance criteria)
- PMM server env vars (DOCKER_ENV_VARIABLE) — defaults are often wrong (e.g. telemetry)
- Monitored databases / CLIENTS for pmm-framework.py (ps, psmdb, pgsql, etc.)
- Post-provision steps (PMM Settings toggles)
- FB images from latest JNKPercona "Staging instance:" on linked pmm-submodules PR (gh only):
  Server docker, Watchtower docker, Client tarball

## 3 — Provision full PMM staging (cloud VM, Docker)

Same pattern as Percona Jenkins staging-start:

export DOCKER_VERSION, WATCHTOWER_VERSION, CLIENT_VERSION from FB comment
export ADMIN_PASSWORD='pmm3admin!'
export DOCKER_ENV_VARIABLE from ticket (default: -e PMM_DEBUG=1 -e PMM_ENABLE_TELEMETRY=0)
export CLIENTS from test plan

1. docker network create pmm-qa
2. docker volume create pmm-data
3. Watchtower on pmm-qa
4. PMM Server on pmm-qa (watchtower env, admin password, DOCKER_ENV_VARIABLE)
5. Wait https://127.0.0.1/v1/server/readyz
6. pmm-qa/qa-integration/pmm_qa/pmm3-client-setup.sh
7. pmm-framework.py with CLIENTS when databases needed

## 4 — Execute manual QA

Use terminal for API/CLI checks (curl, pmm-admin via cli suite patterns).

Use playwright-cli for UI (installed globally in PMM environment):
  playwright-cli open https://127.0.0.1 --ignore-https-errors
  playwright-cli resize 1920 1080
  playwright-cli snapshot
  playwright-cli fill / click / type as needed
  playwright-cli screenshot --filename=tester-<TICKET>-<step>.png
  playwright-cli close

Exercise every item in your test plan. Record pass/fail per criterion.

## 5 — Report manual test results

Post **one** Jira comment (test plan, results, screenshot paths, blockers) restricted to the **Developers** role — **never** post a public comment.

**Mandatory visibility** — always pass it; omitting it posts publicly:

```
jira_add_comment(
  issue_key: "PMM-XXXX",
  body: "...",
  visibility: "{\"type\":\"role\",\"value\":\"Developers\"}"
)
```

With `plugin-atlassian-atlassian` / `addCommentToJiraIssue`: `commentVisibility: {"type": "role", "value": "Developers"}`.

If the MCP tool cannot set visibility, stop and ask the user to paste the draft with **Restrict to → Developers**.

Do not mark QA pass if criteria failed.

## 6 — Automation decision (after manual QA complete)

Ask: can this be automated in pmm-qa with MINIMAL changes?

Yes if:
- Stable selectors/flows exist or small helpers suffice
- No heavy multi-VM topology
- Test adds clear value (regression for this ticket)

No if:
- One-off manual setup, flaky infra, or large new framework work

If Yes → implement smallest test in pmm-qa (codeceptjs-e2e, e2e_tests, or cli), open PR to percona/pmm-qa only.
If No → stop after Jira comment; no PR.

## Never

- Open PRs to percona/pmm or percona/grafana
- Clone Percona-Lab/pmm-submodules
- Trust How to test without reading PR diff
```

---

# Automation 2 — Test Healer

## Editor fields

| Field | Value |
|-------|-------|
| **Name** | `Test Healer` |
| **Description** | On pmm-submodules FB Tests failure, determine product vs test bug. Product bug: no action. Test bug: reproduce using the same environment setup as the FB GitHub workflow, fix percona/pmm-qa, open PR. |
| **Environment** | `PMM` |
| **Repositories** | Environment `PMM` |
| **Memory** | On (optional) |

## Trigger

**GitHub → Workflow run completed** → `Percona-Lab/pmm-submodules`  
(Filter: **FB Tests** / `pmm-qa-fb-checks.yml` when available.)

Fallback: **CI completed** on same repo — prompt must confirm failure is from FB Tests.

## Tools

| Tool | Enable |
|------|--------|
| MCP `atlassian` | Yes (find linked ticket context) |
| Pull request creation | Yes (`percona/pmm-qa` only) |
| Comment on PR | Optional on pmm-submodules PR |

**No Jira status gate** — runs on FB failure regardless of ticket status.

## Prompt

```
You are Test Healer — PMM FB Tests triage and repair cloud agent.

Triggered by Percona-Lab/pmm-submodules Actions (FB Tests workflow).

## 1 — Collect failure evidence

gh pr checks <PR> -R Percona-Lab/pmm-submodules

If all checks pass → exit immediately.

Latest FB build only. Open failed job logs in the Actions run.
Latest JNKPercona "Staging instance:" comment:
  Server docker → PMM_SERVER_IMAGE
  Client tarball → PMM_CLIENT_VERSION

Map each failed check to workflow inputs in pmm-qa/.github/workflows/:
  fb-e2e-suite.yml → runner-e2e-tests-codeceptjs.yml (setup_services, tags_for_tests)
  fb-integration-suite.yml → runner-integration-cli-tests.yml (services_list, cli_tag)

## 2 — Classify: product bug vs test bug

PRODUCT BUG → exit. Do nothing. No comments required unless useful for dev.

Signals:
- Assertion matches percona/pmm or percona/grafana PR diff
- Reproduces on staging with correct product behavior
- Acceptance criteria / feature logic broken

Use gh pr diff and pmm/ workspace. grafana via gh if needed.

TEST BUG → continue.

Signals:
- Wrong selector, outdated expectation, flaky timing
- Setup/infra failure (pmm-framework.py, readyz, image pull, Launchable empty)
- Failure unrelated to PR scope

## 3 — Reproduce with FB workflow setup (NOT Jenkins staging)

Use the same steps as the failed FB job's reusable workflow.

### UI / CodeceptJS (@* UI tests)

Follow pmm-qa/.github/workflows/runner-e2e-tests-codeceptjs.yml:

- docker network create pmm-qa
- pmm-qa/codeceptjs-e2e: docker compose up with PMM_SERVER_IMAGE
- readyz on http://127.0.0.1 (admin-password)
- testdata/db_setup.sh
- pmm3-client-setup.sh with PMM_CLIENT_VERSION
- pmm-framework.py with setup_services from failed job
- codeceptjs run --grep "<tags_for_tests>"

ADMIN_PASSWORD=admin-password for this path.

### CLI (CLI tests *)

Follow pmm-qa/.github/workflows/runner-integration-cli-tests.yml:

- PMM Server docker (CLI style, ports 80/443/9000)
- pmm3-client-setup.sh
- pmm-framework.py with WIZARD_ARGS
- npx playwright test --grep "<cli_tag>" in pmm-qa/cli

## 4 — Fix and PR

Minimal fix in percona/pmm-qa only.
Re-run the failed suite until green.
Open PR. Optional: brief pmm-submodules PR comment that fix is in pmm-qa.

## Never

- Fix percona/pmm or percona/grafana for FB failures
- Clone pmm-submodules
- Use Jenkins watchtower staging for healer (that is Tester's job)
- Act on green FB runs

## Cleanup

docker compose -f pmm-qa/codeceptjs-e2e/docker-compose.yml down -v 2>/dev/null || true
docker rm -f pmm-server watchtower pmm-server-data 2>/dev/null || true
docker network rm pmm-qa 2>/dev/null || true
```

---

## Setup checklist

- [ ] Push `environment.json` → refresh `PMM` snapshot (`playwright-cli --version` works)
- [ ] Atlassian MCP connected
- [ ] **Tester** created with Jira Ready for QA webhook
- [ ] **Test Healer** created with pmm-submodules workflow trigger
- [ ] Dry run Tester on a ticket in Ready for QA
- [ ] Dry run Healer on a failed FB PR

---

## Trigger summary

| Agent | Starts when |
|-------|-------------|
| **Tester** | Jira **Ready for QA** (webhook) |
| **Test Healer** | **pmm-submodules** FB Tests workflow finishes with failures |

---

## Go-live checklist (all automations created)

### 1. Environment `PMM`

- [ ] Push latest `pmm-qa/.cursor/environment.json` to `main`
- [ ] [cursor.com/agents](https://cursor.com/agents) → **PMM** → re-run update / refresh snapshot
- [ ] Confirm in a manual cloud run: `gh --version`, `playwright-cli --version`, `docker run hello-world`

### 2. Secrets (Cursor dashboard)

| Secret | Used by |
|--------|---------|
| `GH_TOKEN` | `gh` on private GitHub repos (Healer, Tester, Reporter) |
| Atlassian MCP | Jira read/write (configure in Cursor Settings → MCP, not a shell secret) |

### 3. Tester — Jira webhook

- [ ] Copy API key via **Generate auth header** on the Tester automation
- [ ] Test with `curl` (see above) using a real `issueKey`
- [ ] Create Jira Automation rule: transition → **Ready for QA** → POST webhook
- [ ] Confirm a run appears under Tester → **Runs**

### 4. Test Healer — GitHub trigger

- [ ] Trigger: **Workflow run completed** on `Percona-Lab/pmm-submodules` (FB Tests)
- [ ] Environment: **PMM**
- [ ] Wait for a real FB failure (or re-run failed workflow) and check Healer → **Runs**

### 5. Third automation (if Test Reporter / FB screenshots)

- [ ] Trigger: same GitHub workflow on `pmm-submodules`
- [ ] Acts only when FB is **green** → updates Jira `customfield_10492`
- [ ] Dry run on a PR with all green checks

### 6. Atlassian MCP

- [ ] Authenticate **atlassian** in Cursor Settings (Tester + Reporter need Jira even without Jira plugin)
- [ ] Team Owned automations: ensure MCP auth works for the team service account

### 7. First real ticket

1. Move **PMM-XXXX** to **Ready for QA** → Tester should start
2. When FB Tests finish green → Reporter updates screenshot (if configured)
3. When FB Tests fail → Healer triages (no Jira status gate on Healer)
