import { expect, Page } from '@playwright/test';

export default class StateTimePanel {
  constructor(private page: Page) {}
  private elements = {
    stateTimeValues: (panelName: string) =>
      this.page.locator(
        `//section[@data-testid="data-testid Panel header ${panelName}"]//div[contains(@class, "LegendItemWrapper")]//button`,
      ),
  };

  public verifyPanelData = async (panelName: string) => {
    await this.elements.stateTimeValues(panelName).first().waitFor({ state: 'visible' });
    const countOfValues = await this.elements.stateTimeValues(panelName).count();

    expect.soft(countOfValues, `Panel: ${panelName} has empty values!`).toBeGreaterThan(0);

    for (let i = 0; i < countOfValues; i++) {
      const text = await this.elements.stateTimeValues(panelName).nth(i).textContent();
      expect.soft(text?.length, `Panel: ${panelName} has empty values!`).toBeGreaterThan(0);
    }
  };
}
