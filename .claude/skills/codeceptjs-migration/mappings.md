# Mappings

Call-level translation only. `playwright-practices.md` decides the idiom a mapping lands in and lists the modern API to prefer over a literal transliteration.

## Helpers

Do not migrate CodeceptJS helpers; map them to existing Playwright code.

| CodeceptJS | Playwright |
| --- | --- |
| `grafana_helper.js` | `@helpers/grafana.helper.ts`, fixture `grafanaHelper` |
| `mongoDB.js` | `@helpers/mongodb.helper.ts`, fixture `mongoDbHelper` |
| `PostgresqlDBHelper` | `@helpers/cli.helper.ts`, run psql through `docker exec` |
| `Mailosaur` | npm `mailosaur` |
| `apiHelper.js`, `REST` | `@api/api.ts` (`api.settingsApi.getSettings()`) |
| `LocalStorageHelper` | `page.localStorage` / `page.sessionStorage`, not `evaluate` |
| `FileHelper`, `FileSystem` | Node `fs` / `path` |
| `ChaiWrapper` (`assert`) | `expect()` |
| `linksHelper.js` | inline, POM, or `@helpers/apiEndpoints.ts` |
| `testdata/` | `e2e_tests/testdata/`, loaded via `fs` or `cliHelper` |
| `tests/**/pages/api/*API.js` | existing `e2e_tests/api/*.api.ts` via the `api.*Api` fixture, or `new *Api(request)` in `beforeAll` when `page` is unavailable |

`I.verifyCommand()` becomes `cliHelper.execute(command)` (fixture `cliHelper`) with all four source semantics preserved: `.assertSuccess()` for a normal command; `stdout.trim()` when the source consumes the return value; the requested output substring asserted when supplied; for `result='fail'`, a nonzero exit code asserted and `stderr.trim()` when `returnErrorPipe=true`.

A bare or `sudo` `pmm-admin` command from a `setupClient=true` source keeps its arguments and assertions and runs on a host client (`orchestration.md` step 3). Never redirect it into `client_container` or a database container's embedded agent; that changes what the command measures.

`parseInt(versionPart, 10)` becomes `parseInt(versionPart)` for decimal version segments.

## CodeceptSyntax

For a legacy remote-instance test, derive the database container's DNS name, internal port, username and password from the `provisioning/` engine and topology the test selects; both containers sit on the `pmm-qa` network. Never copy the legacy gateway (`192.168.0.1`), host-published port or credentials, and never guess a container name. If the provisioner creates only a loopback account, create a network-accessible test account through the database container in setup and remove it in teardown.

