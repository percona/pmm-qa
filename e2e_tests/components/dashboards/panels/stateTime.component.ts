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
    const stateTimeTexts = await this.elements.stateTimeValues(panelName).allTextContents();
    for (const stateTimeText of stateTimeTexts) {
      expect.soft(parseFloat(stateTimeText), `Panel: ${panelName} has empty values!`).toBeGreaterThan(0);
    }
  };
}
