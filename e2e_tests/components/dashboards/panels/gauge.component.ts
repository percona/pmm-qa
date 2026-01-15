import { Page } from '@playwright/test';
import PanelComponent from './panel.component';

export default class GaugePanel extends PanelComponent {
  constructor(page: Page) {
    super(page);
  }

  private elements = {
    gaugePanelValue: (panelName: string) =>
      this.grafanaIframe().locator(
        `//section[@data-testid="data-testid Panel header ${panelName}"]//span[contains(@id, "flotGaugeValue")]`,
      ),
  };

  public verifyPanelData = async (panelName: string) => {
    await this.verifyData(this.elements.gaugePanelValue(panelName), panelName);
  };
}
