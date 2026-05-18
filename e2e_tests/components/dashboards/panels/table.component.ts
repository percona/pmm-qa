import PanelComponent from './panel.component';

export default class TablePanel extends PanelComponent {
  private elements = {
    tablePanelValue: (panelName: string) =>
      this.grafanaIframe().locator(
        `//section[@data-testid="data-testid Panel header ${panelName}"]//div[@data-testid="data-testid table body"]//div[@role="row"]//div[@role="cell" and position() >= 1 and position() <= last()] | //section[@data-testid="data-testid Panel header ${panelName}"]//div[@data-testid="data-testid panel content"]//*[@role="grid"]//*[@role="row" and @aria-rowindex > 1]//*[@role="gridcell"]`,
      ),
  };

  verifyPanelData = async (panelName: string) => {
    await this.verifyData(this.elements.tablePanelValue(panelName), panelName);
  };
}
