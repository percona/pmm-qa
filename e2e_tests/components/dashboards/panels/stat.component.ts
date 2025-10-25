import { expect, Page } from '@playwright/test';

export default class StatPanel {
  constructor(private page: Page) {}

  private elements = {
    statsPanelValue: (panelName: string) =>
      this.page.locator(
        `//section[contains(@data-testid, "${panelName}")]//div[@data-testid="data-testid panel content"]//span`,
      ),
  };

  public verifyPanelData = async (panelName: string) => {
    await this.elements.statsPanelValue(panelName).waitFor({ state: 'visible' });

    const countOfStatElements = await this.elements.statsPanelValue(panelName).count();
    expect.soft(countOfStatElements, `Panel: ${panelName} has empty values!`).toBeGreaterThan(0);

    const value = await this.elements.statsPanelValue(panelName).textContent();
    expect.soft(value?.length, `Panel: ${panelName} has empty values!`).toBeGreaterThan(0);
  };
}
