import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { ServiceType } from '@interfaces/inventory';
import { expect } from '@playwright/test';

const containerName = 'rs101';
const serviceName = 'mongodb_test_collections_flag';
const forceFlagServiceName = 'testing_force_flag';
const exporterType = 'mongodb_exporter';
const metrics = {
  collstats: 'mongodb_collstats_latencyStats_commands_latency',
  dbstats: 'mongodb_dbstats_collections',
  indexstats: 'mongodb_indexstats_accesses_ops',
  topmetrics: 'mongodb_top_total_count',
} as const;
const smartMetric = 'collector_scrape_time_ms';
const pmmAdmin = `docker exec ${containerName} pmm-admin`;
const addMongoDb = `${pmmAdmin} add mongodb --agent-password='testing' ${
  process.env.WIZARD_ARGS?.includes('GSSAPI')
    ? '--username="pmm@PERCONATEST.COM" --password=password1 --authentication-mechanism=GSSAPI --authentication-database="$external"'
    : '--username=pmm --password=pmmpass'
} --host=${containerName}`;
const addService = `${addMongoDb} --service-name=${serviceName} --replication-set=rs0s`;
const dbNames = ['db1', 'db2', 'db3', 'db4', 'db5', 'db6', 'db7', 'db8', 'db9'];

pmmTest.describe.configure({ mode: 'default' });

pmmTest.beforeEach(async ({ cliHelper, mongoDbHelper }) => {
  expect(
    cliHelper
      .execSilent(`docker ps --filter 'name=${containerName}' --format '{{.Names}}'`)
      .assertSuccess()
      .getStdOutLines(),
    `${containerName} docker container should exist. please run pmm-framework with --database psmdb`,
  ).toContain(containerName);

  for (const dbName of dbNames) {
    await mongoDbHelper.createBulkCollections(dbName, ['col1', 'col2', 'col3', 'col4', 'col5']);
  }
});

pmmTest.afterEach(async ({ cliHelper, mongoDbHelper }) => {
  cliHelper.removeService(containerName, ServiceType.mongodb, serviceName);
  cliHelper.removeService(containerName, ServiceType.mongodb, forceFlagServiceName);

  for (const dbName of dbNames) {
    await mongoDbHelper.dropDatabase(dbName);
  }
});

pmmTest(
  'PMM-T1860 - Verify there is no CommandNotSupportedOnView error in mongo logs when using --enable-all-collectors @mongodb-exporter',
  async ({ cliHelper }) => {
    expect(
      cliHelper
        .execSilent(`docker exec ${containerName} journalctl -u mongod --since "5 minutes ago"`)
        .assertSuccess().stdout,
      '"CommandNotSupportedOnView" error should not be in mongo logs',
    ).not.toContain('CommandNotSupportedOnView');
  },
);

pmmTest(
  'PMM-T1208 - Verify metrics of MongoDB added with default flags @mongodb-exporter',
  async ({ api, cliHelper }) => {
    cliHelper.execute(addService).assertSuccess();

    const exporter = await api.inventoryApi.getServiceAgent(ServiceType.mongodb, serviceName, exporterType);

    expect(
      exporter.mongo_db_options.enable_all_collectors,
      `enable_all_collectors must be disabled for ${serviceName}`,
    ).not.toBe(true);
    await api.grafanaApi.waitForMetric(
      `mongodb_up{service_id="${exporter.service_id}",job=~".+_lr"}`,
      Timeouts.FIVE_MINUTES,
    );

    for (const metric of [metrics.dbstats, metrics.collstats, metrics.topmetrics, metrics.indexstats]) {
      await api.grafanaApi.waitForMetricAbsent(`${metric}{service_id="${exporter.service_id}"}`, 'now-5m');
    }
  },
);

