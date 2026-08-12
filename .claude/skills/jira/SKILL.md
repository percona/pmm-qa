---
name: jira
description: Read and write PMM tickets on perconadev.atlassian.net — fields, transitions, Developers-only comment visibility, FB screenshot field, attachments. Use when posting Jira comments, updating How to test, attaching FB evidence, or reading ticket context for PMM QA.
---

# PMM Jira (perconadev.atlassian.net)

## Access path — the relay broker

**All Jira operations go through the relay's `/jira-act` endpoint** (curl, see
"Operations" below). The relay holds the Jira service-account credentials
(`JIRA_EMAIL` + `JIRA_API_TOKEN`); this environment holds only a scoped
`RELAY_KEY` and the relay base URL (`RELAY_BASE_URL`, e.g.
`https://139-162-176-43.ip.linodeusercontent.com`). The relay:

- accepts only existing `PMM-<number>` tickets — **no create, no delete**;
- **forces** `visibility: Developers` on every comment — a public QA comment
  is impossible on this path, regardless of what you send;
- records the caller (`by`) for audit;
- returns the Jira REST response (status + body) verbatim.

Do **not** call the Atlassian MCP connector tools (kept documented below only
for reference), and do **not** hit `perconadev.atlassian.net` directly — the
token isn't in this environment. Connector approval is also still broken for
Routine grants ([claude-code#61015](https://github.com/anthropics/claude-code/issues/61015)),
so the connector path stays disabled; the relay path has no approval gate.

- **Still broken / can't determine** → proceed with `curl`, say nothing.
- **Genuinely fixed** → still complete the current task with `curl`, then
  tell the human: *"claude-code#61015 looks fixed as of \<date/evidence\> —
  revert the curl-first policy in `.claude/skills/jira/SKILL.md` (this
  section) to switch back to the Atlassian connector."* Do not revert it
  yourself — the human owns that change so the team remembers it happened.

## Read

Fields to fetch (via REST per the policy above; `getJiraIssue` is the
connector equivalent, currently not to be used):

| Field | ID | Notes |
|-------|-----|-------|
| How to test | `customfield_10083` | Verify against code, do not trust blindly |
| FB test screenshots | `customfield_10492` | Wiki markup + attachments |
| Development panel | — | Linked GitHub PRs |

## Write — comments (mandatory visibility)

**Never post QA results as public comments.** Always restrict to **Developers** role.

Via REST (the current path), the key is `visibility` — see the fallback
section below. On the connector path (when re-enabled), `addCommentToJiraIssue`
spells it `commentVisibility`:

```json
{
  "commentVisibility": { "type": "role", "value": "Developers" }
}
```

If neither path can set visibility, **stop** and ask the human to paste with **Restrict to → Developers**.

## Attachments

Pass screenshot paths via `attachments` on the issue-update call when updating `customfield_10492`.

Example wiki body:

```markdown
## FB Tests — PR-4376

**Run:** https://github.com/Percona-Lab/pmm-submodules/actions/runs/27009345670
**Failures:** @rta (flaky, out of scope)

!fb-test-PMM-14915-checks.png|width=900!
```

## Ask before writing

Unless the user explicitly requested the Jira update, confirm before writing to production tickets.

## Operations (via the relay)

`POST $RELAY_BASE_URL/jira-act` with header `X-Relay-Secret: $RELAY_KEY` and a
JSON body naming the `op`. `issue` must be a `PMM-<number>` key; `by` is your
email (the relay's audit trail). The relay talks Jira REST **v2** upstream (wiki
markup, no ADF) and returns its status + body verbatim. Bodies with wiki markup
are plain JSON strings — build them with `jq` so newlines/quotes escape cleanly.

```bash
R() { curl -sS -m 90 --fail-with-body -X POST "$RELAY_BASE_URL/jira-act" \
        -H "X-Relay-Secret: $RELAY_KEY" -H "Content-Type: application/json" -d "$1"; }
BY="${USER_EMAIL:-relay}"

# read — omit fieldsCsv for the default QA field set
R "$(jq -n --arg i PMM-15188 --arg by "$BY" '{op:"read",issue:$i,by:$by}')"
R "$(jq -n --arg i PMM-15188 --arg by "$BY" '{op:"read",issue:$i,by:$by,fieldsCsv:"summary,status"}')"

# comment — visibility is FORCED to Developers by the relay; you cannot post public
R "$(jq -n --arg i PMM-15188 --arg by "$BY" --arg b "h2. QA results"$'\n'"..." '{op:"comment",issue:$i,by:$by,body:$b}')"

# field — e.g. update the FB screenshot field (customfield_10492) or How to test
R "$(jq -n --arg i PMM-15188 --arg by "$BY" --arg v "...wiki markup..." '{op:"field",issue:$i,by:$by,fields:{customfield_10492:$v}}')"

# transitions — list, then transition by id
R "$(jq -n --arg i PMM-15188 --arg by "$BY" '{op:"transitions",issue:$i,by:$by}')"
R "$(jq -n --arg i PMM-15188 --arg by "$BY" --arg t 41 '{op:"transition",issue:$i,by:$by,transitionId:$t}')"

# attach — a screenshot, base64-encoded (the relay does the multipart upload)
R "$(jq -n --arg i PMM-15188 --arg by "$BY" --arg f fb-checks.png \
      --arg c "$(base64 -w0 fb-checks.png)" '{op:"attach",issue:$i,by:$by,filename:$f,content_b64:$c}')"
```

Available ops: `read`, `comment`, `field`, `transitions`, `transition`,
`attach` — the full set the old direct-REST path had, minus create/delete
(the relay refuses those by construction). The **mandatory Developers-only
visibility rule** is enforced by the relay itself, so it holds even if a
caller forgets it.
