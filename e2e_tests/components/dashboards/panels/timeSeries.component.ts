import { Page } from '@playwright/test';
import PanelComponent from './panel.component';

export default class TimeSeriesPanel extends PanelComponent {
  constructor(page: Page) {
    super(page);
  }

  private elements = {
    timeSeriesPanelValues: (panelName: string) =>
      this.grafanaIframe().locator(
        `//section[@data-testid="data-testid Panel header ${panelName}"]//button[contains(@class, "LegendLabel")]//ancestor::tr/td[position() >= 2 and position() <= last()]`,
      ),
  };

  public verifyPanelData = async (panelName: string) => {
    await this.verifyData(this.elements.timeSeriesPanelValues(panelName), panelName);
  };
}
