# Migration Context Pack

Read this FIRST on every daily run. It exists so the run does not re-scan the whole repo
(~73 CodeceptJS POM/API/custom-step files + ~93 `e2e_tests` files). Per-run reads should be
bounded to: this file + `tracker.md` + the one source test + its specific POMs/API + the
target registration files listed under "Registration points".

Regenerate the inventory / mapping sections when repo structure or the CI matrix changes.

## 1. Provisioning (how server + client instances are set up)

The basis for what to provision is the test's tag mapped to a `setup_services` argument set,
exactly as CI does in `.github/workflows/e2e-tests-matrix.yml` +
`.github/workflows/runner-e2e-tests-codeceptjs.yml`. Where a test's tag is not in the matrix,
derive the flags by reading the source test (dashboards/exporters/API/custom steps it exercises)
and matching a setup key from `qa-integration/README.md`.

### 1a. PMM server bootstrap (same for every test)

```bash
# from repo root
docker network create pmm-qa || true
cd codeceptjs-e2e
PMM_SERVER_IMAGE=perconalab/pmm-server:3-dev-latest docker compose -f docker-compose.yml up -d
# wait for readiness (200)
timeout 120 bash -c 'until [ "$(curl -s -o /dev/null -w "%{http_code}" --user "admin:admin" http://127.0.0.1/v1/server/readyz)" = "200" ]; do sleep 5; done'
bash -x testdata/db_setup.sh          # optional seed, when the test needs it
docker network connect pmm-qa pmm-server || true
```

Default server image: `perconalab/pmm-server:3-dev-latest`. Admin password: `admin` locally
(CI uses `admin-password`). PMM UI base URL for tests: `http://127.0.0.1/`.

### 1b. PMM client attach (same for every test)

```bash
cd qa-integration/pmm_qa
sudo bash -x pmm3-client-setup.sh --pmm_server_ip 127.0.0.1 --client_version latest-tarball --admin_password admin --use_metrics_mode no
```

### 1c. DB / service instances (per test)

```bash
cd qa-integration/pmm_qa
python3 -m venv virtenv && . virtenv/bin/activate
pip install --upgrade pip && pip install -r requirements.txt setuptools
python pmm-framework.py --pmm-server-password=admin --verbose <setup_services>
```

`pmm-framework.py` REQUIRES an already-running PMM server (it finds the `pmm-server` container
and joins the `pmm-qa` network); it does not start the server itself. Args:
`--database` (repeatable), `--pmm-server-ip`, `--pmm-server-password`, `--client-version`,
`--verbose`, `--client-debug`.

### 1d. Tag -> setup_services mapping (from e2e-tests-matrix.yml)

| Tag(s) | setup_services |
| --- | --- |
| `@settings`, `@cli` | `--database pgsql` |
| `@ssl-mysql` | `--database ssl_mysql` |
| `@ssl-mongo` | `--database ssl_psmdb` |
| `@ssl-postgres` | `--database ssl_pdpgsql=16` |
| `@inventory`, `@image-renderer` | `--database pdpgsql` |
| `@LBAC` | `--database ps=8.4 --database psmdb --database pdpgsql` |
| `@new-navigation` | `--database ps=8.4 --database psmdb --database valkey` |
| `@pmm-ps-pxc-haproxy-integration` | `--database haproxy --database ps --database pxc` |
| `@pmm-valkey-integration` | `--database valkey` |
| `@disconnect` | none (no DB) |

For tests with no DB dependency (pure UI/navigation/help/tour), no `pmm-framework.py` call is
needed after server+client are up.

### 1e. Setup key catalog (from qa-integration/README.md + scripts/database_options.py)

`--database <key>[=version][,PARAM=value,...]`. Keys and default versions (last in list is the
framework default):

