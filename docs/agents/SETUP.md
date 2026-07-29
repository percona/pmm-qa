# Setup (one time per person)

## 1. Cursor account

- Teams plan with **usage-based billing** enabled (Cloud Agents).
- Connect GitHub with access to `percona/pmm`, `percona/pmm-qa`, `percona/grafana`.

## 2. Atlassian MCP (Jira)

Each person must authenticate — team-shared MCP does **not** share OAuth.

1. [cursor.com/agents](https://cursor.com/agents) → MCP → **Atlassian**
2. Complete OAuth for `perconadev.atlassian.net`
3. Test: read a PMM ticket in a cloud run

## 3. Slack (optional, recommended for mobile)

1. Install Cursor Slack app to workspace
2. Connect your Cursor account
3. In any channel: `@Cursor help`
4. For PMM runs: `@Cursor please test PMM-15196` — add `env=PMM` when you need both `pmm` and `pmm-qa` on the cloud VM (required on Slack/mobile; optional on Desktop when `pmm-qa` is already open)

## 4. Desktop shortcut

1. Clone/open `percona/pmm-qa`
2. Agent input → dropdown → **Cloud**
3. Type `/test-runner PMM-15196` or natural language

For multi-repo (`pmm` + `pmm-qa`), prefer Slack `env=PMM` or cursor.com/agents — Desktop may not expose environment picker.

## Team admin (optional, not required to start)

- Promote Healer/Reporter automations to **Team Owned**
- `GH_TOKEN` in PMM environment secrets
- Jira integration + Team follow-ups = Service accounts only

## Verify environment

After `environment.json` is on `main`, confirm in a cloud run:

```bash
gh --version
json-diff --version
docker run hello-world
```

Refresh **PMM** snapshot at cursor.com/agents after each `environment.json` change on `main`.