| CodeceptJS | Playwright |
| --- | --- |
| `I.amOnPage(path)` | `await page.goto(path)` |
| `I.click(l)` | `await l.click()` |
| `I.fillField(l, v)` | `await l.fill(v)` |
| `I.clearField(l)` | `await l.clear()` |
| `I.attachFile(l, path)` | `await l.setInputFiles(path)` |
| `I.see(text, l)` | `await expect(l).toContainText(text)` |
| `I.seeTextEquals(text, l)` | `await expect(l).toHaveText(text)` |
| `I.dontSeeElement(l)` | `await expect(l).toBeHidden()` |
| `I.waitForVisible(l, s)`, `I.waitForElement(l, s)` | `await expect(l).toBeVisible({ timeout })`; omit when the same step already acted on `l` (a wait after `clear()`/`fill()` never waits) |
| `I.waitForText(text, s, l)` | `await expect(l).toContainText(text, { timeout })` |
| `I.seeNumberOfElements(l, n)` | `await expect(l).toHaveCount(n)` |
| `I.grabTextFrom(l)` | `await l.textContent()`; when the value feeds an assertion, use `toHaveText`/`toHaveAttribute`/`toHaveJSProperty` instead, a grabbed variable does not retry |
| `I.grabTextFromAll(l)` | `await l.allTextContents()` |
| `I.grabValueFrom(l)` | `await l.inputValue()`; when the value feeds an assertion, `toHaveValue` |
| `I.sendPostRequest(url, body, headers)` | a method on the matching `e2e_tests/api/*.api.ts` client calling `this.request.post(url, { data, headers })`, asserting status or returning the response |
| `I.grabAttributeFrom(l, a)` | `await l.getAttribute(a)` |
| `I.seeAttributesOnElements(l, { a: v })` | `await expect(l).toHaveAttribute(a, v)` |
| `I.seeCssPropertiesOnElements(l, { color: v })` | `await expect(l).toHaveCSS('color', v)`; `{ pseudo: '::before' }` for pseudo-elements |
| `I.waitForFile(path, t)`, `I.seeFile(path)` | `expect(fs.existsSync(path)).toBe(true)` |
| `I.seeInThisFile(text)` | `expect(fs.readFileSync(path, 'utf-8')).toContain(text)` |
| `tryTo(...)` | explicit conditional logic; `try/catch` only when ignoring failure |
| `I.Authorize()` | `grafanaHelper.authorize()` in `pmmTest.beforeEach` |
| `signOut()` | `await page.goto('graph/logout')` |
| `useDataQA(sel)` | `getByTestId(sel)` |
| `seeElementsDisabled(l)`, `seeElementsEnabled(l)` | `expect(l).toHaveAttribute('disabled', ...)` / `toBeEnabled()` |
| `locate('$testid').find('<tag>')` | `getByTestId('testid')` asserted with `toContainText`; under MUI the child tag is multi-match, so the wrapper's text is the target. Narrow to a child testid only when MCP shows the wrapper itself is multi-match |
| `Before` / `After` | `beforeEach` / `afterEach` |
| `BeforeSuite` / `AfterSuite` | `beforeAll` / `afterAll`, which run once per worker under `fullyParallel: true`. Pin once-per-file semantics with a top-level `pmmTest.describe.configure({ mode: 'default' })` or a worker-scoped fixture when the hook is expensive or mutates shared state |
| `I.refreshPage()` | `await page.reload()` |
| `I.seeInField(l, v)`, `I.waitForValue(l, v, s)` | `await expect(l).toHaveValue(v, { timeout })` |
| `I.pressKey(k)` | `await l.press(k)` on the focused locator, else `await page.keyboard.press(k)` |
| `I.moveCursorTo(l)` | `await l.hover()` |
| `I.waitForInvisible(l, s)`, `I.waitForDetached(l, s)` | `await expect(l).toBeHidden({ timeout })` |
| `I.waitForEnabled(l, s)`, `I.waitForClickable(l, s)` | `await expect(l).toBeEnabled({ timeout })` |
| `I.seeInCurrentUrl(part)`, `I.waitInUrl(part, s)` | `await expect(page).toHaveURL(/part/, { timeout })` |
| `I.grabCurrentUrl()` | `page.url()`; assert with `toHaveURL`, not string equality |
| `I.scrollTo(l)` | `await l.scrollIntoViewIfNeeded()`; on a dashboard `loadAllPanels()` replaces `I.scrollPageToBottom()` |
| `I.switchTo(frame)` / `I.switchTo()` | scope the locator through `grafanaIframe()`; the switch back has no counterpart |
| `I.forceClick(l)` | `await l.click({ force: true })`, with the obstruction named in the handoff |
| `I.grabNumberOfVisibleElements(l)` | `await expect(l).toHaveCount(n)` when asserted; `l.filter({ visible: true }).count()` when branched on |
| `I.grabCssPropertyFrom(l, p)` | `await expect(l).toHaveCSS(p, v)` |
| `I.seeCheckboxIsChecked(l)` | `await expect(l).toBeChecked()` |
| `I.isElementDisplayed(l, s)` | `await l.isVisible()` only to branch; never inside `expect` |
| `I.assertEqual(a, b)`, `I.assertTrue(x)`, `I.assertFalse(x)`, `I.assertContain(a, b)`, `I.assertStartsWith(a, b)` | `expect(a, 'why').toBe(b)` / `.toBe(true)` / `.toBe(false)` / `.toContain(b)` / `.toMatch(/^b/)`; never `toBeTruthy()` |
| `I.usePlaywrightTo(title, fn)` | the body inline, it is already Playwright; a `page.route` mock goes through the `mocks` fixture or `page.route` in the test |
| `I.getAuth(user, pass)` | `GrafanaHelper.getAuthHeader()` (`@helpers/grafana.helper.ts`) |
| `I.sendGetRequest`, `I.sendPutRequest`, `I.sendDeleteRequest` | a method on the matching `e2e_tests/api/*.api.ts` client, as for `I.sendPostRequest` |
| `I.createUser(u, p)` | `grafanaHelper.createUser` / `deleteUser`; `I.setRole(id, role)` becomes a method beside them |
| `I.unAuthorize()` | `await page.goto('graph/logout')` |
| `I.pgExecuteQueryOnDemand(query, conn)` | `cliHelper.execute('docker exec <pg-container> psql -U <user> -d <db> -c "<query>"')` |
| `I.mongoConnect`, `I.mongoGetCollection`, `I.mongoDisconnect` | `mongoDbHelper` (`@helpers/mongodb.helper.ts`) |
| `I.stopMockingUpgrade()` | `page.unroute(...)` on the route the `mocks` fixture registered |
| `I.selectGrafanaDropdownOption(name, option)` | `selectVariableValue(name, option)` in `base.page.ts` |
| `I.openNewTab()` | `duplicateCurrentPage()` in `base.page.ts`, or `context.newPage()` |
| `I.assertNotEqual(a, b)`, `I.assertEndsWith(a, b)`, `I.assertEmpty(x)` | `expect(a, 'why').not.toBe(b)` / `.toMatch(/b$/)` / `.toHaveLength(0)` |
| `I.assertDeepMembers(a, b)`, `I.assertDeepIncludeMembers(a, b)` | same set: `expect([...a].sort()).toEqual([...b].sort())`; superset: `expect(a).toEqual(expect.arrayContaining(b))` |
| `I.seeNumberOfVisibleElements(l, n)`, `I.waitNumberOfVisibleElements(l, n, s)` | `await expect(l.filter({ visible: true })).toHaveCount(n, { timeout })` |
| `I.seeElementInDOM(l)`, `I.dontSeeElementInDOM(l)` | `await expect(l).toBeAttached()` / `.not.toBeAttached()` |
| `I.checkOption(l)`, `I.dontSeeCheckboxIsChecked(l)` | `await l.check()`; `await expect(l).not.toBeChecked()` |
| `I.appendField(l, v)` | `await l.press('End'); await l.pressSequentially(v)` |
| `I.doubleClick(l)`, `I.dragAndDrop(a, b)` | `await l.dblclick()`; `await a.dragTo(b)` |
| `I.goBack()` | `await page.goBack()` |
| `I.waitForURL(u)`, `I.seeTitleEquals(t)` | `await expect(page).toHaveURL(u)`; `await expect(page).toHaveTitle(t)` |
| `I.waitForFunction(fn, args, s)` | `await expect.poll(() => page.evaluate(fn, args), { timeout })`; anchored to an element, `locator.waitForFunction()` (1.62) |
| `I.grabCookie(name)` | `(await context.cookies()).find((c) => c.name === name)` |
| `I.switchToNextTab()`, `I.grabNumberOfOpenTabs()`, `I.grabNumberOfTabs()`, `I.openNewTabs(n)`, `I.navigateTabTo(tab, url)` | a link that opens a tab: `const popup = await page.waitForEvent('popup')` around the click, then act on `popup`; tab count: `context.pages().length`; an explicit tab: `context.newPage()` then `goto`. There is no current-tab switch |
| `I.getSingleSelectOptionLocator(text)` | `getByRole('option', { exact: true, name: text })` as a POM builder |
| `I.readClipboard()` | `await context.grantPermissions(['clipboard-read'])` in the test, then `page.evaluate(() => navigator.clipboard.readText())`; headless clipboard is isolated from the OS since 1.62 |
| `I.writeFileSync(path, data)`, `I.fileSize(path)` | Node `fs.writeFileSync(path, data)`; `fs.statSync(path).size` |
| `I.downloadFile(l)` | `const [download] = await Promise.all([page.waitForEvent('download'), l.click()]); await download.path()`, as `helpPage.exportLogs()` does |
| `I.waitForEndPointRequest(endpoint, l)` | `await Promise.all([page.waitForResponse((r) => r.url().includes(endpoint)), l.click()])` |
| `I.setRequestTimeout(ms)` | the `timeout` option on that one `this.request.get/post(url, { timeout })` call in the API client |
| `I.mockServer(url, body)` | `page.route(url, (route) => route.fulfill({ status: 200, body: JSON.stringify(body) }))` scoped with `await using` in the test; a mock reused across tests becomes a method on `@helpers/mocks.helper.ts` beside `mockUpdateAvailable` |
| `I.getPageTimeToLoad()` | `page.evaluate(() => performance.getEntriesByType('navigation')[0].duration)` |
| `I.getMongoClient(p)`, `I.mongoExecuteCommand(cmd, db)`, `I.mongoExecuteAdminCommand(cmd)`, `I.mongoCreateCollection(db, c)`, `I.mongoCreateBulkCollections(db, names)`, `I.mongoCreateBulkCollection`, `I.mongoAddUser(u, p, roles)` | methods on `@helpers/mongodb.helper.ts` beside `dropDatabase` and `ensureCollectionHasDocuments`, sharing its client, one per distinct source call, no `expect` inside |
| `I.clickIfVisible(l, s)` | `if (await l.isVisible()) await l.click();` only when the source's branch is behaviour; otherwise `await l.click()` |

