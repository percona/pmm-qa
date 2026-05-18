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
    await this.verifyData(this.elements.tablePanelValue(panelName), panelName);
  };
}
