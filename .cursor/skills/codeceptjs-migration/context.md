# Migration Context Pack

Read this FIRST on every daily run. It exists so the run does not re-scan the whole repo
(~73 CodeceptJS POM/API/custom-step files + ~93 `e2e_tests` files). Per-run reads should be
bounded to: this file + `tracker.md` + the one source test + its specific POMs/API + the
target registration files listed under "Registration points".

Regenerate the inventory / mapping sections when repo structure or the CI matrix changes.

## 1. Provisioning (how server + client instances are set up)

The canonical provisioning path for migration live runs is `.cursor/scripts/run-migration-single-test.sh` from repo root. The script starts Docker, creates the `pmm-qa` network and `pmm-volume`, starts PMM Server with `e2e_tests/docker-compose.yml` and fixed image `perconalab/pmm-server:3-dev-latest`, optionally attaches a standalone PMM Client, optionally runs `pmm-framework.py`, and then runs exactly one Playwright file.

The script arguments are:

```bash
./.cursor/scripts/run-migration-single-test.sh '<tests/file.test.ts>' '<setup_services>' <setup_client>
```

- `<tests/file.test.ts>` is relative to `e2e_tests/`.
- `<setup_services>` is the tracker `Setup` value, or an empty string when no DB/service provisioning is needed.
- `<setup_client>` is `true` only for a standalone PMM Client/node outside `pmm-framework.py` provisioning. Use `false` for pure UI tests and for DB/service tests where `pmm-framework.py` creates monitored services.

Server image is fixed to `perconalab/pmm-server:3-dev-latest`. Default password is `ADMIN_PASSWORD=admin-password`; the script uses it consistently for PMM readiness, PMM Client setup, `pmm-framework.py`, and Playwright. Override `ADMIN_PASSWORD=...` only when intentionally testing a different password. PMM UI base URL is `http://127.0.0.1/`.

The basis for `setup_services` is the test's tag mapped to the CI setup matrix in `.github/workflows/e2e-tests-matrix.yml` and `.github/workflows/runner-e2e-tests-codeceptjs.yml`. Where a test's tag is not in the matrix, derive the flags by reading the source test and matching a setup key from `qa-integration/README.md`.

`pmm-framework.py` REQUIRES an already-running PMM server (the script provides this). Args include `--database` (repeatable), `--pmm-server-ip`, `--pmm-server-password`, `--client-version`, `--verbose`, and `--client-debug`.

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

For tests with no DB dependency (pure UI/navigation/help/tour), pass an empty `setup_services` string. Use `setup_client=true` only when the source test needs a standalone client/node.

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

### 1f. Branch strategy (instructions vs merge)

| Branch | Role | What commits land here |
| --- | --- | --- |
| `PMM-7-codeceptjs-migration` | Instructions & tracking | `.cursor/skills/codeceptjs-migration/**`, `.cursor/scripts/**`, tracker row updates |
| `main` | Production | `e2e_tests/**`, Codecept `*_migrated.js` renames, new helpers/API/POMs |

**Every daily run:**

1. `git fetch origin main PMM-7-codeceptjs-migration`
2. Read tracker + skills from `PMM-7-codeceptjs-migration` (instructions source of truth).
3. Branch from **`main`** for test code (`migrate-<category>-<name>`). Do **not** branch migrate PRs from PMM-7.
4. Open per-test PRs with **base `main`** (`gh pr create --base main ...`). PR scope: `e2e_tests/**` + Codecept renames only — **no** `.cursor/**`.
5. Push tracker/docs updates to **`PMM-7-codeceptjs-migration`** separately (second commit/push on that branch).

Never use PMM-7 as the PR base for migrated test code.

## 2. Repo map (source -> target)

| CodeceptJS source | Playwright target |
| --- | --- |
| `codeceptjs-e2e/tests/<category>/*_test.js` | best-fit existing `e2e_tests/tests/**/*.test.ts` (see §2a) |
| `codeceptjs-e2e/tests/<category>/*_migrated.js` | already migrated; reference only — not run by Codecept CI |
| `codeceptjs-e2e/tests/**/pages/*.js` (POMs) | `e2e_tests/pages/<category>/*.page.ts` |
| `codeceptjs-e2e/tests/**/pages/api/*.js` (API) | `e2e_tests/api/*.api.ts` |
| `codeceptjs-e2e/tests/custom_steps.js` | `@helpers/*` or `@components/*` (see section 5) |
| `codeceptjs-e2e/testdata/` | `e2e_tests/testdata/` |

### 2a. Best-fit placement (prefer existing Playwright files)

Before creating a new `e2e_tests/tests/**/*.test.ts`, match on **behavior**, not the Codecept filename:

