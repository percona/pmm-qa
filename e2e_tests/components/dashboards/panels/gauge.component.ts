import PanelComponent from './panel.component';

export default class GaugePanel extends PanelComponent {
  private elements = {
    gaugePanelValue: (panelName: string) =>
      this.grafanaIframe().locator(
        `//section[@data-testid="data-testid Panel header ${panelName}"]//span[contains(@id, "flotGaugeValue")]`,
      ),
  };

  async verifyPanelData(panelName: string) {
    await this.verifyData(this.elements.gaugePanelValue(panelName), panelName);
  }
}
