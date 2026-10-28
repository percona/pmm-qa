import Api from '@api/api';
import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';
import {
  auroraInstanceId,
  auroraMysql,
  awsCredentials,
  azureCredentials,
  azureDatabases,
  editedLabels,
  externalExporter,
  haproxy,
  rdsMysql57,
  remoteDatabases,
} from '@testdata/remoteInstances';

const remoteNodeNames = [
  ...remoteDatabases.map(({ serviceName }) => serviceName),
  ...azureDatabases.map(({ serviceName }) => serviceName),
  externalExporter.serviceName,
  haproxy.serviceName,
  rdsMysql57.serviceName,
  auroraInstanceId,
];
const qanFilters = [
  ...remoteDatabases
    .filter(({ type }) => type === 'mysql' || type === 'mongodb')
    .map(({ environment }) => environment),
  ...azureDatabases.map(({ environment }) => environment),
];

pmmTest.describe.configure({ mode: 'default' });

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest.afterAll(async ({ browser }) => {
  const page = await browser.newPage();
  const api = new Api(page, page.request);
  const nodes = await api.inventoryApi.getAllNodes();

  for (const { node_id } of nodes.filter(({ node_name }) => remoteNodeNames.includes(node_name))) {
    await api.inventoryApi.deleteNode(node_id, true);
  }

  await api.settingsApi.changeSettings({ enable_azurediscover: false });
  await page.close();
});

for (const database of remoteDatabases) {
  pmmTest(
    `PMM-T2340 - Verify Remote Instances can be created and edited [critical] @instances | ${database.type}`,
    async ({ addInstancePage, page, servicesPage }) => {
      const labels = editedLabels(database.serviceName, database);

      await page.goto(addInstancePage.url);
      await addInstancePage.builders.instanceType(database.type).click({ timeout: Timeouts.THIRTY_SECONDS });
      await addInstancePage.selectNode('pmm-server');
      await addInstancePage.fillRemoteFields(database);

      if (database.type === 'postgresql') await addInstancePage.verifyPgStatMonitorIsDefault();

      await addInstancePage.configureRemoteInstance(database.type);
      expect((await addInstancePage.addService()).status()).toEqual(200);
      await expect(servicesPage.builders.serviceRow(database.serviceName)).toBeVisible({
        timeout: Timeouts.THIRTY_SECONDS,
      });
      await servicesPage.editServiceLabels(database.serviceName, labels);
      await servicesPage.verifyEditedServiceLabels(database.serviceName, labels);
    },
  );
}

pmmTest(
  'PMM-T2340 - Verify adding and editing external exporter service via UI @instances',
  async ({ addInstancePage, page, servicesPage }) => {
    const labels = editedLabels(externalExporter.serviceName, externalExporter);

    await page.goto(addInstancePage.url);
    await addInstancePage.builders.instanceType('external').click({ timeout: Timeouts.THIRTY_SECONDS });
    await addInstancePage.fillRemoteFields(externalExporter);
    expect((await addInstancePage.addService()).status()).toEqual(200);
    await expect(servicesPage.builders.serviceRow(externalExporter.serviceName)).toBeVisible({
      timeout: Timeouts.THIRTY_SECONDS,
    });
    await servicesPage.editServiceLabels(externalExporter.serviceName, labels);
    await servicesPage.verifyEditedServiceLabels(externalExporter.serviceName, labels);
  },
);

pmmTest(
  'PMM-T2340 - Verify adding and editing RDS instances [critical] @instances',
  async ({ addInstancePage, page, servicesPage }) => {
    const labels = editedLabels(rdsMysql57.serviceName, rdsMysql57);

    await page.goto(addInstancePage.url);
    await addInstancePage.discoverRds(awsCredentials.accessKey, awsCredentials.secretKey);
    await addInstancePage.builders
      .discoveredInstance(rdsMysql57.serviceName)
      .click({ timeout: Timeouts.THIRTY_SECONDS });
    await expect(addInstancePage.inputs.username).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    await addInstancePage.selectNode('pmm-server');
    await addInstancePage.fillDiscoveredInstanceFields(rdsMysql57);
    await addInstancePage.configureRemoteInstance('mysql');
    expect((await addInstancePage.addService()).status()).toEqual(200);
    await expect(servicesPage.builders.serviceRow(rdsMysql57.serviceName)).toBeVisible({
      timeout: Timeouts.THIRTY_SECONDS,
    });
    await servicesPage.editServiceLabels(rdsMysql57.serviceName, labels);
    await servicesPage.verifyEditedServiceLabels(rdsMysql57.serviceName, labels);
  },
);

