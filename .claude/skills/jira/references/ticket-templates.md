# PMM ticket pattern — issue types, description templates, fields

The team's Definition of Ready is checked against these templates. A ticket an
agent files must arrive already in this shape — a correct diagnosis written as
free-form prose gets bounced back at refinement, however good the evidence is.

Two rules cover most of it:

- **Use the issue type's template headings verbatim, in order, none dropped.**
  A section with nothing to say gets an explicit `None` / `Not known` / `N/A`,
  never silent omission — a missing heading reads as "not investigated", an
  explicit `None known` reads as "checked, there isn't one".
- **Everything the reporter owns gets filled in.** For a Bug that is Steps to
  reproduce, Actual result, Expected result, User impact and Details. Workaround
  is the Eng team's, but say `None known` if you didn't find one. Story Points,
  QA Estimation, Fix/Planned version and Sprint belong to refinement — leave
  them empty.

## Issue types

Pass the name exactly as written to `issuetype` on `jira/create`.

| `issuetype` | Meaning | Agent use |
| ------------- | --------- | ----------- |
| `Bug` | Something that should work but doesn't | Investigator's product-bug report |
| `Improvement` | Existing functionality that isn't broken but could work better | Rare; only when asked |
| `New Feature` | New functionality in the product | Not filed by agents |
| `Admin & Maintenance Task` | Upkeep — dependency bumps, CVEs, upstream merges | Rare; only when asked |
| `QA Automation` | QA automation work | pmm-qa automation work that needs tracking |
| `Epic` | Wrapper for roadmap items / initiatives | Never filed by agents |

There are **no Jira subtasks** — the team uses Smart Checklist items instead.

## Description templates

Descriptions go through Jira REST **v2**, so the body is **wiki markup, not
Markdown**: `h2. Heading`, `*bold*`, `{{monospace}}`, `{code}…{code}`, `#`
ordered / `*` bulleted lists, `[text|url]`, `!image.png|width=900!`. Markdown
`##` and `**bold**` render literally and are the most common tell that a ticket
skipped this file.

### 🐞 Bug

```
h2. Steps to reproduce

# <first step, from a clean PMM — exact command / exact clicks>
# <…>

h2. Actual result

<what happens, with the observed output — error text, status code, empty panel>

h2. Expected result

<what should happen instead, and why that is the intended behaviour>

h2. User impact

<who hits this, in what scenario, and what they can no longer do>

h2. Workaround

<the workaround, or "None known.">

h2. Details

<version + environment, evidence, links; see below>
```

- **Steps to reproduce** must start from a state a developer can get to (a fresh
  PMM Server of a named version, a named `pmm-framework` setup) and be runnable
  verbatim. "Run the nightly matrix" is not a step; the command that failed is.
- **Actual / Expected** stay separate even when the actual result feels
  self-evidently wrong — Expected is where you cite the code, doc or previous
  release that says what should have happened.
- **User impact** is about the user, not the test: which product capability is
  lost. "The `@nightly` suite is red" is a symptom, not an impact.
- **Details** carries everything else an agent-filed bug accumulates: exact
  PMM Server/Client image and version, deployment mode, CI run or FB PR URLs,
  log excerpts in `{code}` blocks, the suspected upstream PR, the control run
  that passed, and — where the failure could not be reproduced independently —
  an explicit statement of that, with what evidence stands in its place.

### 🍏 New Feature / 💚 Improvement

```
h2. User Story

As a <type of user>, I want to <action> so that <benefit>.

h2. Acceptance criteria

# <…>

h2. Design / UI / UX (if applicable)

h2. Suggested implementation / options

h2. Out of scope

h2. Details
```

### 💟 Admin & Maintenance Task

```
h2. What should be done

h2. Added value

h2. Suggested implementation / options

h2. Out of scope

h2. Details
```

### 👜 Epic

```
h2. Problem description

h2. Idea(s) to solve the problem

h2. Roadmap item link

h2. Suggested implementation / options

h2. Design / UI / UX (if applicable)

h2. Out of scope

h2. Details
```

## Summary line

`<area>: <what is broken, specifically>` — the area prefix is optional when the
first words already name it, and a deployment-mode prefix (`[HA]`) is used when
the bug only occurs there. Name the observable failure, not the test that caught
it. Real examples:

- `QAN overview search input unmounts while typing, losing focus and keystrokes`
- `PXC (proxysql) exporter is missing TLS flags for change agent: --tls-ca-file, --tls-cert-file, --tls-key-file`
- `[HA] Shared PostgreSQL runs out of connection slots under load: Grafana auth 401s and dashboards render "No data"`

## Fields

Field IDs verified against the live PMM project. Anything not listed here is
refinement's to fill in.

