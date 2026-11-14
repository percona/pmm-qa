import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';
import BasePage from '../base.page';

export default class AlertStatusPage extends BasePage {
  url = 'pmm-ui/alerting/status';
  builders = {
    alertRow: (alertName: string, serviceName: string) =>
      this.page.getByRole('row').filter({ hasText: alertName }).filter({ hasText: serviceName }),
    detailsParagraph: (text: RegExp) => this.page.getByRole('paragraph').filter({ hasText: text }),
    firingAlert: (alertName: string) =>
      this.page.locator(
        `//td[text()="${alertName}"]/parent::tr//td[position()="2"]//span[contains(text(), "Firing")]`,
      ),
    ruleStep: (refId: string) => this.page.getByTestId(`rule-step-${refId}`),
  };
  buttons = {};
  elements = {
    ruleSteps: this.page.locator('[data-testid^="rule-step-"]'),
  };
  inputs = {};
  messages = {};

  openAlertDetails = async (alertName: string, serviceName: string): Promise<void> => {
    await this.page.goto(this.url);
    await expect(this.builders.alertRow(alertName, serviceName)).toContainText('Firing', {
      timeout: Timeouts.THIRTY_SECONDS,
    });
    await this.builders.alertRow(alertName, serviceName).click();
    await expect(this.elements.ruleSteps.first()).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
  };

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
