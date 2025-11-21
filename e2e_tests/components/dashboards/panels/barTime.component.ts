import { Page } from '@playwright/test';
import PanelComponent from '@components/dashboards/panels/panel.component';

export default class BarTimePanel extends PanelComponent {
  constructor(private page: Page) {
    super();
  }

  private elements = {
    barTimeValues: (panelName: string) =>
      this.page.locator(
        `//section[@data-testid="data-testid Panel header ${panelName}"]//button[contains(@class, "LegendLabel")]`,
      ),
  };

  public verifyPanelData = async (panelName: string) => {
    await this.verifyData(this.elements.barTimeValues(panelName), panelName);
  };
}
