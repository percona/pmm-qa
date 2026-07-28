# Admin request template

Send to Cursor **team admin**. Not required for individuals to start manual runs via Slack/Desktop.

---

## Team Owned automations

Promote these automations to **Team Owned** (shared service account billing):

- **Test Healer** — pmm-submodules FB failure
- **Test Reporter** — pmm-submodules FB green

Keeps event-driven runs from consuming one person's quota (see Shruti/Kiran incident Jul 2026).

## Team follow-ups

Set **Cloud Agents → Security → Team follow-ups** = **Service accounts only**.

Allows team to follow up on **Team Owned** agent threads without exposing human users' tokens.

## Secrets (environment PMM)

| Secret | Value |
|--------|-------|
| `GH_TOKEN` | GitHub PAT with `repo` read on `Percona-Lab/pmm-submodules`, `percona/pmm`, `percona/grafana` |

## Jira integration (optional)

- Install Cursor Jira app
- Service account authentication
- Routing: `pmm` → `percona/pmm`, `pmm-qa` → `percona/pmm-qa`

## Team Rule (optional discovery)

Short rule for all repos:

> PMM QA cloud agents are defined in `percona/pmm-qa` under `.cursor/agents/`. Use Slack `@Cursor env=PMM test-runner <ticket>` or see `docs/agents/README.md`.

---

**Not requesting:** private plugins / Team Marketplace (out of scope).
