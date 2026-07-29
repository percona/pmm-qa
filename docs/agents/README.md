# PMM Cloud Agents

Versioned QA roles live in this repo. **First cloud run in under 5 minutes** (after one-time setup).

## Quick start

1. One-time setup → [SETUP.md](SETUP.md)
2. Pick a role → [ROLES.md](ROLES.md)
3. Run in the **Cloud** (not local):

| Surface | How |
|---------|-----|
| **Slack** (phone) | `@Cursor please test PMM-15196` — add `env=PMM` when you need the multi-repo PMM environment (pmm + pmm-qa) |
| **Web / iOS** | [cursor.com/agents](https://cursor.com/agents) → environment **PMM** |
| **Desktop** | Open `pmm-qa` → input dropdown **Cloud** → `/test-runner PMM-15196` or natural language |

You do **not** need a rigid `test-runner` prefix in Slack when the message clearly asks for QA on a ticket. Automations use pointer prompts that load `.cursor/agents/test-runner.md` by path.

Results: Jira comment (Developers-only), PR on `percona/pmm-qa` if applicable, Slack thread updates.

## Roles

| Role | Command | Trigger (event) |
|------|---------|-----------------|
| Test Runner | `/test-runner <ticket>` | Manual, Slack, Jira webhook |
| Test Healer | `/test-healer` or FB failure event | pmm-submodules CI failed |
| Test Reporter | `/test-reporter` or FB green event | pmm-submodules CI green |

Detail: [ROLES.md](ROLES.md)

## Source of truth

| What | Where |
|------|--------|
| Role definitions | `.cursor/agents/*.md` |
| Domain knowledge | `.cursor/skills/pmm-*/` |
| Cursor provisioning | `cursor-qa-integration/` (separate from `qa-integration/`) |
| Dashboard automations | [AUTOMATIONS.md](AUTOMATIONS.md) (pointer prompts only) |
| Environment | `.cursor/environment.json` |
| IDE workflow prompts (not cloud roles) | [.agents/](../../.agents/README.md) — see [WORKFLOWS.md](WORKFLOWS.md) |

Change behavior via **git PR** to `percona/pmm-qa` — not by editing long prompts in cursor.com.

## Cloud vs local

| Action | Use |
|--------|-----|
| Start new run on cloud VM | Input dropdown → **Cloud** |
| Move existing chat to cloud | **Move to Cloud** (commits/stash first — no dirty files) |
| Launch cloud subagent from local session | `/in-cloud` (different from Cloud dropdown) |

## Help

- [SETUP.md](SETUP.md) — accounts, MCP, billing
- [WORKFLOWS.md](WORKFLOWS.md) — `.agents/workflows` vs `.cursor/agents`
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) — rate limits, 401 webhook, auth
- [VALIDATION.md](VALIDATION.md) — undocumented behaviors to verify
