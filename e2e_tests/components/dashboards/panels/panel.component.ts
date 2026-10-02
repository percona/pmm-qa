import { expect, Page } from '@playwright/test';
import { Locator } from 'playwright';
import { Timeouts } from '@helpers/timeouts';

export default class PanelComponent {
  constructor(protected page: Page) {}

  grafanaIframe = () => this.page.frameLocator('//*[@id="grafana-iframe"]');

  protected verifyData = async (
    locator: Locator,
    panelName: string,
    verifyTexts = true,
    requireEveryValue = true,
  ) => {
    const target = locator.first();

    await target.first().waitFor({ state: 'visible', timeout: Timeouts.ONE_MINUTE });

    try {
      await target.scrollIntoViewIfNeeded();
    } catch {
      /* ignored */
    }

    if (verifyTexts) {
      const values = await locator.allTextContents();

      if (requireEveryValue) {
        for (const value of values) {
          expect.soft(value.length, `Panel: ${panelName} has empty values!`).toBeGreaterThan(0);
        }
      } else {
        const nonEmpty = values.filter((value) => value.trim().length > 0);

        expect.soft(nonEmpty.length, `Panel: ${panelName} has no values!`).toBeGreaterThan(0);
      }
    }
  };
}