pmmTest(
  'PMM-T1209 - Verify metrics of MongoDB with --disable-collectors=topmetrics and --enable-all-collectors were specified @mongodb-exporter',
  async ({ api, cliHelper }) => {
    cliHelper
      .execute(`${addService} --enable-all-collectors --disable-collectors=topmetrics`)
      .assertSuccess();

    const exporter = await api.inventoryApi.getServiceAgent(ServiceType.mongodb, serviceName, exporterType);

    expect(exporter.mongo_db_options.enable_all_collectors, 'enable_all_collectors').toBe(true);
    expect(exporter.disabled_collectors, 'disabled_collectors').toEqual(['topmetrics']);

    for (const metric of [metrics.dbstats, metrics.collstats, metrics.indexstats]) {
      await api.grafanaApi.waitForMetric(
        `${metric}{service_id="${exporter.service_id}"}`,
        Timeouts.FIVE_MINUTES,
      );
    }

    await api.grafanaApi.waitForMetricAbsent(
      `${metrics.topmetrics}{service_id="${exporter.service_id}"}`,
      'now-5m',
    );
  },
);

pmmTest(
  'PMM-T1210 - Verify metrics of MongoDB with "--enable-all-collectors" was specified @mongodb-exporter',
  async ({ api, cliHelper }) => {
    cliHelper.execute(`${addService} --enable-all-collectors`).assertSuccess();

    const exporter = await api.inventoryApi.getServiceAgent(ServiceType.mongodb, serviceName, exporterType);

    expect(exporter.mongo_db_options.enable_all_collectors, 'enable_all_collectors').toBe(true);

    for (const metric of [metrics.dbstats, metrics.collstats, metrics.indexstats, metrics.topmetrics]) {
      await api.grafanaApi.waitForMetric(
        `${metric}{service_id="${exporter.service_id}"}`,
        Timeouts.FIVE_MINUTES,
      );
    }
  },
);

pmmTest(
  'PMM-T1211 - Verify metrics of MongoDB with --disable-collectors="" and --enable-all-collectors were specified @mongodb-exporter',
  async ({ api, cliHelper }) => {
    cliHelper.execute(`${addService} --enable-all-collectors --disable-collectors=""`).assertSuccess();

    const exporter = await api.inventoryApi.getServiceAgent(ServiceType.mongodb, serviceName, exporterType);

    expect(exporter.mongo_db_options.enable_all_collectors, 'enable_all_collectors').toBe(true);

    for (const metric of [metrics.dbstats, metrics.collstats, metrics.indexstats, metrics.topmetrics]) {
      await api.grafanaApi.waitForMetric(
        `${metric}{service_id="${exporter.service_id}"}`,
        Timeouts.FIVE_MINUTES,
      );
    }
  },
);

pmmTest(
  'PMM-T1212 - Verify metrics of MongoDB with --disable-collectors="collstats,dbstats,topmetrics" specified @mongodb-exporter',
  async ({ api, cliHelper }) => {
    cliHelper
      .execute(`${addService} --enable-all-collectors --disable-collectors="collstats,dbstats,topmetrics"`)
      .assertSuccess();

    const exporter = await api.inventoryApi.getServiceAgent(ServiceType.mongodb, serviceName, exporterType);

    expect(exporter.mongo_db_options.enable_all_collectors, 'enable_all_collectors').toBe(true);
    expect(exporter.disabled_collectors, 'disabled_collectors').toEqual([
      'collstats',
      'dbstats',
      'topmetrics',
    ]);

    await api.grafanaApi.waitForMetric(
      `${metrics.indexstats}{service_id="${exporter.service_id}"}`,
      Timeouts.FIVE_MINUTES,
    );

    for (const metric of [metrics.dbstats, metrics.collstats, metrics.topmetrics]) {
      await api.grafanaApi.waitForMetricAbsent(`${metric}{service_id="${exporter.service_id}"}`, 'now-5m');
    }
  },
);

