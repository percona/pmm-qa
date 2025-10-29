import { expect, Page } from '@playwright/test';

export default class TablePanel {
  constructor(private page: Page) {}

  private elements = {
    tablePanelValue: (panelName: string) =>
      this.page.locator(
        `//section[@data-testid="data-testid Panel header ${panelName}"]//div[@data-testid="data-testid table body"]//div[@role="row"]//div[@role="cell" and position() >= 1 and position() <= last()]`,
      ),
  };

  public verifyPanelData = async (panelName: string) => {
    await this.elements.tablePanelValue(panelName).first().waitFor({ state: 'visible' });

    const countOfValues = await this.elements.tablePanelValue(panelName).count();
    expect.soft(countOfValues, `Panel: ${panelName} has empty values!`).toBeGreaterThan(0);

    for (let i = 0; i < countOfValues; i++) {
      const text = await this.elements.tablePanelValue(panelName).nth(i).textContent();
      expect.soft(text?.length, `Panel: ${panelName} has empty values!`).toBeGreaterThan(0);
    }
  };
}