| Source behavior | Typical best-fit target |
| --- | --- |
| Help page (`pmm-ui/help`), export logs, docs/forum links | `tests/helpCenter.test.ts` |
| Left menu collapse, menu traversal, time-range persistence | `tests/navigation.test.ts` |
| QAN RTA flows | `tests/qan/rta/*.test.ts` |
| Inventory services/agents | `tests/inventory/*.test.ts` |
| Valkey dashboards | `tests/dashboards/valkey/valkeyDashboards.test.ts` |

Append migrated scenarios to the best-fit file when hooks/fixtures align. Create a new test file only when no suitable target exists. Update the tracker `Target` column to the actual path used.

### 2b. Post-migration source rename

After live run **PASS**, rename the Codecept source so CI no longer picks it up:

- `foo_test.js` → `foo_migrated.js` (same directory; `git mv`)
- Codecept glob `tests/**/*_test.js` excludes `*_migrated.js`

Pending tracker rows still list `*_test.js` paths. Done rows should list `*_migrated.js`.

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

- `verifyPopUpMessage(message, t=30)` -> `@components/NotificationComponent`. Keep the component dumb: it should expose the locator (`[role="alert"],[role="status"]`) and a `close()` method (`[aria]`), assert text, close via (`[aria-label="Close alert"]`). The `expect(componet.message).toContainText(message)` MUST be written inline in the test. Do not hide `expect(()` inside the component.
- `verifyWarning(message, t=10)` -> assert on `[data-testid="data-testid Alert warning"]`.
- `verifyInvisible(sel, t)` -> `await expect(locator).toBeHidden({ timeout })`.
- `asyncWaitFor(fn, t)` -> `await expect.poll(async () => ..., { timeout })`.
- `getPopUpLocator/getSuccessPopUpLocator/getClosePopUpButtonLocator` -> NotificationComponent locators.
- `downloadZipFile` -> Do NOT port. Use playwright's `const res = await request.get(url); const buffer = await res.body();` Pass the buffer directly to `AdmZip(buffer)` rather than writing to disk.
- `readZipArchive/readFileInZipArchive/getFileLineCount` -> `@helpers/archive.helper.ts` (create if missing; uses `adm-zip`). **`readZipArchive` and `getFileLineCount` are reusable utilities** `seeEntriesInZip/dontSeeEntriesInZip` are thin `expect()` wrappers: do NOT put them in the helper. Write the assertion loop inline in the test using `readZipArchive` directly (e.g. `const entries = readZipArchive(pathOrBuffer); expect(entries.tocontain('file.log);`). Hiding `expect` in a helper violates the `NoExpectsInHelpers` rules and triggers the `playwright/expect-expect` lint error - never use `eslint-disable` to supress it; refactor instead.
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
- Run one migrated test with provisioning: from repo root, `./.cursor/scripts/run-migration-single-test.sh 'tests/<category>/<name>.test.ts' '<setup_services>' <setup_client>`.
- Run by tag: `npx playwright test --grep "@<tag>"`.
- View failure trace: `npx playwright show-trace test-results/<folder>/trace.zip`.
- The script exports `PMM_UI_URL=http://127.0.0.1/`, `ADMIN_PASSWORD=${ADMIN_PASSWORD:-admin-password}`, `HEADLESS=true`, and `WORKERS=1`.

## 7. Auth / login

Tests authorize via `grafanaHelper.authorize()` in `pmmTest.beforeEach`. `pmmTest` already mocks
`/v1/users/me` (tour completed) and `/v1/server/updates` (no update) at context level. Basic auth
header helper: `GrafanaHelper.getToken()`.

For **interactive locator discovery** (browser MCP fallback only), shared workflow docs remain under `.agents/workflows/`; use `.agents/workflows/pmmLogin.md`
— not the UI login form. See section 8.

## 8. Fixing broken locators (trace first, MCP fallback)

When a live run fails on a locator (timeout, not visible, strict mode violation):

| Priority | Tool | When |
| --- | --- | --- |
| 1 | **Playwright trace** | Always try first. Config retains trace on first failure. `npx playwright show-trace <path-to-trace.zip>`. Inspect DOM at the failing step; fix POM; re-run test. |
| 2 | **Browser MCP** | Only if trace is unavailable or target page/iframe not reached. Login per `pmmLogin.md`; navigate to POM `url`; **one** `browser_snapshot`/CDP pass per page; update POM; re-run. Rules: `mcpRules.md`. |

Do not use playwright-cli for migration verification. Do not change test behavior to work around a bad
locator. Max **2** locator-fix loops per run (see `run.md` Step 7a).

Trace path hint: failures write under `e2e_tests/test-results/`; open the `trace.zip` for the failed test.
