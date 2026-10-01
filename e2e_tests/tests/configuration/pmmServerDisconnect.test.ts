import pmmTest from '@fixtures/pmmTest';
import apiEndpoints from '@helpers/apiEndpoints';
import GrafanaHelper from '@helpers/grafana.helper';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

pmmTest.describe.configure({ mode: 'default' });

const disconnectUrl = 'http://127.0.0.1:8180/';
const compose = 'docker compose -f docker-compose-disconnect.yml';

pmmTest.beforeAll(async ({ cliHelper, credentials }) => {
  const { password, username } = credentials.perconaServer;

  cliHelper.execute(`${compose} up -d --wait`).assertSuccess();

  await expect(async () => {
    cliHelper
      .execute(
        `docker exec pmm-client-disconnect pmm-admin add mysql --username=${username} --password=${password} --host=ps8 --port=3306 --query-source=perfschema ps8`,
      )
      .assertSuccess();
  }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.ONE_MINUTE });
});

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize('admin', 'admin', disconnectUrl);
});

pmmTest.afterAll(async ({ cliHelper }) => {
  cliHelper.execute(`${compose} down -v`).assertSuccess();
});

for (const { outage, restore, title } of [
  {
    outage: 'docker stop pmm-server-disconnect',
    restore: 'docker start pmm-server-disconnect',
    title: 'PMM-T1442 - Verify metrics are saved if PMM server was offline @disconnect',
  },
  {
    outage: 'docker network disconnect pmm-disconnect_server-network pmm-client-disconnect',
    restore: 'docker network connect pmm-disconnect_server-network pmm-client-disconnect',
    title: 'PMM-T1443 - Verify metrics are saved if pmm-agent is stopped @disconnect',
  },
] as const) {
  pmmTest(title, async ({ cliHelper, dashboard, page, request, urlHelper }) => {
    const overviewUrl = `${disconnectUrl}${dashboard.mysql.mysqlInstanceOverview.url}`;

    await pmmTest.step('Verify the Services panel has data before the outage', async () => {
      await expect(async () => {
        await page.goto(urlHelper.buildUrlWithParameters(overviewUrl, { from: 'now-2m', to: 'now' }));
        await dashboard.loadAllPanels();
        await expect(dashboard.builders.panelContentByExactName('Services')).not.toHaveText('N/A', {
          timeout: Timeouts.TEN_SECONDS,
        });
      }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.ONE_MINUTE });
    });

    let restoredAt = 0;

    await pmmTest.step('Cut pmm-agent off from PMM Server and restore the connection', async () => {
      cliHelper.execute(outage).assertSuccess();
      await cliHelper.hold(
        Timeouts.FIVE_MINUTES + Timeouts.ONE_MINUTE + Timeouts.THIRTY_SECONDS + Timeouts.TEN_SECONDS,
      );
      cliHelper.execute(restore).assertSuccess();
      restoredAt = Math.floor(Date.now() / 1_000);
      await expect
        .poll(
          async () => {
            const response = await request
              .get(new URL(apiEndpoints.prometheus.query, disconnectUrl).href, {
                headers: GrafanaHelper.getAuthHeader('admin', 'admin'),
                params: {
                  query: 'sum(count_over_time(mysql_up{service_name="ps8"}[30s]))',
                  time: String(restoredAt - 60),
                },
              })
              .catch(() => undefined);

            return response?.ok()
              ? Number((await response.json().catch(() => ({}))).data?.result?.[0]?.value[1] ?? 0)
              : 0;
          },
          {
            message: 'ps8 samples buffered during the outage must reach PMM Server',
            timeout: Timeouts.TWO_MINUTES,
          },
        )
        .toBeGreaterThan(0);
    });

    await pmmTest.step('Verify the metrics collected during the outage are saved', async () => {
      await page.goto(
        urlHelper.buildUrlWithParameters(overviewUrl, {
          from: `${(restoredAt - 180) * 1_000}`,
          to: `${(restoredAt - 60) * 1_000}`,
        }),
      );
      await dashboard.verifyAllPanelsHaveData(dashboard.mysql.mysqlInstanceOverview.noDataMetrics);
    });
  });
}
