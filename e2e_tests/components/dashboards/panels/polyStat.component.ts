import { Page } from '@playwright/test';
import PanelComponent from './panel.component';

export default class PolyStatPanel extends PanelComponent {
  constructor(page: Page) {
    super(page);
  }

  private elements = {
    polyStatPanelValue: (panelName: string) =>
      this.grafanaIframe().locator(
        `//section[@data-testid="data-testid Panel header ${panelName}"]//*[contains(@class, "valueLabel")]`,
      ),
  };

  public verifyPanelData = async (panelName: string) => {
    await this.verifyData(this.elements.polyStatPanelValue(panelName), panelName);
  };
}
