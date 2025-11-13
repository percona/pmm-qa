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
    const statTexts = await this.elements.statsPanelValue(panelName).allTextContents();
    console.log(`statTexts are: ${statTexts}`);
    for (const statText of statTexts) {
      expect.soft(statText.length, `Panel: ${panelName} has empty values!`).toBeGreaterThan(0);
    }
  };
}
