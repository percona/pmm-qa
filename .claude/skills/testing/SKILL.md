---
name: pmm-manual-test
description: Guides PMM manual testing by reading a Jira ticket, syncing local repos, finding pmm-submodules build artifacts, analyzing flaky FB Tests for test insights, provisioning a local PMM Server + database engine(s) via `provisioning/setup.ts` (including FB/PR-specific builds via `--server-image`/`--client-version`), screenshotting FB test results with Playwright MCP into Jira FB test screenshots field, and writing verified test steps. Use when the user asks for help with manual testing, local PMM provisioning, FB test analysis, or wants to test a Jira ticket against a locally provisioned PMM instance.
---

# PMM Manual Test

## Trigger

Start when the user asks for help with **manual testing**. **Always ask for the Jira ticket key** (e.g. `PMM-14915`) if not provided.

This file is a router: each step below is one or two sentences plus a pointer to the reference file with the actual commands/tables/decision rules. Load a reference file only when you reach that step — don't read them all up front.

| Reference file | Covers |
|---|---|
| [repo-setup.md](repo-setup.md) | Repo layout, resolving repos root, cloning missing siblings, safely updating existing checkouts |
| [pr-review.md](pr-review.md) | Finding linked PRs (pmm/grafana/pmm-submodules), PR health checks, cross-repo dependency scanning, diff review |
| [provisioning.md](../../../.agents/workflows/provisioning.md) | Shared cleanup, build/setup commands, flags, engine descriptors/defaults, readiness, and known gaps |
| [local-provisioning.md](local-provisioning.md) | Ticket-specific engine/`--db` decision rule and FB-build lookup |
| [fb-tests.md](fb-tests.md) | FB test analysis, flaky-failure triage, screenshotting, Jira field updates |

## Jira access

Cloud site: `perconadev.atlassian.net`, cloud ID `07843b62-f0f6-4c9c-9c42-aaad27e6ff03`. Pass this cloud ID directly to Atlassian MCP tools — only call `getAccessibleAtlassianResources` if a call is rejected with an "isn't explicitly granted" error (site/cloud ID may differ per environment).

Custom fields: `customfield_10083` (How to test), `customfield_10492` (FB test screenshots).

## Workflow checklist

Run independent discovery steps in parallel once their inputs are known — e.g. Jira ticket
read (step 2), PR search (step 5), and repo-root resolution (step 4) don't depend on each
other's output and don't need to run sequentially.

```
- [ ] 1. Get Jira ticket key from user
- [ ] 2. Read ticket via Atlassian MCP (summary, description, linked PRs, acceptance criteria)
- [ ] 3. Identify affected repos from the ticket's components AND the linked PR's actual file list
- [ ] 4. repo-setup.md: resolve repos root; clone missing siblings; safely update local repos
- [ ] 5. pr-review.md: find PRs, pmm-submodules PR, latest JNKPercona build comment, PR health, cross-repo deps, full diff review (ticket-vs-implementation mismatch flag, QA-notes completeness, input-validation regressions), AND edge cases for the new/changed behavior — do this all in one PR pass, before FB triage or provisioning depends on it
- [ ] 6. fb-tests.md: analyze FB Tests from latest FB build, using step 5's diff findings to judge relevance
- [ ] 7. local-provisioning.md: choose engine(s)+version(s) via the `--db` decision rule and resolve FB artifacts when needed (informed by step 5's diff scope)
- [ ] 8. provisioning.md: run cleanup, build missing engine images, then run `provisioning/setup.ts` with the selected `--db`/build flags
- [ ] 9. provisioning.md: confirm provisioning exited 0 and `docker ps` shows the expected containers
- [ ] 10. Write the proposed manual steps in chat (adapt using FB failures and step 5's findings)
- [ ] 11. Pass the complete live-PMM handoff to `pmm-test-writer`; it performs the manual steps, writes the smallest valuable test, and runs the targeted test against the same instance
- [ ] 12. Run `pmm-test-reviewer` once with the acceptance criteria, PR diff, manual evidence, changed files, exact test command/result, and available report/trace
- [ ] 13. After writer and reviewer success, ask for approval and then use fb-tests.md to update Jira fields and attach an all-green screenshot when applicable
```

## Step 1: Get Jira ticket key

