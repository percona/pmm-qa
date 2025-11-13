import { Page } from '@playwright/test';
import PanelComponent from './panel.component';

export default class StatPanel extends PanelComponent {
  constructor(private page: Page) {
    super();
  }

  private elements = {
    statsPanelValue: (panelName: string) =>
      this.page.locator(
        `//section[@data-testid="data-testid Panel header ${panelName}"]//div[@data-testid="data-testid panel content"]//span`,
      ),
  };

  public verifyPanelData = async (panelName: string) => {
    await this.verifyData(this.elements.statsPanelValue(panelName), panelName);
  };
}
