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
  url = 'pmm-ui/add-instance';
  builders = {
    discoveredInstance: (instanceId: string) => this.page.getByTestId(`start-monitoring-${instanceId}`),
    instanceType: (instanceType: RemoteInstanceType) => this.page.getByTestId(`${instanceType}-instance`),
    nodeOption: (nodeName: string) => this.page.getByRole('option', { exact: true, name: nodeName }),
  };
  buttons = {
    addService: this.page.getByTestId('add-service-submit'),
    azure: this.page.getByTestId('azure-instance'),
    discover: this.page.getByTestId('add-service-submit'),
    mongodbProfiler: this.page.getByTestId('switch-input-qan-mongodb-profiler').getByRole('switch'),
    mysql: this.page.getByTestId('mysql-instance'),
    pgStatStatements: this.page.getByRole('radio', { exact: true, name: 'PG Stat Statements' }),
    rds: this.page.getByTestId('rds-instance'),
    skipTlsVerify: this.page.getByTestId('switch-input-tls-skip-verify').getByRole('switch'),
    useTls: this.page.getByTestId('switch-input-tls').getByRole('switch'),
  };
  elements = {
    nodes: this.page.getByTestId('select-node-id-button'),
    pgStatMonitor: this.page.getByRole('radio', { exact: true, name: 'PG Stat Monitor' }),
    unauthorized: this.page.getByTestId('unauthorized'),
  };
  inputs = {
    accessKey: this.page.getByTestId('text-input-aws-access-key'),
    azureClientId: this.page.getByTestId('text-input-azure-client-id'),
    azureClientSecret: this.page.getByTestId('text-input-azure-client-secret'),
    azureSubscriptionId: this.page.getByTestId('text-input-azure-subscription-id'),
    azureTenantId: this.page.getByTestId('text-input-azure-tenant-id'),
    cluster: this.page.getByTestId('text-input-cluster'),
    environment: this.page.getByTestId('text-input-environment'),
    host: this.page.getByTestId('text-input-address'),
    maxQueryLength: this.page.getByTestId('text-input-max-query-length'),
    metricsPath: this.page.getByTestId('text-input-metrics-path'),
    password: this.page.getByTestId('text-input-password'),
    port: this.page.getByTestId('text-input-port'),
    replicationSet: this.page.getByTestId('text-input-replication-set'),
    secretKey: this.page.getByTestId('text-input-aws-secret-key'),
    serviceName: this.page.getByTestId('text-input-service-name'),
    tlsCa: this.page.getByTestId('text-input-tls-ca'),
    tlsCert: this.page.getByTestId('text-input-tls-cert'),
    tlsKey: this.page.getByTestId('text-input-tls-key'),
    username: this.page.getByTestId('text-input-username'),
  };
  messages = {
    maxQueryLengthError: this.page
      .locator('.MuiFormControl-root', { has: this.page.getByTestId('text-input-max-query-length') })
      .locator('.MuiFormHelperText-root'),
  };

  addRemoteTlsMysql = async (
    serviceName: string,
    host: string,
    certificates: { ca: string; cert: string; key: string },
  ) => {
    await this.builders.instanceType('mysql').click({ timeout: Timeouts.THIRTY_SECONDS });
    await this.selectNode('pmm-server');
    await this.fillRemoteFields({
      cluster: 'mysql_remote_cluster',
      environment: 'mysql_remote_cluster',
      host,
      password: 'pmm',
      port: '3306',
      serviceName,
      username: 'pmm',
    });
    await this.verifyTlsFieldsHidden();
    await this.fillTlsCertificates(certificates);
    await this.configureRemoteInstance('mysql');
  };

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

    if (instanceType === 'mongodb') await this.buttons.mongodbProfiler.check();
    if (instanceType === 'postgresql') await this.buttons.pgStatStatements.check();
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

  fillTlsCertificates = async (certificates: { ca: string; cert: string; key: string }) => {
    await this.buttons.useTls.check();
    await this.inputs.tlsCa.fill(certificates.ca, { timeout: Timeouts.THIRTY_SECONDS });
    await this.inputs.tlsCert.fill(certificates.cert);
    await this.inputs.tlsKey.fill(certificates.key);
  };

  selectNode = async (nodeName: string) => {
    await this.elements.nodes.click({ timeout: Timeouts.ONE_MINUTE });
    await this.builders.nodeOption(nodeName).click({ timeout: Timeouts.THIRTY_SECONDS });
  };

  verifyPgStatMonitorIsDefault = async () => {
    await expect(this.elements.pgStatMonitor).toBeChecked();
  };

  verifyTlsFieldsHidden = async () => {
    for (const input of [this.inputs.tlsCa, this.inputs.tlsCert, this.inputs.tlsKey]) {
      await expect(input).toBeHidden();
    }
  };
}
