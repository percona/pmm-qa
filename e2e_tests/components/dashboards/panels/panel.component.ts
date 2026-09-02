import { expect, Page } from '@playwright/test';
import { Locator } from 'playwright';
import { Timeouts } from '@helpers/timeouts';

export default class PanelComponent {
  constructor(protected page: Page) {}

  grafanaIframe = () => this.page.frameLocator('//*[@id="grafana-iframe"]');

  protected verifyData = async (locator: Locator, panelName: string, verifyTexts = true) => {
    const target = locator.first();

    await target.first().waitFor({ state: 'visible', timeout: Timeouts.ONE_MINUTE });

    try {
      await target.scrollIntoViewIfNeeded();
    } catch {
      /* ignored */
    }

    if (verifyTexts) {
      const barGaugeTexts = await locator.allTextContents();

      for (const barGaugeText of barGaugeTexts) {
        expect.soft(barGaugeText.length, `Panel: ${panelName} has empty values!`).toBeGreaterThan(0);
      }
    }
  };
}
