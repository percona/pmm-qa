import { expect } from '@playwright/test';
import { Locator } from 'playwright';

export default class PanelComponent {
  constructor() {}

  protected verifyData = async (locator: Locator, panelName: string) => {
    await locator.first().waitFor({ state: 'visible' });
    const barGaugeTexts = await locator.allTextContents();
    for (const barGaugeText of barGaugeTexts) {
      expect.soft(barGaugeText.length, `Panel: ${panelName} has empty values!`).toBeGreaterThan(0);
    }
  };
}
