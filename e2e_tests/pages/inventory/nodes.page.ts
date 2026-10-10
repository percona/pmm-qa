import BasePage from '../base.page';
import InventoryPagination from '@components/inventoryPagination.component';
import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

export default class NodesPage extends BasePage {
  readonly url = 'graph/inventory/nodes';
  readonly apiUrl = '';
  readonly pagination = new InventoryPagination(this.grafanaIframe());
  builders = {
    monitoringLinkByIndex: (index: number) =>
      this.grafanaIframe()
        .locator('tbody')
        .getByTestId('table-tbody-tr')
        .nth(index)
        .locator('xpath=td[5]//a'),
    nodeNameCell: (nodeName: string) => this.grafanaIframe().locator(`td[title="${nodeName}"]`),
    // The HA role label has no test id, only a generated emotion class.
    nodeRoleLabel: (nodeName: string) => this.builders.nodeNameCell(nodeName).locator('span + div'),
    nodeRow: (nodeName: string) =>
      this.elements.nodeRows.filter({ has: this.builders.nodeNameCell(nodeName) }),
    nodeStatusCell: (nodeName: string) =>
      this.builders.nodeNameCell(nodeName).locator('xpath=../td[starts-with(@title, "STATUS_")]'),
    rowActions: (nodeName: string) => this.builders.nodeRow(nodeName).getByTestId('dropdown-menu-toggle'),
    showRowDetailsByIndex: (index: string) =>
      this.grafanaIframe().getByTestId('show-row-details').nth(Number(index)),
  };
  buttons = {
    delete: this.grafanaIframe().getByRole('button', { exact: true, name: 'Delete' }),
    overrideAlertThresholds: this.grafanaIframe()
      .getByTestId('dropdown-button')
      .filter({ hasText: 'Override alert thresholds' }),
  };
  elements = {
    detailsContent: this.grafanaIframe().getByTestId('details-row-content'),
    nodeRows: this.grafanaIframe().locator('tbody').getByTestId('table-tbody-tr'),
    runningAgents: this.grafanaIframe().locator('[data-testid^="status-badge"]'),
    unauthorized: this.grafanaIframe().getByTestId('unauthorized'),
  };
  inputs = {};
  messages = {
    deleteConfirmation: this.grafanaIframe().getByRole('dialog').getByRole('heading', { level: 4 }),
  };

  openAlertThresholds = async (nodeName: string): Promise<void> => {
    await this.builders.rowActions(nodeName).click();
    await this.buttons.overrideAlertThresholds.click();
  };

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
