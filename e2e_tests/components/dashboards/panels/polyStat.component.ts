import PanelComponent from './panel.component';

export default class PolyStatPanel extends PanelComponent {
  private elements = {
    polyStatPanelValue: (panelName: string) =>
      this.grafanaIframe().locator(
        `//section[@data-testid="data-testid Panel header ${panelName}"]//*[contains(@class, "valueLabel")]`,
      ),
  };

  async verifyPanelData(panelName: string) {
    await this.verifyData(this.elements.polyStatPanelValue(panelName), panelName);
  }
}
