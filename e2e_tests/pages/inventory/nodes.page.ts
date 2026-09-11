import BasePage from '../base.page';
import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

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

  verifyHaNodeRoles = async (podNames: string[], leader: string): Promise<void> => {
    for (const podName of podNames) {
      const expectedRole = podName === leader ? 'Leader' : 'Follower';

      await pmmTest.step(`Verify "${podName}" is Up and labelled ${expectedRole}`, async () => {
        await expect(
          this.builders.nodeStatusCell(podName),
          `HA node "${podName}" is running, so the Nodes page must show it Up`,
        ).toHaveText('Up', { timeout: Timeouts.ONE_MINUTE });

        await expect(
          this.builders.nodeRoleLabel(podName),
          `The cluster shows "${leader}" leading, so "${podName}" must be labelled ${expectedRole}`,
        ).toHaveText(expectedRole, { timeout: Timeouts.THIRTY_SECONDS });
      });
    }
  };
}