pmmTest(
  'PMM-T1213 - Verify metrics of MongoDB with --stats-collections=db1,db2.col2 specified @mongodb-exporter',
  async ({ api, cliHelper }) => {
    cliHelper
      .execute(`${addService} --enable-all-collectors --stats-collections=db1,db2.col2`)
      .assertSuccess();

    const exporter = await api.inventoryApi.getServiceAgent(ServiceType.mongodb, serviceName, exporterType);
    const serviceFilter = `service_id="${exporter.service_id}"`;

    expect(exporter.mongo_db_options.enable_all_collectors, 'enable_all_collectors').toBe(true);

    for (const metric of [metrics.dbstats, metrics.collstats, metrics.indexstats, metrics.topmetrics]) {
      await api.grafanaApi.waitForMetric(`${metric}{${serviceFilter}}`, Timeouts.FIVE_MINUTES);
    }

    await api.grafanaApi.waitForMetric(
      `${metrics.collstats}{${serviceFilter},database="db1"}`,
      Timeouts.FIVE_MINUTES,
    );
    await api.grafanaApi.waitForMetric(
      `${metrics.collstats}{${serviceFilter},database="db2",collection="col2"}`,
      Timeouts.FIVE_MINUTES,
    );
    await api.grafanaApi.waitForMetricAbsent(
      `${metrics.collstats}{${serviceFilter},database="db3",collection="col3"}`,
      'now-5m',
    );
    await api.grafanaApi.waitForMetricAbsent(
      `${metrics.collstats}{${serviceFilter},database="db2",collection="col1"}`,
      'now-5m',
    );
  },
);

pmmTest(
  'PMM-T1213 - Verify metrics of MongoDB with --stats-collections=db1,db2.col2 & --max-collections-limit=5 specified when total collections across db1, db2 and the filters are 6 @mongodb-exporter',
  async ({ api, cliHelper }) => {
    cliHelper
      .execute(
        `${addService} --enable-all-collectors --max-collections-limit=5 --stats-collections=db1,db2.col2`,
      )
      .assertSuccess();

    const exporter = await api.inventoryApi.getServiceAgent(ServiceType.mongodb, serviceName, exporterType);
    const serviceFilter = `service_id="${exporter.service_id}"`;

    expect(exporter.mongo_db_options.enable_all_collectors, 'enable_all_collectors').toBe(true);
    await api.grafanaApi.waitForMetric(`mongodb_up{${serviceFilter},job=~".+_lr"}`, Timeouts.FIVE_MINUTES);

    for (const metric of [metrics.dbstats, metrics.collstats, metrics.indexstats, metrics.topmetrics]) {
      await api.grafanaApi.waitForMetricAbsent(`${metric}{${serviceFilter}}`, 'now-5m');
    }

    for (const filter of [
      'database="db1"',
      'database="db3",collection="col3"',
      'database="db2",collection="col1"',
      'database="db2",collection="col2"',
    ]) {
      await api.grafanaApi.waitForMetricAbsent(`${metrics.collstats}{${serviceFilter},${filter}}`, 'now-5m');
    }
  },
);

pmmTest(
  'PMM-T1213 - Verify metrics of MongoDB with --stats-collections=db1,db2.col2 & --max-collections-limit=400 specified to allow fetching metrics from all collectors @mongodb-exporter',
  async ({ api, cliHelper }) => {
    cliHelper
      .execute(
        `${addService} --enable-all-collectors --max-collections-limit=400 --stats-collections=db1,db2.col2`,
      )
      .assertSuccess();

    const exporter = await api.inventoryApi.getServiceAgent(ServiceType.mongodb, serviceName, exporterType);
    const serviceFilter = `service_id="${exporter.service_id}"`;

    expect(exporter.mongo_db_options.enable_all_collectors, 'enable_all_collectors').toBe(true);

    for (const metric of [metrics.dbstats, metrics.collstats, metrics.indexstats, metrics.topmetrics]) {
      await api.grafanaApi.waitForMetric(`${metric}{${serviceFilter}}`, Timeouts.FIVE_MINUTES);
    }

    await api.grafanaApi.waitForMetric(
      `${metrics.collstats}{${serviceFilter},database="db1"}`,
      Timeouts.FIVE_MINUTES,
    );
    await api.grafanaApi.waitForMetric(
      `${metrics.collstats}{${serviceFilter},database="db2",collection="col2"}`,
      Timeouts.FIVE_MINUTES,
    );
    await api.grafanaApi.waitForMetricAbsent(
      `${metrics.collstats}{${serviceFilter},database="db3",collection="col3"}`,
      'now-5m',
    );
    await api.grafanaApi.waitForMetricAbsent(
      `${metrics.collstats}{${serviceFilter},database="db2",collection="col1"}`,
      'now-5m',
    );
  },
);

