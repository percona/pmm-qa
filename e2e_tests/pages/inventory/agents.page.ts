import BasePage from '../base.page';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';
import { tableDataRows } from '@helpers/tableLocators';

export default class AgentsPage extends BasePage {
  builders = {
    agentDetailsLabel: (label: string) => this.elements.agentDetails.getByText(label, { exact: true }),
    agentRow: (agentType: string) =>
      this.elements.agentRows.filter({ has: this.page.getByRole('cell', { exact: true, name: agentType }) }),
    agentTypeCell: (agentType: string) => this.page.getByRole('cell', { exact: true, name: agentType }),
    selectAgentCheckbox: (agentType: string) =>
      this.builders.agentRow(agentType).getByRole('checkbox', { name: 'Toggle select row' }),
    showAgentDetails: (agentType: string) =>
      this.builders.agentRow(agentType).getByRole('button', { exact: true, name: 'Expand' }),
  };
  buttons = {
    backToNodes: this.page.getByRole('link', { name: 'Go back to nodes' }),
    confirmDelete: this.page.getByTestId('inventory-delete-modal-confirm'),
    delete: this.page.getByTestId('delete-agents-button'),
    goBack: this.page.getByTestId('agents-go-back'),
  };
  elements = {
    agentDetails: this.page.getByTestId('agent-details'),
    agentRows: this.page.locator(tableDataRows),
    agentTypes: this.page.locator(tableDataRows).locator('td:nth-child(4)'),
    rtaAgentStatus: this.page
      .locator(tableDataRows)
      .filter({
        has: this.page.getByRole('cell', { exact: true, name: 'Real-Time Analytics MongoDB agent' }),
      })
      .getByTestId('agent-status-chip'),
    runningStatuses: this.page
      .locator(tableDataRows)
      .filter({
        has: this.page.getByRole('cell', { exact: true, name: 'Running' }),
      })
  };
  inputs = {};
  messages = {};

  deleteAgent = async (agentType: string) => {
    await this.builders.selectAgentCheckbox(agentType).click({ timeout: Timeouts.THIRTY_SECONDS });
    await this.buttons.delete.click();
    await Promise.all([
      this.page.waitForResponse(
        (response) =>
          response.url().includes('/v1/inventory/agents/') && response.request().method() === 'DELETE',
      ),
      this.buttons.confirmDelete.click(),
    ]);
  };

  serviceAgentsUrl = (serviceId: string) => `pmm-ui/inventory/services/${serviceId}/agents`;

  verifyAgentDetailsLabel = async (agentType: string, label: string) => {
    await this.builders.showAgentDetails(agentType).click({ timeout: Timeouts.THIRTY_SECONDS });
    await expect(this.builders.agentDetailsLabel(label)).toBeVisible({ timeout: Timeouts.TEN_SECONDS });
  };

  verifyRTAAgentStatus = async (expectedStatus: string, timeout: Timeouts = Timeouts.TEN_SECONDS) => {
    await expect(async () => {
      await this.page.reload();
      await this.elements.rtaAgentStatus.waitFor({ state: 'visible' });

      await expect(
        this.elements.rtaAgentStatus,
        `Real time analytics agent status is: ${await this.elements.rtaAgentStatus.textContent()} but should be ${expectedStatus}`,
      ).toHaveText(expectedStatus);
    }).toPass({ timeout: timeout });
  };
}
