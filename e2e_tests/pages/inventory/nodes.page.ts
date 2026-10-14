import BasePage from '../base.page';
import InventoryPagination from '@components/inventoryPagination.component';
import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

export default class NodesPage extends BasePage {
  readonly url = 'pmm-ui/inventory/nodes';
  readonly apiUrl = '';
  readonly pagination = new InventoryPagination(this.page);
  builders = {
    monitoringLinkByIndex: (index: number) =>
      this.elements.nodeRows.nth(index).getByTestId('monitoring-status-link'),
    // The HA role chip sits next to the node name
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
    delete: this.page.getByTestId('delete-nodes-button'),
    overrideAlertThresholds: this.page.getByRole('menuitem', { name: 'Override alert thresholds' }),
  };
  elements = {
    // Details of a node, a service or an agent, whichever inventory page is open
    detailsContent: this.page.locator(
      '[data-testid="node-details"], [data-testid="service-details"], [data-testid="agent-details"]',
    ),
    // Material React Table renders a detail panel row after every node row, and skeleton rows while loading
    nodeRows: this.page.locator('tbody tr:not(.Mui-TableBodyCell-DetailPanel):not(:has(.MuiSkeleton-root))'),
    runningAgents: this.page.getByTestId('agents-status-chip').getByRole('link'),
    unauthorized: this.page.getByTestId('unauthorized'),
  };
  inputs = {};
  messages = {
    deleteConfirmation: this.page.getByTestId('inventory-delete-modal-message'),
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
}
