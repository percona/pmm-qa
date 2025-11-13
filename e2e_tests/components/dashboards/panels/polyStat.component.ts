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
    const polyStatTexts = await this.elements.polyStatPanelValue(panelName).allTextContents();
    for (const polyStatText of polyStatTexts) {
      expect.soft(polyStatText.length, `Panel: ${panelName} has empty values!`).toBeGreaterThan(0);
    }
  };
}
