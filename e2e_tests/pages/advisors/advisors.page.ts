import BasePage from '../base.page';

export default class AdvisorsPage extends BasePage {
  configurationUrl = 'pmm-ui/graph/advisors/configuration';
  builders = {
    advisorIntervalValue: (advisorName: string) => this.grafanaIframe().locator(`//*[text()="${advisorName}"]/parent::tr//td[position()="5"]`),
    advisorsChangeInterval: (advisorName: string) =>
      this.grafanaIframe().locator(
        `//*[text()="${advisorName}"]/parent::tr//td[position()="6"]//button[@title="Change check interval"]`,
      ),
    advisorsGroupHeader: (groupName: string) =>
      this.grafanaIframe().locator(`//*[text()="${groupName}"]/parent::*/parent::*`),
    changeIntervalValue: (advisorValue: string) =>
      this.grafanaIframe().locator(`//label[text()="${advisorValue}"]`),
    disableAdvisor: (advisorName: string) =>
      this.grafanaIframe().locator(
        `//*[text()="${advisorName}"]/parent::tr//td[position()="6"]//button[@data-testid="check-table-loader-button"]//span`,
      ),
  };
  buttons = {
    saveInterval: this.grafanaIframe().locator('//button[@data-testid="change-check-interval-modal-save"]'),
  };
  elements = {};
  inputs = {};
  messages = {};
}
