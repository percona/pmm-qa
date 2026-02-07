import PanelComponent from './panel.component';

export default class StateTimePanel extends PanelComponent {
  private elements = {
    stateTimeValues: (panelName: string) =>
      this.grafanaIframe().locator(
        `//section[@data-testid="data-testid Panel header ${panelName}"]//div[contains(@class, "LegendItemWrapper")]//button`,
      ),
  };

  verifyPanelData = async (panelName: string) => {
    await this.verifyData(this.elements.stateTimeValues(panelName), panelName);
  };
}
