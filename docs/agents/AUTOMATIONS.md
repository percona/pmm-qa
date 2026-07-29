# PMM — Cursor Cloud Automations (dashboard spec)

**Source of truth for agent behavior:** `.cursor/agents/*.md` and `.cursor/skills/*` on `main`.

Automation prompts in the dashboard are **4-line pointers** — never edit long prompts in the UI.

Environment **`PMM`** = `percona/pmm` + `percona/pmm-qa`. Config: `.cursor/environment.json`.

Create at [cursor.com/automations](https://cursor.com/automations).

---

## Pointer prompts (copy into dashboard)

### Test Runner (manual QA / webhook / Slack)

```
Read .cursor/agents/test-runner.md in percona/pmm-qa (main) and act as
that role, following it exactly and reading the skill files it names.
Input: the Jira key or issueKey from the webhook / triggering message.
If the file is missing, stop and report.
```

**Slack:** `@Cursor please test PMM-15196` — use `env=PMM` for multi-repo. Natural language works; rigid `test-runner` prefix not required.

**Desktop:** Cloud dropdown → `/test-runner PMM-15196` or natural language

### Test Healer (GitHub FB failure)

```
Read .cursor/agents/test-healer.md in percona/pmm-qa (main) and act as
that role, following it exactly and reading the skill files it names.
Input: the pmm-submodules PR or Actions run from the triggering event.
If all FB checks passed, exit immediately. If the file is missing, stop.
```

**Trigger:** GitHub → Workflow run completed → `Percona-Lab/pmm-submodules` (FB Tests).

### Test Reporter (GitHub FB green)

```
Read .cursor/agents/test-reporter.md in percona/pmm-qa (main) and act as
that role, following it exactly and reading the skill files it names.
Input: the pmm-submodules PR from the triggering event.
If any check failed, do not attach screenshots. If the file is missing, stop.
```

**Trigger:** Same workflow as Healer — prompt gates on green checks only.

---

## Overview

| Role | Agent file | Typical trigger |
|------|------------|-----------------|
| **Test Runner** | `.cursor/agents/test-runner.md` | Jira Ready for QA webhook, Slack, Desktop |
| **Test Healer** | `.cursor/agents/test-healer.md` | pmm-submodules FB Tests **failed** |
| **Test Reporter** | `.cursor/agents/test-reporter.md` | pmm-submodules FB Tests **green** |

Do not combine roles in one automation.

---

## Shared: environment `PMM`

| Item | Value |
|------|--------|
| Repos | `percona/pmm` + `percona/pmm-qa` |
| `environment.json` | `pmm-qa/.cursor/environment.json` |
| Cursor provisioning | `cursor-qa-integration/` (not `qa-integration/`) |
| `pmm-submodules` | **`gh` only** — never clone |

After pushing `environment.json`, refresh snapshot at [cursor.com/agents](https://cursor.com/agents).

### Secrets

| Secret | Used by |
|--------|---------|
| `GH_TOKEN` | `gh` on private repos |
| Atlassian MCP | Jira (per-user OAuth at cursor.com/agents) |

---

## Test Runner — Jira webhook

Webhook URL after save: `https://api2.cursor.sh/automations/webhook/<uuid>`

Headers: `Authorization: Bearer crsr_<token>`, `Content-Type: application/json`

Body: `{"issueKey": "{{issue.key}}"}`

Jira Automation: transition → **Ready for QA** → Send web request (POST).

---

## Test Healer — GitHub

| Tool | Enable |
|------|--------|
| MCP atlassian | Optional (context) |
| Pull request creation | Yes (`percona/pmm-qa` only) |
| Slack MCP | Optional (healer tracking canvas) |

**Team Owned** recommended for shared billing.

---

## Go-live checklist

- [ ] `.cursor/environment.json` on `main`, PMM snapshot refreshed
- [ ] `gh --version`, `json-diff --version`, `docker run hello-world` in test run
- [ ] Atlassian MCP authenticated (each user)
- [ ] `GH_TOKEN` in environment secrets
- [ ] Three automations with pointer prompts above
- [ ] Dry run Runner on a Ready for QA ticket
- [ ] Dry run Healer on failed FB PR
- [ ] Dry run Reporter on green FB PR

See also [SETUP.md](SETUP.md) and [TROUBLESHOOTING.md](TROUBLESHOOTING.md).
