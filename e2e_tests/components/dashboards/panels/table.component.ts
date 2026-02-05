import PanelComponent from './panel.component';

export default class TablePanel extends PanelComponent {
  private elements = {
    tablePanelValue: (panelName: string) =>
      this.grafanaIframe().locator(
        `//section[@data-testid="data-testid Panel header ${panelName}"]//div[@data-testid="data-testid table body"]//div[@role="row"]//div[@role="cell" and position() >= 1 and position() <= last()]`,
      ),
  };

  async verifyPanelData(panelName: string) {
    await this.verifyData(this.elements.tablePanelValue(panelName), panelName);
  }
}
