 import BasePage from '../base.page';
import { Timeouts } from '@helpers/timeouts';

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
    const timeoutInSeconds = timeout / 1000;
    for (let i = 0; i <= timeoutInSeconds; i++) {
      if (i == timeoutInSeconds) {
        throw new Error(
          `Real time analytics agent status is: ${await this.elements.rtaAgentStatus.textContent()} but should be ${expectedStatus}`,
        );
      }

      await this.page.reload();
      await this.elements.rtaAgentStatus.waitFor({ state: 'visible' });

      if ((await this.elements.rtaAgentStatus.textContent()) == expectedStatus) {
        break;
      }

      await this.page.waitForTimeout(Timeouts.ONE_SECOND);
    }
  };
}
