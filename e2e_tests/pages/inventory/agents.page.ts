import BasePage from '../base.page';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

export default class AgentsPage extends BasePage {
  builders = {};
  buttons = {};
  elements = {
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
