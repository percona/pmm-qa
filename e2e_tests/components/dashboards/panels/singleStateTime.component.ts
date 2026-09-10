import PanelComponent from './panel.component';

export default class SingleStateTimePanel extends PanelComponent {
  private elements = {
    stateTimeValues: (panelName: string) =>
      this.grafanaIframe()
        .locator(
          `//section[@data-testid="data-testid Panel header ${panelName}"]//div[@data-testid="uplot-main-div"]//div[@class="u-axis"]`,
        )
        .first(),
  };

  verifyPanelData = async (panelName: string) => {
    await this.verifyData(this.elements.stateTimeValues(panelName), panelName);
  };
}
