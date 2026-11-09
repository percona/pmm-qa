import BasePage from '../base.page';
import InventoryPagination from '@components/inventoryPagination.component';
import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { tableDataRows } from '@helpers/tableLocators';
import { expect } from '@playwright/test';

export default class NodesPage extends BasePage {
  readonly url = 'pmm-ui/inventory/nodes';
  readonly apiUrl = '';
  readonly pagination = new InventoryPagination(this.page);
  builders = {
    monitoringLinkByIndex: (index: number) =>
      this.elements.nodeRows.nth(index).getByTestId('monitoring-status-link'),
    nodeCheckbox: (nodeName: string) =>
      this.builders.nodeRow(nodeName).getByRole('checkbox', { name: 'Toggle select row' }),
    nodeRoleLabel: (nodeName: string) => this.builders.nodeRow(nodeName).getByTestId('ha-role-chip'),
    nodeRow: (nodeName: string) =>
      this.elements.nodeRows.filter({ has: this.page.getByText(nodeName, { exact: true }) }),
    nodeStatusCell: (nodeName: string) => this.builders.nodeRow(nodeName).getByTestId('status-chip'),
    rowActions: (nodeName: string) =>
      this.builders.nodeRow(nodeName).getByRole('button', { name: 'Row Actions' }),
    showRowDetailsByIndex: (index: string) =>
      this.page.getByRole('button', { exact: true, name: 'Expand' }).nth(Number(index)),
  };
  buttons = {
    confirmDelete: this.page.getByTestId('inventory-delete-modal-confirm'),
    delete: this.page.getByTestId('delete-nodes-button'),
    deleteNode: this.page.getByRole('menuitem', { name: 'Delete' }),
    forceDelete: this.page.getByRole('checkbox', { name: 'Force mode' }),
    overrideAlertThresholds: this.page.getByRole('menuitem', { name: 'Override alert thresholds' }),
  };
  elements = {
    detailsContent: this.page.locator(
      '[data-testid="node-details"], [data-testid="service-details"], [data-testid="agent-details"]',
    ),
    nodeRows: this.page.locator(tableDataRows),
    runningAgents: this.page.getByTestId('agents-status-chip').getByRole('link'),
    unauthorized: this.page.getByTestId('unauthorized'),
  };
  inputs = {};
  messages = {
    deleteConfirmation: this.page.getByTestId('inventory-delete-modal-message'),
  };

  deleteNode = async (nodeName: string) => {
    await this.builders.nodeCheckbox(nodeName).click({ timeout: Timeouts.THIRTY_SECONDS });
    await this.buttons.delete.click();
    await this.buttons.forceDelete.check();
    await Promise.all([
      this.page.waitForResponse(
        (response) =>
          response.url().includes('/v1/inventory/nodes/') && response.request().method() === 'DELETE',
      ),
      this.buttons.confirmDelete.click(),
    ]);
  };

  openAlertThresholds = async (nodeName: string): Promise<void> => {
    await this.builders.rowActions(nodeName).click();
    await this.buttons.overrideAlertThresholds.click();
  };

  verifyAccessDenied = async (): Promise<void> => {
    await expect(this.elements.unauthorized).toContainText('Insufficient access permissions.', {
      timeout: Timeouts.THIRTY_SECONDS,
    });
    await expect(this.elements.nodeRows).toHaveCount(0);
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

  verifyNodeListedOnce = async (nodeName: string): Promise<void> => {
    await this.page.goto(this.url);
    await expect(this.builders.nodeRow(nodeName)).toHaveCount(1, { timeout: Timeouts.THIRTY_SECONDS });
  };
}