- `mysql`: 5.7, 8.0, 8.4, 9.7  (SETUP_TYPE: replication|gr; QUERY_SOURCE: perfschema|slowlog)
- `ps`: 5.7, 8.4, 8.0  (SETUP_TYPE: replication|gr; MY_ROCKS, BACKUP, NODES_COUNT)
- `pxc`: 5.7, 8.0  (fixed 3-node PXC + ProxySQL)
- `pgsql`: 11..18  (QUERY_SOURCE pgstatements; SETUP_TYPE: replication)
- `pdpgsql`: 11..18  (SETUP_TYPE: replication|patroni)
- `psmdb`: 4.4, 5.0, 6.0, 7.0, 8.0, latest  (SETUP_TYPE: pss|psa|shards)
- `valkey`: 7, 8  (SETUP_TYPE: sentinel)
- `proxysql`: 2 ; `haproxy`: default
- `external`: redis_exporter (1.14.0/1.58.0), node_process_exporter (0.7.5/0.7.10)
- Variants: `ssl_mysql`, `ssl_pdpgsql`, `ssl_psmdb`, `mlaunch_psmdb`, `mlaunch_modb`, `ssl_mlaunch`, `dockerclients`, `bucket`

## 2. Repo map (source -> target)

| CodeceptJS source | Playwright target |
| --- | --- |
| `codeceptjs-e2e/tests/<category>/*_test.js` | `e2e_tests/tests/<category>/*.test.ts` |
| `codeceptjs-e2e/tests/**/pages/*.js` (POMs) | `e2e_tests/pages/<category>/*.page.ts` |
| `codeceptjs-e2e/tests/**/pages/api/*.js` (API) | `e2e_tests/api/*.api.ts` |
| `codeceptjs-e2e/tests/custom_steps.js` | `@helpers/*` or `@components/*` (see section 5) |
| `codeceptjs-e2e/testdata/` | `e2e_tests/testdata/` |

Path aliases (from `e2e_tests/tsconfig.json`): `@fixtures/*`, `@interfaces/*`, `@helpers/*`,
`@components/*`, `@pages/*`, `@api/*`, `@valkey`.

## 3. Registration points (edit these when adding new code)

- POM fixtures: `e2e_tests/fixtures/pmmTest.ts` (add to the `base.extend<{...}>` type + factory).
- API clients: `e2e_tests/api/api.ts` (add `readonly xApi` field + constructor assignment).
- API paths: `e2e_tests/helpers/apiEndpoints.ts`.
- Timeouts enum: `e2e_tests/helpers/timeouts.ts` (`Timeouts.THIRTY_SECONDS`, etc.). Use these, never raw numbers.
- POMs extend: `e2e_tests/pages/base.page.ts` (abstract `builders/buttons/elements/inputs/messages`; constructor takes `page`).

POM shape (from CONTRIBUTING.md): group locators in `buttons`, `elements`, `inputs`, `messages`,
`builders`; arrow-function methods only; `url` property for the page URL.

## 4. Existing e2e_tests inventory (REUSE, do not recreate)

Registered fixtures (`pmmTest.ts`): `settingsPage, agentsPage, cliHelper, credentials, dashboard,
grafanaHelper, mongoDbHelper, api, qanStoredMetrics, urlHelper, helpPage, servicesPage, tour, mocks,
leftNavigation, portalRemoval, queryAnalytics, nodesPage, realTimeAnalyticsPage, vacuumDashboardPage,
updatesPage, downloadsPage`.

API clients (`api/api.ts`): `accessControlApi, alertingApi, backupsApi, grafanaApi, inventoryApi,
realTimeAnalyticsApi, serverApi, settingsApi`.

Helpers (`helpers/`): `grafana.helper` (auth), `mongodb.helper`, `cli.helper` (docker exec / psql /
commands), `url.helper`, `metrics.helper`, `mocks.helper`, `credentials.helper`, `apiEndpoints`,
`timeouts`.

Pages (`pages/`): `base.page`, `navigation.page`, `helpCenter.page`, `tour.page`, `updates.page`,
`downloads.page`, `portalRemoval.page`, `inventory/{services,agents,nodes}.page`,
`qan/{queryAnalytics,rta/realTimeAnalytics,storedMetrics/storedMetrics}.page`, `ha/settings.page`,
`dashboards/{dashboards.page,home,mysql/*,valkey/*,postgresql/vacuumDashboard,operating-system/*}`.

Components (`components/`): dashboard panels only -> `dashboards/panels/{panel,table,gauge,barGauge,
stat,stateTime,text,timeSeries,barTime,polyStat}.component.ts` (+ `index.ts`).
NOTE: `@components/NotificationComponent` referenced by `mappings.md` does NOT exist yet -> create it
on first need (wraps the pop-up/alert verification: `[role="alert"], [role="status"]`).

