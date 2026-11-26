import pmmTest from '@fixtures/pmmTest';
import Credentials from '@helpers/credentials.helper';
import { serviceConnections, testUser } from '@helpers/serviceConnection.helper';
import { Timeouts } from '@helpers/timeouts';
import { ServiceType } from '@interfaces/inventory';
import { expect } from '@playwright/test';
import * as remoteInstances from '@testdata/remoteInstances';

const { pdpgsql, perconaServer, psmdb } = new Credentials();
const externalExporter = {
  ...remoteInstances.externalExporter,
  serviceName: `${remoteInstances.externalExporter.serviceName}_fb_instances`,
};
const haproxy = {
  ...remoteInstances.haproxy,
  serviceName: `${remoteInstances.haproxy.serviceName}_fb_instances`,
};
const frameworkDatabases = remoteInstances.remoteDatabases.map((database) => ({
  ...database,
  serviceName: `${database.serviceName}_fb_instances`,
  ...{
    mongodb: { container: '^rs101$', password: psmdb.password, username: psmdb.username },
    mysql: { container: '^ps_pmm_[0-9]+_[0-9]+_1$', ...perconaServer.ps_84 },
    postgresql: { container: '^pgsql_pgss_pmm_', ...pdpgsql },
    proxysql: { container: '^pxc_proxysql_pmm_', password: testUser.password, username: testUser.username },
  }[database.type],
}));
const [mysqlDatabase] = frameworkDatabases.filter(({ type }) => type === 'mysql');
const metrics = [
  { metric: 'pg_stat_database_xact_rollback', serviceName: 'pmm-server-postgresql' },
  { metric: 'redis_uptime_in_seconds', serviceName: externalExporter.serviceName },
  { metric: 'haproxy_process_start_time_seconds', serviceName: haproxy.serviceName },
  { metric: 'mysql_global_status_max_used_connections', serviceName: mysqlDatabase.serviceName },
  {
    metric: 'mongodb_up',
    serviceName: frameworkDatabases.filter(({ type }) => type === 'mongodb')[0].serviceName,
  },
  {
    metric: 'proxysql_up',
    serviceName: frameworkDatabases.filter(({ type }) => type === 'proxysql')[0].serviceName,
  },
] as const;
const disabledCollectors = [
  {
    absentMetric: 'mysql_global_status_connection_errors_total',
    agentName: 'MySQL exporter',
    collectors: ['global_status', 'perf_schema.eventsstatements'],
    presentMetric: 'mysql_exporter_collector_success',
    type: 'mysql',
  },
  {
    absentMetric: 'pg_stat_database_blks_read',
    agentName: 'PostgreSQL exporter',
    collectors: ['stat_database'],
    presentMetric: 'pg_database_size_bytes',
    type: 'postgresql',
  },
  {
    absentMetric: 'proxysql_stats_memory_auth_memory',
    agentName: 'ProxySQL exporter',
    collectors: ['stats_memory_metrics'],
    presentMetric: 'proxysql_up',
    type: 'proxysql',
  },
] as const;
const noDefaultDatabase = {
  container: 'postgresnodb',
  database: 'not_default_db',
  password: '50mFC#z7lHZ1',
  serviceName: 'no_default_db_service',
  username: 'test',
};
const disableExamplesServiceName = 'mysql_disable_examples';
const sharedServiceNames = [
  ...frameworkDatabases.map(({ serviceName }) => serviceName),
  externalExporter.serviceName,
  haproxy.serviceName,
];
const ownServiceNames = [
  ...frameworkDatabases.map(({ serviceName }) => `${serviceName}_client`),
  ...disabledCollectors.map(({ type }) => `${type}_disable_collectors`),
  disableExamplesServiceName,
  noDefaultDatabase.serviceName,
];
const [proxysqlConnection] = serviceConnections.filter(({ name }) => name === 'proxysql');

pmmTest.describe.configure({ mode: 'default' });

