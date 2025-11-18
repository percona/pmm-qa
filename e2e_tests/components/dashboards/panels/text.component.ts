import { Page } from '@playwright/test';
import PanelComponent from './panel.component';

export default class TextPanel extends PanelComponent {
  constructor(private page: Page) {
    super();
  }

  private elements = {
    statsPanelValue: (panelName: string) =>
      this.page.locator(
        `//section[@data-testid="data-testid Panel header ${panelName}"]//*[self::h3 or self::h5]`,
      ),
  };

  public verifyPanelData = async (panelName: string) => {
    await this.verifyData(this.elements.statsPanelValue(panelName), panelName);
  };
}
