import BasePage from '../base.page';

export default class NodesPage extends BasePage {
  readonly url = 'graph/inventory/nodes';
  readonly apiUrl = '';
  builders = {
    showRowDetailsByIndex: (index: string) =>
      this.grafanaIframe().getByTestId('show-row-details').nth(Number(index)),
  };
  buttons = {};
  elements = {
    detailsContent: this.grafanaIframe().getByTestId('details-row-content'),
    runningAgents: this.grafanaIframe().locator('[data-testid^="status-badge"]'),
  };
  inputs = {};
  messages = {};
}