pmmTest.beforeAll(async ({ api, cliHelper, credentials, dockerHelper }) => {
  const proxysql = dockerHelper.getContainerName('^pxc_proxysql_pmm_');

  await api.inventoryApi.removeNodesByName([...sharedServiceNames, ...ownServiceNames]);
  cliHelper.execSilent(proxysqlConnection.dropUser(proxysql, credentials)).assertSuccess();
  cliHelper.execSilent(proxysqlConnection.createUser(proxysql, credentials)).assertSuccess();
});

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest.afterEach(async ({ api, cliHelper }) => {
  await api.inventoryApi.removeNodesByName(ownServiceNames);
  cliHelper.removeContainer(noDefaultDatabase.container);
});

pmmTest.afterAll(async ({ api, cliHelper, credentials, dockerHelper }) => {
  await api.inventoryApi.removeNodesByName(sharedServiceNames);
  cliHelper
    .execSilent(proxysqlConnection.dropUser(dockerHelper.getContainerName('^pxc_proxysql_pmm_'), credentials))
    .assertSuccess();
});

pmmTest(
  'PMM-T1700 - External service name is properly displayed @fb-instances',
  async ({ api, page, servicesPage }) => {
    const { service_name } = await api.inventoryApi.getServiceDetailsByRegexAndParameters(
      '^redis_external_service_',
      { service_type: ServiceType.external },
    );

    await page.goto(servicesPage.url);
    await servicesPage.pagination.showAllRows();
    await expect(servicesPage.builders.serviceRow(service_name)).toBeVisible({
      timeout: Timeouts.THIRTY_SECONDS,
    });
  },
);

pmmTest(
  'PMM-T588 - Verify adding external exporter service via UI @fb-instances',
  async ({ addInstancePage, agentsPage, page, servicesPage }) => {
    await pmmTest.step('Add the external exporter as a remote service', async () => {
      await page.goto(addInstancePage.url);
      await addInstancePage.builders.instanceType('external').click({ timeout: Timeouts.THIRTY_SECONDS });
      await addInstancePage.fillRemoteFields(externalExporter);
      expect((await addInstancePage.addService()).status()).toEqual(200);
    });

    await expect(servicesPage.builders.serviceRow(externalExporter.serviceName)).toBeVisible({
      timeout: Timeouts.THIRTY_SECONDS,
    });
    await servicesPage.openServiceAgents(externalExporter.serviceName);
    await expect(agentsPage.builders.agentTypeCell('External exporter')).toBeVisible({
      timeout: Timeouts.THIRTY_SECONDS,
    });
  },
);

for (const database of frameworkDatabases) {
  pmmTest(
    `PMM-T898 - Verify Remote Instance Addition [critical] @fb-instances | ${database.type}`,
    async ({ addInstancePage, dockerHelper, page, servicesPage }) => {
      await page.goto(addInstancePage.url);
      await addInstancePage.fillRemoteDatabase(database.type, 'pmm-server', {
        ...database,
        host: dockerHelper.getContainerName(database.container),
      });

      if (database.type === 'postgresql') await addInstancePage.verifyPgStatMonitorIsDefault();

      await addInstancePage.configureRemoteInstance(database.type);
      expect((await addInstancePage.addService()).status()).toEqual(200);
      await expect(servicesPage.builders.serviceRow(database.serviceName)).toBeVisible({
        timeout: Timeouts.THIRTY_SECONDS,
      });
    },
  );
}

for (const database of frameworkDatabases) {
  pmmTest(
    `PMM-T1940 - Verify Remote Instance Addition [critical] (Verify Ability to monitor DBs from a different node) @fb-instances | ${database.type}`,
    async ({ addInstancePage, api, dockerHelper, page, servicesPage }) => {
      const serviceName = `${database.serviceName}_client`;
      const clientNode =
        (await api.inventoryApi.getAllNodes())
          .map(({ node_name }) => node_name)
          .find((nodeName) => nodeName.startsWith('client_container')) ?? '';

      expect(clientNode, 'A pmm-agent node named client_container* must be registered').toMatch(
        /^client_container/,
      );
      await page.goto(addInstancePage.url);
      await addInstancePage.fillRemoteDatabase(database.type, clientNode, {
        ...database,
        host: dockerHelper.getContainerAddress(dockerHelper.getContainerName(database.container)),
        serviceName,
      });

      if (database.type === 'postgresql') await addInstancePage.verifyPgStatMonitorIsDefault();

      await addInstancePage.configureRemoteInstance(database.type);
      expect((await addInstancePage.addService()).status()).toEqual(200);
      await expect(servicesPage.builders.serviceRow(serviceName)).toBeVisible({
        timeout: Timeouts.THIRTY_SECONDS,
      });
    },
  );
}

