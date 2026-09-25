# PMM Jira

Use this reference for every Jira operation on `perconadev.atlassian.net`.
The relay holds the service-account credentials, forces project `PMM`, records
the rostered GitHub caller, uses Jira REST v2 wiki markup, and returns Jira's
status and body unchanged. Do not use the Atlassian connector or call Jira
directly; headless connector authentication and Routine grants are unreliable.

## Contents

- [Permissions and boundaries](#permissions-and-boundaries)
- [Actions](#actions)
- [Reading tickets](#reading-tickets)
- [Creating tickets](#creating-tickets)
- [Templates](#templates)
- [Fields](#fields)
- [Evidence and preflight](#evidence-and-preflight)

## Permissions and boundaries

- Ask before writing unless the user explicitly requested the Jira change.
- Investigator may create a deduplicated, reproduced product bug without
  another confirmation; that write is part of its defined workflow.
- The relay forces every comment to the Developers role. If another path cannot
  restrict visibility, stop and ask a human to paste it privately.
- Jira tickets are publicly visible unless a human sets the Internal security
  level. Never include credentials, customer identifiers, relay hosts, internal
  IPs, or cluster endpoints.
- Test plans and test cases belong in Zephyr through `test-cases`, linked to the
  ticket. Never post them to Jira comments or How to test.
- There is no delete action. Dashboards, gadgets, and saved filters are also
  unavailable; produce JQL counts and manual dashboard steps instead.

## Actions

Define `R` from the relay `SKILL.md`, then use `R jira <action> '<json>'`.
Every action except `create` and `search` requires `issue: "PMM-<number>"`.

| Action | Body |
| --- | --- |
| `create` | `issuetype`, `summary`, optional `description`, `fields` |
| `read` | `issue`, optional `fieldsCsv` |
| `search` | JQL without a project clause, optional `maxResults` (1–100), `fields` |
| `comment` | `issue`, `body` |
| `field` | `issue`, `fields` |
| `transitions` | `issue` |
| `transition` | `issue`, `transitionId` |
| `attach` | `issue`, `filename`, `content_b64` |

```bash
R jira read "$(jq -n --arg i PMM-15188 '{issue:$i}')"
R jira search "$(jq -n --arg q 'text ~ "retention" ORDER BY updated DESC' \
  '{jql:$q,maxResults:20}')"
R jira comment "$(jq -n --arg i PMM-15188 --arg b 'h2. QA results' \
  '{issue:$i,body:$b}')"
```

`search` returns `{issues:[...], total:N}` directly, not under `body`. Inspect
the unfiltered payload before trusting an empty filtered result. It does not
paginate: beyond 100 results, order by `created ASC, key ASC`, advance with
`created >= <last created>`, exclude collected keys, deduplicate by key, and
fail if a page adds none. Jira's `created` value is minute-precision, so the key
exclusion is required.

Errors include `issue_must_be_a_PMM_key`, `summary_and_issuetype_required`,
`jira_not_configured`, and `jira_upstream_error`.

## Reading tickets

For QA work, request summary, description, status, comments, components, labels,
fix versions, and these fields explicitly with `fieldsCsv`:

```bash
R jira read "$(jq -n --arg i PMM-15188 \
  '{issue:$i,fieldsCsv:"summary,description,status,comment,components,labels,fixVersions,customfield_10083,customfield_10492,customfield_10059"}')"
```

The relay cannot read Jira's Development panel. Discover linked pull requests
from ticket text and repository searches instead.

| Field | ID | Notes |
| --- | --- | --- |
| How to test | `customfield_10083` | Verify against implementation; do not trust blindly |
| FB screenshots | `customfield_10492` | Wiki markup plus attachments |
| Found by Automation | `customfield_10059` | Relay defaults Bugs to `[{"value":"Yes"}]` |

## Creating tickets

Use the exact issue type name: `Bug`, `Improvement`, `New Feature`,
`Admin & Maintenance Task`, `QA Automation`, or `Epic`. Agents normally create
only reproduced `Bug` issues; create the other types only when asked. PMM uses
Smart Checklist items, not Jira subtasks.

Descriptions are Jira REST v2 wiki markup: `h2.`, `*bold*`, `{{mono}}`,
`{code}`, `#` ordered lists, `*` bullets, `[text|url]`, and
`!image.png|width=900!`. Markdown headings, bold, and fences render literally.
Keep every template heading in order; write `None known.` for an investigated
empty section.

## Templates

### Bug

```text
h2. Steps to reproduce

# <exact steps from a named clean PMM version and environment>

h2. Actual result

<observed output, error, status, or missing data>

h2. Expected result

<intended behavior and its source>

h2. User impact

<affected user, scenario, and lost capability>

h2. Workaround

<workaround or "None known.">

h2. Details

<versions, deployment, concise evidence, run URLs, control, suspected PR>
```

State explicitly when logs support the diagnosis but independent reproduction
was not possible. The summary is `<area>: <observable failure>`; use `[HA]` when
the failure is HA-only. Name the product failure, not the red test.

### New Feature or Improvement

```text
h2. User Story
h2. Acceptance criteria
h2. Design / UI / UX (if applicable)
h2. Suggested implementation / options
h2. Out of scope
h2. Details
```

### Admin & Maintenance Task

```text
h2. What should be done
h2. Added value
h2. Suggested implementation / options
h2. Out of scope
h2. Details
```

### QA Automation

```text
h2. Objective
h2. Scope
h2. Location
h2. Details
```

Name every PMM-T case in Scope and the target spec path and tag in Location.

## Fields

| Field | Key | Shape | Rule |
| --- | --- | --- | --- |
| Priority | `priority` | `{"name":"Medium"}` | Always; choose from Critical/High/Medium/Low |
| Components | `components` | `[{"name":"Backend"}]` | Always, at least one |
| Affects Version/s | `versions` | `[{"name":"3.9.1"}]` | Regression or known failing version |
| Labels | `labels` | `["tech-debt"]` | Only `tech-debt` or current-release `Defect` autonomously |
| Regression Issue | `customfield_10058` | `[{"value":"Yes"}]` | Pair with Affects Version/s |
| Found by Automation | `customfield_10059` | `[{"value":"Yes"}]` | Relay defaults Bugs to Yes; `[]` overrides |
| Needs QA | `customfield_10064` | `{"value":"Yes"}` | Yes on product bugs |
| Needs Doc | `customfield_10066` | `{"value":"No"}` | Yes only for documented behavior changes |
| How to test | `customfield_10083` | string | When reproduction is also the test recipe |
| FB screenshots | `customfield_10492` | wiki markup | `fb-reporter` only |

Use all applicable established components, such as Backend, Frontend, HA,
Packaging, Infrastructure, PMM Helm Charts, PMM ManageD, PMM Agent, PMM Admin,
PMM Client, PMM Server, PMM UI, Grafana Dashboards, Grafana, QAN, Inventory,
Backups, Authentication, VictoriaMetrics, Docker, OpenShift, Documentation, QA,
QA Automation, and the relevant exporter.

Never set Fix version, Planned version, Story Points, QA Estimation, Sprint, or
Escalation Priority. If create rejects a valid field as unavailable on the
screen, retry create without it and apply it afterwards with `field`.

If a custom-field ID may have drifted, search for an issue with a known value,
read it with `fieldsCsv:"*all"`, and inspect its non-null `customfield_*`
entries. Compare known Yes and No issues when two candidates remain; never
guess an ID.

Example create:

```bash
R jira create "$(jq -n --arg s 'MySQL 8.4 agents remain UNKNOWN after registration' \
  --arg d "$DESC" '{issuetype:"Bug",summary:$s,description:$d,fields:{
    priority:{name:"Medium"},components:[{name:"PMM Agent"}],
    customfield_10064:{value:"Yes"},customfield_10066:{value:"No"}}}')"
```

## Evidence and preflight

- Excerpt only the lines carrying the failure and enough surrounding context.
- Remove secrets, tokens, cookies, connection strings, and customer data.
- Use public run URLs instead of internal infrastructure identifiers.
- Make reproduction steps runnable from a named version and environment.
- Separate Actual and Expected; ground Expected in code, docs, or a prior release.
- Describe user impact as a lost capability, not a failing suite.
- Set priority and at least one component deliberately.
- For a regression, set both Affects Version/s and Regression Issue.
- Recheck the summary against existing tickets before creation.
