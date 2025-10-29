import { expect, Page } from '@playwright/test';

export default class SingleStatPanel {
  constructor(private page: Page) {}

  private elements = {
    singleStatsPanelValue: (panelName: string) =>
      this.page.locator(
        `//section[@data-testid="data-testid Panel header ${panelName}"]//div[@data-testid="data-testid panel content"]//div[text()="OK"]`,
      ),
  };

  public verifyPanelData = async (panelName: string) => {
    await this.elements.singleStatsPanelValue(panelName).waitFor({ state: 'visible' });

    const countOfStatElements = await this.elements.singleStatsPanelValue(panelName).count();
    expect.soft(countOfStatElements, `Panel: ${panelName} has empty values!`).toBeGreaterThan(0);
  };
}
