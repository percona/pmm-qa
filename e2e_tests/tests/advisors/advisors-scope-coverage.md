# Advisors scope coverage (PMM-14109)

The 58 `@advisors`, 5 `@advisor-scheduling` and 2 `@advisor-databases` tests, with one upgrade and three HA tests, cover 39 of the 64 scope items fully and 13 partly. Another 4 have tests that have not run yet, 5 were dropped in review, and 3 are not covered. Of the 57 new cases, 50 are automated (TC-28 to TC-73 except the dropped TC-45, TC-53, TC-60 and TC-68, and additions to TC-08, TC-14, TC-22, TC-23, TC-26 and TC-27); 3 remain and 4 were dropped. The [plan](#plan) below covers what is left.

Scope source: the "What PMM-14109 changes" write-up of branch `PMM-14109-improve-advisor-ux` at head 99ac4aec9 (26 Oct 2026). Test IDs (TC-xx) refer to [advisors-test-cases.md](advisors-test-cases.md). Checked on 27 Oct 2026 against the local build `3.10.1-PMM-14109-improve-advisor-ux-ede5df3c7` (pmm-managed at branch head 3c88fc7) with one Percona Server 8.4 service and mailpit: all 60 pass in 5.7 minutes, and so does the fixed `@image-renderer` test. Before U-01 to U-06, 17 of the then 27 passed. On 28 Oct 2026 the 3 `@advisor-scheduling` tests of Phase 2 passed twice on the same build, in 3.4 minutes each; in TC-62 the waiting runs started 83 s after falling due. With the Phase 3 restart tests, all 5 passed twice, in 8.2 and 7.8 minutes. In CI on 2 Nov 2026, against the same feature build, `@advisors` passed all 58 in two separate runs after a race in TC-02 was fixed, `@advisor-scheduling` passed all 5, and `@advisor-databases` passed TC-67 and failed TC-66 on findings 6 and 7 only. TC-69 to TC-72 have not run.

Status: **Covered** = asserted end to end · **Partial** = some of the item is asserted · **Written** = a test asserts it but has not run yet · **Dropped** = left untested on purpose in review · **Broken** = a test asserts behaviour the branch removed · **Gap** = nothing asserts it.

## Scope → tests

| Area | Scope item | Status | Existing tests | New cases |
| --- | --- | --- | --- | --- |
| UI | Sidebar has Insights, Catalog, Run history, Scheduler | Covered | TC-23 | — |
| UI | Legacy `/graph/advisors*`, `/graph/pmm-database-checks*` redirect | Covered | TC-24 | — |
| UI | Grafana Advisor panel (`pmm-check-panel`) removed: Home's "Failed advisors" and Environments Overview | Partial | PMM-T1946 `@image-renderer` no longer renders "Failed advisors" (U-07) | — |
| UI | Filters in the URL; saved per page in localStorage, restored from the sidebar | Covered | TC-03, TC-20, TC-22 (Run history trigger filter and page size), TC-37, TC-47 | — |
| UI | Details panes open maximized; `?details=`, `?insight=` deep links; double-click on every table | Covered | TC-03, TC-19, TC-38 (`?insight=` opens maximized), TC-52 (every table, Scheduler `?details=`) | — |
| Insights | Persisted fields: severity, outcome, topology, labels | Covered | TC-19, TC-36 (outcome), TC-38 (severity, service, description), TC-58 (topology, labels) | — |
| Insights | Status chips Failed, Error, OK, Pending, Not run | Covered | TC-36 (OK, Failed, Error), TC-64 (Pending, Not run) | — |
| Insights | Filter bar from `insights:filterValues`; Filter by name | Covered | TC-20, TC-37 | — |
| Insights | Copy as text; Copy URL keeping filters | Covered | TC-38 | — |
| Insights | Re-run or disable a check for one service | Covered | TC-39, TC-40 | — |
| Insights | Icon on insights with documentation | Covered | TC-57 | — |
| Insights | Email insights: up to 200 insights, 20 addresses, SMTP needed | Partial | TC-41 (limits, delivery with filters and status counts; the error without SMTP is no longer reachable, see below) | — |
| Insights | Read state removed | Partial | TC-20 (Email insights replaces the bulk read button) | — |
| Insights | Retention 30 days; hourly cleaner on the HA leader | Gap | — | NC-28 |
| Runs | Counts stored on the run, kept after insights expire | Partial | TC-21, TC-22 | NC-28 |
| Runs | States queued, running, completed, interrupted, aborted; open runs closed at startup | Partial | TC-21, TC-22, TC-43 (running, completed), TC-64 (queued, interrupted, closed at startup); aborted needs a run whose planning fails | — |
| Runs | One active run; a user request fails with FAILED_PRECONDITION naming the active run | Covered | TC-35 | — |
| Runs | Plan saved first; pending insights; not run; unreachable service becomes an error insight | Covered | TC-55 (unreachable service), TC-64 (pending, then not run) | — |
| Runs | Live covered/planned counts | Partial | TC-21, TC-43 (the row reaches its final count without Refresh) | — |
| Runs | Empty scheduled runs deleted; user runs kept | Covered | TC-42 (a user run with nothing to check is kept), TC-63 (an empty scheduled run is not recorded) | — |
| Runs | Schedule columns, Triggered by name, Schedule filter, "Deleted schedule", late-start icon | Covered | TC-34 (user run of a schedule, Schedule filter, Deleted schedule), TC-61 (a scheduled run shows the schedule name), TC-62 (late-start icon and tooltip) | — |
| Runs | Run again, CSV export, Run ID filter, auto-polling | Covered | TC-22, TC-42, TC-43 | — |
| Scheduler | Schedules replace intervals everywhere | Dropped | — | — |
| Scheduler | Schedule fields and validation (name ≤100, unique ignoring case, days, UTC time, scope, email) | Covered | TC-29, TC-30 | — |
| Scheduler | Default "All checks daily" at 06:00 UTC, recreated when Advisors are turned on | Covered | TC-28, TC-54, TC-73 (other schedules kept) | — |
| Scheduler | No runs at startup, on leader change or on enable; missed runs skipped | Partial | TC-65 (startup, enable, missed occurrence), TC-72 (leader change; not yet run) | — |
| Scheduler | Due schedules wait and run one after another | Covered | TC-62 | — |
| Scheduler | Scope resolved at run time; missing picks flagged | Covered | TC-55 (a service added later joins the next run) | — |
| Scheduler | Week view, table, details pane, row actions, banners | Partial | TC-28, TC-29, TC-31 to TC-35, TC-52, TC-54, TC-61, TC-63 (table and its Last run link, week markers, every row action, details pane, every banner; not clicking a marker) | — |
| Scheduler | Editor: next-runs preview, pickers, coverage table, test email | Covered | TC-29 (preview, pickers), TC-49 (test email), TC-56 (local time, coverage warnings) | — |
| Scheduler | Run now unavailable while a run is active | Covered | TC-35 | — |
| Scheduler | Admins and Editors manage; Viewers cannot open; Editor endpoints for services and email defaults | Covered | TC-26, TC-27, TC-28 to TC-35 (Editor through the API) | — |
| Custom checks | Create, edit, delete | Covered | TC-04, TC-07, TC-08 | — |
| Custom checks | Built-ins read-only; clone | Covered | TC-09, TC-16 | — |
| Custom checks | Form: script editor, parameters, category autocomplete, name validation | Covered | TC-05, TC-10, TC-11 | — |
| Custom checks | Renaming rejected (name from the path only) | Covered | TC-08 (field locked in the UI, name in the body ignored) | — |
| Custom checks | Test from form or details pane; `testTargets` explains exclusions | Covered | TC-14 (form), TC-51 (details pane, targets) | — |
| Custom checks | Authoring and testing are Admin-only: an Editor gets `403` and no Add, Edit, Delete, Clone or Test controls | Covered | TC-27 | — |
| Custom checks | Disable per service; badge | Covered | TC-17, TC-18 | — |
| Custom checks | Global disable | Covered | TC-06 | — |
| Custom checks | Old disabled list not migrated: all checks enabled after upgrade | Written | TC-69 | — |
| Catalog | Flat list sorted by name; `GET /v1/advisors` removed | Partial | TC-01 (every check listed; the order and the removed endpoint are not asserted) | — |
| Catalog | 10 risk categories (Security 27 … Logging 6) | Covered | TC-44 (the ten names; counts compared with the API rather than pinned) | — |
| Catalog | "technology" naming | Covered | TC-02, TC-11 | — |
| Catalog | Four severities; a retired severity fails clearly; notice becomes warning | Partial | TC-46 (notice and emergency fail, info passes) | — |
| Catalog | No Interval column, filter or inline select | Dropped | — | — |
| Built-ins | Starlark error shown; timeouts reported separately | Partial | TC-14 (error; a runaway script is stopped, but by the CPU limit, see finding 5) | — |
| Built-ins | Crash fixes: MySQL 5.7, MongoDB standalone and 8.2, empty metrics | Covered | TC-66 (leaves out the checks of findings 6 and 7) | — |
| Built-ins | 13 checks emit one finding per service or database | Partial | TC-67 (`postgresql_unused_index_check`, one of the 10 PostgreSQL checks that share the 10-name cap) | — |
| Built-ins | Read-more links point to each check's own page | Covered | TC-57 (form, one page per check, and no page answers 404) | — |
| Email | Completed runs emailed through GF_SMTP | Covered | TC-50, TC-61 (a schedule that falls due), TC-62 | — |
| Email | Settings defaults: toggle, severities, ≤20 recipients, enable without recipients rejected | Covered | TC-25, TC-48 | — |
| Email | Per-schedule recipients and severities | Covered | TC-50 (own recipients and severities), TC-59 (Settings, own, none, deleted during the run) | — |
| Email | Test email: Editor-level, needs a severity, `[Test]` subject, FAILED_PRECONDITION without SMTP | Partial | TC-27, TC-49 (Editor and Admin, needs a severity, `[Test]` subject, unsaved values delivered; not the error without SMTP) | — |
| Settings | Advisors tab: switch, retention, notifications, severities, recipients, Scheduler link, test email | Covered | TC-25 | — |
| Settings | Stored under `advisors`; old `sass` object dropped (migration 129) | Written | TC-69 (the switch and retention after an upgrade; the `sass` object is not asserted) | — |
| API | Removed: `failedServices`, `checks/failed`, `GET /v1/advisors` | Dropped | — | — |
| API | Added: runs, insights, check CRUD, test, testTargets | Covered | TC-01 to TC-22 | — |
| API | Added: schedules, `insights:email`, `services`, `notificationSettings` | Covered | TC-27 to TC-35, TC-41 | — |
| API | Interval fields from older clients are ignored | Dropped | — | — |
| Upgrade | Migrations 126–129 on upgrade from 3.10 | Written | TC-69 | — |
| HA | One active run across nodes; cleaner and scheduler on the leader | Written | TC-70 to TC-72 (not the cleaner) | — |
| Other | PMM UI sessions survive past one hour | Gap | — | NC-54 |
| Other | Rejected logins cached | Gap | — | NC-55 |
| Other | Home "Connected Agents" counts only connected agents | Dropped | — | — |

The RPM directory ownership change belongs to `package_tests` and is not listed. The removed `PMM_ADVISORS_CHECKS_DISABLE_START_DELAY` variable has nothing to test from the UI.

## Existing tests to update

Applied on 27 Oct 2026: all 27 tests pass on build `ede5df3c7` with a monitored Percona Server 8.4 service.

Seven tests assert behaviour the branch removed. Six of them fail on the current build; TC-19 failed earlier for lack of a MySQL service and will fail at its mark-as-read step once one exists. TC-14, TC-17 and TC-21 failed locally only because the local PMM has no MySQL service; CI provisions `ps=8.4`.

| ID | Test | What changed | Update |
| --- | --- | --- | --- |
| U-01 | TC-04 Creating a custom check | The form has no Interval field | Drop `interval` from the form fill and from the API expectation; assert the form has no Interval field |
| U-02 | TC-06 Disabling a check and changing its interval | The Catalog has no Interval column or select | Remove the interval step; rename to "Verify disabling and enabling a check from the catalog" |
| U-03 | TC-08 Editing a custom check | No interval to edit | Edit the summary and category instead |
| U-04 | TC-19 step 5 and TC-20 | Read state, its filter and **Mark filtered as read** removed | Drop the mark-as-read step; replace the isRead filter and bulk button with the **Email insights** button |
| U-05 | TC-25 Advisors settings tab | Interval inputs removed; notifications, severities, recipients, Scheduler link and test email added | Assert the new controls |
| U-06 | TC-27 step 6 | Test email is Editor-level | Expect an Editor's request without severities to fail validation (400), not 401/403 |
| U-07 | PMM-T1946 `tests/dashboards/image-renderer/imageRenderer.test.ts` (`@image-renderer`, run by the `@inventory\|@image-renderer` matrix job) | The branch removes Home's "Failed advisors" panel (`pmm-check-panel`, still on `main`) | Applied: the test renders a text panel on a dashboard it creates, which looks the same on every build, both baselines are re-recorded, and `HomeDashboard.metrics()` lists *Monitored DB Services* instead |

Page-object and helper code to remove with these: the `interval` catalog filter, `changeInterval`, `intervalSelect`, `messages.intervalChanged`, the form's interval input, the settings interval inputs, the insights read-state builders, and the `interval` field the API helper still sends.

## New test cases

Priority: **P1** automate before 3.11.0 · **P2** automate when its setup exists · **P3** manual or long-running. Unless noted, run as admin with one monitored MySQL service, using the QA custom check from the earlier doc.

### Automated so far

| New case | Test | Differs from the case |
| --- | --- | --- |
| NC-01 | TC-28 | — |
| NC-02 | TC-29 | — |
| NC-03 | TC-30 | The time input cannot hold `25:00`, so an empty time stands in for an invalid one. |
| NC-04 | TC-31 | CI monitors one MySQL service, so the edit switches All services to that service instead of adding a second one. |
| NC-05 | TC-32 | — |
| NC-06 | TC-33 | — |
| NC-07 | TC-34 | Only the dialog text for a schedule that is not the last; the last-schedule text needs every schedule deleted (NC-12). |
| NC-08 | TC-34 | Coverage is checked on the run through the API (1 planned check, 1 planned service), not in the Run history column. |
| NC-09 | TC-35 | — |
| NC-10 | TC-34 | — |
| NC-20 | TC-23, TC-26, TC-27 | The Editor creates and runs a schedule through the API, not the editor drawer. |
| NC-29 | TC-35 | The error is checked from `checks:start`, `schedules/{id}:run` and **Run all** in the Catalog. |
| NC-21 | TC-36, TC-64 | TC-36 shows OK, Failed and Error; TC-64 shows Pending and Not run on a run it interrupts. |
| NC-22 | TC-37 | The filters are combined one by one rather than also tried alone; restoring is checked on Insights only. |
| NC-23 | TC-38 | — |
| NC-24 | TC-39 | The planned service count is read from the run through the API. |
| NC-25 | TC-40 | — |
| NC-27 | TC-41 | Over 200 insights comes from one check returning 201 findings. The error without SMTP is not checked: PMM Server always has mailpit (see SMTP below). |
| NC-32 | TC-42 | The run without insights is a MongoDB check with no MongoDB service, so it is also the export case for Export failed. |
| NC-33 | TC-43 | Auto-polling is seen as the in-progress spinner giving way to the final count; the counts in between are not checked. |
| NC-36 | TC-44 | Counts are compared with the API rather than pinned to Security 27 … Logging 6, so new built-ins don't break the test; three categories are filtered, not all ten. |
| NC-38 | TC-46 | Only the form's **Test**; *notice becomes warning* for built-ins is not checked. |
| NC-39 | TC-47 | **View results** is not asserted: the build drops notification actions (finding 1 below). |
| NC-46 | TC-48 | Enabling without recipients is blocked by a disabled **Apply changes** rather than a message (finding 3 below); duplicates are merged only when they match exactly (finding 4). |
| NC-47 | TC-27, TC-49 | The FAILED_PRECONDITION without SMTP is not checked: PMM Server always has mailpit (see SMTP below). |
| NC-48 | TC-50, TC-61 | TC-61 lets a schedule fall due. TC-50 starts one with Run now, so its email reads *triggered manually … from the schedule*. |
| NC-18 | TC-62 | Both schedules fall due during a user run, so one test covers the wait and the start order by name. |
| NC-34 | TC-34, TC-61, TC-62 | TC-61 shows a scheduled run's Triggered by and TC-62 the late-start icon; TC-34 covers the Schedule filter and *Deleted schedule*. |
| NC-35 | TC-42, TC-63 | A second schedule due in the same minute starts after the empty one, so by the time its run completes, the empty one has run and been dropped. |
| NC-30 | TC-64 | Running shows no tooltip in this build, and the live counts are TC-43's (NC-33). The run is started from a disabled schedule, so its recipient shows that only the next, completed run is emailed. |
| NC-19 | TC-65 | pmm-managed is stopped rather than PMM Server, and Advisors are turned off and on through the settings API within its first minute. A control schedule due a minute after the missed one shows when the loop has run. |
| NC-11 | TC-55 | The removed services are two MySQL services the test adds, not the one CI monitors. The Catalog-disabled check is checked on the run's plan (1 check). A third service added before a rerun shows the scope is resolved when the schedule runs. |
| NC-12 | TC-54 | — |
| NC-13 | TC-54 | Advisors are turned off and on through the settings API, not the Settings page. |
| NC-14 | TC-28, TC-35 | The run banner is accepted as queued or running, whichever the page shows. The email-off banner is checked in TC-28. |
| NC-15 | TC-56 | `Asia/Tokyo` instead of `Pacific/Auckland`: Japan has no daylight saving time, so the local time is fixed. |
| NC-16 | TC-52 | A Run history row opens the run's insights rather than a pane. |
| NC-17 | TC-56 | Both warnings: a check with no service of its technology, and checks that match none of the selected services. |
| NC-26 | TC-57 | — |
| NC-31 | TC-55, TC-64 | TC-55 has the unreachable service; TC-64 the Pending insights of a running run and the Not run ones once it is interrupted. |
| NC-40 | TC-08 | The API returns 200 and keeps the name, rather than rejecting the request. |
| NC-41 | TC-51 | `testTargets` lists only eligible services, without reasons. The reason comes from `checks:test` on an ineligible one. |
| NC-42 | TC-14 | Only *check script execution* is asserted: the message says *signal: killed*, not *timed out* (finding 5). |
| NC-43 | TC-66 | The test starts `mysql:5.7` and `mongo:8.2` itself and has PMM Server's own agent monitor them as remote services. It runs every built-in MySQL and MongoDB check but the two of findings 6 and 7 on those two services only, rather than **Run all**, and reads the errors from the run's insights. |
| NC-44 | TC-67 | PostgreSQL rather than MySQL: `mysql_tables_without_pk` still reports one finding per table. The 13 checks are the 10 PostgreSQL ones that share a 10-name cap, plus `mongodb_balancer`, `mongodb_shard_collection_inconsistent_indexes` and `mongodb_xfs_ftype`. Two databases show the split per database. |
| NC-45 | TC-57 | Each link is checked for its form and one page per check, and fetched from docs.percona.com to show it is not a 404. |
| NC-49 | TC-59 | Settings recipients, own recipients, no email, and a schedule deleted during its run. Own severities are in TC-50. |
| NC-51 | TC-54 | **Run selected** is not tried; starting checks is refused through the API. |
| NC-52 | TC-69 | Only the after-upgrade half is new: the `@pre-upgrade` tests of the `pmm-3.6.0` to `pmm-3.10.0` branches already disable `mongodb_version` and set an interval. The bookmark is opened as a URL. |
| NC-53 | TC-70, TC-71, TC-72 | A follower is reached with `curl` inside its pod. The refusal comes from the leader while the follower's run is still queued. |
| — | TC-58 | Topology and labels of an insight, from the *Persisted fields* row. |
| — | TC-73 | Added in review: a user schedule survives turning Advisors off and on. |

### Scheduler

| ID | Pri | Case | Steps | Expected |
| --- | --- | --- | --- | --- |
| NC-01 | P1 | Default schedule on a fresh server | 1. Open Advisors → Scheduler.<br>2. Read `GET /v1/advisors/schedules`. | One enabled schedule "All checks daily": every day at 06:00 UTC, All checks, All services, Settings recipients. |
| NC-02 | P1 | Create a schedule | 1. Click **New schedule**.<br>2. Name it, pick Mon–Fri, 10:00, Selected checks (the QA check), Selected services (one MySQL service).<br>3. Click **Create schedule**. | `Created "<name>". Next run: …`; the row shows When, 1 check, 1 service, Next run; a marker appears in "This week, UTC". |
| NC-03 | P1 | Schedule editor validation | Save with each invalid input: empty name; an existing name in different case; 101-character name; no day; time `25:00`; Selected checks with none picked; Selected services with none picked; own recipients empty, invalid or 21 addresses; Only these with no severity. | Each shows its message ("Give the schedule a name.", "A schedule named … already exists.", "Pick at least one day.", "Enter a time as HH:MM.", …) and nothing is saved. |
| NC-04 | P1 | Edit a schedule | 1. Edit the NC-02 schedule: change the time and add a service.<br>2. Save. | `Saved "<name>".`; the table and Next run reflect the change; the API returns the full new definition. |
| NC-05 | P1 | Pause and enable | 1. Turn the row's Enabled switch off.<br>2. Turn it on. | `Paused "<name>"…`, Next run reads "Paused" and the week view drops it; enabling shows `Enabled "<name>". Next run: …`. |
| NC-06 | P1 | Duplicate starts paused | **Duplicate** a schedule. | `Duplicated as "<copy>"…`; the copy is paused and has the same scope and email. |
| NC-07 | P1 | Delete keeps run history | 1. Run the schedule once (**Run now**).<br>2. **Delete** it and confirm. | Dialog text differs for the last schedule; `Deleted "<name>".`; Run history still shows the run under the old name and the Schedule filter lists "Deleted schedule". |
| NC-08 | P1 | Run now uses the schedule scope | **Run now** on a schedule that picks one check and one service. | `Started "<name>"…`; Run history shows one run, Triggered by naming the schedule, coverage 1/1 checks and 1/1 services. |
| NC-09 | P1 | Run now while a run is active | 1. Start a run.<br>2. While it is queued or running, try **Run now** and `POST /v1/advisors/schedules/{id}:run`. | Run now is unavailable in the UI; the API returns FAILED_PRECONDITION. |
| NC-10 | P1 | View runs | **View runs** on a schedule with runs. | Run history opens filtered by that schedule. |
| NC-11 | P2 | Scope resolved at run time | 1. Schedule two picked services and a picked custom check.<br>2. Remove one service from Inventory, then the other; delete the check.<br>3. Disable a picked check in the Catalog and run. | Services cell reads "1 of 2 services", then "Targets no existing service"; "Targets no existing check"; the Catalog-disabled check is not in the run. |
| NC-12 | P2 | Restore the default from the empty page | Delete every schedule, then click **Create the default schedule**. | The empty state "No schedules" shows; the default schedule is recreated as in NC-01. Restore the original schedules afterwards. |
| NC-13 | P2 | Advisors off and on | 1. Turn Advisors off in Settings.<br>2. Open the Scheduler.<br>3. With no schedules left, turn Advisors on. | Schedules are kept, the "Advisors are turned off" banner shows and Next run reads "Advisors are off"; turning on recreates the default only when none exist. |
| NC-14 | P2 | In-progress banner | Open the Scheduler while a run is queued, then while it runs. | Banner "An Advisor run is queued…", then "…is running: x of y checks done…", with **Open in Run history**. |
| NC-15 | P2 | Times in UTC and local time | Open the editor in a browser context with `timezoneId` set to, e.g., `Pacific/Auckland`; set 23:00 UTC. | Preview lists next runs in UTC and local time and notes the run lands on another local day. |
| NC-16 | P2 | Schedule details pane | Double-click a schedule row; also open `/pmm-ui/advisors/scheduler?details=<id>`. | The pane shows When, Checks, Services, Email, Next runs, "What each run covers" and Recent runs; the deep link opens the same pane. |
| NC-17 | P2 | Coverage warnings | Pick only PostgreSQL checks and only MySQL services. | The coverage table warns that none of the selected checks applies to the selected services. |
| NC-18 | P3 | Due schedules wait | Create two schedules due at the same minute, and one due while a run is active. | They run one after another (by time, then name), each as its own run; the delayed run shows the late-start icon and tooltip. |
| NC-19 | P3 | No hidden runs | Restart pmm-managed; turn Advisors on; stop PMM Server across a due time and start it again. | No run starts at startup or on enable; the missed occurrence is skipped, not caught up. |
| NC-20 | P1 | Scheduler permissions | Repeat as Editor and as Viewer: open the Scheduler; create, edit, run a schedule; call `GET /v1/advisors/services` and `GET /v1/advisors/notificationSettings`. | Editor can do all of it and the endpoints return 200; Viewer gets no Scheduler menu item, the unauthorized page, and 401/403 from the API. |

### Insights

| ID | Pri | Case | Steps | Expected |
| --- | --- | --- | --- | --- |
| NC-21 | P1 | Status chips | Run three custom checks: one returning no findings, one returning a warning, one calling `fail()`. | The run's insights show OK, Failed and Error chips with their labels; the Status filter narrows to each. |
| NC-22 | P1 | Filters and Filter by name | 1. Filter by Service, Node, Category, Severity and Status, alone and combined.<br>2. Use **Filter by name** on a row.<br>3. Leave the page and return through the sidebar. | Rows match the filters; options come from `insights:filterValues`; the URL carries the filters; they are restored on return. |
| NC-23 | P1 | Copy as text, Copy URL, `?insight=` | 1. **Copy as text** on an insight.<br>2. With filters set, **Copy URL** and open it in a new page. | Clipboard text carries summary, service, severity, status and description; the URL restores the filters and opens that insight's details pane maximized. |
| NC-24 | P1 | Re-run for one service | **Re-run now** on an insight. | A run starts for that check on that service only; its run shows 1 service planned. |
| NC-25 | P1 | Disable for one service from Insights | **Disable check for service** on an insight, then enable it again. | The check's disabled services include that service (Catalog badge 1); the action flips to enable and back. |
| NC-26 | P2 | Documentation icon | Run a built-in check that fails on the service. | Its insight shows the documentation icon; **Read more** in the pane opens that check's documentation page. |
| NC-27 | P1 | Email insights dialog | 1. Click **Email insights** with no filters, then with filters.<br>2. Enter 21 addresses, then an invalid one.<br>3. Match more than 200 insights.<br>4. Send without SMTP configured. | Text reads "No filters are set…" or "Email n insights matching…"; address errors block Send; over 200 shows "Narrow the filters…" with Send disabled; without SMTP the error names the missing setting. With an SMTP sink (P2): the email lists the filters, counts per status and every insight; Settings recipients are unchanged; works with notifications off. |
| NC-28 | P3 | Retention cleanup | Set retention to 1 day, age insights past it (DB time shift or wait), wait for the hourly cleaner. | Expired insights are gone; their runs keep their counts in Run history. |

### Run history

| ID | Pri | Case | Steps | Expected |
| --- | --- | --- | --- | --- |
| NC-29 | P1 | One active run | Call `checks:start` twice back to back. | The second call returns FAILED_PRECONDITION naming who started the active run and when; the UI shows the same error from **Run all**. |
| NC-30 | P2 | Run states | Observe a run queued, running and completed; restart pmm-managed during a long run. | Queued and Running show with their tooltips and live counts; after restart the run is Interrupted and its saved insights stay. |
| NC-31 | P2 | Plan first, unreachable services | 1. Start a run and open Insights for it while it runs.<br>2. Add a MySQL service whose DB is stopped and run. | Pending insights exist for each check and service, then update; an unreachable service gets an Error insight instead of being skipped. |
| NC-32 | P1 | CSV export | **Export all** and **Export failed** on a run with findings; then on a run without any. | CSVs download with one row per insight (failed only for the second); a run without insights shows "This run has no insights to export". |
| NC-33 | P1 | Run again, Copy run ID, auto-polling | 1. **Run again** on a run.<br>2. **Copy run ID**.<br>3. Watch a new run without clicking Refresh. | A new run with the same checks; clipboard holds the ID; the row updates to Completed on its own. |
| NC-34 | P2 | Schedule column and filter | Run a schedule and start a user run; filter by Schedule; delete the schedule. | Triggered by shows the schedule name or `User · <name>`; the filter narrows to the schedule; deleted schedules show "Deleted schedule". |
| NC-35 | P2 | Empty runs | 1. Start a user run of a check whose technology has no services.<br>2. Let a schedule whose services were all removed fall due. | The user run stays with 0/0 and the "nothing to check" tooltip; the empty scheduled run is not recorded. |

### Catalog and custom checks

| ID | Pri | Case | Steps | Expected |
| --- | --- | --- | --- | --- |
| NC-36 | P1 | No intervals; 10 categories | Open the Catalog; open the Category filter; filter by each category. | No Interval column, filter or select; categories Security 27, Durability 12, Replication 11, Versions 11, Performance 11, Resources 11, Maintenance 7, Schema & indexes 7, Connections 6, Logging 6 (built-ins only). |
| NC-37 | P1 | Check list API and removed endpoints | `GET /v1/advisors/checks`; `GET /v1/advisors`, `/v1/advisors/failedServices`, `/v1/advisors/checks/failed`. | Flat list sorted by name with no interval field; the three removed endpoints return 404. |
| NC-38 | P1 | Severities | In the form, **Test** scripts returning `notice`, `emergency`, then `info`. | Retired severities fail with a clear error; `info` succeeds. |
| NC-39 | P1 | Run all and Run selected | 1. Without filters, **Run selected** is unavailable.<br>2. Filter by a category; **Run selected**.<br>3. **Run all**. | The selected run lists only the enabled checks of that category; Run all lists every enabled check; both notifications offer **View results**. |
| NC-40 | P2 | Rename rejected | `PUT /v1/advisors/checks/<name>` with a different name in the body. | The check keeps its name; no second check appears. |
| NC-41 | P2 | Test from details; test targets | 1. **Test** from a custom check's details pane.<br>2. Open the service list for a PostgreSQL check. | Results show as in the form; `pmm-server-postgresql` is not offered, and ineligible services carry their reason. |
| NC-42 | P2 | Timeouts | **Test** a script that loops forever. | The result reports a timeout, distinct from a script error. Today it reads *check script execution failed: signal: killed* (finding 5). |

### Built-in checks (regression)

| ID | Pri | Case | Steps | Expected |
| --- | --- | --- | --- | --- |
| NC-43 | P2 | Built-ins on older and edge databases | With pmm-framework, add MySQL 5.7, a standalone MongoDB and MongoDB 8.2; **Run all**. | Errors column is 0 for these services; no "exit status 1". |
| NC-44 | P3 | One finding per service | Create several tables without a primary key on one MySQL service; run the matching check. | One finding for the service, count in the summary, at most 10 table names in the description. |
| NC-45 | P2 | Read-more links | For every built-in check with a finding, request its `read_more_url`. | Each returns 200 and points to that check's own page. |

### Email and settings

| ID | Pri | Case | Steps | Expected |
| --- | --- | --- | --- | --- |
| NC-46 | P1 | Notification settings validation | In Settings → Advisors: enable notifications with no recipients; enter 21, duplicate, comma- and space-separated, and invalid addresses; clear the list. | Enabling without recipients is rejected; >20 and invalid rejected; duplicates merged; both separators accepted; empty list clears; default severities are critical and error. |
| NC-47 | P1 | Test email | As Editor and Admin: send with no severity; send without SMTP configured; with an SMTP sink (P2), send from Settings and from the schedule editor with unsaved changes. | No severity → validation error; no SMTP → FAILED_PRECONDITION naming the missing GF_SMTP variable; with SMTP the subject starts `[Test]` and uses the unsaved recipients and severities. |
| NC-48 | P2 | Run report email | With an SMTP sink, complete a scheduled run and a user run. | One email per completed run; the scheduled one names the schedule in the subject; counts by severity and technology include zeros; only default severities are listed for user runs. |
| NC-49 | P3 | Per-schedule email | Schedules with own recipients, with no email, and with own severities; delete one mid-run. | Each run emails as its schedule says; the deleted schedule's run falls back to the defaults. |
| NC-50 | P2 | Settings API fields | `GET /v1/server/settings`; `PUT` with an `advisor_run_intervals` object. | Retention, notification toggle, severities and recipients are returned; no interval or `sass` fields; the old field is ignored, not rejected. |
| NC-51 | P2 | Advisors turned off | Turn Advisors off; open the sidebar and `checks:start`. | The Advisors menu disappears and starting checks fails; turning back on restores both. |

### Upgrade, HA and other changes

| ID | Pri | Case | Steps | Expected |
| --- | --- | --- | --- | --- |
| NC-52 | P1 | Upgrade from 3.10 | Pre-upgrade: disable a built-in check, change intervals, keep a bookmark of `/graph/advisors`. Upgrade to 3.11. | The default schedule exists; every check is enabled (documented breaking change); no interval settings remain; the bookmark redirects; Settings → Advisors shows retention 30. |
| NC-53 | P2 | HA | On a 3-node cluster: start a run on one node and request another on a second; change a schedule on a follower; fail over the leader during a run. | Second request returns FAILED_PRECONDITION; the leader picks up the change within a minute; failover starts no new run and the open run is closed as Interrupted. |
| NC-54 | P2 | Session survives one hour | Stay idle in the PMM UI for more than an hour, then open Advisors. | No 403 and no logout; the session cookie is rotated. |
| NC-55 | P3 | Rejected logins cached | Repeat a wrong-password API request. | Consistent 401s served from cache; internal errors are not cached. |
| NC-56 | P2 | Connected Agents panel | Stop one pmm-agent; open the Home dashboard. | Connected Agents drops by one. |
| NC-57 | P2 | Advisor panel removed | Open Home and Environments Overview; check the plugin list. | No "Failed advisors" or other `pmm-check-panel` panel, and no `pmm-check-panel` plugin. |

## Plan

Done so far: U-01 to U-07, every P1 case, the SMTP sink, and Phases 0 to 4. TC-69 to TC-72 are written but have not run yet.

pmm's own `api-tests/server/advisor*_test.go` already cover the API side of most of the feature:

- schedules: CRUD, validation and limits, names unique ignoring case, email modes, Editor and Viewer access, Run now during an active run, runs filtered by schedule, deleted-schedule names, the default schedule re-created when Advisors are turned on
- the `services` and `notificationSettings` endpoints
- checks: CRUD, test, disabling per service
- runs, insights, Email insights, test-email errors without SMTP, and the check metrics by category

So the tests below check the UI and how the parts work together, rather than repeat those API tests.

### Phases 0 and 1 (done)

- **Phase 0:** U-07 is fixed, and the unused `advisor_run_intervals` type in `e2e_tests/api/settings.api.ts` and the `checkIntervals` case in `codeceptjs-e2e/tests/pages/api/settingsAPI.js` are gone.
- **Phase 1:** TC-51 to TC-60 and additions to TC-08, TC-14, TC-22, TC-28 and TC-35. *Automated so far* lists how each differs from its case.
- **Moved to Phase 4:** NC-44 (one finding per database). `mysql_tables_without_pk`, the only table-level check that Percona Server 8.4 triggers, still reports one finding per table. It is not one of the 13 changed checks, and which ones those are needs the developers or the branch history.

When a test needs a long run, it uses custom checks whose script loops until the CPU limit stops it (`AdvisorsApi.endlessCheckScript`). The checks of a run execute one after another, about 4 s each, so 16 such checks make a run of about a minute. To make a service unreachable, a test adds one with `ManagementApi.addUnreachableMysql`.

### Phase 2: schedules that fall due (done)

TC-61 to TC-63 in `scheduling.test.ts`, tagged `@advisor-scheduling` and run by the matrix job of that name. The tag drops the *s* of the planned `@advisors-scheduling`: the runner passes the tag to `--grep`, which matches substrings, so the `@advisors` job would have run these tests too.

Each test creates schedules due at the first whole UTC minute at least 20 s away and waits for them. TC-62 keeps a user run going with 25 to 40 slow checks, enough to end at least 80 s after its schedules fall due, since a scheduled run counts as late only after a minute. pmm-managed wakes at the exact due time, so a schedule on time starts within a second of it.

| Test | Cases | Covers |
| --- | --- | --- |
| TC-61 A schedule falls due | NC-48 (scheduled run), NC-34 | `scheduled_for`, no `waited_for_run`, the email naming the schedule, the Scheduler's Last run link, and Triggered by showing the schedule name |
| TC-62 Due schedules wait for the active run | NC-18, NC-34 | Two schedules start after the user run, one after the other by name, each with its own email; `waited_for_run` and the late-start icon and tooltip on both |
| TC-63 An empty scheduled run is dropped | NC-35 | A schedule whose only service was removed falls due with a control schedule and records no run |

### Phase 3: restarting pmm-managed (done)

TC-64 and TC-65, in a second describe of `scheduling.test.ts` after the Phase 2 tests, also tagged `@advisor-scheduling`. They stop or restart pmm-managed with `docker exec pmm-server supervisorctl … pmm-managed`, as `ruleTemplates.test.ts` already runs `docker exec pmm-server`. `readyz` answers within a second of a restart, but pmm-managed starts no run for a minute: a run requested then stays Queued, and a run left running is closed as Interrupted as soon as it starts. A queued run survives a restart, so a test that fails with its run queued would leave it to start during the next one; the file's `afterEach` therefore waits until no run is queued or running before it deletes the checks.

| Test | Cases | Covers |
| --- | --- | --- |
| TC-64 A restart interrupts a run | NC-30, NC-31 (Pending, Not run), NC-21 | Queued with its tooltip, then Running and Pending insights; after a second restart the run is Interrupted with its tooltip, keeps the findings of the check it ran first, marks the rest Not run with their outcome, and is not emailed |
| TC-65 No hidden runs | NC-19 | With pmm-managed stopped through a due minute and Advisors turned off and on after the start, the only new run is a control schedule's; the missed occurrence is skipped until tomorrow |

### Phase 4: other jobs (done)

| Test | Where | Cases | Covers |
| --- | --- | --- | --- |
| TC-66 Every check completes on older databases | `databases.test.ts`, `@advisor-databases`, a new amd64-only matrix job | NC-43 | MySQL 5.7 and a standalone MongoDB 8.2 that the test starts itself: no check errors. It leaves out the two checks of findings 6 and 7 until they are fixed. |
| TC-67 One finding per database | `databases.test.ts`, `@advisor-databases` | NC-44 | PostgreSQL 17 with 12 and 2 unused indexes in two databases: one finding each, a `count` label, 10 names and *and 2 more* |
| TC-69 Advisors after an upgrade | `tests/upgrade/advisorsUpgrade.test.ts`, `@post-upgrade` | NC-52 | Every check enabled again, the default schedule, a 30-day history, the old URL redirecting |
| TC-70 to TC-72 Advisors in HA | `tests/ha/advisorRuns.test.ts`, `@pmm-ha` | NC-53 | A run queued on a follower and started by the leader, one run at a time, a schedule created on a follower, and a failover interrupting the open run without starting another |

The `@advisor-databases` tests start their databases with `docker run` because pmm-framework sets up neither a standalone MongoDB nor MongoDB 8.2. The job is amd64-only because `mysql:5.7` has no arm64 image. Its tag drops the *s* for the same `--grep` reason as `@advisor-scheduling`.

The upgrade workflows run `@pre-upgrade` from the `pmm-<from-version>` branch, so a pre-upgrade test added to `main` would run only on the RC leg. The `@pre-upgrade` tests of `pmm-3.6.0` to `pmm-3.10.0` already disable `mongodb_version` and set *Check for unsupported PostgreSQL* to Frequent. `main` had dropped only their `@post-upgrade` halves, which expected the old behaviour, so TC-69 is the only new upgrade test.

TC-67 passed on the local build, and TC-66 failed on findings 6 and 7 only. TC-69 has not run: Docker Desktop ran out of disk while pulling `pmm-server:3.10.0`. TC-70 to TC-72 need an HA cluster running the feature build.

### Review changes (2 Nov 2026)

- Dropped: TC-45 (check list API and removed endpoints), TC-53 (Grafana Advisor panel removed), TC-60 (Advisor fields of the settings API) and TC-68 (Connected Agents), and every assertion that interval controls or fields are gone.
- Added: TC-73 (user schedules survive Advisors off and on), a step in TC-55 where a new service joins the next run, and a 404 check of the read-more pages in TC-57.
- Locators the tests built inline now live in the page and component objects, and the scheduler tests wait for the active run in `afterEach` instead of a try/finally.

### Manual or left to pmm's tests

- NC-28 retention: the cleaner runs hourly on the leader and only removes insights older than the retention period. Check it manually after shifting the stored times in the database, or confirm that pmm has a Go test for it.
- NC-54 (session past one hour) and NC-55 (rejected-login cache): manual, or pmm unit tests.
- The errors without SMTP for Email insights and the test email: pmm's API tests run without SMTP and assert *SMTP is not configured in PMM Server: GF_SMTP_ENABLED is not set.*
- Bundled checks whose findings change from notice to warning: manual, since it needs a built-in that used to report notice.

### Where this leaves coverage

- **After Phase 4 and the review:** 3 scope items are not covered (retention, sessions and rejected logins) and 5 are dropped on purpose. 4 more have tests that have not run yet: the upgrade and settings rows and HA. The run-states row still lacks Aborted.
- **Manual:** retention, sessions and rejected logins.
- **Housekeeping:** replace the `PMM-Txxxx` placeholders with Zephyr keys once the zephyr-bot connector works again, and report findings 1 to 5 on PMM-14109.

## SMTP

`e2e_tests/docker-compose.yml` starts a `mailpit` container with PMM Server and points PMM Server at it (`GF_SMTP_ENABLED=true`, `GF_SMTP_HOST=mailpit:1025`), so every Playwright job, the `@advisors` one included, can read the email PMM sends through `MAILPIT_URL` (default `http://127.0.0.1:8025`). pmm-managed reads `GF_SMTP_*` from its own environment, so a server either has SMTP or not for its lifetime: the *SMTP is not configured* error (FAILED_PRECONDITION) is no longer reachable from these tests.

## Findings

Product issues seen while automating, for PMM-14109:

1. Notifications never show their action button: the app's `NotistackMuiSnackbar` renders only the message, so **View results** after Run, Run all and Run selected in the Catalog and after **Re-run now** in Insights is missing.
2. The error notification for a duplicate check name covers the check form's **Save** button, so the form can't be retried until it closes.
3. Turning Advisor notifications on with no recipients disables **Apply changes** without saying why; *Add at least one recipient…* appears only after the recipients field is edited.
4. Settings keeps `QA@example.com` and `qa@example.com` as two recipients, while the schedule editor and the Email insights dialog merge addresses ignoring case.
5. A check script that never ends fails with *check script execution failed: signal: killed*, in **Test** and in runs. The 4 s CPU limit of `pmm-managed-starlark` kills it before the 5 s timeout that would report *timed out after 5s*.
6. `mongodb_multiple_services` errors with *key "cluster" not in dict* on a MongoDB service added without a cluster name.
7. `mongodb_swap_allocation` errors with *local variable swap_alloc_GB referenced before assignment* when the node reports no swap metric (a remote node). With no swap and no replica set it would hit the same error on `state`.
