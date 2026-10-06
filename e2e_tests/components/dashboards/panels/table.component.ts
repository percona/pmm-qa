import PanelComponent from './panel.component';

export default class TablePanel extends PanelComponent {
  private elements = {
    tablePanelValue: (panelName: string) =>
      this.grafanaIframe()
        .getByTestId(`data-testid Panel header ${panelName}`)
        .getByTestId('data-testid panel content')
        .getByRole('grid')
        .getByRole('gridcell'),
  };

  verifyPanelData = async (panelName: string) => {
    // Grafana tables can include a "Total" footer row whose non-aggregated label
    // columns (e.g. Collection Name) are legitimately empty, so require the table to
    // contain data rather than every single cell being non-empty.
    await this.verifyData(this.elements.tablePanelValue(panelName), panelName, true, false);
  };
}
