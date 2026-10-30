import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';
import BasePage from '../base.page';

export default class AlertStatusPage extends BasePage {
  url = 'pmm-ui/alerting/status';
  builders = {
    firingAlert: (alertName: string) =>
      this.page.locator(
        `//td[text()="${alertName}"]/parent::tr//td[position()="2"]//span[contains(text(), "Firing")]`,
      ),
  };
  buttons = {};
  elements = {};
  inputs = {};
  messages = {};

  verifyAlertFiring = async (alertName: string, firing = true): Promise<void> => {
    await this.page.goto(this.url);
    await expect(async () => {
      await this.page.reload();
      await expect(this.builders.firingAlert(alertName)).toBeVisible({
        timeout: Timeouts.TEN_SECONDS,
        visible: firing,
      });
    }).toPass({ timeout: Timeouts.TWO_MINUTES });
  };
}
