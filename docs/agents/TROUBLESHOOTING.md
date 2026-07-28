# Troubleshooting

## AI provider rate-limiting / quota exhausted

**Symptom:** `The AI provider is rate-limiting requests or is temporarily at capacity.`

**Cause:** The automation ran under **your** Cursor account (Private/Team Visible automations bill the creator).

**Fix:** Use your own `@Cursor` in Slack or Desktop Cloud run. Ask admin to promote event automations to **Team Owned** ([ADMIN_REQUEST.md](ADMIN_REQUEST.md)).

## Jira comment could not be posted (no Atlassian API auth)

**Symptom:** Agent completes but no Jira update (PMM-14609).

**Fix:** Authenticate Atlassian MCP at [cursor.com/agents](https://cursor.com/agents) — **per user**, even for team MCP servers.

## Webhook 401

**Symptom:** Jira automation fires but no Cursor run.

**Fix:** Regenerate token via **Generate auth header** in automation editor. Use fresh `Bearer crsr_...` in Jira rule.

## gh fails on pmm-submodules

**Symptom:** `gh pr checks` errors on private repo.

**Fix:** Add `GH_TOKEN` to PMM environment secrets (team admin). Verify `gh auth status` in cloud run.

## Environment ready (with warnings)

**Symptom:** Snapshot stale or install failed.

**Fix:** Refresh PMM snapshot at cursor.com/agents after `environment.json` change on `main`.

## Another person cannot follow up in Slack thread

**Symptom:** `@Cursor` in thread does not continue agent.

**Cause:** Follow-ups only work if you **own** the agent, unless Team follow-ups = All or Service accounts only on Team Owned agents.

**Fix:** `@Cursor agent <new prompt>` for separate run, or share agent URL (read-only). See [ADMIN_REQUEST.md](ADMIN_REQUEST.md).

## Wrong branch / old setup scripts

**Symptom:** Provisioning fails on MicroVM.

**Fix:** Ensure cloud agent uses `percona/pmm-qa` **main** (not `cursor/pmm-manual-qa-process-d487`). Merge must be on `main`.

## Hooks block completion

**Symptom:** Agent loops at end asking for Jira Developers comment.

**Fix:** Post Jira comment with Developers visibility per `pmm-jira` skill, or complete reporting step.
