import PanelComponent from '@components/dashboards/panels/panel.component';

export default class BarGaugePanel extends PanelComponent {
  elements = {
    barGaugeValues: (panelName: string) =>
      this.grafanaIframe().locator(
        `//section[@data-testid="data-testid Panel header ${panelName}"]//div[contains(@data-testid, "Bar gauge value")]`,
      ),
    barWithValue: (panelName: string) =>
      this.grafanaIframe().locator(
        `//section[@data-testid="data-testid Panel header ${panelName}"]//div[@data-testid="data-testid Bar gauge value"]//span[text() > "0"]`,
      ),
  };

  verifyPanelData = async (panelName: string) => {
    await this.verifyData(this.elements.barGaugeValues(panelName), panelName);
  };
}