`I.wait(N)`: find the real completion signal first, a network response (`page.waitForResponse`, precedent `e2e_tests/tests/ha/advancedSettings.test.ts`), a state change, or a label change, and assert on it. Two false signals: after a save the input still holds the typed value, and a submit button is disabled both while saving and when the form is pristine after a successful save, so the label returning from "Applying..." is the settle signal, not `toBeEnabled`. Only when no signal exists, keep a fixed pause in a POM or helper with the `no-wait-for-timeout` suppression naming the signals ruled out.

## Custom Steps

Read `codeceptjs-e2e/tests/custom_steps.js` for any step not listed here; map it to `@helpers` or `@components`, never inline into the test.

- `verifyPopUpMessage(message, t=30)`, `verifyWarning(message, t=10)`, `getPopUpLocator`, `getSuccessPopUpLocator`, `getClosePopUpButtonLocator`: the POM's `messages` locator first; create `@components/notification.component.ts` only when reused across pages, and keep it dumb: it exposes the locator and a `close()` method (`[aria-label="Close alert"]`) and does not assert. The `expect(...).toContainText(message)` is written in the test body. When the same message is asserted again later in the test, close the toast first (`[aria-label="Close alert"]`); otherwise the second assertion can pass on the first toast. `verifyWarning` asserts on `[data-testid="data-testid Alert warning"]`.
- Every locator spelled out here is a floor, not a ceiling: `[role="alert"],[role="status"]` is `getByRole('status').or(getByRole('alert'))`. Keep a union via `.or()` unless the surviving role was measured live.
- `verifyInvisible(sel, t)`: `await expect(locator).toBeHidden({ timeout })`.
- `asyncWaitFor(fn, t)`: `await expect.poll(async () => ..., { timeout })`.
- `downloadZipFile`: not a helper. `const res = await request.get(url); const buffer = await res.body();` and pass the buffer to `AdmZip(buffer)`.
- `readZipArchive`, `getFileLineCount`: inline `new AdmZip(path).getEntries().map(({ entryName }) => entryName)` in the test while it has one consumer; move it to `@helpers/archive.helper.ts` at the second. Entry names only: no `getZip` flag or `string[] | AdmZip` return.
- `readFileInZipArchive(zip, file)`: inline `new AdmZip(zip).readAsText(file)`.
- `seeEntriesInZip`, `dontSeeEntriesInZip`: not helpers. Assert on the entry list in the test: `expect(entries).toContain('file.log')` / `not.toContain(...)`.
- `buildUrlWithParams(url, params)`: `@helpers/url.helper.ts` (maps `env`/`node_name`/`cluster`/`service_name`/`application_name`/`database`/`columns`/`from`/`to`/`search`/`page_number`/`page_size`/`refresh`/`metric` to `var-*`/query params; defaults `from=now-5m`, `to=now`).
- `cleanupClickhouse()`: `@helpers/cli.helper.ts`, `docker exec pmm-server clickhouse-client --database pmm --password clickhouse --query "TRUNCATE TABLE metrics"`.

