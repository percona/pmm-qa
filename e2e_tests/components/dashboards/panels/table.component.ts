import PanelComponent from './panel.component';

export default class TablePanel extends PanelComponent {
  private elements = {
    tablePanelValue: (panelName: string) =>
      this.grafanaIframe().locator(
        `//section[@data-testid="data-testid Panel header ${panelName}"]//div[@role="grid"]//div[@role="row"]//div[@role="gridcell" and position() >= 1 and position() <= last()]`,
      ),
  };

  verifyPanelData = async (panelName: string) => {
    await this.verifyData(this.elements.tablePanelValue(panelName), panelName);
  };
}
