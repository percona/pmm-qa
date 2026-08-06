---
name: jira
description: Read and write PMM tickets on perconadev.atlassian.net — fields, transitions, Developers-only comment visibility, FB screenshot field, attachments. Use when posting Jira comments, updating How to test, attaching FB evidence, or reading ticket context for PMM QA.
---

# PMM Jira (perconadev.atlassian.net)

## Which access path to use

- **Interactive session with a human present** → Atlassian MCP connector (below).
- **Unattended run (Routine-fired session), or any session where a connector
  call stalls on "This connector call requires your approval to proceed"** →
  use the **REST fallback** (bottom of this file). Connector approval is
  enforced host-side and is broken for Routine grants
  ([claude-code#61015](https://github.com/anthropics/claude-code/issues/61015)):
  an unattended run that hits it stalls forever. `curl` via Bash has no
  approval gate. Don't retry a stalled connector call — switch paths.

## Read

Use the Atlassian MCP connector (`getJiraIssue` / equivalent):

| Field | ID | Notes |
|-------|-----|-------|
| How to test | `customfield_10083` | Verify against code, do not trust blindly |
| FB test screenshots | `customfield_10492` | Wiki markup + attachments |
| Development panel | — | Linked GitHub PRs |

## Write — comments (mandatory visibility)

**Never post QA results as public comments.** Always restrict to **Developers** role.

`addCommentToJiraIssue` (Atlassian MCP):

```json
{
  "commentVisibility": { "type": "role", "value": "Developers" }
}
```

If the MCP tool cannot set visibility, **stop** and ask the human to paste with **Restrict to → Developers**.

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

## REST fallback (no connector, no approval prompts)

Requires `JIRA_EMAIL` + `JIRA_API_TOKEN` env vars (set in the cloud
environment config; token from id.atlassian.com → API tokens) and network
access to `perconadev.atlassian.net` (already reachable if the environment
allows Linode/terraform traffic; otherwise add it to the environment's
Allowed domains). Use API **v2** — it speaks wiki markup directly, no ADF.

```bash
J="https://perconadev.atlassian.net/rest/api/2"
AUTH=(-u "$JIRA_EMAIL:$JIRA_API_TOKEN" -H "Content-Type: application/json")

# Read ticket (same fields as the connector path)
curl -sS "${AUTH[@]}" "$J/issue/PMM-15188?fields=summary,description,status,customfield_10083,customfield_10492,comment"

# Comment restricted to Developers — REST names the key `visibility`,
# not `commentVisibility` (that's the MCP tool's spelling)
curl -sS "${AUTH[@]}" -X POST "$J/issue/PMM-15188/comment" \
  -d '{"body":"h2. QA results\n...","visibility":{"type":"role","value":"Developers"}}'

# Attach a screenshot (multipart, no JSON content-type)
curl -sS -u "$JIRA_EMAIL:$JIRA_API_TOKEN" -X POST \
  -H "X-Atlassian-Token: no-check" -F "file=@fb-checks.png" \
  "$J/issue/PMM-15188/attachments"

# Update FB screenshot field / transitions
curl -sS "${AUTH[@]}" -X PUT "$J/issue/PMM-15188" -d '{"fields":{"customfield_10492":"...wiki markup..."}}'
curl -sS "${AUTH[@]}" "$J/issue/PMM-15188/transitions"   # list, then POST {"transition":{"id":"..."}}
```

The **mandatory Developers-only visibility rule above applies on this path
too** — REST will happily post a public comment if you omit `visibility`.
