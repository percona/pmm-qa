# Migration Example: Page Object Model (POM)
This file provides a "Gold Standard" example of a CodeceptJS POM migrated to the Playwright BasePage structure.

## ❌ Source: `tests/pages/pmmSettingsPage.js`
```javascript
module.exports = {
  url: '/pmm-ui/settings',
  fields: {
    publicAddressInput: '$publicAddress-text-input',
    applyButton: 'button[type="submit"]',
  },
  async applyChanges() {
    I.click(this.fields.applyButton);
    I.verifyPopUpMessage(this.messages.successPopUpMessage, 30);
  },
};
```

## ✅ Target: `e2e_tests/pages/ha/settings.page.ts`
```typescript
import BasePage from '../base.page';
import pmmTest from '../../fixtures/pmmTest';
import { expect } from '@playwright/test';

export default class SettingsPage extends BasePage {
  url = '/pmm-ui/settings';

  buttons = {
    applyAdvancedChanges: this.page.getByTestId('advanced-button'),
  };

  inputs = {
    publicAddress: this.page.getByTestId('text-input-public-address'),
  };

  async applyChanges(): Promise<void> {
    await pmmTest.step('Apply changes', async () => {
      await this.buttons.apply.click();
      await this.notifications.verifyPopUpMessage(this.messages.successPopUpMessage, Timeouts.THIRTY_SECONDS);
    });
  }
}
```

## 🗝️ Key Changes Explained:
1. **Class Structure**: Changed from a plain object to a class extending `BasePage`.
2. **Locators**: `$` shorthand $\rightarrow$ `this.page.getByTestId()`.
3. **Categorization**: Fields are now split into `buttons`, `inputs`, `elements`, and `urls` as per the project shape.
4. **Steps**: Logic is now wrapped in `pmmTest.step` for better reporting in Playwright.
5. **Behavior preserved**: `I.verifyPopUpMessage(successPopUpMessage, 30)` is kept via `@components/NotificationComponent`, not replaced by an error-absence check.
6. **Types**: Added TypeScript return types (`Promise<void>`).
