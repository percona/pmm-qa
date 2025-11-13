import { expect, Page } from '@playwright/test';

export default class GaugePanel {
  constructor(private page: Page) {}

  private elements = {
    gaugePanelValue: (panelName: string) =>
      this.page.locator(
        `//section[@data-testid="data-testid Panel header ${panelName}"]//span[contains(@id, "flotGaugeValue")]`,
      ),
  };

  public verifyPanelData = async (panelName: string) => {
    await this.elements.gaugePanelValue(panelName).first().waitFor({ state: 'visible' });
    const gaugeTexts = await this.elements.gaugePanelValue(panelName).allTextContents();
    for (const gaugeText of gaugeTexts) {
      expect.soft(parseFloat(gaugeText), `Panel: ${panelName} has empty values!`).toBeGreaterThan(0);
    }
  };
}
