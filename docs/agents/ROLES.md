# Roles

Source files: `.cursor/agents/<name>.md`. Skills listed are read **by path** from `.cursor/skills/`.

---

## Test Runner

| | |
|--|--|
| **Does** | Full manual QA for a Jira ticket: read ticket, plan, provision PMM on cloud VM, test (CLI + UI), Developers-only Jira report, optional `pmm-qa` PR |
| **Skills** | `pmm-jira`, `pmm-fb-tests`, `pmm-provisioning`, `pmm-ui-evidence`, `pmm-repos` |
| **Produces** | Jira comment (Developers), screenshots/videos, optional PR to `percona/pmm-qa` |

### How to run

| Surface | Command |
|---------|---------|
| Desktop | Cloud dropdown → `/test-runner PMM-15196` |
| Slack | `@Cursor env=PMM test-runner PMM-15196` |
| Web / iOS | cursor.com/agents → PMM → prompt with ticket key |
| Automation | Jira webhook → pointer in [AUTOMATIONS.md](AUTOMATIONS.md) |

**Automation status:** webhook configurable (Jira Ready for QA); manual via Slack/Desktop **today**.

---

## Test Healer

| | |
|--|--|
| **Does** | On FB Tests failure: product vs test bug; reproduce with FB workflow setup; fix `pmm-qa`; open PR |
| **Skills** | `pmm-fb-tests`, `pmm-provisioning`, `pmm-repos`, `pmm-jira` (optional) |
| **Produces** | PR to `percona/pmm-qa`; optional pmm-submodules PR comment |

### How to run

| Surface | Command |
|---------|---------|
| Desktop | Cloud → `/test-healer` + PR or run URL |
| Slack | `@Cursor env=PMM` + failed Actions link |
| Automation | GitHub workflow completed on `pmm-submodules` (failure) |

**Automation status:** GitHub trigger **works** (Team Owned recommended).

---

## Test Reporter

| | |
|--|--|
| **Does** | When all FB checks green: screenshot Actions run, update Jira `customfield_10492` |
| **Skills** | `pmm-fb-tests`, `pmm-jira`, `pmm-ui-evidence`, `pmm-repos` |
| **Produces** | Jira FB screenshot field + attachment |

### How to run

| Surface | Command |
|---------|---------|
| Desktop | Cloud → `/test-reporter` + PR |
| Automation | Same GitHub workflow as Healer (green gate in prompt) |

**Automation status:** GitHub trigger **works** when configured.

---

## Workers (orchestration, Fase 3)

| Agent | Purpose |
|-------|---------|
| `read-git-diff` | Isolated PR diff summary |
| `provision-pmm` | Isolated server + DB setup |
| `run-e2e` | CodeceptJS / UI slice |
| `run-cli` | CLI Playwright slice |

Test Runner may delegate when validated on cloud. See [HANDOFF.md](HANDOFF.md).

---

## Canvas source

This file is the source for the **#pmm-ai** Slack canvas "How to manually run?" column.
