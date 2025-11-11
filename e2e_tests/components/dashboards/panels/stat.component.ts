import { expect, Page } from '@playwright/test';

export default class StatPanel {
  constructor(private page: Page) {}

  private elements = {
    statsPanelValue: (panelName: string) =>
      this.page.locator(
        `//section[@data-testid="data-testid Panel header ${panelName}"]//div[@data-testid="data-testid panel content"]//span`,
      ),
  };

  public verifyPanelData = async (panelName: string) => {
    await expect(this.elements.statsPanelValue(panelName).first()).toBeVisible({ timeout: 10000 });

    const countOfStatElements = await this.elements.statsPanelValue(panelName).count();
    expect.soft(countOfStatElements, `Panel: ${panelName} has empty values!`).toBeGreaterThan(0);

    for (let i = 0; i < countOfStatElements; i++) {
      const text = await this.elements.statsPanelValue(panelName).nth(i).textContent();
      expect.soft(text?.length, `Panel: ${panelName} has empty values!`).toBeGreaterThan(0);
    }
  };
}
