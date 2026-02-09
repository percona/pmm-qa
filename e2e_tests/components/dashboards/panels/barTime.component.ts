import PanelComponent from '@components/dashboards/panels/panel.component';

export default class BarTimePanel extends PanelComponent {
  private elements = {
    barTimeValues: (panelName: string) =>
      this.grafanaIframe().locator(
        `//section[@data-testid="data-testid Panel header ${panelName}"]//button[contains(@class, "LegendLabel")]`,
      ),
  };

  verifyPanelData = async (panelName: string) => {
    await this.verifyData(this.elements.barTimeValues(panelName), panelName);
  };
}