pmmTest(
  'PMM-T630 - Verify adding External service with empty fields via UI @fb-instances',
  async ({ addInstancePage, page }) => {
    await page.goto(addInstancePage.url);
    await addInstancePage.builders.instanceType('external').click({ timeout: Timeouts.THIRTY_SECONDS });
    await addInstancePage.buttons.addService.click({ timeout: Timeouts.TWO_MINUTES });
    await expect(addInstancePage.messages.hostRequired).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    await expect(addInstancePage.messages.portRequired).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
  },
);

for (const database of frameworkDatabases) {
  pmmTest(
    `PMM-T2858 - Verify Remote Instance has Status Running [critical] @fb-instances | ${database.type}`,
    async ({ agentsPage, api, page, servicesPage }) => {
      await page.goto(servicesPage.url);
      await expect(servicesPage.builders.serviceRow(database.serviceName)).toBeVisible({
        timeout: Timeouts.THIRTY_SECONDS,
      });

      const { service_id } = await api.inventoryApi.getServiceDetailsByRegexAndParameters(
        `^${database.serviceName}$`,
        { service_type: ServiceType[database.type] },
      );

      await agentsPage.verifyRunningAgents(service_id, database.type === 'proxysql' ? 1 : 2);
    },
  );
}

pmmTest(
  'PMM-T2859 - TableStats UI Default table Options for Remote MySQL & AWS-RDS Instance @fb-instances',
  async ({ addInstancePage, page }) => {
    await page.goto(addInstancePage.url);
    await addInstancePage.builders.instanceType('mysql').click({ timeout: Timeouts.THIRTY_SECONDS });
    await expect(addInstancePage.inputs.tablestatsGroupTableLimit).toHaveValue('-1', {
      timeout: Timeouts.TWO_MINUTES,
    });
    await addInstancePage.builders.radioLabel('Default').click();
    await expect(addInstancePage.inputs.tablestatsGroupTableLimit).toHaveValue('1000');
    await addInstancePage.builders.radioLabel('Custom').click();
    await expect(addInstancePage.inputs.tablestatsGroupTableLimit).toHaveValue('1000');
  },
);

pmmTest('PMM-T637 - Verify elements on HAProxy page @fb-instances', async ({ addInstancePage, page }) => {
  await page.goto(addInstancePage.url);
  await addInstancePage.builders.instanceType('haproxy').click({ timeout: Timeouts.THIRTY_SECONDS });
  await addInstancePage.verifyRemoteFormFields(Timeouts.TWO_MINUTES);
});

pmmTest(
  'PMM-T636 - Verify adding HAProxy with all empty fields @fb-instances',
  async ({ addInstancePage, page }) => {
    await page.goto(addInstancePage.url);
    await addInstancePage.builders.instanceType('haproxy').click({ timeout: Timeouts.THIRTY_SECONDS });
    await addInstancePage.buttons.addService.click({ timeout: Timeouts.TWO_MINUTES });
    await expect(addInstancePage.messages.hostRequired).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
  },
);

pmmTest(
  'PMM-T635 - Verify Adding HAProxy service via UI @fb-instances',
  async ({ addInstancePage, agentsPage, page, servicesPage }) => {
    await pmmTest.step('Add HAProxy as a remote service', async () => {
      await page.goto(addInstancePage.url);
      await addInstancePage.builders.instanceType('haproxy').click({ timeout: Timeouts.THIRTY_SECONDS });
      await addInstancePage.fillRemoteFields(haproxy);
      expect((await addInstancePage.addService()).status()).toEqual(200);
    });

    await expect(servicesPage.builders.serviceRow(haproxy.serviceName)).toBeVisible({
      timeout: Timeouts.THIRTY_SECONDS,
    });
    await servicesPage.openServiceAgents(haproxy.serviceName);
    await agentsPage.builders
      .showAgentDetails('External exporter')
      .click({ timeout: Timeouts.THIRTY_SECONDS });

    for (const label of ['metrics_scheme=http', 'metrics_path=/metrics', 'listen_port=42100']) {
      await expect(agentsPage.builders.agentDetailsLabel(label)).toBeVisible({
        timeout: Timeouts.TEN_SECONDS,
      });
    }
  },
);

