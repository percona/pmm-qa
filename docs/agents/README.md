# PMM Cloud Agents

Versioned QA roles live in this repo. **First cloud run in under 5 minutes** (after one-time setup).

## Quick start

1. One-time setup → [SETUP.md](SETUP.md)
2. Pick a role → [ROLES.md](ROLES.md)
3. Run in the **Cloud** (not local):

| Surface | How |
|---------|-----|
| **Slack** (phone) | `@Cursor env=PMM test-runner PMM-15196` |
| **Web / iOS** | [cursor.com/agents](https://cursor.com/agents) → environment **PMM** |
| **Desktop** | Open `pmm-qa` → input dropdown **Cloud** → `/test-runner PMM-15196` |

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
| Dashboard automations | [AUTOMATIONS.md](AUTOMATIONS.md) (pointer prompts only) |
| Environment | `.cursor/environment.json` |

Change behavior via **git PR** to `percona/pmm-qa` — not by editing long prompts in cursor.com.

## Cloud vs local

| Action | Use |
|--------|-----|
| Start new run on cloud VM | Input dropdown → **Cloud** |
| Move existing chat to cloud | **Move to Cloud** (commits/stash first — no dirty files) |
| Launch cloud subagent from local session | `/in-cloud` (different from Cloud dropdown) |

## Help

- [SETUP.md](SETUP.md) — accounts, MCP, billing
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) — rate limits, 401 webhook, auth
- [VALIDATION.md](VALIDATION.md) — undocumented behaviors to verify
- [ADMIN_REQUEST.md](ADMIN_REQUEST.md) — what to ask team admin
