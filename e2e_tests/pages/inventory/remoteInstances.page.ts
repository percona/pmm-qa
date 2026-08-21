import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';
import BasePage from '@pages/base.page';

export interface CreateRemoteInstanceOptions {
  disableExamples?: boolean;
}

export interface RemoteConnectionDetails {
  host: string;
  password: string;
  port?: string;
  serviceName: string;
  username: string;
}

/**
 * Best-effort port of the CodeceptJS remote instances page, scoped to the
 * PostgreSQL "add remote instance" flow used by the PGSM integration tests.
 * Selectors mirror the `data-testid` values from the CodeceptJS page object and
 * may need adjustment against the live UI.
 */
export default class RemoteInstancesPage extends BasePage {
  url = 'graph/add-instance';
  builders = {
    nodeOption: (nodeName: string) =>
      this.grafanaIframe().locator(`//div[contains(@class, "option") and normalize-space()="${nodeName}"]`),
  };
  buttons = {
    addPostgreSQL: this.grafanaIframe().getByTestId('postgresql-instance'),
    addService: this.grafanaIframe().locator('//div[contains(text(), "Add service")]'),
    disableQueryExamples: this.grafanaIframe().getByTestId('disable_query_examples-field-label'),
    nodesSelect: this.grafanaIframe().getByTestId('nodes-selectbox'),
    skipTls: this.grafanaIframe().getByTestId('tls_skip_verify-field-label'),
  };
  elements = {};
  inputs = {
    hostName: this.grafanaIframe().getByTestId('address-text-input'),
    password: this.grafanaIframe().getByTestId('password-password-input'),
    portNumber: this.grafanaIframe().getByTestId('port-text-input'),
    serviceName: this.grafanaIframe().getByTestId('serviceName-text-input'),
    userName: this.grafanaIframe().getByTestId('username-text-input'),
  };
  messages = {};

  createRemoteInstance = async (serviceName: string, options: CreateRemoteInstanceOptions = {}) => {
    await this.buttons.skipTls.click();

    if (options.disableExamples) {
      await this.buttons.disableQueryExamples.click();
    }

    await Promise.all([
      this.page.waitForResponse(
        (response) => response.url().includes('v1/management/services') && response.status() === 200,
        { timeout: Timeouts.THIRTY_SECONDS },
      ),
      this.buttons.addService.click(),
    ]);
  };

  fillConnectionDetails = async (details: RemoteConnectionDetails) => {
    await expect(this.inputs.hostName).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    await this.inputs.hostName.fill(details.host);
    await this.inputs.userName.fill(details.username);
    await this.inputs.password.fill(details.password);
    await this.inputs.serviceName.fill(details.serviceName);

    if (details.port) {
      await this.inputs.portNumber.fill(details.port);
    }
  };

  openAddPostgreSQL = async () => {
    await this.buttons.addPostgreSQL.click();
    await expect(this.inputs.serviceName).toBeVisible({ timeout: Timeouts.ONE_MINUTE });
  };

  selectNode = async (nodeName: string) => {
    await this.buttons.nodesSelect.click();
    await this.builders.nodeOption(nodeName).first().click();
  };
}
