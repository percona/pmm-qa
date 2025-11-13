import { expect, Page } from '@playwright/test';

export default class BarGaugePanel {
  constructor(private page: Page) {}

  private elements = {
    barGaugeValues: (panelName: string) =>
      this.page.locator(
        `//section[@data-testid="data-testid Panel header ${panelName}"]//div[contains(@data-testid, "Bar gauge value")]`,
      ),
  };

  public verifyPanelData = async (panelName: string) => {
    await this.elements.barGaugeValues(panelName).first().waitFor({ state: 'visible' });
    const barGaugeTexts = await this.elements.barGaugeValues(panelName).allTextContents();
    for (const barGaugeText of barGaugeTexts) {
      expect.soft(parseFloat(barGaugeText), `Panel: ${panelName} has empty values!`).toBeGreaterThan(0);
    }
  };
}
