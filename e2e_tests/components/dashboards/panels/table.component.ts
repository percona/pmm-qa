import { Page } from '@playwright/test';
import PanelComponent from './panel.component';

export default class TablePanel extends PanelComponent {
  constructor(page: Page) {
    super(page);
  }

  private elements = {
    tablePanelValue: (panelName: string) =>
      this.grafanaIframe().locator(
        `//section[@data-testid="data-testid Panel header ${panelName}"]//div[@data-testid="data-testid table body"]//div[@role="row"]//div[@role="cell" and position() >= 1 and position() <= last()]`,
      ),
  };

  public verifyPanelData = async (panelName: string) => {
    await this.verifyData(this.elements.tablePanelValue(panelName), panelName);
  };
}
