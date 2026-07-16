# Migration Example: API/CLI-only Test (no POM)
This file provides a "Gold Standard" example for a CodeceptJS test with no UI interaction —
pure API calls and/or CLI commands. Use this instead of `examples-test.md` when the source
test has no `I.amOnPage` / `I.click` / page-object usage. Do NOT invent a POM for these.

## ❌ Source: `tests/qa-integration/pmm_pdpgsql_integration_test.js`
```javascript
Feature('PDPGSQL Integration');

Before(async ({ I }) => {
  await I.Authorize();
});

Scenario('Verify pdpgsql service registered @not-ui-pipeline', async ({ I, inventoryAPI, cliHelper }) => {
  const services = await inventoryAPI.getServicesList();
  I.assertTrue(services.some(s => s.service_type === 'POSTGRESQL_SERVICE'));

  const out = await I.verifyCommand('pmm-admin list');
  I.assertContains(out, 'POSTGRESQL_SERVICE');
});
```

## ✅ Target: `e2e_tests/tests/integration/pdpgsql.test.ts`
```typescript
import { expect } from '@playwright/test';
import pmmTest from '@fixtures/pmmTest';

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest('Verify pdpgsql service registered @not-ui-pipeline', async ({ api, cliHelper }) => {
  const services = await api.inventoryApi.getServicesList();
  expect(services.some((s) => s.service_type === 'POSTGRESQL_SERVICE')).toBe(true);

  const out = await cliHelper.exec('pmm-admin list');
  expect(out).toContain('POSTGRESQL_SERVICE');
});
```

## 🗝️ Key Changes Explained:
1. **No POM created**: the source never calls `I.amOnPage`/`I.click`/a page fixture, so the migration stays API+CLI only. Creating a `*.page.ts` here would violate `SKILL.md`'s "no invented coverage" rule by adding unused surface area.
2. **Fixtures**: `I`, `inventoryAPI`, `cliHelper` → `{ api, cliHelper }` from `pmmTest` (reuse `context.md` §4 registered fixtures — do not re-register `inventoryApi` or `cliHelper`, they already exist).
3. **Assertions**: `I.assertTrue(...)` → `expect(...).toBe(true)`; `I.assertContains(...)` → `expect(...).toContain(...)`.
4. **CLI**: `I.verifyCommand(cmd)` → `cliHelper.exec(cmd)` (see `mappings.md` Helpers).
5. **Tag preserved** exactly in the title string (`@not-ui-pipeline`), same as the UI example.
6. **Target selection**: this still goes through the best-fit check in `context.md` §2a before creating `tests/integration/pdpgsql.test.ts` — only create new if no existing integration test file already covers pdpgsql.
