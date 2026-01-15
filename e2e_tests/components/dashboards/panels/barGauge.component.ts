import { Page } from '@playwright/test';
import PanelComponent from '@components/dashboards/panels/panel.component';

export default class BarGaugePanel extends PanelComponent {
  constructor(page: Page) {
    super(page);
  }

  private elements = {
    barGaugeValues: (panelName: string) =>
      this.grafanaIframe().locator(
        `//section[@data-testid="data-testid Panel header ${panelName}"]//div[contains(@data-testid, "Bar gauge value")]`,
      ),
  };

  public verifyPanelData = async (panelName: string) => {
    await this.verifyData(this.elements.barGaugeValues(panelName), panelName);
  };
}
