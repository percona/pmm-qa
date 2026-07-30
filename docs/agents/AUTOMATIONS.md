# PMM — Cursor dashboard (automations + canvas)

Agent behavior lives in `.cursor/agents/*.md` and `.cursor/skills/*` on `main`. Dashboard prompts are **4-line pointers only**.

Environment **`PMM`** = `percona/pmm` + `percona/pmm-qa`. Config: `.cursor/environment.json`. Refresh snapshot at [cursor.com/agents](https://cursor.com/agents) after changes.

Create automations at [cursor.com/automations](https://cursor.com/automations).

---

## Pointer prompts (copy into dashboard)

### Test Runner

```
Read .cursor/agents/test-runner.md in percona/pmm-qa (main) and act as
that role, following it exactly and reading the skill files it names.
Input: the Jira key or issueKey from the webhook / triggering message.
If the file is missing, stop and report.
```

Slack: `@Cursor please test PMM-15196` — add `env=PMM` for multi-repo. Desktop: Cloud → `/test-runner PMM-15196`.

Jira webhook body: `{"issueKey": "{{issue.key}}"}` — headers `Authorization: Bearer crsr_<token>`, `Content-Type: application/json`.

### Test Healer

```
Read .cursor/agents/test-healer.md in percona/pmm-qa (main) and act as
that role, following it exactly and reading the skill files it names.
Input: the pmm-submodules PR or Actions run from the triggering event.
If all FB checks passed, exit immediately. If the file is missing, stop.
```

Trigger: GitHub → Workflow run completed → `Percona-Lab/pmm-submodules`.

### Test Reporter

```
Read .cursor/agents/test-reporter.md in percona/pmm-qa (main) and act as
that role, following it exactly and reading the skill files it names.
Input: the pmm-submodules PR from the triggering event.
If any check failed, do not attach screenshots. If the file is missing, stop.
```

Same GitHub trigger as Healer; prompt gates on green checks only.

---

## Go-live checklist

- [ ] `.cursor/environment.json` on `main`, PMM snapshot refreshed
- [ ] `gh --version`, `json-diff --version`, `docker run hello-world` in a test run
- [ ] Atlassian MCP authenticated (each user, cursor.com/agents)
- [ ] `GH_TOKEN` in PMM environment secrets
- [ ] Three automations with pointer prompts above

---

## Canvas sync (#pmm-ai)

Canvas ID: `F0BESJWC8AE`.

Update when `.cursor/agents/test-runner.md`, `test-healer.md`, or `test-reporter.md` change on `main`.

**Cron automation prompt:**

```
Read .cursor/agents/test-runner.md, test-healer.md, and test-reporter.md
from percona/pmm-qa on main. Update Slack canvas F0BESJWC8AE table columns:
Agent | What it does | How to manually run | Automation status.
Keep the Cursor Slack auth callout. Do not change canvas ID.
```

Tools: Slack MCP canvas update + read repo files. Team Owned automation recommended.