Interfaces (`interfaces/`): `grafana, grafanaPanel, dashboard, inventory, accessControl, execReturn`.

## 5. Custom step -> Playwright mapping (from custom_steps.js + mappings.md)

- `verifyPopUpMessage(message, t=30)` -> `@components/NotificationComponent` (wait `[role="alert"],[role="status"]`, assert text, close via `[aria-label="Close alert"]`).
- `verifyWarning(message, t=10)` -> assert on `[data-testid="data-testid Alert warning"]`.
- `verifyInvisible(sel, t)` -> `await expect(locator).toBeHidden({ timeout })`.
- `asyncWaitFor(fn, t)` -> `await expect.poll(async () => ..., { timeout })`.
- `getPopUpLocator/getSuccessPopUpLocator/getClosePopUpButtonLocator` -> NotificationComponent locators.
- `downloadZipFile/readZipArchive/seeEntriesInZip/dontSeeEntriesInZip/readFileInZipArchive/getFileLineCount` -> `@helpers/archive.helper.ts` (create if missing; uses `adm-zip`, already a devDependency).
- `buildUrlWithParams(url, params)` -> `@helpers/url.helper.ts` (maps env/node_name/cluster/service_name/application_name/database/columns/from/to/search/page_number/page_size/refresh/metric to `var-*`/query params; defaults from=now-5m,to=now).
- `signOut()` -> `await page.goto('graph/logout')`.
- `cleanupClickhouse()` -> `@helpers/cli.helper.ts`: `docker exec pmm-server clickhouse-client --database pmm --password clickhouse --query "TRUNCATE TABLE metrics"`.
- `seeElementsDisabled/seeElementsEnabled(locator)` -> `expect(locator).toHaveAttribute('disabled', ...)` / `toBeEnabled()`.
- `useDataQA(sel)` -> `getByTestId(sel)`.

## 6. Commands

Run all from `e2e_tests/`:

- Install (first time): `npm ci` then `npx playwright install chromium`.
- TS compile check: `npx tsc --noEmit -p tsconfig.json`.
- Lint: `npx eslint .` (config: `eslint.config.mjs`; arrow functions only, numeric separators, camelCase filenames, no `.skip()`/commented tests).
- Run one migrated test: `npx playwright test tests/<category>/<name>.test.ts`.
- Run by tag: `npx playwright test --grep "@<tag>"`.
- View failure trace: `npx playwright show-trace test-results/<folder>/trace.zip`.
- Env for a run: create `e2e_tests/.env` with `PMM_UI_URL=http://127.0.0.1/`, `ADMIN_PASSWORD=admin`, `HEADLESS=true`, `WORKERS=1`.

## 7. Auth / login

Tests authorize via `grafanaHelper.authorize()` in `pmmTest.beforeEach`. `pmmTest` already mocks
`/v1/users/me` (tour completed) and `/v1/server/updates` (no update) at context level. Basic auth
header helper: `GrafanaHelper.getAuthHeader()`.

For **interactive locator discovery** (browser MCP fallback only), use `.agents/workflows/pmmLogin.md`
— not the UI login form. See section 8.

## 8. Fixing broken locators (trace first, MCP fallback)

When a live run fails on a locator (timeout, not visible, strict mode violation):

| Priority | Tool | When |
| --- | --- | --- |
| 1 | **Playwright trace** | Always try first. Config retains trace on first failure. `npx playwright show-trace <path-to-trace.zip>`. Inspect DOM at the failing step; fix POM; re-run test. |
| 2 | **Browser MCP** | Only if trace is unavailable or target page/iframe not reached. Login per `pmmLogin.md`; navigate to POM `url`; **one** `browser_snapshot`/CDP pass per page; update POM; re-run. Rules: `mcpRules.md`. |

Do not use playwright-cli for migration verification. Do not change test behavior to work around a bad
locator. Max **2** locator-fix loops per run (see `migrationRun.md` Step 7a).

Trace path hint: failures write under `e2e_tests/test-results/`; open the `trace.zip` for the failed test.
