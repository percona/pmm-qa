import { expect, Page } from '@playwright/test';
import { Locator } from 'playwright';
import { Timeouts } from '@helpers/timeouts';

export default class PanelComponent {
  constructor(protected page: Page) {}

  grafanaIframe() {
    return this.page.frameLocator('//*[@id="grafana-iframe"]');
  }

  protected async verifyData(locator: Locator, panelName: string) {
    const target = locator.first();

    await target.waitFor({ state: 'visible', timeout: Timeouts.ONE_MINUTE });
    await target.scrollIntoViewIfNeeded();

    const barGaugeTexts = await locator.allTextContents();

    for (const barGaugeText of barGaugeTexts) {
      expect.soft(barGaugeText.length, `Panel: ${panelName} has empty values!`).toBeGreaterThan(0);
    }
  }
}