| Field | Key | Shape | Agent sets it |
| ------- | ----- | ------- | --------------- |
| Summary | `summary` | string | Always |
| Issue type | `issuetype` | name, see table above | Always |
| Description | `description` | wiki markup, template above | Always |
| Priority | `priority` | `{"name":"Medium"}` — `Critical`, `High`, `Medium`, `Low` | Always; `Medium` unless the impact argues otherwise |
| Components | `components` | `[{"name":"Backend"}]` | Always, at least one |
| Affects Version/s | `versions` | `[{"name":"3.9.1"}]` | On a regression, or whenever the failing version is known |
| Labels | `labels` | `["…"]` | Only when one applies (see below) |
| Regression Issue | `customfield_10058` | `[{"value":"Yes"}]` (checkbox) | When it worked in an earlier release — pair with Affects Version/s |
| Found by Automation | `customfield_10059` | `[{"value":"Yes"}]` (checkbox) | Auto-set to Yes by the relay on every Bug it creates; pass `[]` to override for a human-reported bug |
| Needs QA | `customfield_10064` | `{"value":"Yes"}` | Yes on a product bug |
| Needs Doc | `customfield_10066` | `{"value":"No"}` | Yes only when the fix changes documented behaviour |
| How to test | `customfield_10083` | string | When the reproduction doubles as the test recipe |
| FB test screenshots | `customfield_10492` | wiki markup + attachments | `fb-reporter` only |

Components in use (pick every one the bug touches): `Backend`, `Frontend`,
`HA`, `Packaging`, `Infrastructure`, `PMM Helm Charts`, `PMM ManageD`,
`PMM Agent`, `PMM Admin`, `PMM Client`, `PMM Server`, `PMM UI`, `PMM Update Service`,
`Grafana Dashboards`, `Grafana`, `QAN`, `Inventory`, `Backups`, `Authentication`,
`VictoriaMetrics`, `Docker`, `OpenShift`, `Documentation`, `QA`, `QA Automation`,
`Node_Exporter`, `Postgres_Exporter`, `MongoDB_Exporter`, `ProxySQL_Exporter`,
`Releases`.

Labels are mostly applied by automation (`CVE`, `ES`, `Ext`, `Int`) or by the
team during refinement (`refined`, `triaged`, `QAA`, `Unplanned`). The two an
agent may set on its own: `tech-debt`, and `Defect` for a regression the team
introduced in the release currently under development.

`Fix version`, `Planned version`, `Story Points`, `QA Estimation`, `Sprint` and
`Escalation Priority` are **never** set by an agent.

If Jira rejects a field on create (`Field 'x' cannot be set. It is not on the
appropriate screen`), re-issue the create without it and set it afterwards with
the `field` action — do not drop the value.

## Worked create call

Uses the `J()` helper from `SKILL.md`.

```bash
DESC=$(cat <<'EOF'
h2. Steps to reproduce

# Start PMM Server {{perconalab/pmm-server:3.9.1-rc}} in Docker.
# Register a MySQL 8.4 instance: {{pmm-admin add mysql --username=root --password=... mysql84 127.0.0.1:3306}}
# Open *MySQL Instance Summary* for {{mysql84}}.

h2. Actual result

The command exits 0 but the dashboard renders "No data" for every panel, and
{{pmm-admin list}} shows the agent as {{AGENT_STATUS_UNKNOWN}}:

{code}
mysqld_exporter ... AGENT_STATUS_UNKNOWN
{code}

h2. Expected result

The exporter reaches {{RUNNING}} and the summary dashboard populates within one
scrape interval, as it does for MySQL 8.0 on the same server.

h2. User impact

MySQL 8.4 instances cannot be monitored at all — every dashboard for them is
empty, so anyone on 8.4 has no metrics after upgrading PMM.

h2. Workaround

None known.

h2. Details

* PMM Server {{perconalab/pmm-server:3.9.1-rc}} (3.9.1), PMM Client {{pmm3-rc}}
* Reproduced on a throwaway Linode VM, single-server Docker, 3/3 attempts
* Control: MySQL 8.0 on the same server registers and reports normally
* CI run: <url>
* Suspected upstream change: [percona/pmm#NNNN|https://github.com/percona/pmm/pull/NNNN]
EOF
)

J create "$(jq -n --arg s "MySQL 8.4 instances register but report no metrics (agent stays AGENT_STATUS_UNKNOWN)" \
                 --arg d "$DESC" \
  '{issuetype:"Bug", summary:$s, description:$d,
    fields:{ priority:{name:"Medium"},
             components:[{name:"Backend"},{name:"PMM Agent"}],
             versions:[{name:"3.9.1"}],
             customfield_10058:[{value:"Yes"}],
             customfield_10064:{value:"Yes"},
             customfield_10066:{value:"No"} }}')"
```

## Before you create — checklist

1. Issue type correct, and every heading of its template present, in order.
2. Steps to reproduce are numbered and runnable from a named starting state.
3. Actual and Expected are separate, and Expected cites what makes it expected.
4. User impact names the affected user and lost capability, not the red test.
5. Workaround filled in, or explicitly `None known.`
6. Details carry version, environment, evidence and links — including an honest
   note when the failure was diagnosed from logs rather than reproduced.
7. Body is wiki markup: no `##`, no `**bold**`, no Markdown fences.
8. At least one component; priority set deliberately.
9. Regression → `versions` + `customfield_10058` both set.
10. Summary names the observable failure, specific enough to dedup against.
