import { Page } from '@playwright/test';
import PanelComponent from './panel.component';

export default class TimeSeriesPanel extends PanelComponent {
  constructor(private page: Page) {
    super();
  }

  private elements = {
    timeSeriesPanelValues: (panelName: string) =>
      this.page.locator(
        `//section[@data-testid="data-testid Panel header ${panelName}"]//button[contains(@class, "LegendLabel")]//ancestor::tr/td[position() >= 2 and position() <= last()]`,
      ),
  };

  public verifyPanelData = async (panelName: string) => {
    await this.verifyData(this.elements.timeSeriesPanelValues(panelName), panelName);
  };
}
