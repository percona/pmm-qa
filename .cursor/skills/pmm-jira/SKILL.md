---
name: pmm-jira
description: Read and write PMM tickets on perconadev.atlassian.net — fields, transitions, Developers-only comment visibility, FB screenshot field, attachments. Use when posting Jira comments, updating How to test, attaching FB evidence, or reading ticket context for PMM QA.
---

# PMM Jira (perconadev.atlassian.net)

## Read

Use Atlassian MCP (`jira_get_issue`, `jira_get_issue_development_info`):

| Field | ID | Notes |
|-------|-----|-------|
| How to test | `customfield_10083` | Verify against code, do not trust blindly |
| FB test screenshots | `customfield_10492` | Wiki markup + attachments |
| Development panel | — | Linked GitHub PRs |

## Write — comments (mandatory visibility)

**Never post QA results as public comments.** Always restrict to **Developers** role.

`jira_add_comment` (user-mcp-atlassian):

```json
{
  "issue_key": "PMM-XXXX",
  "body": "...",
  "visibility": "{\"type\":\"role\",\"value\":\"Developers\"}"
}
```

`addCommentToJiraIssue` (plugin-atlassian):

```json
{
  "commentVisibility": { "type": "role", "value": "Developers" }
}
```

If the MCP tool cannot set visibility, **stop** and ask the human to paste with **Restrict to → Developers**.

## Attachments

Pass screenshot paths via `attachments` on `jira_update_issue` / issue update APIs when updating `customfield_10492`.

Example wiki body:

```markdown
## FB Tests — PR-4376

**Run:** https://github.com/Percona-Lab/pmm-submodules/actions/runs/27009345670
**Failures:** @rta (flaky, out of scope)

!fb-test-PMM-14915-checks.png|width=900!
```

## Ask before writing

Unless the user explicitly requested the Jira update, confirm before writing to production tickets.
