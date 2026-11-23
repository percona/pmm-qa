import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

const replicaSet = 'rs';
const members = ['rs101', 'rs102', 'rs103'];
const arbiterLog = (level: string) =>
  `docker exec rs103 grep -q "level=${level}.*some metrics might be unavailable on arbiter nodes" /var/log/pmm-agent.log`;
const delaySeconds = 10;

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest.afterEach(async ({ mongoDbHelper }) => {
  mongoDbHelper.resetDelayedReplicaSetMembers(replicaSet, members);
});

pmmTest(
  'PMM-T1775 + PMM-T1888 - Verify Wrong Replication Lag by Set values if RS is PSA (MongoDB Cluster Summary) @pmm-psmdb-arbiter-integration @not-ui-pipeline',
  async ({ cliHelper, dashboard, mongoDbHelper, page, urlHelper }) => {
    await pmmTest.step('Verify the arbiter agent logs the arbiter warning and no error', async () => {
      await expect
        .poll(() => cliHelper.execSilent(arbiterLog('warning')).code, {
          message: 'pmm-agent on the arbiter should warn that some metrics might be unavailable',
          timeout: Timeouts.ONE_MINUTE,
        })
        .toBe(0);
      cliHelper.execute(arbiterLog('error')).exitCodeEquals(1);
    });

    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.mongo.replSetSummary.url, {
        from: 'now-5m',
        refresh: '5s',
        to: 'now',
      }),
    );
    await dashboard.loadAllPanels();

    const secondary = mongoDbHelper.delayReplicaSetMember(replicaSet, members, 1, delaySeconds);

    expect(secondary, 'The delayed member host name should be read from rs.conf()').toMatch(/^rs\d+$/);
    await dashboard.builders.panelByExactName('Replication Lag').scrollIntoViewIfNeeded();
    await expect
      .poll(() => dashboard.getLegendMaxSeconds('Replication Lag', secondary), {
        message: `Replication Lag Max for ${secondary} should reach the ${delaySeconds} s delay and be shown in seconds`,
        timeout: Timeouts.FIVE_MINUTES,
      })
      .toBeGreaterThanOrEqual(delaySeconds);
  },
);

pmmTest(
  'PMM-T1889 - Verify Mongo replication lag graph shows correct info @pmm-psmdb-replica-integration',
  async ({ dashboard, mongoDbHelper, page, urlHelper }) => {
    const delayed = mongoDbHelper.delayReplicaSetMember(replicaSet, members, 2, delaySeconds);

    expect(delayed, 'The delayed member host name should be read from rs.conf()').toMatch(/^rs\d+$/);
    await page.goto(
      urlHelper.buildUrlWithParameters(dashboard.mongo.replSetSummary.url, {
        from: 'now-10m',
        refresh: '5s',
        to: 'now',
      }),
    );
    await dashboard.loadAllPanels();
    await dashboard.builders.panelByExactName('Replication Lag').scrollIntoViewIfNeeded();
    await expect
      .poll(() => dashboard.getLegendMaxSeconds('Replication Lag', delayed), {
        message: `Replication Lag Max for ${delayed} should reach the ${delaySeconds} s delay and be shown in seconds`,
        timeout: Timeouts.FIVE_MINUTES,
      })
      .toBeGreaterThanOrEqual(delaySeconds);
  },
);
