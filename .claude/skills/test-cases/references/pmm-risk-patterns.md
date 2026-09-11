# PMM risk patterns

Use the row matching the changed area to challenge the initial candidate list. These are historical prompts, not automatic cases. Cite a bug key only after confirming that its failure mechanism is relevant to the current change.

| Area | Recurring PMM failure | Historical evidence | Candidate to consider |
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
| PMM UI client state | Session, polling, or cache state held in the browser dies silently: a scheduler that stops rescheduling, a cookie the app's path cannot read, a deadline missed while the tab is hidden | PMM-15420 | Confirm the state is reachable from the app's own serving path, then drive it directly (cookie edit, blur/focus) rather than only through server state |
| HA | Stale inventory, false health, incorrect proxy routing, or restart failure | PMM-15227, PMM-14734, PMM-15030, PMM-15029, PMM-15228 | Drive the actual cluster trigger and assert at the owning layer; test unhealthy as well as healthy |
| Helm and HA chart configuration | Chart defaults, image pins, or feature gates make product behavior differ from single-server PMM | PMM-T2217 exposed this with internal PostgreSQL QAN disabled | Render or inspect effective values first; never assert output from a component the chart disables |
| Upgrade and restart | Migration crash-loop, restart hangs, or large state fails | PMM-15404, PMM-15266, PMM-15050 | Upgrade seeded data and perform both a post-upgrade read and write |
| Backups | Restore does not restart the DB, tool versions conflict, or polling misreports state | PMM-15163, PMM-14594, PMM-14576 | Perform a real restore; assert the database is running and queryable |
| Alerting | Missing series incorrectly resolves a firing alert | PMM-14193, PMM-15145 | Hold the condition beyond the evaluation/lookback window and assert the alert remains firing |
| Packages and installers | Package conflicts with itself or installer ignores installed version | PMM-15015, PMM-15126 | Install or upgrade over an existing supported version, then verify the client runs |

## Trigger discipline

Before proposing a lifecycle case, identify what invokes the changed path. Helm scaling, pod deletion, process restart, reconciliation, scrape, election, and migration can produce different inputs. Drive the exact trigger the implementation observes and name it in Preconditions.

Before writing a client-state case, confirm the app can read that cookie or storage entry at its serving path. Before writing a focus-recovery case, confirm the implementation registers a focus or visibility handler and acts on it.

For chart tickets, treat `percona/percona-helm-charts` as implementation, not provisioning detail. Inspect templates and effective values alongside PMM code before selecting the oracle.

## Fresh historical evidence

When no row fits and the change is high risk, use the Jira skill to search recent resolved bugs in the matching component. Select only two or three bugs whose summaries describe the same behavior or boundary; similarity of component alone is not evidence.
