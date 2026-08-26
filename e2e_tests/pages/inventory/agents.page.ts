import BasePage from '../base.page';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

export default class AgentsPage extends BasePage {
  builders = {
    hideRowDetails: (agentId: string) =>
      this.grafanaIframe().locator(
        `//td[@title="${agentId}"]//ancestor::tr//button[@data-testid="hide-row-details"]`,
      ),
    property: (propertyText: string) =>
      this.grafanaIframe().locator(
        `//span[@data-testid="details-row-content"]//span[text()="${propertyText}"]`,
      ),
    showRowDetails: (agentId: string) =>
      this.grafanaIframe().locator(
        `//td[@title="${agentId}"]//ancestor::tr//button[@data-testid="show-row-details"]`,
      ),
  };
  buttons = {};
  elements = {
    rowDetails: this.grafanaIframe().locator('//span[@data-testid="details-row-content"]'),
    rtaAgentStatus: this.grafanaIframe().locator(
      '//td[@title="rta-mongodb-agent"]//parent::tr//td[position()="2"]',
    ),
  };
  inputs = {};
  messages = {};

  // eslint-disable-next-line perfectionist/sort-classes -- Issue with url being the method
  readonly url = (serviceId: string) => `graph/inventory/services/${serviceId}/agents`;
  // eslint-disable-next-line perfectionist/sort-classes -- Issue with url being the method
  readonly nodesUrl = (nodeId: string) => `graph/inventory/nodes/${nodeId}/agents`;

  hideRowDetails = async (agentId: string) => {
    await this.builders.hideRowDetails(agentId).click();
    await this.elements.rowDetails.waitFor({ state: 'detached' });
  };

  showRowDetails = async (agentId: string) => {
    await this.builders.showRowDetails(agentId).click({ timeout: Timeouts.TWENTY_SECONDS });
    await this.elements.rowDetails.waitFor({ state: 'visible' });
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
