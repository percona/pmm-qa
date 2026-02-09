import PanelComponent from '@components/dashboards/panels/panel.component';

export default class BarGaugePanel extends PanelComponent {
  private elements = {
    barGaugeValues: (panelName: string) =>
      this.grafanaIframe().locator(
        `//section[@data-testid="data-testid Panel header ${panelName}"]//div[contains(@data-testid, "Bar gauge value")]`,
      ),
  };

  verifyPanelData = async (panelName: string) => {
    await this.verifyData(this.elements.barGaugeValues(panelName), panelName);
  };
}
