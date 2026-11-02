import BasePage from '../base.page';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

export default class AgentsPage extends BasePage {
  builders = {
    agentDetailsLabel: (label: string) =>
      this.grafanaIframe()
        .getByTestId('details-row-content')
        .getByRole('listitem')
        .filter({ hasText: label }),
    agentTypeCell: (agentType: string) =>
      this.grafanaIframe().getByRole('cell', { exact: true, name: agentType }),
    selectAgentCheckbox: (agentType: string) =>
      this.grafanaIframe()
        .getByTestId('table-tbody-tr')
        .filter({ has: this.page.getByRole('cell', { exact: true, name: agentType }) })
        .getByTestId('select-row')
        .locator('span'),
    showAgentDetails: (agentType: string) =>
      this.grafanaIframe()
        .getByTestId('table-tbody-tr')
        .filter({ has: this.page.getByRole('cell', { exact: true, name: agentType }) })
        .getByTestId('show-row-details'),
  };
  buttons = {
    backToNodes: this.grafanaIframe().getByRole('link', { name: 'Go back to nodes' }),
    delete: this.grafanaIframe().getByRole('button', { exact: true, name: 'Delete' }),
    proceed: this.grafanaIframe().getByRole('button', { name: 'Proceed' }),
  };
  elements = {
    agentTypes: this.grafanaIframe().getByTestId('table-tbody-tr').locator('xpath=td[3]'),
    rtaAgentStatus: this.grafanaIframe().locator(
      '//td[@title="rta-mongodb-agent"]//parent::tr//td[position()="2"]',
    ),
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
      this.buttons.proceed.click(),
    ]);
  };

  serviceAgentsUrl = (serviceId: string) => `graph/inventory/services/${serviceId}/agents`;

  verifyAgentDetailsLabel = async (agentType: string, label: string) => {
    await this.builders.showAgentDetails(agentType).click();
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
