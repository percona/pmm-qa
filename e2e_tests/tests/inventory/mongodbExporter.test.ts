import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

const containerName = 'rs101';
const serviceName = 'mongodb_test_pass_plus';
const testUser = { password: 'pass+', username: 'test_user' } as const;

pmmTest.beforeEach(async ({ cliHelper, mongoDbHelper }) => {
  await mongoDbHelper.addUser(testUser.username, testUser.password, [
    { db: 'admin', role: 'explainRole' },
    { db: 'admin', role: 'clusterMonitor' },
    { db: 'local', role: 'read' },
    { collection: '', db: 'admin', role: 'readWrite' },
    { db: 'admin', role: 'backup' },
    { db: 'admin', role: 'clusterMonitor' },
    { db: 'admin', role: 'restore' },
    { db: 'admin', role: 'pbmAnyAction' },
  ]);
  expect(
    cliHelper
      .execSilent(`docker ps --filter 'name=${containerName}' --format '{{.Names}}'`)
      .assertSuccess()
      .getStdOutLines(),
    `${containerName} docker container should exist. please run pmm-framework with --database psmdb`,
  ).toContain(containerName);
});

pmmTest.afterEach(async ({ cliHelper, mongoDbHelper }) => {
  cliHelper.execSilent(`docker exec ${containerName} pmm-admin remove mongodb ${serviceName} || true`);
  await mongoDbHelper.dropUser(testUser.username);
});

pmmTest(
  'PMM-T1241 - Verify add mongoDB service with "+" in user password @mongodb-exporter',
  async ({ api, cliHelper }) => {
    cliHelper
      .execute(
        `docker exec ${containerName} pmm-admin add mongodb --username=${testUser.username} --password=${testUser.password} --host=${containerName} --service-name=${serviceName}`,
      )
      .assertSuccess();
    await api.grafanaApi.waitForMetric(`mongodb_up{service_name="${serviceName}"}`, Timeouts.TWO_MINUTES);
  },
);
