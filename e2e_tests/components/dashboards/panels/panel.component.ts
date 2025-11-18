import { expect } from '@playwright/test';
import { Locator } from 'playwright';
import { Timeouts } from '@helpers/timeouts';

export default class PanelComponent {
  constructor() {}

  protected verifyData = async (locator: Locator, panelName: string) => {
    try {
      await locator.first().scrollIntoViewIfNeeded({ timeout: Timeouts.ONE_SECOND });
    } catch {
      await expect.soft(locator, `Panel: ${panelName} not visible!`).toBeVisible();
    }

    const barGaugeTexts = await locator.allTextContents();
    for (const barGaugeText of barGaugeTexts) {
      expect.soft(barGaugeText.length, `Panel: ${panelName} has empty values!`).toBeGreaterThan(0);
    }
  };
}
