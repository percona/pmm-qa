const {
  I, adminPage, pmmInventoryPage, codeceptjsConfig, remoteInstancesHelper,
} = inject();
const assert = require('assert');

// The Add Service forms render MUI fields; their label, helper text and radio inputs carry no test id.
const formControl = (inputTestId) => locate('.MuiFormControl-root').withDescendant(`[data-testid="${inputTestId}"]`);
const fieldLabel = (inputTestId) => formControl(inputTestId).find('label');
const fieldHelperText = (inputTestId) => formControl(inputTestId).find('p');
const fieldError = (inputTestId) => formControl(inputTestId).find('//p[contains(@class, "Mui-error")]');
// Radio test ids repeat across groups (e.g. two "enabled"), so a radio is found by its group's input name.
const radioInput = (group, value) => `input[name="radio-group-${group}"][value="${value}"]`;
const radioLabel = (group, value) => locate('label').withDescendant(radioInput(group, value));

const url = new URL(codeceptjsConfig.config.helpers.Playwright.url);

module.exports = {
  accessKey: remoteInstancesHelper.remote_instance.aws.aws_access_key,
  secretKey: remoteInstancesHelper.remote_instance.aws.aws_secret_key,

  // insert your locators and methods here
  // setting locators
  postgresGCSettings: {
    environment: 'Remote PostgreSQL_GC env',
    cluster: 'Remote PostgreSQL_GC cluster',
  },
  mysqlSettings: {
    environment: 'remote-mysql',
    cluster: 'remote-mysql-cluster',
  },
  potgresqlSettings: {
    environment: 'remote-postgres',
    cluster: 'remote-postgres-cluster',
  },
  mongodbSettings: {
    environment: 'remote-mongodb',
    cluster: 'remote-mongodb-cluster',
    replicationSet: 'remote-mongodb-replica',
  },
  postgresqlAzureInputs: {
    userName: remoteInstancesHelper.remote_instance.azure.azure_postgresql.userName,
    password: remoteInstancesHelper.remote_instance.azure.azure_postgresql.password,
    environment: 'Azure PostgreSQL environment',
    cluster: 'Azure PostgreSQL cluster',
    replicationSet: 'Azure PostgreSQL replica',
  },
  mysqlAzureInputs: {
    userName: remoteInstancesHelper.remote_instance.azure.azure_mysql.userName,
    password: remoteInstancesHelper.remote_instance.azure.azure_mysql.password,
    environment: 'Azure MySQL environment',
    cluster: 'Azure MySQL cluster',
    replicationSet: 'Azure MySQL replica',
  },
  mysqlInputs: {
    userName: remoteInstancesHelper.remote_instance.aws.aws_rds_5_6.username,
    password: remoteInstancesHelper.remote_instance.aws.aws_rds_5_6.password,
    environment: 'RDS MySQL 5.6',
    cluster: 'rds56-cluster',
    replicationSet: 'rds56-replication',
  },
  mysql57rdsInput: {
    userName: remoteInstancesHelper.remote_instance.aws.aws_rds_5_7.username,
    password: remoteInstancesHelper.remote_instance.aws.aws_rds_5_7.password,
    environment: 'RDS MySQL 5.7',
    cluster: 'rds57-cluster',
    replicationSet: 'rds57-replication',
  },
  mysql80rdsInput: {
    userName: remoteInstancesHelper.remote_instance.aws.aws_rds_8_0.username,
    password: remoteInstancesHelper.remote_instance.aws.aws_rds_8_0.password,
    environment: 'RDS MySQL 8.0',
    cluster: 'rds80-cluster',
    replicationSet: 'rds80-replication',
  },
  mysql84rdsInput: {
    userName: remoteInstancesHelper.remote_instance.aws.aws_rds_8_4.username,
    password: remoteInstancesHelper.remote_instance.aws.aws_rds_8_4.password,
    environment: 'RDS MySQL 8.4',
    cluster: 'rds84-cluster',
    replicationSet: 'rds84-replication',
  },
  postgresql13Inputs: {
    userName: remoteInstancesHelper.remote_instance.aws.aws_postgresql_13.userName,
    password: remoteInstancesHelper.remote_instance.aws.aws_postgresql_13.password,
    environment: 'RDS Postgres13',
    cluster: 'rdsPostgres13-cluster',
    replicationSet: 'rdsPostgres13-replication',
  },
  postgresql14Inputs: {
    userName: remoteInstancesHelper.remote_instance.aws.aws_postgresql_14.userName,
    password: remoteInstancesHelper.remote_instance.aws.aws_postgresql_14.password,
    environment: 'RDS Postgres14',
    cluster: 'rdsPostgres14-cluster',
    replicationSet: 'rdsPostgres14-replication',
  },
  postgresql15Inputs: {
    userName: remoteInstancesHelper.remote_instance.aws.aws_postgresql_15.userName,
    password: remoteInstancesHelper.remote_instance.aws.aws_postgresql_15.password,
    environment: 'RDS Postgres15',
    cluster: 'rdsPostgres15-cluster',
    replicationSet: 'rdsPostgres15-replication',
  },
  postgresql16Inputs: {
    userName: remoteInstancesHelper.remote_instance.aws.aws_postgresql_16.userName,
    password: remoteInstancesHelper.remote_instance.aws.aws_postgresql_16.password,
    environment: 'RDS Postgres16',
    cluster: 'rdsPostgres16-cluster',
    replicationSet: 'rdsPostgres16-replication',
  },
  postgresql17Inputs: {
    userName: remoteInstancesHelper.remote_instance.aws.aws_postgresql_17.userName,
    password: remoteInstancesHelper.remote_instance.aws.aws_postgresql_17.password,
    environment: 'RDS Postgres17',
    cluster: 'rdsPostgres17-cluster',
    replicationSet: 'rdsPostgres17-replication',
  },
  postgres15auroraInputs: {
    userName: remoteInstancesHelper.remote_instance.aws.aurora.postgres15aurora.username,
    password: remoteInstancesHelper.remote_instance.aws.aurora.postgres15aurora.password,
    environment: 'RDS Postgres17',
    cluster: 'rdsPostgres17-cluster',
    replicationSet: 'rdsPostgres17-replication',
  },
  postgres16auroraInputs: {
    userName: remoteInstancesHelper.remote_instance.aws.aurora.postgres16aurora.username,
    password: remoteInstancesHelper.remote_instance.aws.aurora.postgres16aurora.password,
    environment: 'RDS Postgres16',
    cluster: 'rdsPostgres16-cluster',
    replicationSet: 'rdsPostgres16-replication',
  },
  url: 'pmm-ui/add-instance',
  addMySQLRemoteURL: 'pmm-ui/add-instance/mysql',
  mysql84rds: {
    'Service Name': 'pmm-qa-rds-mysql-8-4',
    Environment: 'RDS MySQL 8.4',
    'Replication Set': 'rds84-replication',
    Cluster: 'rds84-cluster',
  },
  mysql80rds: {
    'Service Name': 'pmm-qa-mysql-8-0-30',
    Environment: 'RDS MySQL 8.0',
    'Replication Set': 'rds80-replication',
    Cluster: 'rds80-cluster',
  },
  mysql57rds: {
    'Service Name': 'pmm-qa-rds-mysql-5-7-39',
    Environment: 'RDS MySQL 5.7',
    'Replication Set': 'rds57-replication',
    Cluster: 'rds57-cluster',
  },
  postgresql14rds: {
    'Service Name': 'pmm-qa-rds-pgsql-14',
    Environment: 'RDS PGSQL 14',
    'Replication Set': 'pgsqlrds14-replication',
    Cluster: 'pgsqlrds14-cluster',
  },
  postgresql15rds: {
    'Service Name': 'pmm-qa-postgres-15-10',
    Environment: 'RDS PGSQL 15',
    'Replication Set': 'pgsqlrds15-replication',
    Cluster: 'pgsqlrds15-cluster',
  },
  postgresql16rds: {
    'Service Name': 'pmm-qa-pgsql-16',
    Environment: 'RDS PGSQL 16',
    'Replication Set': 'pgsqlrds16-replication',
    Cluster: 'pgsqlrds16-cluster',
  },
  postgresql17rds: {
    'Service Name': 'pmm-qa-rds-pgsql-17-1',
    Environment: 'RDS PGSQL 17',
    'Replication Set': 'pgsqlrds17-replication',
    Cluster: 'pgsqlrds17-cluster',
  },
  rds: {
    'Service Name': 'rds-mysql56',
    Environment: 'RDS MySQL 5.6',
    'Replication Set': 'rds56-replication',
    Cluster: 'rds56-cluster',
  },
  elements: {
    noData: locate('$discovered-instances').withText('No instances found'),
    serverDiscoveryFailed: '$rds-server-discovery-failed',
  },
  fields: {
    accessKeyInput: '$text-input-aws-access-key',
    addAWSRDSMySQLbtn: '$rds-instance',
    addAzureMySQLPostgreSQL: '$azure-instance',
    addExternalServiceRemote: '$external-instance',
    addHAProxy: '$haproxy-instance',
    addInstanceDiv: '$add-service-form',
    addInstancesList: '$mysql-instance',
    addMongoDBRemote: '$mongodb-instance',
    addMySqlRemote: '$mysql-instance',
    addPostgreSQLRemote: '$postgresql-instance',
    addProxySQLRemote: '$proxysql-instance',
    // CSS, since clickAddInstanceAndWaitForSuccess hands it to Playwright directly
    addService: '[data-testid="add-service-submit"]',
    availabilityZone: '$text-input-az',
    clientID: '$text-input-azure-client-id',
    clientSecret: '$text-input-azure-client-secret',
    cluster: '$text-input-cluster',
    customLabels: '$text-input-custom-labels',
    database: '$text-input-database',
    disableCollectors: '$text-input-disable-collectors',
    disableCollectorsDescription: fieldHelperText('text-input-disable-collectors'),
    disableCollectorsError: fieldError('text-input-disable-collectors'),
    disableCollectorsLabel: fieldLabel('text-input-disable-collectors'),
    disableQueryExamples: '$switch-input-disable-query-examples-label',
    disableBasicMetrics: '$switch-input-disable-basic-metrics-label',
    disableEnhancedMetrics: '$switch-input-disable-enhanced-metrics-label',
    discoverBtn: '$add-service-submit',
    discoveryResults: locate('[data-testid^="start-monitoring-"]'),
    doNotTrack: radioLabel('tracking', 'none'),
    environment: '$text-input-environment',
    hostName: '$text-input-address',
    iframe: '#grafana-iframe',
    metricsPath: '$text-input-metrics-path',
    noCredentialsError: locate('#notistack-snackbar').withText('No credentials provided and IAM role is not defined'),
    pageHeaderText: 'Select service type',
    parseFromURLRadioButton: radioLabel('metricsParameters', 'parsed'),
    password: '$text-input-password',
    portNumber: '$text-input-port',
    region: '$text-input-region',
    maxQueryLength: '$text-input-max-query-length',
    maxQueryLengthError: fieldHelperText('text-input-max-query-length'),
    remoteInstanceTitle: 'Select service type',
    remoteInstanceTitleLocator: '//h2',
    replicationSet: '$text-input-replication-set',
    secretKeyInput: '$text-input-aws-secret-key',
    serviceName: '$text-input-service-name',
    setManualy: radioLabel('metricsParameters', 'manually'),
    skipConnectionCheck: '$switch-input-skip-connection-check-label',
    skipTLS: 'input[name="tlsSkipVerify"]',
    skipTLSL: '$switch-input-tls-skip-verify-label',
    startMonitoring: '[data-testid^="start-monitoring-"]',
    subscriptionID: '$text-input-azure-subscription-id',
    tableStatsGroupTableLimit: '$text-input-tablestats-group-table-limit',
    tenantID: '$text-input-azure-tenant-id',
    tlscaInput: locate('$text-input-tls-ca'),
    tlsCertificateInput: locate('$text-input-tls-cert'),
    tlsCertificateKeyInput: locate('$text-input-tls-key'),
    tlsCertificateFilePasswordInput: '$text-input-tls-certificate-key-file-password',
    tlsCertificateKey: '$text-input-tls-certificate-key',
    usePerformanceSchema2: '$switch-input-qan-mysql-perfschema-label',
    usePgStatMonitor: radioLabel('tracking', 'pgMonitor'),
    usePgStatStatements: radioLabel('tracking', 'pgStatements'),
    useQANMongoDBProfiler: '$switch-input-qan-mongodb-profiler-label',
    schemeRadioHttps: 'input[name="radio-group-scheme"][value="https"]',
    useTLS: '$switch-input-tls-label',
    userName: '$text-input-username',
    urlInput: '$text-input-url',
    returnToMenuButton: '$add-service-back',
    requiredFieldHostname: fieldHelperText('text-input-address').withText('Required field'),
    requiredFieldPort: fieldHelperText('text-input-port').withText('Required field'),
    dontTrackingRadio: radioLabel('tracking', 'none'),
    pgStatStatementsRadio: radioLabel('tracking', 'pgStatements'),
    pgStatMonitorRadio: radioLabel('tracking', 'pgMonitor'),
    pgStatMonitorRadioInput: radioInput('tracking', 'pgMonitor'),
    customAutoDiscoveryButton: radioLabel('autoDiscoveryOptions', 'custom'),
    customAutoDiscoveryfield: '$text-input-auto-discovery-limit',
    dropdownOption: (text) => locate('li[role="option"]').withText(text),
  },

  async getFileContent(filePath) {
    let command;

    if (filePath.includes('mysql')) {
      command = `cat ${filePath} | head -n -1`;
    } else {
      command = `cat ${filePath}`;
    }

    const fileContent = await I.verifyCommand(command);

    return fileContent;
  },

  async fillFileContent(field, file) {
    I.click(field);
    I.type(await this.getFileContent(file));
  },

  tableStatsLimitRadioButtonLocator(limit) {
    return radioLabel('tablestatOptions', limit.toLowerCase());
  },

  async getTableLimitFieldValue() {
    return await I.grabValueFrom(this.fields.tableStatsGroupTableLimit);
  },

  rdsInstanceIdLocator(instance) {
    return `$start-monitoring-${instance}`;
  },

  waitUntilRemoteInstancesPageLoaded() {
    I.waitForElement(this.fields.addMySqlRemote, 30);
    I.seeElement(this.fields.addMySqlRemote);

    return this;
  },

  openAddRemotePage(instanceType) {
    // eslint-disable-next-line default-case
    switch (instanceType) {
      case 'mysql':
      case 'mysql_ssl':
        I.click(this.fields.addMySqlRemote);
        break;
      case 'mongodb':
      case 'mongodb_ssl':
        I.click(this.fields.addMongoDBRemote);
        break;
      case 'postgresql':
      case 'postgresGC':
      case 'postgres_ssl':
        I.click(this.fields.addPostgreSQLRemote);
        break;
      case 'proxysql':
        I.click(this.fields.addProxySQLRemote);
        break;
      case 'external':
        I.click(this.fields.addExternalServiceRemote);
        break;
      case 'haproxy':
        I.click(this.fields.addHAProxy);
        break;
    }
    I.waitForElement(this.fields.serviceName, 60);

    return this;
  },

  selectDropdownOption(dropdownLocator, text) {
    I.click(dropdownLocator);
    I.waitForVisible(this.fields.dropdownOption(text), 30);
    I.click(this.fields.dropdownOption(text));
    I.dontSeeElement(this.fields.dropdownOption(text));
  },

  async addRemoteDetails(details, skipUserNamePassword = false) {
    I.waitForElement(this.fields.hostName, 30);
    this.selectDropdownOption('$select-node-id-button', 'pmm-server');
    I.fillField(this.fields.hostName, details.host);
    if (!skipUserNamePassword) {
      I.fillField(this.fields.userName, details.username);
      I.fillField(this.fields.password, details.password);
    }

    adminPage.customClearField(this.fields.portNumber);
    I.fillField(this.fields.portNumber, details.port);

    I.fillField(this.fields.serviceName, details.serviceName);
    I.fillField(this.fields.environment, details.environment);
    I.fillField(this.fields.cluster, details.cluster);

    // eslint-disable-next-line no-empty
    if (details.type === 'postgresql') {
      I.fillField(this.fields.database, details.database);
    }
  },

  async addRemoteSSLDetails(details) {
    if (details.serviceType === 'postgres_ssl' || details.serviceType === 'mysql_ssl') {
      await this.addRemoteDetails(details);
      I.dontSeeElement(this.fields.tlscaInput);
      I.dontSeeElement(this.fields.tlsCertificateKeyInput);
      I.dontSeeElement(this.fields.tlsCertificateInput);
      I.click(this.fields.useTLS);
      I.waitForElement(this.fields.tlscaInput, 30);

      if (details.serviceType === 'postgres_ssl') {
        I.click(this.fields.tlscaInput);
        I.type(details.tlsCA);
        I.click(this.fields.tlsCertificateInput);
        I.type(details.tlsCert);
        I.click(this.fields.tlsCertificateKeyInput);
        I.type(details.tlsKey);
        I.click(this.fields.usePgStatStatements);
      }

      if (details.serviceType === 'mysql_ssl') {
        await this.fillFileContent(this.fields.tlscaInput, details.tlsCAFile);
        await this.fillFileContent(this.fields.tlsCertificateInput, details.tlsCertFile);
        await this.fillFileContent(this.fields.tlsCertificateKeyInput, details.tlsKeyFile);
        I.click(this.fields.skipTLSL);
      }
    }

    if (details.serviceType === 'mongodb_ssl') {
      await this.addRemoteDetails(details, true);
      I.dontSeeElement(this.fields.tlscaInput);
      I.dontSeeElement(this.fields.tlsCertificateFilePasswordInput);
      I.dontSeeElement(this.fields.tlsCertificateKey);
      I.click(this.fields.useTLS);
      I.waitForElement(this.fields.tlscaInput, 30);
      await this.fillFileContent(this.fields.tlscaInput, details.tlsCAFile);
      await this.fillFileContent(this.fields.tlsCertificateKey, details.tlsCertificateKeyFile);
      I.click(this.fields.useQANMongoDBProfiler);
      I.click(this.fields.skipTLSL);
    }
  },

  selectNodeForRemoteInstance(nodeName = 'pmm-server') {
    I.waitForElement(this.fields.hostName, 30);
    if (nodeName === 'pmm-server') {
      this.selectDropdownOption('$select-node-id-button', 'pmm-server');
    } else {
      this.selectDropdownOption('$select-node-id-button', 'client_container');
    }
  },

  async fillRemoteFields(serviceName, nodeName = 'pmm-server', overrideServiceName = null) {
    let inputs;
    let port;
    let host;

    // Handle undefined or null values
    // eslint-disable-next-line no-param-reassign
    nodeName = nodeName || 'pmm-server';

    const isClientContainer = nodeName.startsWith('client_container');
    const externalServiceName = 'external_service_new';
    const srviceName = nodeName.startsWith('client_container') ? `${serviceName}_client` : serviceName;
    const getHostForNodeName = (nodeName, inputs) => {
      if (isClientContainer) {
        return '192.168.0.1';
      }

      return inputs.host;
    };
    const getPortForNodeName = (nodeName, inputs) => {
      if (isClientContainer) {
        return inputs.host_server_port;
      }

      return inputs.server_port;
    };

    if (serviceName !== externalServiceName) {
      this.selectNodeForRemoteInstance(nodeName);
    }

    // eslint-disable-next-line default-case
    switch (serviceName) {
      case remoteInstancesHelper.services.mysql:
        inputs = {
          ...remoteInstancesHelper.remote_instance.mysql.ps_5_7,
          ...this.mysqlSettings,
        };
        port = getPortForNodeName(nodeName, inputs);
        host = getHostForNodeName(nodeName, inputs);
        I.fillField(this.fields.hostName, host);
        I.fillField(this.fields.userName, inputs.username);
        I.fillField(this.fields.password, inputs.password);
        adminPage.customClearField(this.fields.portNumber);
        I.fillField(this.fields.portNumber, port);
        I.fillField(this.fields.serviceName, overrideServiceName || srviceName);
        I.fillField(this.fields.environment, inputs.environment);
        I.fillField(this.fields.cluster, inputs.cluster);
        break;
      case remoteInstancesHelper.services.mysql_ssl:
        inputs = remoteInstancesHelper.remote_instance.mysql.ms_8_0_ssl;
        I.fillField(this.fields.hostName, inputs.host);
        I.fillField(this.fields.userName, inputs.username);
        I.fillField(this.fields.password, inputs.password);
        adminPage.customClearField(this.fields.portNumber);
        I.fillField(this.fields.portNumber, inputs.port);
        I.fillField(this.fields.serviceName, serviceName);
        I.fillField(this.fields.environment, inputs.environment);
        I.fillField(this.fields.cluster, inputs.clusterName);
        I.dontSeeElement(this.fields.tlscaInput);
        I.dontSeeElement(this.fields.tlsCertificateInput);
        I.dontSeeElement(this.fields.tlsCertificateKeyInput);
        I.click(this.fields.useTLS);
        I.waitForElement(this.fields.tlscaInput, 30);

        await this.fillFileContent(
          this.fields.tlscaInput,
          inputs.tlsCAFile,
        );
        await this.fillFileContent(
          this.fields.tlsCertificateInput,
          inputs.tlsCertificateFile,
        );
        await this.fillFileContent(
          this.fields.tlsCertificateKeyInput,
          inputs.tlsCertificateKeyFile,
        );
        break;
      case remoteInstancesHelper.services.mongodb:
        inputs = {
          ...remoteInstancesHelper.remote_instance.mongodb.psmdb_4_2,
          ...this.mongodbSettings,
        };
        host = getHostForNodeName(nodeName, inputs);
        I.fillField(this.fields.hostName, host);
        I.fillField(this.fields.userName, inputs.username);
        I.fillField(this.fields.password, inputs.password);
        I.fillField(this.fields.serviceName, srviceName);
        I.fillField(this.fields.environment, inputs.environment);
        I.fillField(this.fields.cluster, inputs.cluster);
        break;
      case remoteInstancesHelper.services.mongodb_ssl:
        inputs = remoteInstancesHelper.remote_instance.mongodb.mongodb_4_4_ssl;
        I.fillField(this.fields.hostName, inputs.host);
        adminPage.customClearField(this.fields.portNumber);
        I.fillField(this.fields.portNumber, inputs.port);
        I.fillField(this.fields.serviceName, serviceName);
        I.fillField(this.fields.environment, inputs.environment);
        I.fillField(this.fields.cluster, inputs.clusterName);
        I.dontSeeElement(this.fields.tlscaInput);
        I.dontSeeElement(this.fields.tlsCertificateFilePasswordInput);
        I.dontSeeElement(this.fields.tlsCertificateKey);
        I.click(this.fields.useTLS);
        I.waitForElement(this.fields.tlscaInput, 30);

        await this.fillFileContent(
          this.fields.tlscaInput,
          inputs.tlsCAFile,
        );
        await this.fillFileContent(
          this.fields.tlsCertificateFilePasswordInput,
          inputs.tlsCertificateKeyFilePassword,
        );
        await this.fillFileContent(
          this.fields.tlsCertificateKey,
          inputs.tlsCertificateKeyFile,
        );
        break;
      case remoteInstancesHelper.services.postgresql:
        inputs = {
          ...remoteInstancesHelper.remote_instance.postgresql.pdpgsql_15,
          ...this.potgresqlSettings,
        };
        port = getPortForNodeName(nodeName, inputs);
        host = getHostForNodeName(nodeName, inputs);
        I.fillField(this.fields.hostName, host);
        I.fillField(this.fields.userName, inputs.username);
        I.fillField(this.fields.password, inputs.password);
        adminPage.customClearField(this.fields.portNumber);
        I.fillField(this.fields.portNumber, port);
        I.fillField(this.fields.serviceName, overrideServiceName || srviceName);
        I.fillField(this.fields.environment, inputs.environment);
        I.fillField(this.fields.cluster, inputs.cluster);
        break;
      case remoteInstancesHelper.services.postgres_ssl:
        inputs = {
          ...remoteInstancesHelper.remote_instance.postgresql.postgres_13_3_ssl,
          ...this.potgresqlSettings,
        };
        I.fillField(this.fields.hostName, inputs.host);
        adminPage.customClearField(this.fields.portNumber);
        I.fillField(this.fields.portNumber, inputs.port);
        I.fillField(this.fields.serviceName, serviceName);
        I.fillField(this.fields.environment, inputs.environment);
        I.fillField(this.fields.cluster, inputs.clusterName);
        I.dontSeeElement(this.fields.tlscaInput);
        I.dontSeeElement(this.fields.tlsCertificateKeyInput);
        I.dontSeeElement(this.fields.tlsCertificateInput);
        I.click(this.fields.useTLS);
        I.waitForElement(this.fields.tlscaInput, 30);

        await this.fillFileContent(
          this.fields.tlscaInput,
          inputs.tlsCAFile,
        );
        await this.fillFileContent(
          this.fields.tlsCertificateInput,
          inputs.tlsCertFile,
        );
        await this.fillFileContent(
          this.fields.tlsCertificateKeyInput,
          inputs.tlsKeyFile,
        );
        break;
      case remoteInstancesHelper.services.proxysql:
        inputs = remoteInstancesHelper.remote_instance.proxysql.proxysql_2_1_1;
        host = getHostForNodeName(nodeName, inputs);
        I.fillField(this.fields.hostName, host);
        I.fillField(this.fields.userName, inputs.username);
        I.fillField(this.fields.password, inputs.password);
        I.fillField(this.fields.serviceName, overrideServiceName || srviceName);
        I.fillField(this.fields.environment, inputs.environment);
        I.fillField(this.fields.cluster, inputs.clusterName);
        break;
      case externalServiceName:
        inputs = remoteInstancesHelper.remote_instance.external.redis;
        I.fillField(this.fields.serviceName, serviceName);
        I.fillField(this.fields.hostName, inputs.host);
        I.fillField(this.fields.metricsPath, '/metrics');
        adminPage.customClearField(this.fields.portNumber);
        I.fillField(this.fields.portNumber, inputs.port);
        I.fillField(this.fields.environment, 'remote-external-service');
        I.fillField(this.fields.cluster, 'remote-external-cluster');
        break;
      case 'postgreDoNotTrack':
      case 'postgresPGStatStatements':
      case 'postgresPgStatMonitor':
        inputs = {
          ...remoteInstancesHelper.remote_instance.postgresql.pdpgsql_13_3,
          ...this.potgresqlSettings,
        };
        I.fillField(this.fields.hostName, inputs.host);
        I.fillField(this.fields.userName, inputs.username);
        I.fillField(this.fields.password, inputs.password);
        adminPage.customClearField(this.fields.portNumber);
        I.fillField(this.fields.portNumber, inputs.port);
        I.fillField(this.fields.serviceName, serviceName);
        break;
      case remoteInstancesHelper.services.postgresGC:
        inputs = {
          ...remoteInstancesHelper.remote_instance.gc.gc_postgresql,
          ...this.postgresGCSettings,
        };
        I.fillField(this.fields.hostName, inputs.address);
        I.fillField(this.fields.userName, inputs.userName);
        I.fillField(this.fields.password, inputs.password);
        I.fillField(this.fields.serviceName, serviceName);
        I.fillField(this.fields.environment, inputs.environment);
        I.fillField(this.fields.cluster, inputs.cluster);
    }
    adminPage.performPageDown(1);

    return inputs;
  },

  async createRemoteInstance(serviceName, options = {}) {
    I.waitForVisible(this.fields.addService, 30);

    // Skipping TLS verification is offered only once TLS is on.
    if (await I.grabNumberOfVisibleElements(this.fields.skipTLSL)) {
      I.checkOption(this.fields.skipTLSL);
    }

    // eslint-disable-next-line default-case
    switch (serviceName) {
      case remoteInstancesHelper.services.mongodb:
      case remoteInstancesHelper.services.mongodb_ssl:
        I.click(this.fields.useQANMongoDBProfiler);
        break;
      case remoteInstancesHelper.services.postgresql:
        I.seeCheckboxIsChecked(this.fields.pgStatMonitorRadioInput);
        I.click(this.fields.pgStatStatementsRadio);
        break;
      case 'pmm-qa-pgsql-12':
        I.click(this.fields.disableEnhancedMetrics);
        I.click(this.fields.disableBasicMetrics);
        break;
    }

    if (options.disableExamples) {
      I.click(this.fields.disableQueryExamples);
    }

    if (options.disableCollectors) {
      I.fillField(this.fields.disableCollectors, options.disableCollectors);
    }

    await this.clickAddInstanceAndWaitForSuccess();
    I.waitForVisible(pmmInventoryPage.fields.serviceRow(serviceName), 30);
  },

  async clickAddInstanceAndWaitForSuccess() {
    I.waitForVisible(this.fields.addService, 30);

    await I.usePlaywrightTo('click Add service and wait for response', async (args) => {
      let pageObject = args.page;

      if (args.browserContext) {
        const pages = args.browserContext.pages();

        if (pages.length > 0) {
          [pageObject] = pages;
        }
      }

      await Promise.all([
        pageObject.waitForResponse(
          async (response) => {
            if (response.url().includes('v1/management/services')) {
              if (response.status() === 200) {
                return true;
              }

              throw new Error(`Expected status 200 but received ${response.status()}. Response: ${await response.text()}`);
            }

            return false;
          },
          { timeout: 5000 },
        ),
        args.page.locator(this.fields.addService).click(),
      ]);
    });

    // A successful add opens the inventory, which is a Grafana page in the iframe.
    I.waitForElement(this.fields.iframe, 30);
    I.switchTo(this.fields.iframe);
  },

  openAddAzure() {
    I.waitForVisible(this.fields.addAzureMySQLPostgreSQL, 10);
    I.click(this.fields.addAzureMySQLPostgreSQL);
    I.waitForVisible(this.fields.clientID, 10);
  },

  discoverAzure() {
    I.fillField(this.fields.clientID, remoteInstancesHelper.remote_instance.azure.azure_client_id);
    I.fillField(this.fields.clientSecret, remoteInstancesHelper.remote_instance.azure.azure_client_secret);
    I.fillField(this.fields.tenantID, remoteInstancesHelper.remote_instance.azure.azure_tenant_id);
    I.fillField(this.fields.subscriptionID, remoteInstancesHelper.remote_instance.azure.azure_subscription_id);
    I.click(this.fields.discoverBtn);
    this.waitForDiscovery();
  },

  openAddAWSRDSMySQLPage() {
    I.click(this.fields.addAWSRDSMySQLbtn);
    I.waitForVisible(this.fields.accessKeyInput, 30);
    I.waitForVisible(this.fields.secretKeyInput, 30);
  },

  discoverRDS() {
    I.fillField(this.fields.accessKeyInput, this.accessKey);
    I.fillField(this.fields.secretKeyInput, this.secretKey);
    I.click(this.fields.discoverBtn);
    this.waitForDiscovery();
  },

  discoverRDSWithoutCredentials() {
    I.waitForVisible(this.elements.serverDiscoveryFailed, 60);
    I.click(this.fields.discoverBtn);
    I.waitForVisible(this.fields.noCredentialsError, 30);
  },

  waitForDiscovery() {
    I.waitForVisible(this.fields.discoveryResults, 30);
  },

  verifyInstanceIsDiscovered(instanceIdToMonitor) {
    const instanceIdLocator = this.rdsInstanceIdLocator(instanceIdToMonitor);

    I.seeElement(instanceIdLocator);
  },

  startMonitoringOfInstance(instanceIdToMonitor) {
    const instangeIdLocator = this.rdsInstanceIdLocator(instanceIdToMonitor);

    I.waitForVisible(instangeIdLocator, 30);
    I.click(instangeIdLocator);
  },

  verifyAddInstancePageOpened() {
    I.waitForVisible(this.fields.userName, 30);
    I.seeElement(this.fields.userName);
  },

  fillFields(serviceParameters) {
    adminPage.customClearField(this.fields.userName);
    I.waitForVisible(this.fields.userName, 30);
    I.fillField(this.fields.userName, serviceParameters.userName);
    I.fillField(this.fields.password, serviceParameters.password);
    I.fillField(this.fields.environment, serviceParameters.environment);
    I.fillField(this.fields.cluster, serviceParameters.cluster);
    I.fillField(this.fields.replicationSet, serviceParameters.replicationSet);
  },

  async fillRemoteRDSFields(serviceName, nodeName) {
    let inputs;
    const srviceName = nodeName.startsWith('client_container') ? `${serviceName}_client` : serviceName;

    this.selectNodeForRemoteInstance(nodeName);
    // eslint-disable-next-line default-case
    switch (serviceName) {
      case 'rds-mysql56':
        inputs = this.mysqlInputs;
        adminPage.customClearField(this.fields.serviceName);
        I.fillField(this.fields.serviceName, srviceName);
        this.fillFields(inputs);
        break;
      case 'pmm-qa-mysql-8-0-30':
        inputs = this.mysql80rdsInput;
        adminPage.customClearField(this.fields.serviceName);
        I.fillField(this.fields.serviceName, srviceName);
        this.fillFields(inputs);
        break;
      case 'pmm-qa-rds-mysql-8-4':
        inputs = this.mysql84rdsInput;
        adminPage.customClearField(this.fields.serviceName);
        I.fillField(this.fields.serviceName, srviceName);
        this.fillFields(inputs);
        break;
      case 'pmm-qa-rds-mysql-5-7-39':
        inputs = this.mysql57rdsInput;
        adminPage.customClearField(this.fields.serviceName);
        I.fillField(this.fields.serviceName, srviceName);
        this.fillFields(inputs);
        break;
      case 'pmmqa-rds-pgsql13-4':
        inputs = this.postgresql13Inputs;
        this.fillFields(inputs);
        break;
      case 'pmm-qa-rds-pgsql-14':
        inputs = this.postgresql14Inputs;
        this.fillFields(inputs);
        break;
      case 'pmm-qa-postgres-15-10':
        inputs = this.postgresql15Inputs;
        this.fillFields(inputs);
        break;
      case 'pmm-qa-pgsql-16':
        inputs = this.postgresql16Inputs;
        I.click(this.fields.useTLS);
        I.click(this.fields.skipTLSL);
        this.fillFields(inputs);
        break;
      case 'pmm-qa-rds-pgsql-17-1':
        inputs = this.postgresql17Inputs;
        I.click(this.fields.useTLS);
        I.click(this.fields.skipTLSL);
        this.fillFields(inputs);
        break;
      case 'pmm-qa-rds-aurora-15-instance-1':
        inputs = this.postgres15auroraInputs;
        this.fillFields(inputs);
        break;
      case 'pmm-qa-aurora-postgres-16-6-instance-1':
        inputs = this.postgres16auroraInputs;
        I.click(this.fields.useTLS);
        I.click(this.fields.skipTLSL);
        this.fillFields(inputs);
        break;
      case 'azure-MySQL':
        inputs = this.mysqlAzureInputs;
        adminPage.customClearField(this.fields.serviceName);
        I.fillField(this.fields.serviceName, serviceName);
        this.fillFields(inputs);
        break;
      case 'azure-PostgreSQL':
        inputs = this.postgresqlAzureInputs;
        adminPage.customClearField(this.fields.serviceName);
        I.fillField(this.fields.serviceName, serviceName);
        this.fillFields(inputs);
    }
    I.scrollPageToBottom();

    return inputs;
  },

  parseURL(url) {
    I.waitForVisible(this.fields.parseFromURLRadioButton, 30);
    I.click(this.fields.parseFromURLRadioButton);
    I.waitForVisible(this.fields.urlInput, 30);
    I.fillField(this.fields.urlInput, url);
    I.click(this.fields.parseFromURLRadioButton);
    I.wait(2);
    I.click(this.fields.setManualy);
  },

  async checkParsing(metricsPath, credentials) {
    const grabbedHostname = await I.grabValueFrom(this.fields.hostName);
    const grabbedMetricPath = await I.grabValueFrom(this.fields.metricsPath);
    const grabbedPort = await I.grabValueFrom(this.fields.portNumber);
    const grabbedCredentials = await I.grabValueFrom(this.fields.userName);

    assert.ok(grabbedHostname === process.env.MONITORING_HOST, `Hostname is not parsed correctly: ${grabbedHostname}`);
    assert.ok(grabbedMetricPath === metricsPath, `Metrics path is not parsed correctly: ${grabbedMetricPath}`);
    assert.ok(grabbedPort === process.env.EXTERNAL_EXPORTER_PORT, `Port is not parsed correctly: ${grabbedPort}`);
    assert.ok(grabbedCredentials === credentials, `Username is not parsed correctly: ${grabbedCredentials}`);
    assert.ok(grabbedCredentials === credentials, `Password is not parsed correctly: ${grabbedCredentials}`);
    I.seeCheckboxIsChecked(this.fields.schemeRadioHttps);
  },

  // The port is prefilled with the service type's default, so only the hostname is reported.
  checkRequiredField() {
    I.waitForVisible(this.fields.requiredFieldHostname, 30);
  },
};
