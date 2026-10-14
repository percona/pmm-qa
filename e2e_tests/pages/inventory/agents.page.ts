import BasePage from '../base.page';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';
import { tableDataRows } from '@helpers/tableLocators';

export default class AgentsPage extends BasePage {
  builders = {
    agentTypeCell: (agentType: string) => this.page.getByRole('cell', { exact: true, name: agentType }),
  };
  buttons = {
    backToNodes: this.page.getByRole('link', { name: 'Go back to nodes' }),
    goBack: this.page.getByTestId('agents-go-back'),
  };
  elements = {
    agentRows: this.page.locator(tableDataRows),
    agentTypes: this.page.locator(tableDataRows).locator('td:nth-child(4)'),
    rtaAgentStatus: this.page
      .locator(tableDataRows)
      .filter({
        has: this.page.getByRole('cell', { exact: true, name: 'Real-Time Analytics MongoDB agent' }),
      })
      .getByTestId('agent-status-chip'),
  };
  inputs = {};
  messages = {};

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
