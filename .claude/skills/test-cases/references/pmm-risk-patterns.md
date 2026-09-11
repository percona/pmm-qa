# PMM risk patterns

Use the row matching the changed area to challenge the failure model. These are historical prompts, not automatic cases.

A historical bug is evidence only when its **failure mechanism** is reachable from the current change. `PMM-*` entries are Jira bugs; an explicitly marked `PMM-T*` entry is a Zephyr test-case observation and must be read with the `zephyr` skill.

| Area | Known PMM failure | Evidence | Candidate to consider |
|---|---|---|---|
| Agent connectivity | Agent remains disconnected or metrics do not resume after a dropped connection | PMM-15310, PMM-15200, PMM-14442, PMM-13994 | Drop and restore the link; assert Connected and fresh metrics after one reconnect cycle |
| CLI and inventory changes | Invalid changes are accepted, exporter becomes `Done`, or CLI fails after UI removal | PMM-15130, PMM-15201, PMM-13120, PMM-15242 | Validate rejection without mutation; assert exporter remains Running; check cross-surface lifecycle |
| DB authentication and TLS | New auth defaults, skip-verify, or certificate handling breaks monitoring | PMM-15259, PMM-14519, PMM-15188, PMM-7888 | Exercise only the auth/TLS variant and DB version touched by the change |
| Exporter output | Duplicate metrics, runaway queries, or false metric values | PMM-15198, PMM-14958, PMM-14906, PMM-15161 | Compare metric value with the DB source; bound log and query-count checks |
| Dashboard aggregation | Panels double-count or group by the wrong label | PMM-15184, PMM-15091, PMM-15118, PMM-15114, PMM-15174 | Use at least two entities sharing the default grouping key; one entity hides aggregation bugs |
| Dashboard filters and topology | All/multi-value filters omit standalone or asynchronous nodes | PMM-15240, PMM-13932, PMM-14908, PMM-14938 | Exercise the non-default topology and multiple selected values |
| Dashboards after upgrade | Datasource, plugin, or theme works fresh but not after upgrade | PMM-15155, PMM-15083 | Open the changed dashboard on an upgraded server with seeded state |
| QAN and RTA | Filters omit values, historical ranges fail, or missing DB privileges look like no data | PMM-15206, PMM-15336, PMM-14661, PMM-14717 | Trace workload to ClickHouse to UI; distinguish authorization failure from empty data |
| Settings and persistence | Value appears saved but is lost or never reaches the consumer | PMM-15074, PMM-15354, PMM-15241, PMM-14751, PMM-14931 | Read back through the API and at exporter/metric consumer after the relevant reload |
| RBAC, anonymous, and secrets | UI hides an action while API allows it, or credentials leak into logs | PMM-15138, PMM-15139, PMM-15309, PMM-15067, PMM-15164, PMM-15010 | Deny the API mutation and verify unchanged state; search bounded logs for the exact secret |
| HA | Stale inventory, false health, incorrect proxy routing, or restart failure | PMM-15227, PMM-14734, PMM-15030, PMM-15029, PMM-15228 | Drive the actual cluster trigger and assert at the owning layer; test unhealthy as well as healthy |
| Helm and HA chart configuration | Chart defaults, image pins, or feature gates make behavior differ from single-server PMM | PMM-T2217 test-case observation: internal PostgreSQL QAN disabled | Inspect/render effective values before assuming a component exists |
| Upgrade and restart | Migration crash-loop, restart hangs, or large state fails | PMM-15404, PMM-15266, PMM-15050 | Upgrade seeded data and perform both a post-upgrade read and write |
| Backups | Restore does not restart the DB, tool versions conflict, or polling misreports state | PMM-15163, PMM-14594, PMM-14576 | Perform a real restore; assert the DB is running and queryable |
| Alerting | Missing series incorrectly resolves a firing alert | PMM-14193, PMM-15145 | Hold the condition beyond the evaluation/lookback window and assert the alert remains firing |
| Packages and installers | Package conflicts with itself or installer ignores installed version | PMM-15015, PMM-15126 | Install/upgrade over an existing supported version, then verify the client runs |

## How to use the table

1. Find rows that match the **changed behavior or dependency**, not merely the component name.
2. Extract the failure mechanism.
3. Ask whether the current implementation can reach the same mechanism.
4. If yes, add it to the failure model.
5. Generate a candidate only if it passes the strong-case gate.

Example:

- Current change: dashboard grouping field changed.
- Relevant historical mechanism: two entities collapsed because grouping used the wrong label.
- Useful challenge: seed two entities that should remain distinct.
- Not useful: rerun every dashboard test associated with the old ticket.

## Fresh historical evidence

Historical search is a normal part of meaningful behavior changes, not a last resort.

Run a focused Jira search when the change touches:

- persisted state;
- monitoring/metrics data flow;
- agent/exporter behavior;
- permissions/authentication;
- lifecycle/retry/reconnect;
- upgrade/migration/version gates;
- HA/chart topology;
- dashboards/QAN aggregation or filtering;
- shared API/schema/configuration used by multiple callers.

Search using the narrowest useful combination of:

- component;
- API field/CLI flag/config key;
- state transition;
- metric/label;
- user-visible failure;
- dependency or boundary.

Select **at most 2-3** historical bugs that describe the same failure mechanism or boundary.

Do not use:

- same component alone;
- same UI page alone;
- broad "similar feature" matches.

If no relevant bug is found, continue from implementation evidence. Absence of history is not evidence of safety.

## Trigger discipline

Before proposing lifecycle coverage, identify what invokes the changed path.

These are not interchangeable:

- Helm scaling;
- pod deletion;
- process restart;
- reconciliation;
- scrape/evaluation;
- reconnect;
- leader election;
- migration.

Drive the exact trigger the implementation observes.

For chart tickets, treat `percona/percona-helm-charts` as implementation, not provisioning detail. Inspect templates and effective values alongside PMM code before choosing an oracle.