pmmTest(
  'PMM-T1089 - Verify UI elements for PostgreSQL Instance @fb-instances',
  async ({ addInstancePage, page }) => {
    await page.goto(addInstancePage.url);
    await addInstancePage.builders.instanceType('postgresql').click({ timeout: Timeouts.THIRTY_SECONDS });
    await addInstancePage.buttons.addService.click({ timeout: Timeouts.ONE_MINUTE });
    await expect(addInstancePage.messages.hostRequired).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    await expect(addInstancePage.messages.portRequired).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    await addInstancePage.verifyRemoteFormFields();

    for (const tracking of ["Don't track", 'PG Stat Statements', 'PG Stat Monitor'] as const) {
      await expect(addInstancePage.builders.radioLabel(tracking)).toBeVisible();
    }
  },
);

pmmTest(
  `PMM-T854 - Verify QAN after remote instance is added @fb-instances | ${mysqlDatabase.environment}`,
  async ({ page, qanStoredMetrics, urlHelper }) => {
    await expect(async () => {
      await page.goto(
        urlHelper.buildUrlWithParameters(qanStoredMetrics.url, {
          environment: mysqlDatabase.environment,
          from: 'now-5m',
          to: 'now',
        }),
      );
      await qanStoredMetrics.waitForLoad();
      expect(
        await qanStoredMetrics.getQueryCount(),
        `The queries for filter ${mysqlDatabase.environment} instance do NOT exist`,
      ).toBeGreaterThan(0);
    }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.TWO_MINUTES });
  },
);

for (const { metric, serviceName } of metrics) {
  pmmTest(
    `PMM-T743 - Check metrics from exporters are hitting PMM Server @fb-instances | ${serviceName}`,
    async ({ api }) => {
      await api.grafanaApi.waitForMetric(`${metric}{service_name="${serviceName}"}`, Timeouts.TEN_SECONDS);
    },
  );
}

pmmTest(
  'PMM-T1087 - Verify adding PostgreSQL remote instance without postgres database @fb-instances',
  async ({ addInstancePage, agentsPage, api, page, postgresqlHelper, servicesPage }) => {
    const [postgresqlDatabase] = frameworkDatabases.filter(({ type }) => type === 'postgresql');

    await postgresqlHelper.startWithoutDefaultDatabase(noDefaultDatabase.container, noDefaultDatabase);

    await pmmTest.step('Add the remote PostgreSQL with the default database', async () => {
      await page.goto(addInstancePage.url);
      await addInstancePage.fillRemoteDatabase('postgresql', 'pmm-server', {
        cluster: postgresqlDatabase.cluster,
        environment: postgresqlDatabase.environment,
        host: noDefaultDatabase.container,
        password: noDefaultDatabase.password,
        port: '5432',
        serviceName: noDefaultDatabase.serviceName,
        username: noDefaultDatabase.username,
      });
      await addInstancePage.buttons.addService.click();
      await expect(
        addInstancePage.builders.popUp('Connection check failed: pq: database "postgres" does not exist'),
      ).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    });

    await pmmTest.step('Add it again with an existing database', async () => {
      await addInstancePage.inputs.database.fill(noDefaultDatabase.database);
      expect((await addInstancePage.addService()).status()).toEqual(200);
      await expect(servicesPage.builders.serviceRow(noDefaultDatabase.serviceName)).toBeVisible({
        timeout: Timeouts.THIRTY_SECONDS,
      });
    });

    const { service_id } = await api.inventoryApi.getServiceDetailsByPartialName(
      noDefaultDatabase.serviceName,
    );

    await agentsPage.verifyRunningAgents(service_id, 1);
    await api.grafanaApi.waitForMetric(
      `pg_stat_database_xact_rollback{service_name="${noDefaultDatabase.serviceName}"}`,
    );
  },
);

