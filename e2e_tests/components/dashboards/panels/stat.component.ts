import PanelComponent from './panel.component';

export default class StatPanel extends PanelComponent {
  private elements = {
    statsPanelValue: (panelName: string) =>
      this.grafanaIframe().locator(
        `//section[@data-testid="data-testid Panel header ${panelName}"]//div[@data-testid="data-testid panel content"]//span`,
      ),
  };

  async verifyPanelData(panelName: string) {
    await this.verifyData(this.elements.statsPanelValue(panelName), panelName);
  }
}
