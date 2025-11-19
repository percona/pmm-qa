import { Page } from '@playwright/test';
import PanelComponent from './panel.component';

export default class GaugePanel extends PanelComponent {
  constructor(private page: Page) {
    super();
  }

  private elements = {
    gaugePanelValue: (panelName: string) =>
      this.page.locator(
        `//section[@data-testid="data-testid Panel header ${panelName}"]//span[contains(@id, "flotGaugeValue")]`,
      ),
  };

  public verifyPanelData = async (panelName: string) => {
    await this.verifyData(this.elements.gaugePanelValue(panelName), panelName);
  };
}