pmmTest(
  'PMM-T2340 - Verify Adding and Editing HAProxy service via UI @instances',
  async ({ addInstancePage, page, servicesPage }) => {
    const labels = editedLabels(haproxy.serviceName, {});

    await page.goto(addInstancePage.url);
    await addInstancePage.builders.instanceType('haproxy').click({ timeout: Timeouts.THIRTY_SECONDS });
    await addInstancePage.fillRemoteFields(haproxy);
    expect((await addInstancePage.addService()).status()).toEqual(200);
    await expect(servicesPage.builders.serviceRow(haproxy.serviceName)).toBeVisible({
      timeout: Timeouts.THIRTY_SECONDS,
    });
    await servicesPage.editServiceLabels(haproxy.serviceName, labels);
    await servicesPage.verifyEditedServiceLabels(haproxy.serviceName, labels);
  },
);

for (const database of azureDatabases) {
  pmmTest(
    `PMM-T2340 - Verify adding and editing monitoring for Azure @instances | ${database.serviceName}`,
    async ({ addInstancePage, api, page, servicesPage }) => {
      const labels = editedLabels(database.serviceName, database);

      await api.settingsApi.changeSettings({ enable_azurediscover: true });
      await page.goto(addInstancePage.url);
      await addInstancePage.discoverAzure(azureCredentials);
      await addInstancePage.builders
        .discoveredInstance(database.instanceToMonitor)
        .click({ timeout: Timeouts.THIRTY_SECONDS });
      await expect(addInstancePage.inputs.username).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
      await addInstancePage.selectNode('pmm-server');
      await addInstancePage.fillDiscoveredInstanceFields(database);
      expect((await addInstancePage.addService()).status()).toEqual(200);
      await expect(servicesPage.builders.serviceRow(database.serviceName)).toBeVisible({
        timeout: Timeouts.THIRTY_SECONDS,
      });
      await servicesPage.editServiceLabels(database.serviceName, labels);
      await servicesPage.verifyEditedServiceLabels(database.serviceName, labels);
    },
  );
}

pmmTest(
  'PMM-T2340 - Verify adding and editing Aurora remote instance @instances',
  async ({ api, page, servicesPage }) => {
    const labels = editedLabels(auroraInstanceId, { cluster: auroraMysql.rds?.cluster });

    await api.remoteInstanceApi.addRemoteInstance(auroraMysql);
    await page.goto(servicesPage.url);
    await expect(servicesPage.builders.serviceRow(auroraInstanceId)).toBeVisible({
      timeout: Timeouts.THIRTY_SECONDS,
    });
    await servicesPage.editServiceLabels(auroraInstanceId, labels);
    await servicesPage.verifyEditedServiceLabels(auroraInstanceId, labels);
  },
);

for (const filterName of qanFilters) {
  pmmTest(
    `PMM-T2340 - Verify QAN after remote instance is added @instances | ${filterName}`,
    async ({ page, qanStoredMetrics, urlHelper }) => {
      await page.goto(urlHelper.buildUrlWithParameters(qanStoredMetrics.url, { from: 'now-5m', to: 'now' }));
      await qanStoredMetrics.waitForLoad();
      await qanStoredMetrics.selectFilterContaining(filterName);
      expect(
        await qanStoredMetrics.getQueryCount(),
        `The queries for filter ${filterName} instance do NOT exist`,
      ).toBeGreaterThan(0);
    },
  );
}

pmmTest(
  'PMM-T2340 - Verify QAN after Aurora instance is added and edited @instances',
  async ({ leftNavigation, page, qanStoredMetrics, urlHelper }) => {
    await page.goto(urlHelper.buildUrlWithParameters(qanStoredMetrics.url, { from: 'now-5m', to: 'now' }));
    await qanStoredMetrics.waitForLoad();
    await leftNavigation.selectTimeRange('Last 12 hours');
    await qanStoredMetrics.waitForLoad();
    await qanStoredMetrics.selectFilterContaining(auroraInstanceId);
    expect(
      await qanStoredMetrics.getQueryCount(),
      `The queries for service ${auroraInstanceId} instance do NOT exist, check QAN Data`,
    ).toBeGreaterThan(0);
  },
);
