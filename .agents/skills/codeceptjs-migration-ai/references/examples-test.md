# Migration Example: Test File
This file provides a a "Gold Standard" example of a CodeceptJS test migrated to Playwright.

## ❌ Source: `tests/configuration/verifySettings_test.js`
```javascript
Feature('Settings Verification');

Before(async ({ I, settingsAPI }) => {
  await I.Authorize();
  await settingsAPI.restoreSettingsDefaults();
});

Scenario('Verify Public Address @settings', async ({ I, pmmSettingsPage }) => {
  I.amOnPage(pmmSettingsPage.url);
  await pmmSettingsPage.waitForPmmSettingsPageLoaded();
  I.fillField(pmmSettingsPage.fields.publicAddressInput, '1.2.3.4');
  I.click(pmmSettingsPage.fields.applyButton);
  I.verifyPopUpMessage(pmmSettingsPage.messages.successPopUpMessage);
  I.seeInField(pmmSettingsPage.fields.publicAddressInput, '1.2.3.4');
});
```

## ✅ Target: `e2e_tests/tests/configuration/verifySettings.test.ts`
```typescript
import { expect } from '@playwright/test';
import pmmTest from '@fixtures/pmmTest';

pmmTest.beforeEach(async ({ api, grafanaHelper }) => {
  await grafanaHelper.authorize();
  await api.settingsApi.restoreSettingsDefaults();
});

pmmTest('Verify Public Address @settings', async ({ page, settingsPage, notifications }) => {
  await page.goto(settingsPage.url);
  await settingsPage.waitForPmmSettingsPageLoaded();

  await settingsPage.inputs.publicAddress.fill('1.2.3.4');
  await settingsPage.buttons.apply.click();

  await notifications.verifyPopUpMessage(settingsPage.messages.successPopUpMessage);
  await expect(settingsPage.inputs.publicAddress).toHaveValue('1.2.3.4');
});
```

## 🗝️ Key Changes Explained:
1. **Fixtures**: `I` and `settingsAPI` $\rightarrow$ `{ page, settingsPage, api, grafanaHelper, notifications }`.
2. **Navigation**: `I.amOnPage` $\rightarrow$ `page.goto`.
3. **Interactions**: `I.fillField` $\rightarrow$ `.fill()`, `I.click` $\rightarrow$ `.click()` on the same submit/apply control.
4. **Assertions (behavior preserved)**: `I.verifyPopUpMessage(successPopUpMessage)` $\rightarrow$ `notifications.verifyPopUpMessage(...)` (`@components/NotificationComponent`); `I.seeInField` $\rightarrow$ `expect().toHaveValue()`. The success-popup assertion is kept, not swapped for an error-absence check.
5. **Structure**: Wrapped in `pmmTest` for granular reporting. No explanatory comments in the migrated test.
