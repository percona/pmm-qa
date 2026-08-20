import BasePage from '../base.page';

export default class NodesPage extends BasePage {
  readonly url = 'graph/inventory/nodes';
  readonly apiUrl = '';
  builders = {
    nodeNameCell: (nodeName: string) => this.grafanaIframe().locator(`td[title="${nodeName}"]`),
    // The HA role label has no test id, only a generated emotion class.
    nodeRoleLabel: (nodeName: string) => this.builders.nodeNameCell(nodeName).locator('span + div'),
    nodeStatusCell: (nodeName: string) =>
      this.builders.nodeNameCell(nodeName).locator('xpath=../td[starts-with(@title, "STATUS_")]'),
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
