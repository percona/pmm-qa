import BasePage from '@pages/base.page';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

export type RemoteInstanceType = 'external' | 'haproxy' | 'mongodb' | 'mysql' | 'postgresql' | 'proxysql';

export interface RemoteInstanceFields {
  cluster?: string;
  environment?: string;
  host: string;
  metricsPath?: string;
  password?: string;
  port?: string;
  replicationSet?: string;
  serviceName: string;
  username?: string;
}

export default class AddInstancePage extends BasePage {
  url = 'graph/add-instance?orgId=1';
  builders = {
    discoveredInstance: (instanceId: string) =>
      this.grafanaIframe()
        .getByRole('row')
        .filter({ has: this.page.getByRole('cell', { exact: true, name: instanceId }) })
        .getByRole('button'),
    instanceType: (instanceType: RemoteInstanceType) =>
      this.grafanaIframe().getByTestId(`${instanceType}-instance`),
    nodeOption: (nodeName: string) =>
      this.grafanaIframe().getByRole('option', { exact: true, name: nodeName }),
  };
  buttons = {
    addService: this.grafanaIframe().getByRole('button', { name: 'Add service' }),
    azure: this.grafanaIframe().getByTestId('azure-instance'),
    discover: this.grafanaIframe().getByRole('button', { name: 'Discover' }),
    mongodbProfiler: this.grafanaIframe().getByTestId('qan_mongodb_profiler-field-label'),
    mysql: this.grafanaIframe().getByTestId('mysql-instance'),
    pgStatStatements: this.grafanaIframe().getByText('PG Stat Statements', { exact: true }),
    rds: this.grafanaIframe().getByTestId('rds-instance'),
    skipTlsVerify: this.grafanaIframe().getByTestId('tls_skip_verify-field-label'),
  };
  elements = {
    nodes: this.grafanaIframe().getByTestId('nodes-selectbox'),
    pgStatMonitor: this.grafanaIframe().getByRole('radio', { name: 'PG Stat Monitor' }),
    trackingState: this.grafanaIframe().getByTestId('tracking-radio-state'),
    unauthorized: this.grafanaIframe().getByTestId('unauthorized'),
  };
  inputs = {
    accessKey: this.grafanaIframe().getByTestId('aws_access_key-text-input'),
    azureClientId: this.grafanaIframe().getByTestId('azure_client_id-text-input'),
    azureClientSecret: this.grafanaIframe().getByTestId('azure_client_secret-password-input'),
    azureSubscriptionId: this.grafanaIframe().getByTestId('azure_subscription_id-text-input'),
    azureTenantId: this.grafanaIframe().getByTestId('azure_tenant_id-text-input'),
    cluster: this.grafanaIframe().getByTestId('cluster-text-input'),
    environment: this.grafanaIframe().getByTestId('environment-text-input'),
    host: this.grafanaIframe().getByTestId('address-text-input'),
    metricsPath: this.grafanaIframe().getByTestId('metrics_path-text-input'),
    password: this.grafanaIframe().getByTestId('password-password-input'),
    port: this.grafanaIframe().getByTestId('port-text-input'),
    replicationSet: this.grafanaIframe().getByTestId('replication_set-text-input'),
    secretKey: this.grafanaIframe().getByTestId('aws_secret_key-password-input'),
    serviceName: this.grafanaIframe().getByTestId('serviceName-text-input'),
    username: this.grafanaIframe().getByTestId('username-text-input'),
  };
  messages = {};

  addService = async () => {
    const [response] = await Promise.all([
      this.page.waitForResponse(
        (response) =>
          response.url().includes('v1/management/services') && response.request().method() === 'POST',
      ),
      this.buttons.addService.click({ timeout: Timeouts.THIRTY_SECONDS }),
    ]);

    return response;
  };

  configureRemoteInstance = async (instanceType: RemoteInstanceType) => {
    await this.buttons.skipTlsVerify.check({ timeout: Timeouts.THIRTY_SECONDS });

    if (instanceType === 'mongodb') await this.buttons.mongodbProfiler.click();
    if (instanceType === 'postgresql') await this.buttons.pgStatStatements.click();
  };

  discoverAzure = async (credentials: {
    clientId: string;
    clientSecret: string;
    subscriptionId: string;
    tenantId: string;
  }) => {
    await this.buttons.azure.click();
    await this.inputs.azureClientId.fill(credentials.clientId);
    await this.inputs.azureClientSecret.fill(credentials.clientSecret);
    await this.inputs.azureTenantId.fill(credentials.tenantId);
    await this.inputs.azureSubscriptionId.fill(credentials.subscriptionId);
    await this.buttons.discover.click();
  };

  discoverRds = async (accessKey: string, secretKey: string) => {
    await this.buttons.rds.click({ timeout: Timeouts.THIRTY_SECONDS });
    await this.inputs.accessKey.fill(accessKey, { timeout: Timeouts.THIRTY_SECONDS });
    await this.inputs.secretKey.fill(secretKey);
    await this.buttons.discover.click();
  };

  fillDiscoveredInstanceFields = async (
    fields: Required<Omit<RemoteInstanceFields, 'host' | 'metricsPath' | 'port'>>,
  ) => {
    await this.inputs.serviceName.fill(fields.serviceName);
    await this.inputs.username.fill(fields.username);
    await this.inputs.password.fill(fields.password);
    await this.inputs.environment.fill(fields.environment);
    await this.inputs.cluster.fill(fields.cluster);
    await this.inputs.replicationSet.fill(fields.replicationSet);
  };

  fillRemoteFields = async (fields: RemoteInstanceFields) => {
    await this.inputs.host.fill(fields.host, { timeout: Timeouts.ONE_MINUTE });

    if (fields.username) await this.inputs.username.fill(fields.username);
    if (fields.password) await this.inputs.password.fill(fields.password);
    if (fields.port) await this.inputs.port.fill(fields.port);
    if (fields.metricsPath) await this.inputs.metricsPath.fill(fields.metricsPath);

    await this.inputs.serviceName.fill(fields.serviceName);

    if (fields.environment) await this.inputs.environment.fill(fields.environment);
    if (fields.cluster) await this.inputs.cluster.fill(fields.cluster);
  };

  selectNode = async (nodeName: string) => {
    await this.elements.nodes.click({ timeout: Timeouts.ONE_MINUTE });
    await this.builders.nodeOption(nodeName).click({ timeout: Timeouts.THIRTY_SECONDS });
  };

  verifyPgStatMonitorIsDefault = async () => {
    await expect(this.elements.trackingState).toHaveAttribute('value', 'qan_postgresql_pgstatmonitor_agent');
    await expect(this.elements.pgStatMonitor).toBeChecked();
  };
}
