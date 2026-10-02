import BasePage from '../base.page';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

export default class AgentsPage extends BasePage {
  builders = {
    agentTypeCell: (agentType: string) =>
      this.grafanaIframe().getByRole('cell', { exact: true, name: agentType }),
  };
  buttons = {
    backToNodes: this.grafanaIframe().getByRole('link', { name: 'Go back to nodes' }),
  };
  elements = {
    agentTypes: this.grafanaIframe().getByTestId('table-tbody-tr').locator('xpath=td[3]'),
    rtaAgentStatus: this.grafanaIframe().locator(
      '//td[@title="rta-mongodb-agent"]//parent::tr//td[position()="2"]',
    ),
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