pmmTest(
  'PMM-T2080 - Verify disable examples for MySQL @fb-instances',
  async ({
    addInstancePage,
    agentsPage,
    api,
    dockerHelper,
    page,
    qanStoredMetrics,
    servicesPage,
    urlHelper,
  }) => {
    await pmmTest.step('Add the remote MySQL with query examples disabled', async () => {
      await page.goto(addInstancePage.url);
      await addInstancePage.fillRemoteDatabase('mysql', 'pmm-server', {
        ...mysqlDatabase,
        host: dockerHelper.getContainerName(mysqlDatabase.container),
        serviceName: disableExamplesServiceName,
      });
      await addInstancePage.buttons.skipTlsVerify.check({ timeout: Timeouts.THIRTY_SECONDS });
      await addInstancePage.buttons.disableQueryExamples.click();
      expect((await addInstancePage.addService()).status()).toEqual(200);
      await expect(servicesPage.builders.serviceRow(disableExamplesServiceName)).toBeVisible({
        timeout: Timeouts.THIRTY_SECONDS,
      });
    });

    const { service_id } = await api.inventoryApi.getServiceDetailsByTypeAndPartialName(
      ServiceType.mysql,
      disableExamplesServiceName,
    );

    await page.goto(agentsPage.serviceAgentsUrl(service_id));
    await agentsPage.verifyAgentDetailsLabel(
      'QAN MySQL Performance Schema agent',
      'query_examples_disabled=true',
    );

    await expect(async () => {
      await page.goto(
        urlHelper.buildUrlWithParameters(qanStoredMetrics.url, {
          from: 'now-2m',
          serviceName: disableExamplesServiceName,
          to: 'now',
        }),
      );
      await qanStoredMetrics.waitForLoad();
      await qanStoredMetrics.searchByValue('SHOW GLOBAL STATUS');
      await qanStoredMetrics.waitForLoad();
      await expect(qanStoredMetrics.builders.queryRow(1)).toBeVisible({ timeout: Timeouts.FIVE_SECONDS });
    }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.FIVE_MINUTES });
    await qanStoredMetrics.selectRow(1);
    await qanStoredMetrics.openDetailsTab('Examples');
    await expect(qanStoredMetrics.elements.noExamples).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
  },
);

for (const { absentMetric, agentName, collectors, presentMetric, type } of disabledCollectors) {
  pmmTest(
    `PMM-T2246 + PMM-T2247 + PMM-T2248 - Verify disable collectors for remote DB services @fb-instances | ${type}`,
    async ({ addInstancePage, agentsPage, api, dockerHelper, page, servicesPage }) => {
      const [database] = frameworkDatabases.filter((remoteDatabase) => remoteDatabase.type === type);
      const serviceName = `${type}_disable_collectors`;

      await pmmTest.step('Add the remote service with collectors disabled', async () => {
        await page.goto(addInstancePage.url);
        await addInstancePage.fillRemoteDatabase(type, 'pmm-server', {
          ...database,
          host: dockerHelper.getContainerName(database.container),
          serviceName,
        });
        await expect(addInstancePage.inputs.disableCollectors).toBeVisible({
          timeout: Timeouts.THIRTY_SECONDS,
        });
        await expect(addInstancePage.elements.disableCollectorsLabel).toContainText('Disable collectors', {
          timeout: Timeouts.THIRTY_SECONDS,
        });
        await addInstancePage.buttons.skipTlsVerify.check({ timeout: Timeouts.THIRTY_SECONDS });
        await addInstancePage.inputs.disableCollectors.fill(collectors.join(', '));
        expect((await addInstancePage.addService()).status()).toEqual(200);
        await expect(servicesPage.builders.serviceRow(serviceName)).toBeVisible({
          timeout: Timeouts.THIRTY_SECONDS,
        });
      });

      const { service_id } = await api.inventoryApi.getServiceDetailsByTypeAndPartialName(
        ServiceType[type],
        serviceName,
      );

      await page.goto(agentsPage.serviceAgentsUrl(service_id));
      await agentsPage.builders.showAgentDetails(agentName).click({ timeout: Timeouts.THIRTY_SECONDS });

      await expect(
        agentsPage.builders.agentDetailsLabel(`disabled_collectors=${collectors.join(',')}`),
      ).toBeVisible({ timeout: Timeouts.TEN_SECONDS });

      await api.grafanaApi.waitForMetric(`${presentMetric}{service_id="${service_id}"}`);
      await api.grafanaApi.waitForMetricAbsent(`${absentMetric}{service_id="${service_id}"}`, 'now-5m');
    },
  );
}
