# MappingsAI
## Helpers
DoNotMigrateHelpers;MapToExistingPlaywrightHelpers.
`grafana_helper.js`->`@helpers/grafana.helper.ts`;fixture:`grafanaHelper`.
`mongoDB.js`->`@helpers/mongodb.helper.ts`;fixture:`mongoDbHelper`.
`PostgresqlDBHelper`->`@helpers/cli.helper.ts`;RunPsqlViaDockerExec.
`Mailosaur`->npm`mailosaur`.
`apiHelper.js`/`REST`->`@api/api.ts`(e.g.`api.settingsApi.getSettings()`).
`LocalStorageHelper`->`await page.evaluate(() => window.localStorage.setItem(...))`.
`FileHelper`/`FileSystem`->Node`fs`/`path`.
`ChaiWrapper`(`assert`)->`expect()`.
`linksHelper.js`->Inline/POM/`@helpers/apiEndpoints.ts`.
`I.verifyCommand()`->`@helpers/cli.helper.ts`;fixture:`cliHelper`.
`testdata/`->`e2e_tests/testdata/`;LoadVia`fs`Or`cliHelper`.
## CodeceptSyntax
`I.amOnPage(path)`->`await page.goto(path)`.
`I.click(locator)`->`await locator.click()`.
`I.fillField(locator,value)`->`await locator.fill(value)`.
`I.clearField(locator)`->`await locator.clear()`.
`I.attachFile(locator,path)`->`await locator.setInputFiles(path)`.
`I.see(text,locator)`->`await expect(locator).toContainText(text)`.
`I.seeTextEquals(text,locator)`->`await expect(locator).toHaveText(text)`.
`I.dontSeeElement(locator)`->`await expect(locator).toBeHidden()`.
`I.waitForVisible(locator,seconds)`->`await expect(locator).toBeVisible({ timeout })`.
`I.waitForText(text,seconds,locator)`->`await expect(locator).toContainText(text,{ timeout })`.
`I.seeNumberOfElements(locator,n)`->`await expect(locator).toHaveCount(n)`.
`I.grabTextFrom(locator)`->`await locator.textContent()`.
`I.grabTextFromAll(locator)`->`await locator.allTextContents()`.
`I.grabAttributeFrom(locator,attr)`->`await locator.getAttribute(attr)`.
`I.seeAttributesOnElements(locator,{ attr: val })`->`await expect(locator).toHaveAttribute(attr,val)`.
`I.seeCssPropertiesOnElements(locator,{ color: val })`->`const c=await locator.evaluate(el => getComputedStyle(el).color); expect(c).toBe(val)`.
`I.waitForFile(path,t)`/`I.seeFile(path)`->`expect(fs.existsSync(path)).toBe(true)`.
`I.seeInThisFile(text)`->`expect(fs.readFileSync(path,'utf-8')).toContain(text)`.
`tryTo(...)`->ExplicitConditionalLogicOr`try/catch`OnlyWhenIgnoringFailure.

## Custom Steps
`verifyPopUpMessage`/`verifyWarning`->`@components/NotificationComponent`.
`getPopUpLocator`/`getSuccessPopUpLocator`->`@components/NotificationComponent`.
`verifyInvisible`->`expect(locator).toBeHidden()`.
`asyncWaitFor`->`expect.poll()`.
`downloadZipFile`/`readZipArchive`/`seeEntriesInZip`->`@helpers/archive.helper.ts`.
`buildUrlWithParams`->`@helpers/url.helper.ts`.
`signOut`->`page.goto('graph/logout')`.
`cleanupClickhouse`->`@helpers/cli.helper.ts`(via`docker exec`).

## ESLintSuppressions
DisableCommentsRequire`-- reason`.
Timeout:`// eslint-disable-next-line playwright/no-wait-for-timeout -- <reason>`.
POMAssert:`// eslint-disable-next-line playwright/expect-expect -- inside <method> POM`.
Locator:`// eslint-disable-next-line playwright/prefer-locator -- via builder`.
Conditional:`/* eslint-disable playwright/no-conditional-expect -- logic matches source */`...`/* eslint-enable ... */`.
## AuditChecklist
CompareOriginalSkill+SourceTestVsMigrated:Folders/POM/APIPath;Helpers;CodeceptSyntax;Hooks;DataLoops;Tags;Skipped/Retry;URLsInPOM;LocatorSemantics;Assertions;Timeouts;NoComments;LintRules;NoLogicLoss.