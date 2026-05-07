const assert = require('assert');
const remoteInstancesFixture = require('../fixtures/remoteInstancesFixture');

Feature('PMM upgrade tests for external services');

Before(async ({ I }) => {
  await I.Authorize();
});

const remoteUpgradeInstances = remoteInstancesFixture.getUpgradeRemoteServicesName();
const redisServiceName = 'pmm-ui-tests-redis-external-remote';

Scenario(
  'Adding Redis as external Service before Upgrade @pre-external-upgrade',
  async ({
    I, addInstanceAPI,
  }) => {
    await addInstanceAPI.addExternalService(redisServiceName);
    await I.verifyCommand(
      `docker exec external_pmm pmm-admin add external --listen-port=42200 --group="redis" --custom-labels="testing=redis" --service-name=${redisServiceName}-2`,
    );
  },
);

Data(remoteUpgradeInstances).Scenario(
  'PMM-T2074 - Verify user - can create Remote Instances before upgrade @pre-external-upgrade',
  async ({ addInstanceAPI, current, remoteInstancesFixture }) => {
    const remoteInstance = remoteInstancesFixture.getUpgradeRemoteServiceByName(current);

    await addInstanceAPI.apiAddInstance(
      remoteInstance.remote_instance_type,
      remoteInstance.service_upgrade_name,
      remoteInstance,
    );
  },
);

Scenario(
  'Verify Redis as external Service Works After Upgrade @post-external-upgrade @post-client-upgrade',
  async ({
    I, grafanaAPI, remoteInstancesHelper,
  }) => {
    const metricName = 'redis_uptime_in_seconds';
    const headers = { Authorization: `Basic ${await I.getAuth()}` };

    await grafanaAPI.checkMetricExist(metricName);
    await grafanaAPI.checkMetricExist(metricName, { type: 'node_name', value: redisServiceName });
    await grafanaAPI.checkMetricExist(metricName, {
      type: 'service_name',
      value: 'pmm-ui-tests-redis-external-remote-2',
    });

    const response = await I.sendGetRequest('prometheus/api/v1/targets', headers);
    const targets = response.data.data.activeTargets.find(
      (o) => o.labels.external_group === 'redis-remote',
    );

    const expectedScrapeUrl = `${remoteInstancesHelper.remote_instance.external.redis.schema}://${remoteInstancesHelper.remote_instance.external.redis.host
    }:${remoteInstancesHelper.remote_instance.external.redis.port}${remoteInstancesHelper.remote_instance.external.redis.metricsPath}`;

    assert.ok(
      targets.scrapeUrl === expectedScrapeUrl,
      `Active Target for external service Post Upgrade has wrong Address value, value found is ${targets.scrapeUrl} and value expected was ${expectedScrapeUrl}`,
    );

    await I.asyncWaitFor(async () => {
      const response = await I.sendGetRequest('prometheus/api/v1/targets', headers);
      const targets = response.data.data.activeTargets.find(
        (o) => o.labels.external_group === 'redis-remote',
      );

      return targets.health === 'up';
    }, 60, 'Active Target for external service Post Upgrade health value is not up!');
  },
).retry(2);

Data(remoteUpgradeInstances).Scenario(
  'PMM-T2073 - Verify Agents are RUNNING after Upgrade (API) [critical] @post-external-upgrade @post-client-upgrade',
  async ({ inventoryAPI, current }) => {
    const remoteInstance = remoteInstancesFixture.getUpgradeRemoteServiceByName(current);

    await inventoryAPI.verifyServiceExistsAndHasRunningStatus(remoteInstance.service_type, remoteInstance.service_upgrade_name);
  },
);

Data(remoteUpgradeInstances).Scenario(
  'PMM-T2072 - Verify Agents are RUNNING after Upgrade (UI) [critical] @post-external-upgrade @post-client-upgrade',
  async ({ I, pmmInventoryPage, current }) => {
    const remoteInstance = remoteInstancesFixture.getUpgradeRemoteServiceByName(current);

    I.amOnPage(pmmInventoryPage.url);
    I.scrollPageToBottom();
    await pmmInventoryPage.verifyAgentHasStatusRunning(remoteInstance.service_upgrade_name);
  },
);

Data(remoteUpgradeInstances).Scenario(
  'PMM-T2071 - Verify Agents are Running and Metrics are being collected Pre and Post Upgrade (API) [critical] @pre-external-upgrade @post-external-upgrade @post-client-upgrade',
  async ({ I, grafanaAPI, current }) => {
    const remoteInstance = remoteInstancesFixture.getUpgradeRemoteServiceByName(current);

    await grafanaAPI.waitForMetric(remoteInstance.upgrade_metric_name, { type: 'service_name', value: remoteInstance.service_upgrade_name });
  },
);

Data(remoteUpgradeInstances).Scenario(
  'PMM-T2070 - Verify QAN has specific filters for Remote Instances after Upgrade (UI) @post-external-upgrade @post-client-upgrade',
  async ({ I, queryAnalyticsPage, current }) => {
    const remoteInstance = remoteInstancesFixture.getUpgradeRemoteServiceByName(current);

    I.amOnPage(I.buildUrlWithParams(queryAnalyticsPage.url, { from: 'now-5m' }));
    queryAnalyticsPage.waitForLoaded();
    queryAnalyticsPage.filters.filterBy(remoteInstance.qanFilter);
    I.waitForVisible(queryAnalyticsPage.filters.fields.filterByName(remoteInstance.qanFilter));
  },
);
