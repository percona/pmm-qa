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
    popUp: (message: string) =>
      this.grafanaIframe()
        .getByRole('status')
        .or(this.grafanaIframe().getByRole('alert'))
        .filter({ hasText: message }),
    radioLabel: (label: "Don't track" | 'Custom' | 'Default' | 'PG Stat Monitor' | 'PG Stat Statements') =>
      this.grafanaIframe().getByText(label, { exact: true }),
  };
  buttons = {
    addService: this.grafanaIframe().getByRole('button', { name: 'Add service' }),
    azure: this.grafanaIframe().getByTestId('azure-instance'),
    disableQueryExamples: this.grafanaIframe().getByTestId('disable_query_examples-field-label'),
    discover: this.grafanaIframe().getByRole('button', { exact: true, name: 'Discover' }),
    mongodbProfiler: this.grafanaIframe().getByTestId('qan_mongodb_profiler-field-label'),
    mysql: this.grafanaIframe().getByTestId('mysql-instance'),
    parseFromUrl: this.grafanaIframe().getByText('Parse from URL string', { exact: true }),
    pgStatStatements: this.grafanaIframe().getByText('PG Stat Statements', { exact: true }),
    rds: this.grafanaIframe().getByTestId('rds-instance'),
    setManually: this.grafanaIframe().getByText('Set manually', { exact: true }),
    skipConnectionCheck: this.grafanaIframe().getByTestId('skip_connection_check-field-label'),
    skipTlsVerify: this.grafanaIframe().getByTestId('tls_skip_verify-field-label'),
    useTls: this.grafanaIframe().getByTestId('tls-field-label'),
  };
  elements = {
    disableCollectorsLabel: this.grafanaIframe().getByTestId('disable_collectors-field-label'),
    nodes: this.grafanaIframe().getByTestId('nodes-selectbox'),
    pgStatMonitor: this.grafanaIframe().getByRole('radio', { name: 'PG Stat Monitor' }),
    rdsHeading: this.grafanaIframe().getByTestId('rds-instance').getByRole('heading'),
    schemaState: this.grafanaIframe().getByTestId('schema-radio-state'),
    trackingState: this.grafanaIframe().getByTestId('tracking-radio-state'),
    unauthorized: this.grafanaIframe().getByTestId('unauthorized'),
  };
  inputs = {
    accessKey: this.grafanaIframe().getByTestId('aws_access_key-text-input'),
    availabilityZone: this.grafanaIframe().getByTestId('az-text-input'),
    azureClientId: this.grafanaIframe().getByTestId('azure_client_id-text-input'),
    azureClientSecret: this.grafanaIframe().getByTestId('azure_client_secret-password-input'),
    azureSubscriptionId: this.grafanaIframe().getByTestId('azure_subscription_id-text-input'),
    azureTenantId: this.grafanaIframe().getByTestId('azure_tenant_id-text-input'),
    cluster: this.grafanaIframe().getByTestId('cluster-text-input'),
    customLabels: this.grafanaIframe().getByTestId('custom_labels-textarea-input'),
    database: this.grafanaIframe().getByTestId('database-text-input'),
    disableCollectors: this.grafanaIframe().getByTestId('disable_collectors-text-input'),
    environment: this.grafanaIframe().getByTestId('environment-text-input'),
    host: this.grafanaIframe().getByTestId('address-text-input'),
    maxQueryLength: this.grafanaIframe().getByTestId('maxQueryLength-text-input'),
    metricsPath: this.grafanaIframe().getByTestId('metrics_path-text-input'),
    password: this.grafanaIframe().getByTestId('password-password-input'),
    port: this.grafanaIframe().getByTestId('port-text-input'),
    region: this.grafanaIframe().getByTestId('region-text-input'),
    replicationSet: this.grafanaIframe().getByTestId('replication_set-text-input'),
    secretKey: this.grafanaIframe().getByTestId('aws_secret_key-password-input'),
    serviceName: this.grafanaIframe().getByTestId('serviceName-text-input'),
    tablestatsGroupTableLimit: this.grafanaIframe().getByTestId('tablestats_group_table_limit-number-input'),
    tlsCa: this.grafanaIframe().getByTestId('tls_ca-textarea-input'),
    tlsCert: this.grafanaIframe().getByTestId('tls_cert-textarea-input'),
    tlsCertificateFilePassword: this.grafanaIframe().getByTestId(
      'tls_certificate_file_password-password-input',
    ),
    tlsCertificateKey: this.grafanaIframe().getByTestId('tls_certificate_key-textarea-input'),
    tlsKey: this.grafanaIframe().getByTestId('tls_key-textarea-input'),
    url: this.grafanaIframe().getByTestId('url-text-input'),
    username: this.grafanaIframe().getByTestId('username-text-input'),
  };
  messages = {
    hostRequired: this.grafanaIframe().getByTestId('address-field-error-message'),
    maxQueryLengthError: this.grafanaIframe().getByTestId('maxQueryLength-field-error-message'),
    portRequired: this.grafanaIframe().getByTestId('port-field-error-message'),
  };

  addRemoteTlsMongodb = async (
    serviceName: string,
    host: string,
    certificates: { ca: string; key: string },
  ) => {
    await this.fillRemoteDatabase('mongodb', 'pmm-server', {
      cluster: 'mongodb_remote_cluster',
      environment: 'mongodb_remote_cluster',
      host,
      port: '27017',
      serviceName,
    });
    await this.verifyTlsFieldsHidden([
      this.inputs.tlsCa,
      this.inputs.tlsCertificateFilePassword,
      this.inputs.tlsCertificateKey,
    ]);
    await this.buttons.useTls.check();
    await this.inputs.tlsCa.fill(certificates.ca, { timeout: Timeouts.THIRTY_SECONDS });
    await this.inputs.tlsCertificateKey.fill(certificates.key);
    await this.configureRemoteInstance('mongodb');
  };

  addRemoteTlsMysql = async (
    serviceName: string,
    host: string,
    certificates: { ca: string; cert: string; key: string },
  ) => {
    await this.fillRemoteDatabase('mysql', 'pmm-server', {
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

  fillRemoteDatabase = async (
    instanceType: RemoteInstanceType,
    nodeName: string,
    fields: RemoteInstanceFields,
  ) => {
    await this.builders.instanceType(instanceType).click({ timeout: Timeouts.THIRTY_SECONDS });
    await this.selectNode(nodeName);
    await this.fillRemoteFields(fields);
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

  parseUrl = async (url: string) => {
    await this.buttons.parseFromUrl.click({ timeout: Timeouts.THIRTY_SECONDS });
    await this.inputs.url.fill(url, { timeout: Timeouts.THIRTY_SECONDS });
    await this.buttons.parseFromUrl.click();
    await this.buttons.setManually.click();
  };

  selectNode = async (nodeName: string) => {
    await this.elements.nodes.click({ timeout: Timeouts.ONE_MINUTE });
    await this.builders.nodeOption(nodeName).click({ timeout: Timeouts.THIRTY_SECONDS });
  };

  verifyPgStatMonitorIsDefault = async () => {
    await expect(this.elements.trackingState).toHaveAttribute('value', 'qan_postgresql_pgstatmonitor_agent');
    await expect(this.elements.pgStatMonitor).toBeChecked();
  };

  verifyRemoteFormFields = async (timeout = Timeouts.THIRTY_SECONDS) => {
    for (const field of [
      this.inputs.host,
      this.inputs.serviceName,
      this.inputs.port,
      this.inputs.username,
      this.inputs.password,
      this.inputs.environment,
      this.inputs.region,
      this.inputs.availabilityZone,
      this.inputs.replicationSet,
      this.inputs.cluster,
      this.inputs.customLabels,
      this.buttons.skipConnectionCheck,
    ]) {
      await expect(field).toBeVisible({ timeout });
    }
  };

  verifyTlsFieldsHidden = async (inputs = [this.inputs.tlsCa, this.inputs.tlsCert, this.inputs.tlsKey]) => {
    for (const input of inputs) {
      await expect(input).toBeHidden();
    }
  };
}
