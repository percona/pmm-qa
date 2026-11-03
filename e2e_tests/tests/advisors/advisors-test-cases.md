# Advisors UI test cases (PMM-14109)

Test cases automated by the `@advisors`, `@advisor-scheduling` and `@advisor-databases` Playwright suites in this folder, and by
the upgrade and HA tests linked from the last sections, for the new Advisors pages served by PMM UI
(percona/pmm#5656, percona/grafana#930). Every case still carries the `PMM-Txxxx` placeholder until its Zephyr case is created.

Run them with:

```bash
cd e2e_tests && npx playwright test --grep "@advisors|@advisor-scheduling|@advisor-databases"
```

## Common preconditions

- PMM Server built with PMM-14109 (Advisors enabled, which is the default).
- At least one monitored MySQL service (CI starts `--database ps=8.4`).
- Logged in as `admin`, unless the case says otherwise.
- PMM Server sends email to the `mailpit` container started with it from `e2e_tests/docker-compose.yml` (`GF_SMTP_HOST=mailpit:1025`). Email cases send to a unique `qa-<label>-<timestamp>@example.com` address and read it back through the mailpit API.

## Test data

The **QA custom check** is created through `POST /v1/advisors/checks` and deleted after the test:

| Field | Value |
| --- | --- |
| Name | `custom_qa_<timestamp>_<random>` |
| Summary | `QA check <name>` |
| Category | `QA` |
| Technology | MySQL |
| Query | `METRICS_INSTANT`: `vector(1)` |
| Script | returns three `warning` findings named `Finding 0`, `Finding 1`, `Finding 2` |

Each run of this check produces three insights per monitored MySQL service, whatever the state of that database.

Two variants change only the script: the **passing** variant returns no findings (one *OK* insight per service), and the **erroring** variant calls `fail("QA failure")` (one *Error* insight per service).

## Pages

| Page | URL |
| --- | --- |
| Catalog (Advisor checks) | `/pmm-ui/advisors` |
| Insights | `/pmm-ui/advisors/insights` |
| Run history | `/pmm-ui/advisors/runs` |
| Scheduler | `/pmm-ui/advisors/scheduler` |
| Settings → Advisors | `/pmm-ui/settings/advisors` |

---

## Catalog

### TC-01 · PMM-Txxxx - Verify the advisor checks catalog lists every check

Spec: [catalog.test.ts:19](catalog.test.ts#L19)

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Get the check list from `GET /v1/advisors/checks`. | The list is returned. |
| 2 | Open the Catalog page. | The **Advisor checks** heading is shown, with **Add advisor**, **Clear filters**, **Refresh**, **Run all** and **Run selected** in the toolbar. |
| 3 | Look at the pagination label. | It ends with `of <number of checks from step 1>`. |
| 4 | Search for the summary of a built-in check. | Its row shows Source **Builtin**, the status switch matches its enabled state, and **Run** and **Disable for services** are shown. **Edit** and **Delete** are not shown. |

### TC-02 · PMM-Txxxx - Verify searching and filtering advisor checks

Spec: [catalog.test.ts:59](catalog.test.ts#L59)

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Open the Catalog page and search for the summary of a MongoDB check. | That check's row is shown and the total count drops below the number of all checks. |
| 2 | Click **Clear filters**, then set **Technology** to *MongoDB*. | The total count equals the number of MongoDB checks in the API. |
| 3 | Click **Clear filters**. | The total count equals the number of all checks again. |

### TC-03 · PMM-Txxxx - Verify the details pane of a built-in advisor check

Spec: [catalog.test.ts:94](catalog.test.ts#L94)

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Open the Catalog page, search for a built-in check and double-click its row. | The details pane opens and the URL contains `details=<check name>`. |
| 2 | Look at the details pane. | **Check name** shows the check's name, **Source** shows *Builtin*, and the script contains `def check_context`. **Edit** is disabled and **Clone** is enabled. |
| 3 | Click **Close**. | The pane closes and `details=` is removed from the URL. |
| 4 | Open `/pmm-ui/advisors?details=<check name>` directly. | The details pane opens for that check. |

### TC-04 · PMM-Txxxx - Verify creating a custom advisor check

Spec: [catalog.test.ts:131](catalog.test.ts#L131)

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Open the Catalog page and click **Add advisor**. | The **Add advisor check** form opens, with the **Name** field prefilled as `custom_`. |
| 2 | Fill in: a unique `custom_…` name, a summary, description *Created by a UI test.*, category *QA*, technology *MySQL*, query type `METRICS_INSTANT` with query `vector(1)`, and the QA custom check script. Click **Save**. | A `Advisor check "<name>" created` notification appears and the form closes. |
| 3 | Search for the new summary. | The row shows Source **Custom**, with **Edit** and **Delete** buttons. |
| 4 | Read the check from `GET /v1/advisors/checks/<name>`. | Category `QA`, technology MySQL, the entered summary, and `user_defined: true`. |

Cleanup: the check is deleted through the API.

### TC-05 · PMM-Txxxx - Verify a custom check name requires the custom_ prefix

Spec: [catalog.test.ts:178](catalog.test.ts#L178)

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Open the Catalog page and click **Add advisor**. | The form opens. |
| 2 | Enter the name `qa_<timestamp>` and click **Save**. | The error *Custom check names must start with "custom_".* is shown and the form stays open. |
| 3 | Look the name up through the API. | No such check exists. |

### TC-06 · PMM-Txxxx - Verify disabling and enabling a check from the catalog

Spec: [catalog.test.ts:194](catalog.test.ts#L194)

Precondition: the QA custom check exists.

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Open the Catalog page and search for the check's summary. | Its row is shown with the status switch on. |
| 2 | Turn the status switch off. | A `Check "<summary>" disabled` notification appears, the switch is off, the API reports `enabled: false`, and the row's **Run** button is disabled. |
| 3 | Turn the status switch on again. | A `Check "<summary>" enabled` notification appears, the switch is on and the API reports `enabled: true`. |

### TC-07 · PMM-Txxxx - Verify deleting a custom advisor check

Spec: [catalog.test.ts:220](catalog.test.ts#L220)

Precondition: the QA custom check exists.

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Open the Catalog page, search for the check and click its **Delete** button. | The delete dialog opens and names the check's summary. |
| 2 | Click **Cancel**. | The dialog closes and the row is still there. |
| 3 | Click **Delete** again and confirm. | A `Check "<summary>" deleted` notification appears, the row disappears, and the API no longer returns the check. |

---

## Check form

### TC-08 · PMM-Txxxx - Verify editing a custom advisor check

Spec: [checkForm.test.ts:20](checkForm.test.ts#L20)

Precondition: the QA custom check exists.

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Open the Catalog page, search for the check and click **Edit**. | The **Edit advisor check** form opens. **Name** shows the check's name and is disabled, **Summary** shows its summary, and the first query is `vector(1)`. |
| 2 | Change the summary to `<summary> edited` and the category to *QA edited*, then click **Save**. | A `Advisor check "<name>" updated` notification appears and the form closes. |
| 3 | Search for the new summary. | The row shows category **QA edited**, and the API returns the new summary and category. |
| 4 | Call `PUT /v1/advisors/checks/<name>` with a new name in the body. | `200`. The check keeps its name, and no check with the new name exists. |

### TC-09 · PMM-Txxxx - Verify cloning a built-in advisor check

Spec: [checkForm.test.ts:78](checkForm.test.ts#L78)

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Open the details pane of a built-in check and click **Clone**. | The **Clone advisor check** form opens. **Name** is `custom_<built-in name>` and can be edited; **Summary** and **Category** are copied from the built-in check. |
| 2 | Change the name to a unique `custom_…` value and click **Save**. | A `Advisor check "<name>" created` notification appears. |
| 3 | Read the new check from the API. | Same category, summary and technology as the built-in check, with `user_defined: true`. |

Cleanup: the clone is deleted through the API.

### TC-10 · PMM-Txxxx - Verify advisor check form validation

Spec: [checkForm.test.ts:111](checkForm.test.ts#L111)

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Open the Catalog page, click **Add advisor**, then click **Save** without filling anything in. | *This field is required.* is shown four times (summary, description, category, script). The only query's **Remove** button is disabled. |
| 2 | Enter the name `custom_bad-name`. | *Enter a valid name: letters, digits and underscores…* is shown. |
| 3 | Enter a name of `custom_` followed by 128 letters. | *Name must be at most 128 characters.* is shown. |
| 4 | Set the query type to `METRICS_INSTANT`, then add two parameters both named `lookback`. | *This parameter is already set for the query.* is shown. |

### TC-11 · PMM-Txxxx - Verify query types follow the check technology

Spec: [checkForm.test.ts:146](checkForm.test.ts#L146)

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Open **Add advisor**, set **Technology** to *MongoDB* and open the first query's **Type** list. | `MONGODB_GETPARAMETER` and `METRICS_INSTANT` are offered; `MYSQL_SHOW` is not. |
| 2 | Set **Technology** to *MySQL* and open the **Type** list. | `MYSQL_SHOW` and `METRICS_INSTANT` are offered; `POSTGRESQL_SHOW` is not. |
| 3 | Set **Technology** to *PostgreSQL* and open the **Type** list. | `POSTGRESQL_SELECT` and `METRICS_INSTANT` are offered; `MONGODB_BUILDINFO` is not. |

### TC-12 · PMM-Txxxx - Verify the server rejects a duplicate check name

Spec: [checkForm.test.ts:172](checkForm.test.ts#L172)

Precondition: the QA custom check exists.

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Open **Add advisor** and fill in a valid check that uses the existing check's name with a different summary. Click **Save**. | An `advisor check <name> already exists` error appears and the form stays open. |
| 2 | Read the existing check from the API. | Its summary is unchanged. |

Known UI issue: the error notification covers the form's **Save** button for at least 10 seconds.

### TC-13 · PMM-Txxxx - Verify the server rejects a script indented with tabs

Spec: [checkForm.test.ts:197](checkForm.test.ts#L197)

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Open **Add advisor** and fill in a valid check whose script is indented with a tab character. Click **Save**. | An error saying the script should use spaces for indentation, not tabs, appears and the form stays open. |
| 2 | Look the name up through the API. | No such check exists. |

### TC-14 · PMM-Txxxx - Verify testing a check on a service from the form

Spec: [checkForm.test.ts:222](checkForm.test.ts#L222)

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Open **Add advisor** and fill in the QA custom check without saving it. | The form is filled in. |
| 2 | Pick a monitored MySQL service in **Test on service** and click **Test**. | Test results show **Success** and `· 3 findings`, and the output contains `Finding 0`. |
| 3 | Replace the script with one that calls `fail("broken check")` and click **Test**. | Test results show **Error** and the error text contains `broken check`. |
| 4 | Replace the script with a loop over `range(1000000000)` and click **Test**. | Within seconds, test results show **Error** and the error text contains `check script execution`. Today it reads *failed: signal: killed*, not *timed out* (finding 5 in the coverage doc). |
| 5 | Click **Cancel**. | The form closes and the API has no check with that name. |

### TC-15 · PMM-Txxxx - Verify copying the code of a check from the details pane

Spec: [checkForm.test.ts:271](checkForm.test.ts#L271)

Precondition: the QA custom check exists, and the browser allows clipboard access.

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Open `/pmm-ui/advisors?details=<check name>` and click **Copy** in the script section. | A *Check code copied to clipboard* notification appears. |
| 2 | Read the clipboard. | It contains `def check_context`. |

### TC-16 · PMM-Txxxx - Verify built-in checks cannot be changed or deleted

Spec: [checkForm.test.ts:333](checkForm.test.ts#L333)

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Send `PUT /v1/advisors/checks/<built-in name>` with a valid definition and a changed summary. | `400` with a message saying the check cannot be modified. |
| 2 | Send `DELETE /v1/advisors/checks/<built-in name>`. | `400`. |
| 3 | Read the built-in check. | Its summary is unchanged. |

---

## Disable for services

### TC-17 · PMM-Txxxx - Verify disabling and re-enabling a check for a service

Spec: [disableServices.test.ts:16](disableServices.test.ts#L16)

Precondition: the QA custom check exists; one MySQL service is picked as the target.

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Open the Catalog page, search for the check and click **Disable for services**. | The drawer **Disable "<summary>" for services** opens. It reads *This check is not disabled for any service.* and **Disable** is disabled. |
| 2 | Pick the MySQL service and click **Disable**. | A *Check disabled for 1 service* notification appears, the service is listed under **Disabled for services**, and the API returns its ID in `disabled_service_ids`. |
| 3 | Close the drawer. | The row's services badge shows `1`. |
| 4 | Run the check through the API and list the run's insights. | None of the insights belongs to the disabled service. |
| 5 | Open the drawer again and click **Re-enable** for the service. | A `Check re-enabled for "<service name>"` notification appears, the drawer reads *This check is not disabled for any service.*, and `disabled_service_ids` is empty. |

### TC-18 · PMM-Txxxx - Verify a globally disabled check cannot be disabled for services

Spec: [disableServices.test.ts:66](disableServices.test.ts#L66)

Precondition: the QA custom check exists and is disabled through the API.

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Open the Catalog page, search for the check and click **Disable for services**. | The notice that the check is disabled globally is shown. The service picker and **Disable** are both disabled. |

---

## Insights

### TC-19 · PMM-Txxxx - Verify the insights a run produced and their details

Spec: [insights.test.ts:20](insights.test.ts#L20)

Precondition: the QA custom check exists and one run of it, started through the API, has completed with findings.

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Open `/pmm-ui/advisors/insights?runId=<run id>`. | The **Advisor insights** heading is shown, the **Run ID** filter holds the run ID, and there is one row per finding of the run. |
| 2 | Look at one insight's row. | It shows the insight summary, the service name, severity **Warning** and status **Failed**. |
| 3 | Double-click the row. | The details pane opens with the check name, the run ID and the service name. |
| 4 | Close the details pane. | The pane closes. |

### TC-20 · PMM-Txxxx - Verify filtering insights by run from the actions menu

Spec: [insights.test.ts:60](insights.test.ts#L60)

Precondition: same as TC-19.

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Open the Insights page. | The **Service**, **Node**, **Category**, **Severity** and **Status** filters and **Email insights** are shown. |
| 2 | Open an insight's **More actions** menu and choose **Filter by run ID**. | The URL contains `runId=<run id>` and the table shows one row per finding of the run. |
| 3 | Click **Clear filters**. | The **Run ID** filter is empty and `runId=` is removed from the URL. |

---

## Run history

### TC-21 · PMM-Txxxx - Verify a check run from the catalog is recorded in run history

Spec: [runs.test.ts:20](runs.test.ts#L20)

Precondition: the QA custom check exists.

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Open the Catalog page, search for the check and click its **Run** button. | A `Check "<summary>" started` notification appears. |
| 2 | Open Run history and filter by the new run's ID. | Exactly one row is shown, with **Triggered by** *User*. |
| 3 | Click **Refresh** until the run finishes. | The run's coverage shows `1/1`. |
| 4 | Open the run's **More actions** menu and choose **View insights**. | Insights opens at `?runId=<run id>` and the first row contains `Finding`. |

### TC-22 · PMM-Txxxx - Verify run history filters by trigger and run ID

Spec: [runs.test.ts:60](runs.test.ts#L60)

Precondition: the QA custom check exists and one run of it, started through the API, has completed.

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Open Run history. | The **Advisor runs** heading and the run's row are shown. The columns are Started, Duration, Triggered by, Checks, Findings, Errors and Services. |
| 2 | Set **Triggered by** to *Scheduler*. | The run's row is hidden. |
| 3 | Click **Clear filters**. | **Triggered by** reads *All*. |
| 4 | Filter by the run's ID. | Exactly one row is shown, and it contains the run's findings count. |
| 5 | Set **Triggered by** to *User* and **Rows per page** to 100, open the Catalog from the menu, then Run history from the menu. | The URL has `pageSize=100` and no `runId`. **Triggered by** reads *User*, **Rows per page** reads 100, and the run ID filter is empty. |

---

## Navigation and settings

### TC-23 · PMM-Txxxx - Verify the Advisors menu opens Insights, Catalog, Run history and Scheduler

Spec: [navigation.test.ts:10](navigation.test.ts#L10)

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Open `/pmm-ui` and choose **Advisors → Insights** in the left menu. | The URL ends with `/pmm-ui/advisors/insights` and **Advisor insights** is shown. |
| 2 | Choose **Advisors → Catalog**. | The URL ends with `/pmm-ui/advisors` and **Advisor checks** is shown. |
| 3 | Choose **Advisors → Run history**. | The URL ends with `/pmm-ui/advisors/runs` and **Advisor runs** is shown. |
| 4 | Choose **Advisors → Scheduler**. | The URL ends with `/pmm-ui/advisors/scheduler` and **Advisor schedules** is shown. |

### TC-24 · PMM-Txxxx - Verify legacy Advisors URLs redirect to the new pages

Spec: [navigation.test.ts:113](navigation.test.ts#L113)

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Open `/graph/advisors`. | Redirected to `/pmm-ui/advisors`. |
| 2 | Open `/graph/advisors/configuration`. | Redirected to `/pmm-ui/advisors`. |
| 3 | Open `/graph/advisors/insights`. | Redirected to `/pmm-ui/advisors/insights`. |
| 4 | Open `/graph/pmm-database-checks`. | Redirected to `/pmm-ui/advisors/insights`. |
| 5 | Open `/graph/pmm-database-checks/all-checks`. | Redirected to `/pmm-ui/advisors`. |

### TC-25 · PMM-Txxxx - Verify the Advisors settings tab

Spec: [navigation.test.ts:130](navigation.test.ts#L130)

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Open Settings and click the **Advisors** tab. | The URL ends with `/pmm-ui/settings/advisors`. |
| 2 | Look at the tab. | The **Advisors**, **Advisor history retention** and **Advisor notifications** sections and the retention input are shown. The Advisors switch is on, notifications are off, and **Apply changes** is disabled. |
| 3 | Turn **Advisor notifications** on (without applying). | Default severities show *Critical* and *Error* checked and *Warning* and *Info* unchecked; **Default recipients** is empty; the note links to the Scheduler; **Send test email** is disabled. |

---

## Permissions

Precondition for both cases: Grafana users `advisors_viewer` (Viewer) and `advisors_editor` (Editor) exist. The suite creates them with a unique suffix and deletes them afterwards.

### TC-26 · PMM-Txxxx - Verify a viewer has no access to Advisors

Spec: [permissions.test.ts:42](permissions.test.ts#L42)

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Log in as `advisors_viewer` and open `/pmm-ui`. | The left menu is shown without an **Advisors** item. |
| 2 | Open the Catalog, Insights, Run history and Scheduler pages one by one. | Each page shows *Insufficient access permissions.* |
| 3 | Call `GET /v1/advisors/checks` and `GET /v1/advisors/schedules` as the viewer. | `401` or `403` for each. |

### TC-27 · PMM-Txxxx - Verify an editor can use Advisors but not its admin settings

Spec: [permissions.test.ts:86](permissions.test.ts#L86)

Precondition: the QA custom check exists.

| # | Step | Expected result |
| --- | --- | --- |
| 1 | As the editor, call `GET /v1/advisors/schedules`, `GET /v1/advisors/services` and `GET /v1/advisors/notificationSettings`. | `200` for each. |
| 2 | As the editor, create a schedule for the check through `POST /v1/advisors/schedules` and run it with `POST /v1/advisors/schedules/<id>:run`. | Both return `200` and the run completes. |
| 3 | Log in as `advisors_editor` and open the Catalog page. | **Add advisor** is shown. |
| 4 | Search for the check and click its **Run** button. | A `Check "<summary>" started` notification appears. |
| 5 | Open Insights, Run history and the Scheduler. | Each page shows its heading and no access error. |
| 6 | Open `/pmm-ui/settings/advisors`. | *Insufficient access permissions.* is shown. |
| 7 | Call `GET /v1/advisors/checks` as the editor. | `200`. |
| 8 | Call `POST /v1/advisors/notifications:test` as the editor, first without a severity, then with *Critical*. | `400` *At least one severity is required.*, then `200`. |

---

## Scheduler

Schedules a case creates are named `QA schedule <timestamp>_<random>` and deleted after the test. Unless a case says otherwise, a schedule created through the API runs Mon–Fri at 10:00 UTC on all checks and all services, with no email.

### TC-28 · PMM-Txxxx - Verify the default "All checks daily" schedule

Spec: [scheduler.test.ts:52](scheduler.test.ts#L52)

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Call `GET /v1/advisors/schedules`. | A schedule named *All checks daily* is enabled, runs every day (0–6) at `06:00`, has no check names or service IDs, and emails the Settings recipients. |
| 2 | Open the Scheduler. | **Advisor schedules** is shown. The schedule's row reads *Every day, 06:00 UTC*, *All checks*, *All services* and *Settings recipients*. With email notifications off, as by default, a banner says *Advisor email notifications are turned off, so no schedule sends email.* |

### TC-29 · PMM-Txxxx - Verify creating a schedule

Spec: [scheduler.test.ts:188](scheduler.test.ts#L188)

Precondition: the QA custom check exists.

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Open the Scheduler and click **New schedule**. | The **New schedule** editor opens. |
| 2 | Enter a name, pick Mon–Fri, set the time to `10:00`, choose **Selected checks** and tick the QA check, choose **Selected services** and tick the MySQL service. | The preview reads *Runs every weekday at 10:00 UTC*. |
| 3 | Click **Create schedule**. | A `Created "<name>". Next run: …` notification appears. |
| 4 | Call `GET /v1/advisors/schedules`. | The schedule is enabled, with days 1–5, time `10:00`, the QA check and the MySQL service. |
| 5 | Look at the schedule's row and the **This week, UTC** view. | The row shows *Mon–Fri, 10:00 UTC*, *1 check*, *1 service*, the service name and a next run at 10:00 UTC; the week view has five markers for it. |

### TC-30 · PMM-Txxxx - Verify schedule editor validation

Spec: [scheduler.test.ts:241](scheduler.test.ts#L241)

Precondition: one schedule exists, created through the API.

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Open the Scheduler and click **New schedule**. Leave the name empty, unpick every day, clear the time, choose **Selected checks** and **Selected services** without ticking any, choose **These recipients** with no address, choose **Only these** severities and untick *Critical* and *Error*. Click **Create schedule**. | Each field shows its error: *Give the schedule a name.*, *Pick at least one day.*, *Enter a time as HH:MM.*, *Pick at least one check, or choose All checks.*, *Pick at least one service, or choose All services.*, *Enter at least one address, or choose Settings recipients.*, *Pick at least one severity, or choose Same as Settings.* The footer reads *Fix the highlighted fields: name, days, time, checks, services, email, severities.* |
| 2 | Enter the existing schedule's name in upper case. | *A schedule named "<NAME>" already exists.* |
| 3 | Type a 101-character name. | The field keeps the first 100 characters. |
| 4 | Enter `qa@example.com, not-an-email` as recipients. | *Not a valid address: not-an-email* |
| 5 | Enter 21 addresses separated by spaces. | *Up to 20 addresses; there are 21.* |
| 6 | Click **Create schedule**, then **Cancel**. | The footer lists every field but the name; the editor closes and the number of schedules is unchanged. |

### TC-31 · PMM-Txxxx - Verify editing a schedule

Spec: [scheduler.test.ts:310](scheduler.test.ts#L310)

Precondition: a schedule created through the API.

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Open the schedule's **More actions** menu and choose **Edit**. | The **Edit schedule** editor opens with the schedule's name. |
| 2 | Pick Mon, Wed and Fri, set the time to `11:30`, choose **Selected services** and tick the MySQL service. Click **Save changes**. | A `Saved "<name>". Next run: …` notification appears. |
| 3 | Look at the row and call `GET /v1/advisors/schedules`. | The row shows *Mon, Wed, Fri, 11:30 UTC*, *1 service* and the service name; the API returns days 1, 3, 5, time `11:30` and the service ID. |

### TC-32 · PMM-Txxxx - Verify pausing and enabling a schedule

Spec: [scheduler.test.ts:347](scheduler.test.ts#L347)

Precondition: a schedule created through the API.

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Open the Scheduler. | The schedule's **Enabled** switch is on and the week view has five markers for it. |
| 2 | Turn the switch off. | `Paused "<name>". It won't run until you enable it.`; the row's next run reads *Paused*; its markers disappear; the API returns `enabled: false`. |
| 3 | Turn the switch on. | `Enabled "<name>". Next run: …`; five markers again; the API returns `enabled: true`. |

### TC-33 · PMM-Txxxx - Verify a duplicated schedule starts paused

Spec: [scheduler.test.ts:378](scheduler.test.ts#L378)

Precondition: a schedule created through the API for the MySQL service, emailing its own recipient `qa@example.com`.

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Open the schedule's **More actions** menu and choose **Duplicate**. | `Duplicated as "<name> (copy)". It stays paused until you enable it, so nothing runs twice.` |
| 2 | Call `GET /v1/advisors/schedules` and look at the copy's row. | The copy is disabled and has the same days, time, checks, services, email mode and recipients; its **Enabled** switch is off. |

### TC-34 · PMM-Txxxx - Verify Run now, View runs and deleting a schedule that has run

Spec: [scheduler.test.ts:411](scheduler.test.ts#L411)

Precondition: the QA custom check exists, and a schedule created through the API runs it on the MySQL service.

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Open the schedule's **More actions** menu and choose **Run now**. | `Started "<name>". Follow it in Run history.` The run completes with the QA check only, 1 planned check and 1 planned service, and carries the schedule's ID and name. |
| 2 | Choose **View runs** for the schedule. | Run history opens at `?scheduleId=<id>`; the **Schedule** filter shows the schedule's name; one row is shown, with **Triggered by** *User · <name>*. |
| 3 | Back in the Scheduler, choose **Delete** for the schedule. | The dialog asks *Delete "<name>"?* and says *Its future runs are cancelled. Past runs stay in Run history under this name.* |
| 4 | Click **Delete**. | `Deleted "<name>".`; the row disappears and the API no longer returns the schedule. |
| 5 | Open Run history at `?scheduleId=<id>`, clear the filters and filter by the run's ID. | The **Schedule** filter reads *Deleted schedule*; the run is still listed as *User · <name>*. |

### TC-35 · PMM-Txxxx - Verify a second run cannot start while one is active

Spec: [scheduler.test.ts:477](scheduler.test.ts#L477)

Precondition: a schedule created through the API, and a run of all checks started through `POST /v1/advisors/checks:start` that is still running. A full run on one MySQL service takes about a minute; the test waits for it to finish.

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Call `POST /v1/advisors/checks:start`, then `POST /v1/advisors/schedules/<id>:run`. | Both return `400` (FAILED_PRECONDITION) with *Advisor checks are already running (started … by a user). Try again when the run finishes.* |
| 2 | Open the Scheduler and the schedule's **More actions** menu. | A banner says the run *is queued and starts within a minute* or *is running: x of y checks done, started …*; **Run now** is disabled. |
| 3 | Close the menu and click **Open in Run history** in the banner. | Run history opens at `?runId=<the active run>`. |
| 4 | Open the Catalog and click **Run all**. | A notification says *Advisor checks are already running…* |

---

## Insights: statuses, filters and actions

### TC-36 · PMM-Txxxx - Verify the OK, Failed and Error status chips and the Status filter

Spec: [insights.test.ts:98](insights.test.ts#L98)

Precondition: three QA custom checks, run together through the API: the passing variant, the default one and the erroring variant.

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Open Insights at `?runId=<run id>`. | One row per insight of the run. The passing check's rows show *OK*, the default check's rows *Failed* and the erroring check's rows *Error*. |
| 2 | Set **Status** to *OK*, then *Failed*, then *Error*. | The URL carries `status=ADVISOR_CHECK_RESULT_STATUS_<status>` and only that check's rows are shown each time. |
| 3 | Double-click the *Error* row. | The details pane's **Outcome** contains *QA failure*. |

### TC-37 · PMM-Txxxx - Verify insight filters, Filter by name and restoring filters from the menu

Spec: [insights.test.ts:150](insights.test.ts#L150)

Precondition: the QA custom check and the passing variant in category `QA passing`, run together through the API.

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Open Insights at `?runId=<run id>`. Set **Service** to the MySQL service and **Node** to its node. | Both options are offered; every row of the run is still shown. |
| 2 | Set **Category** to `QA`. | Only the QA check's rows are shown. |
| 3 | Set **Severity** to *Warning* and **Status** to *Failed*. | The same rows; the URL carries `service`, `node`, `category`, `severity=SEVERITY_WARNING` and `status`. |
| 4 | Set **Category** to `QA passing`. | *No advisor insights found*: the filters combine. |
| 5 | Click **Clear filters**, filter by the run ID, open a QA-check row's **More actions** menu and choose **Filter by name**. | The URL carries `check=<name>` and only that check's rows are shown. |
| 6 | Choose **Advisors → Catalog** in the left menu, then **Advisors → Insights**. | Insights opens with `check=<name>` and `runId=<run id>` restored, showing the same rows. |

### TC-38 · PMM-Txxxx - Verify copying an insight as text and as a URL that opens its details

Spec: [insights.test.ts:216](insights.test.ts#L216)

Precondition: one run of the QA custom check; the browser may read the clipboard.

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Open Insights at `?runId=<run id>` and set **Status** to *Failed*. | The run's rows are shown. |
| 2 | Choose **Copy as text** for an insight. | *Insight copied to clipboard*. The clipboard text starts `The Advisor Check "<summary>" completed at … with status "Failed"` and lists the Run ID, Check Name, Service Name, Description and *Severity: Warning*. |
| 3 | Choose **Copy URL** for the same insight. | *Insight URL copied to clipboard*. The URL carries `runId`, `status=ADVISOR_CHECK_RESULT_STATUS_FAILED` and `insight=<id>`. |
| 4 | Open the copied URL in a new page. | The insight's details pane opens maximized (the toggle offers **Minimize**) with its summary. |
| 5 | Close the pane. | The Run ID filter holds the run's ID and **Status** reads *Failed*. |

### TC-39 · PMM-Txxxx - Verify re-running a check for the service of an insight

Spec: [insights.test.ts:285](insights.test.ts#L285)

Precondition: one run of the QA custom check; the browser may read the clipboard.

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Open Insights at `?runId=<run id>` and choose **Re-run now** for an insight. | `Check "<summary>" started on <service>, run ID copied to clipboard.` |
| 2 | Wait for the run whose ID is on the clipboard. | It completes with only the QA check, 1 planned check, 1 planned service and the insight's service ID. |

### TC-40 · PMM-Txxxx - Verify disabling and enabling a check for the service of an insight

Spec: [insights.test.ts:317](insights.test.ts#L317)

Precondition: one run of the QA custom check.

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Open Insights at `?runId=<run id>` and choose **Disable check for service** for an insight. | `Check "<summary>" disabled for <service>`; the check's `disabled_service_ids` is the insight's service; the row is dimmed (`data-check-disabled`). |
| 2 | Open the insight's **More actions** menu again. | The item reads **Enable check for service** and **Re-run now** is disabled. |
| 3 | Open the Catalog and search for the check. | Its services badge shows `1`. |
| 4 | Back in Insights, choose **Enable check for service**. | `Check "<summary>" enabled for <service>`; `disabled_service_ids` is empty and the row is no longer dimmed. |

### TC-41 · PMM-Txxxx - Verify the Email insights dialog

Spec: [insights.test.ts:375](insights.test.ts#L375)

Precondition: one run of a QA custom check whose script returns 201 findings per service, the first an `error` and the rest `warning`. The counts below are for one MySQL service, as in CI.

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Open Insights without filters and click **Email insights**. | *No filters are set, so this emails all N insights.* Cancel closes the dialog. |
| 2 | Open Insights at `?runId=<run id>` and click **Email insights**. Enter `qa@example.com`. | *Email 201 insights matching the current filters.* and *201 insights match, more than the 200 one email can carry. Narrow the filters to 200 insights or fewer.* **Send** stays disabled. |
| 3 | Cancel, set **Severity** to *Error* and click **Email insights**. Enter `qa@example.com`. | *Email 1 insight matching the current filters.*, no over-limit warning, **Send** enabled. |
| 4 | Clear the addresses; enter `qa@example.com, not-an-email`; enter 21 addresses. | *Enter at least one address.*, *Not a valid address: not-an-email*, *Up to 20 addresses; there are 21.* in turn; **Send** disabled each time. |
| 5 | Enter a new address and click **Send**. | *Emailed 1 insight to 1 recipient.* and the dialog closes. The email's subject is *PMM Advisor Insights: 1 insight(s) shared with you*; its body lists the filters (*Run ID*, *Severity: Error*), the counts by status (*Failed: 1*, *Error: 0*, *OK: 0*) and the insight *Finding 0*. |
| 6 | Read the notification settings. | Unchanged: notifications off, no recipients. |

---

## Run history and Catalog: exports, reruns and runs

### TC-42 · PMM-Txxxx - Verify exporting the insights of a run as CSV

Spec: [runs.test.ts:116](runs.test.ts#L116)

Precondition: the QA custom check and its passing variant run together through the API, and a MongoDB variant (no MongoDB service is monitored) runs on its own, producing no insights.

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Open Run history, filter by the first run's ID and choose **Export all** in its **More actions** menu. | `advisor_run_insights_<yyyyMMdd_HHmmss>.csv` downloads; its header has `check_name` and it holds the ID of every insight of the run. |
| 2 | Choose **Export failed**. | `advisor_run_failed_insights_<yyyyMMdd_HHmmss>.csv` holds the QA check's insights and not the passing check's. |
| 3 | Filter by the MongoDB run's ID and choose **Export all**, then **Export failed**. | *This run has no insights to export*, then *This run has no failed insights to export*; nothing downloads. |

### TC-43 · PMM-Txxxx - Verify Copy run ID, Run again and following a run in progress

Spec: [runs.test.ts:171](runs.test.ts#L171)

Precondition: one run of the QA custom check; the browser may read the clipboard.

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Open Run history, filter by the run's ID and choose **Copy run ID**. | *Run ID copied to clipboard*; the clipboard holds the run's ID. |
| 2 | Choose **Run again**. | *Advisor checks started*; a new run completes with the same check. |
| 3 | Start a run of 20 MySQL built-in checks through the API and filter by its ID, without clicking **Refresh** afterwards. | The row shows the run in progress, then completes by itself with `20/20` checks. A 20-check run takes about 20 seconds on one service. |

### TC-44 · PMM-Txxxx - Verify the ten risk categories of the built-in checks

Spec: [catalog.test.ts:245](catalog.test.ts#L245)

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Call `GET /v1/advisors/checks`. | The built-in checks use exactly ten categories: Connections, Durability, Logging, Maintenance, Performance, Replication, Resources, Schema & indexes, Security, Versions. |
| 2 | Open the Catalog and set **Category** to *Security*, *Schema & indexes* and *Logging* in turn. | The pagination counts as many checks as the API returns for that category. |

### TC-46 · PMM-Txxxx - Verify testing a check rejects retired severities

Spec: [checkForm.test.ts:353](checkForm.test.ts#L353)

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Open the Catalog, click **Add advisor** and fill the form with a script returning one `notice` finding. Pick the MySQL service and click **Test**. | *Error*: `result severity 'notice' is not supported by advisors; use one of: critical, error, warning, info`. |
| 2 | Change the severity to `emergency` and click **Test**. | The same error for `emergency`. |
| 3 | Change the severity to `info` and click **Test**. | *Success* with one finding. Cancel saves nothing. |

### TC-47 · PMM-Txxxx - Verify Run selected and Run all

Spec: [catalog.test.ts:280](catalog.test.ts#L280)

Precondition: two QA custom checks in a category of their own, one of them disabled.

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Open the Catalog. | **Run all** is enabled and **Run selected** disabled. |
| 2 | Set **Category** to the new category. | **Run all** is disabled. |
| 3 | Click **Run selected**. | *Advisor checks started, run ID copied to clipboard*. The request names only the enabled check, and the run completes with that check. |
| 4 | Open `/pmm-ui/advisors` again without a query string. | The Category filter is restored. |
| 5 | Click **Clear filters**, then **Run all**. | The same notification; the request names no checks (all). The run has insights of the enabled check and none of the disabled one. It takes about a minute. |

The notification after a run should offer **View results**, but build `ede5df3c7` drops notification actions, so the step is not asserted (see the coverage doc).

---

## Email notifications

Each case restores the notification settings afterwards: notifications off, no recipients, severities *Critical* and *Error*.

### TC-48 · PMM-Txxxx - Verify Advisor notification settings validation

Spec: [notifications.test.ts:25](notifications.test.ts#L25)

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Through `PUT /v1/server/settings`, turn notifications on with no recipients, with 21, then with `not-an-email`. | `400` each time: *at least one recipient is required while Advisor notifications are enabled.*, *at most 20 addresses are allowed, got 21.*, *invalid address 'not-an-email'.* |
| 2 | Open Settings → Advisors and turn **Advisor notifications** on. | *Critical* and *Error* are checked; **Default recipients** is empty and **Apply changes** is disabled. |
| 3 | Type an address in **Default recipients**, then clear it. | *Add at least one recipient, or turn Advisor notifications off* |
| 4 | Enter 21 addresses, then `qa@example.com, not-an-email`. | *At most 20 recipients are allowed*, then *"not-an-email" is not a valid email address*; **Apply changes** stays disabled. |
| 5 | Untick *Critical* and *Error*, then tick them again. | *Select at least one severity, or turn Advisor notifications off*, which goes away once a severity is ticked. |
| 6 | Enter `qa@example.com, dba@example.com qa@example.com` and click **Apply changes**. | *Settings updated*. The API returns notifications on, recipients `dba@example.com` and `qa@example.com` and severities critical and error. After a reload the field reads `dba@example.com, qa@example.com`. |
| 7 | Clear **Default recipients**. | The required-recipient error; **Apply changes** is disabled. |
| 8 | Turn **Advisor notifications** off and click **Apply changes**. | *Settings updated*; the API returns notifications off and no recipients. |

### TC-49 · PMM-Txxxx - Verify sending a test email from the API, Settings and the schedule editor

Spec: [notifications.test.ts:113](notifications.test.ts#L113)

| # | Step | Expected result |
| --- | --- | --- |
| 1 | As admin, call `POST /v1/advisors/notifications:test` without a severity, then with *Critical*. | `400` *At least one severity is required.*, then `200`. The email's subject is *[Test] PMM Advisor Insights: 1 sample finding(s)* and it counts *Critical: 1*. |
| 2 | Open Settings → Advisors, turn notifications on, enter a new address, untick *Critical* and *Error*. | **Send test email** is disabled. |
| 3 | Tick *Warning* and click **Send test email** without applying. | *Test email sent to <address>*. The email reaches that address with a `[Test]` subject and *Warning: 1*; the saved settings still have notifications off and no recipients. |
| 4 | In the Scheduler, click **New schedule**, choose **These recipients** with a new address and **Only these** severities, untick *Critical*, and click **Send test email**. | *Sent a test report to <address> with sample Error findings. No checks were run.* The email has a `[Test]` subject and *Error: 1*. Cancel saves nothing. |

### TC-50 · PMM-Txxxx - Verify the report emails of a user run and of a schedule

Spec: [notifications.test.ts:180](notifications.test.ts#L180)

Precondition: a QA custom check whose script returns three findings per service, one `error` and two `warning`. Notifications are turned on through the API with one new recipient and the default severities (*Critical*, *Error*). The counts below are for one MySQL service, as in CI.

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Run the check through `POST /v1/advisors/checks:start` and wait for it. | One email reaches the Settings recipient: *PMM Advisor Insights: 1 finding(s) for run <run id>*. Its body says the run *was triggered manually by an operator*, names the severities *(Critical, Error)*, counts *Critical: 0* and *Error: 1* with no Warning line, and counts *MySQL: 1*, *PostgreSQL: 0*, *MongoDB: 0*. |
| 2 | Create a schedule for the check on the MySQL service that emails its own new recipient, *Warning* only, and start it with `POST /v1/advisors/schedules/<id>:run`. | The schedule's recipient gets *PMM Advisor Insights: 2 finding(s) for <schedule name>*, *triggered manually by an operator from the schedule '<schedule name>'*, counting *Warning: 2*. The Settings recipient still has one email. |

---

## Details panes and deep links

### TC-51 · PMM-Txxxx - Verify testing a check from its details pane and the services it can target

Spec: [checkForm.test.ts:286](checkForm.test.ts#L286)

Precondition: a QA custom check whose script prints `QA print output` and returns one `warning` finding.

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Call `GET /v1/advisors/checks:testTargets` for PostgreSQL, then `POST /v1/advisors/checks:test` with a PostgreSQL check on `pmm-server-postgresql`. | The targets leave out `pmm-server-postgresql`. The test returns `400` with *PMM Server's internal PostgreSQL database cannot be targeted by advisor checks*. |
| 2 | Open the check's details pane (`/pmm-ui/advisors?details=<name>`) and open **Test on service**. | The options are exactly the MySQL test targets the API returns. |
| 3 | Pick the MySQL service and click **Test**. | Test results show **Success** and `· 1 finding`, and **Script output** contains `QA print output`. |

### TC-52 · PMM-Txxxx - Verify double-clicking a row on every Advisor table and the schedule details link

Spec: [navigation.test.ts:40](navigation.test.ts#L40)

Precondition: a QA custom check, one completed run of it, and a schedule that picks it.

| # | Step | Expected result |
| --- | --- | --- |
| 1 | In the Catalog, search for the check and double-click its row. | The check details pane opens and the URL has `details=<name>`. |
| 2 | In Insights for the run, double-click an insight. | The insight details pane opens and the URL has `insight=<id>`. |
| 3 | In Run history, filter by the run and double-click its row. | Insights opens at `?runId=<run id>` and shows the insight. |
| 4 | In the Scheduler, double-click the schedule's row. | The schedule details pane opens and the URL has `details=<schedule id>`. |
| 5 | Open `/pmm-ui/advisors/scheduler?details=<schedule id>`. | The pane names the schedule. Its summary reads *Mon–Fri at 10:00 UTC* and *1 selected*. It shows **Next runs**, **What each run covers**, **Checks** and **Recent runs**, which says *This schedule has not run yet.* |

---

## Scheduler: Advisors off, scope and time zones

### TC-54 · PMM-Txxxx - Verify the empty Scheduler and turning Advisors off and on

Spec: [scheduler.test.ts:74](scheduler.test.ts#L74)

The test saves every schedule first, and afterwards turns Advisors on and recreates them.

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Delete every schedule through the API and open the Scheduler. | The empty state shows *No schedules*, and the week reads *Nothing is scheduled. Advisor checks run only when someone starts them.* |
| 2 | Click **Create the default schedule**. | The empty state goes away, and the API has *All checks daily* as in TC-28. |
| 3 | Turn Advisors off through `PUT /v1/server/settings` and reload. | The banner says *Advisors are turned off, so no schedule runs. Schedules are kept.* The default schedule's row reads *Advisors are off*, and the week reads *Nothing runs while Advisors are turned off.* The Advisors menu is gone. `POST /v1/advisors/checks:start` returns `400` *advisor checks are disabled.* |
| 4 | Delete every schedule, turn Advisors on and reload. | The API has *All checks daily* again, the Advisors-off banner is gone and the Advisors menu is back. |

### TC-73 · PMM-Txxxx - Verify user schedules survive turning Advisors off and on

Spec: [scheduler.test.ts:148](scheduler.test.ts#L148)

Precondition: a schedule created through the API for Mon, Wed and Fri at 11:30 UTC.

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Turn Advisors off through `PUT /v1/server/settings` and open the Scheduler. | The schedule's row is there and reads *Advisors are off*. |
| 2 | Turn Advisors on and reload. | The API lists the same schedules as before, and this one keeps its name, days and time and is enabled. The Advisors-off banner is gone and the row is shown. |

### TC-55 · PMM-Txxxx - Verify a schedule resolves its checks and services when it runs

Spec: [scheduler.test.ts:516](scheduler.test.ts#L516)

Precondition: two MySQL services added through `POST /v1/management/services` on their own remote nodes, at `127.0.0.1:1` with the connection check skipped, so every query to them fails. A custom check that runs the `MYSQL_SELECT` query `1` and returns no findings, and a second QA custom check. Two schedules: one picks both checks and both added services, the other picks only the query check, on all services.

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Disable the second check in the Catalog through the API and run the first schedule. | The run plans 1 check and 2 services. Both insights are *Error* for the query check, with an outcome containing `connect: connection refused`. |
| 2 | Run the second schedule, add a third unreachable MySQL service, and run it again. | The second run plans one more service than the first, and its Run history row shows that many services. |
| 3 | Open the Scheduler. | The first schedule's row reads *2 services*. |
| 4 | Remove one of its services' nodes and reload. | The row reads *1 of 2 services*. |
| 5 | Remove the other node and reload. | The row is flagged *Targets no existing service*. |
| 6 | Delete the query check and reload. | The second schedule, unflagged before, is flagged *Targets no existing check*. |

### TC-56 · PMM-Txxxx - Verify the schedule editor shows local times and coverage warnings

Spec: [scheduler.test.ts:630](scheduler.test.ts#L630)

Precondition: the browser runs in the `Asia/Tokyo` time zone (UTC+9, no daylight saving time). A QA custom check, and a copy of it for PostgreSQL. CI monitors no PostgreSQL service besides PMM Server's own.

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Click **New schedule**, pick Mon–Fri and enter `23:00`. | The preview reads *Runs every weekday at 23:00 UTC, 08:00 in your time zone (Asia/Tokyo, …)* and *In your time zone this lands on the next day. Days are picked in UTC.* It does not mention daylight saving time, and the first next run shows *08:00 your time*. |
| 2 | Choose **Selected checks** and pick both checks. | *1 PostgreSQL check won't run: there is no PostgreSQL service in Inventory.* |
| 3 | Untick the MySQL check, choose **Selected services** and pick the MySQL service. | *None of the selected checks applies to the selected services, so every run would have nothing to do. Pick checks for MySQL, or other services.* Cancel saves nothing. |

---

## Insights: documentation links and topology

### TC-57 · PMM-Txxxx - Verify insights link to the documentation page of their check

Spec: [insights.test.ts:464](insights.test.ts#L464)

Precondition: the QA custom check exists, and a run of all checks has completed. It takes about a minute on one MySQL service.

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Read the run's insights through the API. | At least one built-in check failed. Each failed built-in insight links to `https://docs.percona.com/percona-monitoring-and-management/3/advisors/checks/<page>.html`, and no two checks share a page. None of these pages answers `404`. |
| 2 | Open Insights for the run filtered by a failed built-in check (`&check=<name>`). | Its row has the documentation icon. Double-clicking it opens the pane, where **Read more** links to the check's page. |
| 3 | Open Insights for the run filtered by the QA custom check. | Its rows have no documentation icon. |

### TC-58 · PMM-Txxxx - Verify an insight keeps the topology and labels of its service

Spec: [insights.test.ts:519](insights.test.ts#L519)

Precondition: a MySQL service added as in TC-55, with environment `qa-environment`, cluster `qa-cluster`, replication set `qa-replication-set`, custom label `qa_label=qa-value`, and its node in region `qa-region` and AZ `qa-az`. The QA custom check reads only metrics, so it still reports findings on this service.

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Run the QA custom check and read the added service's insight through the API. | The insight has the service and node names, environment, cluster, replication set, region and AZ, and its labels include those values and `qa_label: qa-value`. |
| 2 | Open `/pmm-ui/advisors/insights?runId=<run id>&insight=<id>`. | The pane shows the node, environment, cluster, replication set and region, and a `qa_label: qa-value` label. |

---

## Email modes

### TC-59 · PMM-Txxxx - Verify each schedule emails as it is set to

Spec: [notifications.test.ts:247](notifications.test.ts#L247)

Precondition: a QA custom check whose script returns two findings per service, one `error` and one `warning`, and two custom checks whose script loops until the 4 s CPU limit stops it. Notifications are turned on through the API with one new recipient and the default severities. Every schedule picks the MySQL service and is started with `POST /v1/advisors/schedules/<id>:run`.

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Run a schedule with no email, then one that emails the Settings recipients. | The Settings recipient gets exactly one email, *PMM Advisor Insights: 1 finding(s) for <second schedule>*. |
| 2 | Run a schedule that emails its own new recipient at the Settings severities. | That recipient gets *PMM Advisor Insights: 1 finding(s) for <schedule>* counting *Critical: 0* and *Error: 1*; the Settings recipient still has one email. |
| 3 | Run a schedule with its own recipient that also picks the two slow checks, and delete it right after starting it. | When the run completes, the Settings recipient gets *PMM Advisor Insights: 1 finding(s) for <deleted schedule>*, and the schedule's own recipient gets nothing. |

---

## Schedules falling due

These cases run under `@advisor-scheduling`, in their own CI job, because each waits for its schedules to fall due. Every schedule runs every day at the first whole UTC minute at least 20 s after the test creates it, so a test waits up to 80 s before its first run starts.

```bash
cd e2e_tests && npx playwright test --grep @advisor-scheduling
```

### TC-61 · PMM-Txxxx - Verify a schedule runs when it falls due and emails its report

Spec: [scheduling.test.ts:76](scheduling.test.ts#L76)

Precondition: the QA custom check. Notifications are turned on through the API.

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Create a schedule due at the next minute for the QA check and the MySQL service, emailing its own new recipient at warning severity, and wait for it to fall due. | A run of the schedule completes: triggered by the scheduler, 3 findings, `scheduled_for` at that minute, started less than a minute after it, and no `waited_for_run`. |
| 2 | Read the recipient's email. | *PMM Advisor Insights: 3 finding(s) for <schedule>*, saying the run *was run automatically by the schedule '<schedule>'*. |
| 3 | Open the Scheduler and click the schedule's last run. | The link reads *3 findings* and opens Run history at the run. Triggered by shows the schedule name, not *User · <schedule>*, and there is no late-start icon. |

### TC-62 · PMM-Txxxx - Verify schedules that fall due during a run wait for it and start late

Spec: [scheduling.test.ts:136](scheduling.test.ts#L136)

Precondition: the QA custom check, and 40 custom checks whose script loops until the 4 s CPU limit stops it. Notifications are turned on through the API. Two schedules due at the same minute, *<name> A* and *<name> B* (created B first), each for the QA check and the MySQL service and emailing its own new recipient at warning severity.

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Start a user run of enough slow checks to last until at least 80 s after the schedules fall due, and wait for both schedules to run. | The user run started before the schedules fell due. Both runs have that `scheduled_for`. A starts after the user run finishes and B after A finishes. A's `waited_for_run` is the user run, B's is A. |
| 2 | Read both recipients' email. | Each gets one email, *PMM Advisor Insights: 3 finding(s) for <its schedule>*. |
| 3 | Open each run in Run history and hover the clock icon by its start time. | A: *Scheduled for HH:MM UTC. Started N min late, after the run started at HH:MM UTC (a user run).* B: the same, ending *(<name> A)*. |

### TC-63 · PMM-Txxxx - Verify a schedule with nothing to check records no run

Spec: [scheduling.test.ts:238](scheduling.test.ts#L238)

Precondition: a custom check that returns no findings, and a MySQL service added as in TC-55.

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Create two schedules due at the same minute for the check: *<name> A* on the added service and *<name> B* on the monitored MySQL service. Remove the added service's node. | A now targets no existing service. |
| 2 | Wait for B's run to complete. | A starts first, by name, yet `GET /v1/advisors/runs?schedule_id=<A>` returns no run. |
| 3 | Open the Scheduler. | B's last run reads *0 findings*, and A's row reads *Never run*. |

## Restarting pmm-managed

These cases also run under `@advisor-scheduling`, after the cases above, because they stop or restart pmm-managed with `docker exec pmm-server supervisorctl … pmm-managed`. After a start, pmm-managed waits a minute before it starts any run.

### TC-64 · PMM-Txxxx - Verify a restart interrupts a run, which keeps the insights it saved

Spec: [scheduling.test.ts:286](scheduling.test.ts#L286)

Precondition: the QA custom check, named to sort first, and 15 custom checks whose script loops until the 4 s CPU limit stops it. A run executes its checks in name order. Notifications are turned on through the API. Two disabled schedules on the MySQL service, emailing one new recipient at warning severity: *interrupted* with all 16 checks, *following* with the QA check only.

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Restart pmm-managed, then click **Run now** on *interrupted* (through the API) and open the run in Run history. | The run is Queued. Its row reads *Queued…*, and hovering that text shows *Requested and waiting for PMM to start it, which takes up to a minute*. |
| 2 | Wait for the run to start and open its insights. | The row changes to *Running…* without a refresh. Insights lists *Pending* rows for the checks the run has not reached. |
| 3 | Once the QA check's insights are Failed, restart pmm-managed. | The run is Interrupted with 3 findings. The QA check's Failed insights are kept, no insight is Pending, and at least one is Not run with the outcome *The run ended before executing the check, for example because PMM restarted.* |
| 4 | Open the run in Run history and hover *Interrupted*; open its insights. | *PMM restarted, or the HA leader changed, before the run finished. The insights it saved are kept; the checks it did not reach show as Not run.* Insights shows a kept Failed insight and a *Not run* one. |
| 5 | Run *following* now and wait for it to complete. | The recipient gets one email, for the *following* run. The interrupted run sent none. |

### TC-65 · PMM-Txxxx - Verify PMM starts no run of its own after a restart and skips a schedule missed while stopped

Spec: [scheduling.test.ts:400](scheduling.test.ts#L400)

Precondition: a custom check that returns no findings. Two daily schedules for it on the MySQL service: *<name> missed*, due at the next minute, and *<name> control*, due a minute later.

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Stop pmm-managed until 5 s after *missed* falls due, then start it. | `readyz` answers again. |
| 2 | Within its first minute, turn Advisors off and on through the settings API. | Both changes are accepted. |
| 3 | Wait for *control* to run. | *control* runs for its due time. It is the only run since the stop that is a user run or one of these schedules': no run at startup, none on turning Advisors on, and none for *missed*, whose next run is the same time tomorrow. |
| 4 | Open the Scheduler. | *control*'s last run reads *0 findings*, and *missed* reads *Never run*. |

## Built-in checks on other databases

These cases run under `@advisor-databases`, in their own amd64-only CI job. Each starts its databases with `docker run` on the `pmm-qa` network, since pmm-framework sets up neither a standalone MongoDB nor MongoDB 8.2, and adds them as remote services monitored by PMM Server's own agent. The test removes the nodes and containers afterwards.

```bash
cd e2e_tests && npx playwright test --grep @advisor-databases
```

### TC-66 · PMM-Txxxx - Verify every built-in check completes on MySQL 5.7 and a standalone MongoDB 8.2

Spec: [databases.test.ts:78](databases.test.ts#L78)

Precondition: `mysql:5.7` and `mongo:8.2` (no replica set, no authentication) monitored as remote services.

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Start every check on these two services only (`checks:start` with their `service_ids`). | The run completes for 2 services. |
| 2 | Read the insights of the run. | No insight has status Error, and every planned check completed. |
| 3 | Open Run history for the run. | Checks reads *N/N*. |

### TC-67 · PMM-Txxxx - Verify a check reports one finding per database, naming at most 10 relations

Spec: [databases.test.ts:108](databases.test.ts#L108)

Precondition: `postgres:17` monitored as a remote service, with database *qa_many* holding 12 tables and *qa_few* holding 2, each table with an index no query has used.

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Run `postgresql_unused_index_check` on the service. | One finding per database, labelled with `database` and `count` (12 and 2). The *qa_many* summary reads *12 relation(s) with unused indexes in database qa_many*. |
| 2 | Read the outcomes. | *qa_many* names 10 of its tables and ends *; and 2 more.*; *qa_few* names both tables and nothing more. |
| 3 | Open Insights for the run and the *qa_many* details. | Two rows; the details outcome ends *; and 2 more.* |

## Upgrade

### TC-69 · PMM-Txxxx - Verify Advisors start from the default schedule with every check enabled after upgrade

Spec: [advisorsUpgrade.test.ts:13](../upgrade/advisorsUpgrade.test.ts#L13), tagged `@post-upgrade` and run by the upgrade workflows after upgrading from each of the last five minor releases.

Precondition: before the upgrade, the `@pre-upgrade` tests of the release's own `pmm-3.x` branch disable *MongoDB version check* (`mongodb_version`) and set *Check for unsupported PostgreSQL* to the Frequent interval.

| # | Step | Expected result |
| --- | --- | --- |
| 1 | List the checks. | Every check is enabled, `mongodb_version` included. |
| 2 | Find *All checks daily*. | Enabled, every day at 06:00, all checks and services, emailing the settings recipients. |
| 3 | Read the server settings and open Settings → Advisors. | Advisors on and history retention 30 days; the tab shows 30. |
| 4 | Open `/graph/advisors`. | It redirects to `/pmm-ui/advisors`. |

## High availability

These cases run under `@pmm-ha` against a three-node PMM HA cluster. HAProxy routes every request to the leader, so a test reaches a follower with `curl` inside its pod. The leader looks for runs queued and schedules changed on followers once a minute.

### TC-70 · PMM-Txxxx - Verify the HA leader runs a run requested on a follower and allows one run at a time

Spec: [advisorRuns.test.ts:49](../ha/advisorRuns.test.ts#L49)

| # | Step | Expected result |
| --- | --- | --- |
| 1 | On a follower, start 16 slow custom checks. | 200 with a run ID; the run is Queued. |
| 2 | Through HAProxy, start checks again. | 400: *Advisor checks are already running (started … by a user)*. |
| 3 | Wait. | The leader starts the queued run at its next poll and completes it. |

### TC-71 · PMM-Txxxx - Verify the HA leader runs a schedule created on a follower when it falls due

Spec: [advisorRuns.test.ts:79](../ha/advisorRuns.test.ts#L79)

| # | Step | Expected result |
| --- | --- | --- |
| 1 | On a follower, create a daily schedule due at the next minute. | 200. |
| 2 | Wait for its run. | The leader runs it for its due time. |

### TC-72 · PMM-Txxxx - Verify an HA leader failover interrupts the open run and starts no run of its own

Spec: [advisorRuns.test.ts:113](../ha/advisorRuns.test.ts#L113)

| # | Step | Expected result |
| --- | --- | --- |
| 1 | Start 40 slow custom checks and wait until the run is Running. | — |
| 2 | Delete the leader pod and wait for a new leader. | The run becomes Interrupted. |
| 3 | Wait three minutes from the failover. | No run without a schedule started since the failover. |
