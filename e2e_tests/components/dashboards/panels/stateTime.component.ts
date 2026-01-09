import { Page } from '@playwright/test';
import PanelComponent from './panel.component';

export default class StateTimePanel extends PanelComponent {
  constructor(page: Page) {
    super(page);
  }

  private elements = {
    stateTimeValues: (panelName: string) =>
      this.grafanaIframe().locator(
        `//section[@data-testid="data-testid Panel header ${panelName}"]//div[contains(@class, "LegendItemWrapper")]//button`,
      ),
  };

  public verifyPanelData = async (panelName: string) => {
    await this.verifyData(this.elements.stateTimeValues(panelName), panelName);
  };
}
