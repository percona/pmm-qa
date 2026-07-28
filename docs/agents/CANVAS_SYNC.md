# Canvas sync (#pmm-ai)

Canvas ID: `F0BESJWC8AE` (channel `#pmm-ai`).

## Source

[ROLES.md](ROLES.md) — especially "How to run" tables.

## Manual update

Edit canvas when ROLES.md changes on `main`.

## Automation (cron) — dashboard spec

**Schedule:** daily or on merge to `main` (if webhook unavailable).

**Prompt:**

```
Read docs/agents/ROLES.md from percona/pmm-qa on main.
Update Slack canvas F0BESJWC8AE to match the role table:
Agent | What it does | How to manually run | Automation status.
Use Slack MCP canvas update. Keep the auth callout for Cursor Slack integration.
Do not change canvas ID.
```

**Tools:** Slack MCP (`slack_update_canvas` or equivalent), read repo file.

**Scope:** Team Owned automation recommended.

---

Last manual sync: part of agent versioning rollout.