pmmTest(
  'PMM-T2425 - Verify smart metrics of MongoDB with --stats-collections=db1,db2.col2 & --max-collections-limit=400 specified to allow fetching metrics from all collectors @mongodb-exporter',
  async ({ api, cliHelper }) => {
    const addSmartService = `${addService} --enable-all-collectors --max-collections-limit=400 --stats-collections=db1,db2.col2`;

    cliHelper.execute(addSmartService).assertSuccess();

    const exporter = await api.inventoryApi.getServiceAgent(ServiceType.mongodb, serviceName, exporterType);

    expect(exporter.mongo_db_options.enable_all_collectors, 'enable_all_collectors').toBe(true);

    for (const collector of [
      'collstats',
      'dbstats',
      'diagnostic_data',
      'general',
      'indexstats',
      'replset_status',
      'top',
    ]) {
      await api.grafanaApi.waitForMetric(
        `${smartMetric}{service_id="${exporter.service_id}",collector="${collector}"}`,
        Timeouts.FIVE_MINUTES,
      );
    }

    cliHelper.execute(`${pmmAdmin} remove mongodb ${serviceName}`).assertSuccess();
    cliHelper.execute(`${addSmartService} --disable-collectors='topmetrics'`).assertSuccess();

    const { service_id } = await api.inventoryApi.getServiceDetailsByTypeAndPartialName(
      ServiceType.mongodb,
      serviceName,
    );

    await api.grafanaApi.waitForMetric(
      `${smartMetric}{service_id="${service_id}",collector="dbstats"}`,
      Timeouts.FIVE_MINUTES,
    );
    await api.grafanaApi.waitForMetricAbsent(
      `${smartMetric}{service_id="${service_id}",collector="top"}`,
      'now-5m',
    );
  },
);

pmmTest(
  'PMM-T1352 + PMM-T610 - Verify that pmm-admin inventory remove service with --force flag stops running agents and collecting data from exporters @mongodb-exporter',
  async ({ api, cliHelper }) => {
    cliHelper.execute(`${addMongoDb} --enable-all-collectors --service-name=${serviceName}`).assertSuccess();

    const pmmAgentId = cliHelper.getPmmAdminStatusField(containerName, 'Agent ID');

    cliHelper
      .execute(`${addMongoDb} --enable-all-collectors --service-name=${forceFlagServiceName}`)
      .assertSuccess();

    const { service_id } = await api.inventoryApi.getServiceDetailsByTypeAndPartialName(
      ServiceType.mongodb,
      forceFlagServiceName,
    );

    await api.grafanaApi.waitForMetric(`mongodb_up{service_id="${service_id}"}`, Timeouts.TWO_MINUTES);
    cliHelper.execute(`${pmmAdmin} inventory remove service ${service_id} --force`).assertSuccess();
    await api.grafanaApi.waitForMetricAbsent(
      `mongodb_up{service_id="${service_id}"}`,
      'now-1m',
      Timeouts.TWO_MINUTES,
    );
    cliHelper
      .execute(`${pmmAdmin} inventory add agent node-exporter --log-level=fatal ${pmmAgentId}`)
      .assertFailure(
        'pmm-admin: error: --log-level must be one of "debug","info","warn","error" but got "fatal"',
      );
  },
);