## Skip policy

`xScenario(...)` becomes `pmmTest.skip(title, fn)` with this pairing, the only recognised skip in this repo (precedent: `e2e_tests/tests/configuration/settingsPageElements.test.ts`):

```ts
// TODO: <reactivation condition, naming the ticket>
// eslint-disable-next-line playwright/no-skipped-test -- <ticket> is intentionally skipped for <reason>.
pmmTest.skip(
  '<title>',
  async ({ ... }) => { ... },
);
```

`check-migration-conventions.sh` enforces the pairing and requires the TODO to name a ticket. If the source reason does not fit, stop and report the gap.

A source scenario guarded by a runtime early `return` reports a pass while asserting nothing. Do not port it as an inline conditional `pmmTest.skip(condition, reason)`; `playwright/no-skipped-test` is `error` for `**/*.test.ts`. Port the guard as an auto fixture calling `testInfo.skip(condition, reason)`, as `versionGate` does in `e2e_tests/fixtures/pmmTest.ts`, extending it or adding one beside it. A suppressed inline skip is the last resort, and the handoff says why the fixture route was ruled out.

## ESLint suppressions

- `*.test.ts` contains zero comments, so zero suppressions: refactor, or move the behaviour to a helper, POM, component or API client.
- Outside tests, only targeted `eslint-disable-next-line <rule> -- <reason>`; never block-level `/* eslint-disable */`. Accepted reasons: `playwright/no-wait-for-timeout -- <signal ruled out>`, `playwright/expect-expect -- inside <method> POM`, `playwright/prefer-locator -- via builder`, `playwright/no-conditional-expect -- <reason>`.
- Never suppress `playwright/expect-expect` to silence an `expect` hidden in a helper; move the assertion to the test.
