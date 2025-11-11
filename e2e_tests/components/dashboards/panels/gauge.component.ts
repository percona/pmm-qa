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

    const countOfValues = await this.elements.gaugePanelValue(panelName).count();
    expect.soft(countOfValues, `Panel: ${panelName} has empty values!`).toBeGreaterThan(0);

    for (let i = 0; i < countOfValues; i++) {
      const text = await this.elements.gaugePanelValue(panelName).nth(i).textContent();
      expect.soft(text?.length, `Panel: ${panelName} has empty values!`).toBeGreaterThan(0);
    }
  };
}
