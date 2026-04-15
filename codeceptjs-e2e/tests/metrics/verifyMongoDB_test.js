const assert = require('assert');
const { gssapi } = require('../helper/constants');

Feature('MongoDB Metrics tests');

const connection = {
  host: '127.0.0.1',
  // eslint-disable-next-line no-inline-comments
  port: '27027', // This is the port used by --database psmdb
  username: 'pmm',
  password: 'pmmpass',
};
const mongodb_service_name = 'mongodb_test_pass_plus';
const mongo_test_user = {
  username: 'test_user',
  password: 'pass+',
};

const clientCredentialsFlags = gssapi.enabled
  ? gssapi.credentials_flags
  : `--username=${mongo_test_user.username} --password=${mongo_test_user.password}`;

const telemetry = {
  collstats: 'mongodb_collector_scrape_time_collstats',
  dbstats: 'mongodb_collector_scrape_time_dbstats',
  diagnosticData: 'mongodb_collector_scrape_time_diagnostic_data',
  general: 'mongodb_collector_scrape_time_general',
  indexstats: 'mongodb_collector_scrape_time_indexstats',
  top: 'mongodb_collector_scrape_time_top',
  replsetStatus: 'mongodb_collector_scrape_time_replset_status',
};

const containerName = 'rs101';

BeforeSuite(async ({ I }) => {
  await I.mongoConnect(connection);
  await I.mongoAddUser(mongo_test_user.username, mongo_test_user.password, [
    { role: 'explainRole', db: 'admin' },
    { role: 'clusterMonitor', db: 'admin' },
    { role: 'read', db: 'local' },
    { db: 'admin', role: 'readWrite', collection: '' },
    { db: 'admin', role: 'backup' },
    { db: 'admin', role: 'clusterMonitor' },
    { db: 'admin', role: 'restore' },
    { db: 'admin', role: 'pbmAnyAction' },
  ]);

  // check that rs101 docker container exists
  const dockerCheck = await I.verifyCommand(`docker ps | grep ${containerName}`);

  assert.ok(dockerCheck.includes(containerName), 'rs101 docker container should exist. please run pmm-framework with --database psmdb');
});

Before(async ({ I }) => {
  await I.Authorize();
});

After(async ({ I }) => {
  await I.verifyCommand(`docker exec ${containerName} pmm-admin remove mongodb ${mongodb_service_name} || true`);
});

AfterSuite(async ({ I }) => {
  await I.mongoDisconnect();
});

Scenario(
  'PMM-T1241 - Verify add mongoDB service with "+" in user password @mongodb-exporter',
  async ({ I, grafanaAPI }) => {
    await I.say(
      await I.verifyCommand(`docker exec ${containerName} pmm-admin add mongodb ${clientCredentialsFlags} --host=${containerName} --service-name=${mongodb_service_name}`),
    );

    await grafanaAPI.waitForMetric('mongodb_up', { type: 'service_name', value: mongodb_service_name }, 65);
  },
);

Scenario(
  'PMM-T1458 - Verify MongoDB exporter meta-metrics supporting @mongodb-exporter',
  async ({ I }) => {
    await I.say(await I.verifyCommand(`docker exec ${containerName} pmm-admin add mongodb ${clientCredentialsFlags} --host=${containerName} --service-name=${mongodb_service_name} --enable-all-collectors`));
    let logs = '';

    await I.asyncWaitFor(async () => {
      logs = await I.verifyCommand('docker exec pmm-server cat /srv/logs/pmm-managed.log | grep mongodb_collector_scrape_time');

      return logs.includes(telemetry.collstats) && logs.includes(telemetry.dbstats) && logs.includes(telemetry.diagnosticData)
        && logs.includes(telemetry.general) && logs.includes(telemetry.indexstats) && logs.includes(telemetry.top)
        && logs.includes(telemetry.replsetStatus);
    }, 60);
    I.assertTrue(logs.includes(telemetry.collstats), `/srv/logs/pmm-managed.log expected to contain '${telemetry.collstats}'`);
    I.assertTrue(logs.includes(telemetry.dbstats), `/srv/logs/pmm-managed.log expected to contain '${telemetry.dbstats}'`);
    I.assertTrue(logs.includes(telemetry.diagnosticData), `/srv/logs/pmm-managed.log expected to contain '${telemetry.diagnosticData}'`);
    I.assertTrue(logs.includes(telemetry.general), `/srv/logs/pmm-managed.log expected to contain '${telemetry.general}'`);
    I.assertTrue(logs.includes(telemetry.indexstats), `/srv/logs/pmm-managed.log expected to contain '${telemetry.indexstats}'`);
    I.assertTrue(logs.includes(telemetry.top), `/srv/logs/pmm-managed.log expected to contain '${telemetry.top}'`);
    I.assertTrue(logs.includes(telemetry.replsetStatus), `/srv/logs/pmm-managed.log expected to contain '${telemetry.replsetStatus}'`);
  },
);
