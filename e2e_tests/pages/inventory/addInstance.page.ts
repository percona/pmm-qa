import { expect } from '@playwright/test';
import BasePage from '@pages/base.page';
import { Timeouts } from '@helpers/timeouts';

export interface RdsDiscoveryCredentials {
  accessKey?: string;
  roleArn?: string;
  secretKey?: string;
}

export default class AddInstancePage extends BasePage {
  url = 'graph/add-instance?orgId=1';
  readonly texts = {
    credentialsExclusive: 'Use either an access key and secret key, or an IAM role ARN, not both',
    invalidRoleArn: 'Enter an IAM role ARN, for example arn:aws:iam::123456789012:role/RoleName',
    roleArnTooltip: 'PMM Server assumes this role using its own AWS identity to discover RDS instances.',
  };
  builders = {
    discoveredInstanceRow: (instanceId: string) =>
      this.grafanaIframe()
        .getByRole('row')
        .filter({
          has: this.grafanaIframe().getByRole('cell', { exact: true, name: instanceId }),
        }),
    fieldError: (fieldName: string) => this.grafanaIframe().getByTestId(`${fieldName}-field-error-message`),
  };
  buttons = {
    addService: this.grafanaIframe().getByRole('button', { name: 'Add service' }),
    azure: this.grafanaIframe().getByTestId('azure-instance'),
    discover: this.grafanaIframe().getByRole('button', { name: 'Discover' }),
    mysql: this.grafanaIframe().getByTestId('mysql-instance'),
    rds: this.grafanaIframe().getByTestId('rds-instance'),
  };
  elements = {
    alertError: this.grafanaIframe().getByTestId('data-testid Alert error'),
    roleArnFieldContainer: this.grafanaIframe().getByTestId('aws_role_arn-field-container'),
    roleArnTooltipIcon: this.grafanaIframe()
      .getByTestId('aws_role_arn-field-container')
      .locator('.Tooltip-Icon'),
    secretKeyFieldContainer: this.grafanaIframe().getByTestId('aws_secret_key-field-container'),
    tooltip: this.grafanaIframe().getByRole('tooltip'),
  };
  inputs = {
    accessKey: this.grafanaIframe().getByTestId('aws_access_key-text-input'),
    password: this.grafanaIframe().getByTestId('password-password-input'),
    roleArn: this.grafanaIframe().getByTestId('aws_role_arn-text-input'),
    secretKey: this.grafanaIframe().getByTestId('aws_secret_key-password-input'),
    serviceName: this.grafanaIframe().getByTestId('serviceName-text-input'),
    tlsSkipVerify: this.grafanaIframe()
      .getByTestId('tls_skip_verify-field-container')
      .locator('span')
      .first(),
    username: this.grafanaIframe().getByTestId('username-text-input'),
  };
  messages = {};

  addDiscoveredRdsMysql = async (
    instanceId: string,
    { password, serviceName, username }: { password: string; serviceName: string; username: string },
  ) => {
    await this.builders
      .discoveredInstanceRow(instanceId)
      .getByRole('button')
      .click({ timeout: Timeouts.ONE_MINUTE });
    await expect(this.inputs.username).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    await this.inputs.serviceName.fill(serviceName);
    await this.inputs.username.fill(username);
    await this.inputs.password.fill(password);
    await this.inputs.tlsSkipVerify.click();

    const response = this.page.waitForResponse(
      (response) =>
        response.url().endsWith('/v1/management/services') && response.request().method() === 'POST',
    );

    await this.buttons.addService.click();
    expect((await response).status(), `Adding RDS service failed: ${await (await response).text()}`).toEqual(
      200,
    );
  };

  discoverRds = async ({ accessKey = '', roleArn = '', secretKey = '' }: RdsDiscoveryCredentials) => {
    await this.inputs.accessKey.fill(accessKey);
    await this.inputs.secretKey.fill(secretKey);
    await this.inputs.roleArn.fill(roleArn);

    const response = this.page.waitForResponse('**/v1/management/services:discoverRDS', {
      timeout: Timeouts.ONE_MINUTE,
    });

    await this.buttons.discover.click();

    return await response;
  };

  openRdsDiscovery = async () => {
    // The form discovers once on mount with PMM Server's own identity; wait it out so it is not
    // mistaken for a request the test sends.
    const mountDiscovery = this.page.waitForResponse('**/v1/management/services:discoverRDS', {
      timeout: Timeouts.ONE_MINUTE,
    });

    await this.buttons.rds.click();
    await mountDiscovery;
    await expect(this.inputs.roleArn).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
  };

  // Form validation runs before submit, so a blocked Discover never reaches the API.
  verifyDiscoverIsBlocked = async () => {
    const request = this.page.waitForRequest('**/v1/management/services:discoverRDS', {
      timeout: Timeouts.THREE_SECONDS,
    });

    await this.buttons.discover.click();
    await expect(request, 'Discover must not send a request while the form is invalid').rejects.toThrow();
  };
}
