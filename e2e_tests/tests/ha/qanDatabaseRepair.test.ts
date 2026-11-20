import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';
import {
  pmmDbCreated as created,
  pmmDbRecreated as recreated,
  pmmDbSkipped as skipped,
} from '@helpers/haClickHouse.helper';

let clickHousePods: string[] = [];
let stoppedServer: string | undefined;

pmmTest.beforeEach(async ({ api, grafanaHelper, haClusterHelper }) => {
  await grafanaHelper.authorize();
  await haClusterHelper.ensureServing(api.haApi);
});

pmmTest.afterEach(async ({ api, haClickHouseHelper, haClusterHelper }) => {
  if (stoppedServer) await haClickHouseHelper.startServer(stoppedServer);

  stoppedServer = undefined;

  if (clickHousePods.length === 0) return;

  await haClusterHelper.ensureServing(api.haApi);
  haClickHouseHelper.restartQanApi(haClusterHelper.leaderFromPods());
  await haClickHouseHelper.waitForOnePmm(clickHousePods, Timeouts.FIVE_MINUTES);
});

pmmTest(
  'PMM-T2774 - Verify a missing or stray QAN database copy is repaired and QAN totals stay the same after failover @pmm-ha',
  async ({ api, haClickHouseHelper, haClusterHelper, page, qanStoredMetrics, urlHelper }) => {
    pmmTest.setTimeout(Timeouts.THIRTY_MINUTES);

    clickHousePods = haClickHouseHelper.pods();
    expect(clickHousePods, 'PMM HA runs three ClickHouse servers').toHaveLength(3);

    const [serverZero, serverOne, serverTwo] = clickHousePods;
    const windowEnd = new Date(Date.now() - Timeouts.FIVE_MINUTES);
    const qanUrl = urlHelper.buildUrlWithParameters(qanStoredMetrics.url, {
      from: String(windowEnd.getTime() - Timeouts.THIRTY_MINUTES),
      to: String(windowEnd.getTime()),
    });
    const leader = haClusterHelper.leaderFromPods();

    haClickHouseHelper.restartQanApi(leader);

    const sharedUuid = await haClickHouseHelper.waitForOnePmm(clickHousePods);
    let queryCount: number | null = null;

    await pmmTest.step('Note the QAN query count of a past time range', async () => {
      await page.goto(qanUrl);
      await qanStoredMetrics.waitForLoad();
      queryCount = await qanStoredMetrics.getTotalQueryCount();

      expect(queryCount, 'QAN must list queries in the half hour before the test').toBeGreaterThan(0);
    });

    await pmmTest.step(
      'Verify a server that lost the pmm database gets it back with the shared UUID',
      async () => {
        const since = haClickHouseHelper.pmmDbLog(leader).length;

        haClickHouseHelper.dropPmm(serverTwo);
        haClickHouseHelper.restartQanApi(leader);

        expect(await haClickHouseHelper.waitForOnePmm(clickHousePods)).toEqual(sharedUuid);
        await expect
          .poll(() => haClickHouseHelper.pmmDbLogged(leader, since, created, { uuid: sharedUuid }), {
            message: `The leader must log "${created}"`,
          })
          .toBe(true);
      },
    );

    const strayUuid = await pmmTest.step(
      'Verify the leader changes nothing while a ClickHouse server is down',
      async () => {
        stoppedServer = serverOne;
        await haClickHouseHelper.stopServer(serverOne);
        haClickHouseHelper.createStrayPmm(serverTwo);

        const [{ uuid: stray }] = haClickHouseHelper.pmmCopies([serverTwo]);

        expect(stray, 'The stray copy must have a UUID of its own').not.toEqual(sharedUuid);

        const since = haClickHouseHelper.pmmDbLog(leader).length;

        haClickHouseHelper.restartQanApi(leader);
        await expect
          .poll(() => haClickHouseHelper.pmmDbLogged(leader, since, skipped), {
            message: `The leader must log "${skipped}"`,
            timeout: Timeouts.TWO_MINUTES,
          })
          .toBe(true);
        expect(haClickHouseHelper.pmmDbLogged(leader, since, recreated)).toBe(false);
        expect(haClickHouseHelper.pmmCopies([serverZero, serverTwo]).map((copy) => copy.uuid)).toEqual([
          sharedUuid,
          stray,
        ]);

        return stray;
      },
    );

    await pmmTest.step('Verify the stray copy is replaced once every server answers', async () => {
      await haClickHouseHelper.startServer(serverOne);
      stoppedServer = undefined;

      const since = haClickHouseHelper.pmmDbLog(leader).length;

      haClickHouseHelper.restartQanApi(leader);

      expect(await haClickHouseHelper.waitForOnePmm(clickHousePods)).toEqual(sharedUuid);
      await expect
        .poll(
          () =>
            haClickHouseHelper.pmmDbLogged(leader, since, recreated, {
              old_uuid: strayUuid,
              uuid: sharedUuid,
            }),
          { message: `The leader must log "${recreated}"` },
        )
        .toBe(true);
    });

    await pmmTest.step('Verify every server holds the same QAN rows', async () => {
      await expect(async () => {
        haClickHouseHelper.syncMetrics(serverTwo);

        const rows = clickHousePods.map((pod) => haClickHouseHelper.metricsRowsBefore(pod, windowEnd));

        expect(
          new Set(rows).size,
          `Rows before ${windowEnd.toISOString()} per server: ${rows.join(', ')}`,
        ).toEqual(1);
      }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.TWO_MINUTES });
    });

    await pmmTest.step('Verify QAN shows the same query count', async () => {
      await page.goto(qanUrl);
      await qanStoredMetrics.waitForLoad();
      expect(await qanStoredMetrics.getTotalQueryCount()).toEqual(queryCount);
    });

    await pmmTest.step('Verify QAN shows the same query count after a failover', async () => {
      await haClusterHelper.failoverLeader(api.haApi);
      await expect(async () => {
        await page.goto(qanUrl);
        await qanStoredMetrics.waitForLoad();
        expect(await qanStoredMetrics.getTotalQueryCount()).toEqual(queryCount);
      }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.TWO_MINUTES });
    });
  },
);