Ask if missing. Proceed once you have the key (e.g. `PMM-14915`).

## Step 2: Read Jira ticket

Use **Atlassian MCP** (`getJiraIssue` or equivalent):

- Summary, description, QA notes, acceptance criteria
- Existing **How to test** (`customfield_10083`) and **FB test screenshots** (`customfield_10492`)
- Development panel: linked GitHub PRs/branches
- Environment or setup hints

**Setup is ticket-specific.** Pay attention to:

- Which subsystems change (server, UI/grafana, clients, telemetry, advisors, etc.)
- Whether monitored databases are needed
- Required **PMM server environment variables** — local provisioning hardcodes `PMM_ENABLE_TELEMETRY=0` with no override flag today (see provisioning.md's "Known gap"); flag it explicitly if the ticket needs telemetry or another server env var changed
- PMM Settings changes the user must apply after provisioning

## Step 3: Identify affected repos

| Change area | Repo |
|-------------|------|
| Backend, API, managed services | `percona/pmm` |
| Grafana UI, dashboards, frontend | `percona/grafana` |
| Both | Check both PRs |

Grafana-only tickets still need an FB **server** image from pmm-submodules.

Don't stop at this table: once a PR is found (`pr-review.md`), check its actual `files` list. A single ticket can span component boundaries the table doesn't predict (e.g. one PR touching both a native React app and an older Grafana panel) — treat every changed path as in scope, not just the ones matching the expected component.

## Step 10: Write test instructions

Post in chat **before** Jira update and browser:

1. Engine(s)+version(s) chosen and why
2. Build & setup commands used (including `--server-image`/`--client-version` if an FB build)
3. FB test summary (failures relevant to this ticket)
4. Provision → configure → exercise → expected result
5. Edge cases identified in step 5's diff review (empty state, boundary values, error paths, permissions, cross-engine, concurrent use) that apply to this ticket
6. DevTools / logs / PMM Settings checks
7. Any PR-health, cross-repo-dependency, or ticket-vs-implementation mismatch found in step 5 — don't bury these, call them out as a caveat line

## Step 11: Hand live PMM to the writer

Provisioning script exits 0 → server is ready for the writer:

```powershell
docker ps
```

Confirm `pmm-server` plus the expected engine container(s) are running. Invoke
`pmm-test-writer` with the Jira key and acceptance criteria, PR diff or readable checkout,
proposed manual steps, PMM URL and current credentials, server/client build identifiers,
and database inventory. The writer owns login, live manual verification, test creation,
and the targeted test run. It does not update Jira.

## Steps 11–13: Writer, reviewer, then Jira

Once PMM is ready, complete the workflow in this order:

1. `pmm-test-writer` performs the proposed manual steps against the live instance. A
   manual failure stops the workflow without creating a test for broken behavior.
2. If automation is valuable, the writer creates or extends the test and runs the narrowest
   Playwright command from `e2e_tests/` against the same PMM URL. A justified `SKIPPED`
   automation result is valid when manual verification passed.
3. Invoke `pmm-test-reviewer` once after the targeted run passes. Pass the acceptance
   criteria, PR diff, manual evidence, changed files, exact command and exit result, and
   report/trace path when available.
4. Only after successful manual verification and a reviewer `PASS` (when a test was
   created), ask the user before updating Jira. The main workflow owns all Jira mutations.

## Done criteria

1. Jira read; scope understood
2. Latest JNKPercona build comment used
3. FB Tests analyzed; relevant failures reflected in manual plan
4. Docker cleanup run, correct engine(s) provisioned via `setup.ts`, exit code 0
5. Proposed test instructions posted in chat
6. Writer manually verified the acceptance criteria against the live PMM
7. Automation decision made; if automated, the targeted run is green and the reviewer passed
8. Jira fields updated only after successful verification and explicit user approval

## Additional resources

- [repo-setup.md](repo-setup.md) — repo layout, clone, safe update
- [pr-review.md](pr-review.md) — PR discovery, health, cross-repo deps, diff review
- [provisioning.md](../../../.agents/workflows/provisioning.md) — shared commands, flags, defaults, readiness, known gaps
- [local-provisioning.md](local-provisioning.md) — engine decision rule and FB-build lookup
- [fb-tests.md](fb-tests.md) — FB test sources, flaky guidance, screenshot & Jira templates
