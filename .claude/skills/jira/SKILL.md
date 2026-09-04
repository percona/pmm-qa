---
name: jira
description: Read and write PMM tickets on perconadev.atlassian.net — fields, transitions, Developers-only comment visibility, FB screenshot field, attachments. Use when posting Jira comments, updating How to test, attaching FB evidence, or reading ticket context for PMM QA.
---

# PMM Jira (perconadev.atlassian.net)

## Access path — the relay broker

**All Jira operations go through the relay's `/jira/<action>` broker** (curl,
see "Operations" below). The relay holds the Jira service-account credentials
(`JIRA_EMAIL` + `JIRA_API_TOKEN`); this environment holds only a scoped
`RELAY_KEY` (the relay URL is a fixed public hostname, hardcoded in the snippet
below). You identify yourself with `X-Actor` (your GitHub login — from the GitHub MCP
`get_me`; `gh api user` only where `gh` exists), which
the relay roster-checks. The relay:

- operates on existing `PMM-<number>` tickets, **and can `create` a new PMM
  issue** (project forced to `PMM`; still **no delete**);
- **forces** `visibility: Developers` on every comment — a public QA comment
  is impossible on this path, regardless of what you send;
- records the caller (`by`) for audit;
- returns the Jira REST response (status + body) verbatim.

Do **not** call the Atlassian MCP connector tools (kept documented below only
for reference), and do **not** hit `perconadev.atlassian.net` directly — the
token isn't in this environment. This includes **searching for existing
tickets**: use the relay `search` action (JQL), not the Atlassian Rovo search —
the connector needs interactive auth that isn't there in a Routine/headless run,
so it fails closed. The relay `search` is the supported dedup path. Connector approval is also still broken for
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
| ------- | ----- | ------- |
| How to test | `customfield_10083` | Verify against code, do not trust blindly |
| FB test screenshots | `customfield_10492` | Wiki markup + attachments |
| Found by Automation | `customfield_10059` | Multi-checkbox; set `[{"value":"Yes"}]`. The relay sets this to Yes automatically on Bugs it `create`s |
| Development panel | — | Linked GitHub PRs |

The full field map for **writing** a ticket (priority, components, affects
version, Regression Issue, Needs QA/Doc) is in
`references/ticket-templates.md`.

## Write — creating an issue

**Read `references/ticket-templates.md` before every `create`** and follow the
issue type's template. A ticket whose description doesn't carry the team's
headings, or that arrives with no components and no priority, fails the
Definition of Ready at refinement no matter how sound the investigation behind
it was. That file has the templates in wiki markup, the verified field IDs, a
worked `create` call and a pre-flight checklist.

Two things to get right that are easy to miss: the relay talks Jira REST **v2**,
so descriptions are **wiki markup** (`h2.`, `*bold*`, `{{mono}}`, `{code}`) and
Markdown renders literally; and a template section with nothing to say gets an
explicit `None known.` rather than being dropped.

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

**One standing exception:** the Investigator agent `create`s a `Bug` (auto-flagged Found by Automation) for a product regression it has *reproduced* and classified — that autonomous create is the agent's defined job and its dedup step already guards against duplicates, so it needs no extra confirmation. Every other write — comments, transitions, field edits on existing tickets — still follows the confirm rule above.

## Operations (via the relay)

`POST $RELAY/jira/<action>` (relay URL hardcoded below) with headers `X-Relay-Secret: $RELAY_KEY`
and `X-Actor: <your GitHub login>` (from the GitHub MCP `get_me`, or `gh api user`
where `gh` exists; the relay roster-checks it
and records who acted — no self-reported email). The action is
in the **URL path**; the JSON body carries `issue` (must be a `PMM-<number>`
key) and any action args. The relay talks Jira REST **v2** upstream (wiki
markup, no ADF) and returns its status + body verbatim. Build bodies with `jq`
so newlines/quotes escape cleanly.

```bash
RELAY=https://139-162-176-43.ip.linodeusercontent.com   # fixed prod relay (reserved IP)
# X-Actor is your GitHub login — set ACTOR from the GitHub MCP get_me (.login) first.
# gh is a fallback only where present; fail closed on an empty actor (the relay 401s it).
command -v gh >/dev/null && ACTOR="${ACTOR:-$(gh api user --jq .login)}"
[ -n "$ACTOR" ] || { echo "ACTOR unset — set it from the GitHub MCP get_me .login" >&2; exit 1; }
J() { curl -sS -m 90 --fail-with-body -X POST "$RELAY/jira/$1" \
        -H "X-Relay-Secret: $RELAY_KEY" -H "X-Actor: $ACTOR" \
        -H "Content-Type: application/json" -d "$2"; }

# create — a new PMM issue (project is forced to PMM). issuetype + summary
# required; description optional. On a Bug the relay auto-sets Found by
# Automation (customfield_10059) = Yes unless you pass it yourself.
# Description + fields MUST follow references/ticket-templates.md (wiki markup,
# team headings, components + priority) — see the worked example there.
J create "$(jq -n --arg s "PMM Server X breaks on Y" --arg d "$DESC" \
      '{issuetype:"Bug", summary:$s, description:$d,
        fields:{priority:{name:"Medium"}, components:[{name:"Backend"}],
                customfield_10064:{value:"Yes"}, customfield_10066:{value:"No"}}}')"
# override / add fields (e.g. NOT automation-found):
J create "$(jq -n --arg s "..." '{issuetype:"Bug", summary:$s, fields:{customfield_10059:[]}}')"

# read — omit fieldsCsv for the default QA field set
J read "$(jq -n --arg i PMM-15188 '{issue:$i}')"
J read "$(jq -n --arg i PMM-15188 '{issue:$i,fieldsCsv:"summary,status"}')"

# search — JQL to find existing tickets (e.g. dedup before create). The project
# is FORCED to PMM, so write only the rest of the clause. Read-only. ORDER BY ok;
# maxResults<=100 (default 20); fields optional. Use THIS, never the Atlassian MCP.
J search "$(jq -n --arg q 'text ~ "cannot add MySQL 8.4" AND statusCategory != Done ORDER BY updated DESC' \
      '{jql:$q, maxResults:20, fields:"summary,status,issuetype,updated"}')"

# comment — visibility is FORCED to Developers by the relay; you cannot post public
J comment "$(jq -n --arg i PMM-15188 --arg b "h2. QA results"$'\n'"..." '{issue:$i,body:$b}')"

# field — e.g. update the FB screenshot field (customfield_10492) or How to test
J field "$(jq -n --arg i PMM-15188 --arg v "...wiki markup..." '{issue:$i,fields:{customfield_10492:$v}}')"

# transitions — list, then transition by id
J transitions "$(jq -n --arg i PMM-15188 '{issue:$i}')"
J transition  "$(jq -n --arg i PMM-15188 --arg t 41 '{issue:$i,transitionId:$t}')"

# attach — a screenshot, base64-encoded (the relay does the multipart upload)
J attach "$(jq -n --arg i PMM-15188 --arg f fb-checks.png \
      --arg c "$(base64 -w0 fb-checks.png)" '{issue:$i,filename:$f,content_b64:$c}')"
```

Available actions: `create`, `read`, `search`, `comment`, `field`, `transitions`,
`transition`, `attach` — the full set the old direct-REST path had **plus
`create`** (project forced to `PMM`) **and `search`** (JQL, also PMM-scoped, so
dedup goes through the relay instead of the Atlassian MCP), minus delete (the
relay refuses that by construction). The **mandatory Developers-only visibility rule** is enforced by
the relay itself, so it holds even if a caller forgets it.
