import { expect, Page } from '@playwright/test';

export default class PolyStatPanel {
  constructor(private page: Page) {}

  private elements = {
    polyStatPanelValue: (panelName: string) =>
      this.page.locator(
        `//section[@data-testid="data-testid Panel header ${panelName}"]//*[contains(@class, "valueLabel")]`,
      ),
  };

  public verifyPanelData = async (panelName: string) => {
    await this.elements.polyStatPanelValue(panelName).waitFor({ state: 'visible' });

    const countOfStatElements = await this.elements.polyStatPanelValue(panelName).count();
    expect.soft(countOfStatElements, `Panel: ${panelName} has empty values!`).toBeGreaterThan(0);

    for (let i = 0; i < countOfStatElements; i++) {
      const text = await this.elements.polyStatPanelValue(panelName).nth(i).textContent();
      expect.soft(text?.length, `Panel: ${panelName} has empty values!`).toBeGreaterThan(0);
    }
  };
}
