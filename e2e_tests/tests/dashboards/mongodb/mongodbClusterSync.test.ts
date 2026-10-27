import pmmTest from '@fixtures/pmmTest';
import { expect, Locator } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';
import { NestedLocators } from '@pages/base.page';
import Dashboards from '@pages/dashboards/dashboards.page';
import PrometheusApi from '@api/prometheus.api';
import CliHelper from '@helpers/cli.helper';

const instances = ['pcsm-1', 'pcsm-2'];
// pmm-framework --database psmdb,SETUP_TYPE=pss --database pcsm,SOURCE=psmdb migrates replica set rs to rs-tgt.
const sourceCluster = 'replicaset';
const targetCluster = 'rs-tgt';
const targetOrders = (cliHelper: CliHelper) =>
  Number(
    cliHelper
      .execSilent(
        `docker exec pcsm-tgt-1 mongo --quiet mongodb://root:root@127.0.0.1:27017/admin --eval 'db.getSiblingDB("pcsm_qa").orders.countDocuments({})'`,
      )
      .assertSuccess()
      .getStdOutLines()
      .pop(),
  );

const startPcsm = (cliHelper: CliHelper, instance: string) => {
  if (cliHelper.execSilent(`docker exec ${instance} pgrep -x pcsm`).code !== 0) {
    cliHelper
      .execSilent(`docker exec --detach ${instance} sh -c 'exec pcsm >>/var/log/pcsm.log 2>&1'`)
      .assertSuccess();
  }
};

const haActive = (value: 0 | 1) => `percona_clustersync_mongodb_ha_active == ${value}`;
const unitSeconds: Record<string, number> = { min: 60, mins: 60, ms: 0.001, ns: 1e-9, s: 1, µs: 1e-6 };

// Stat panels render a duration as "350 ms", "2 s" or "5.43 mins".
const toSeconds = (text: string) => {
  const match = /(-?[\d.]+)\s*(mins?|ms|µs|ns|s)\b/.exec(text);

  if (!match) throw new Error(`No duration in "${text}"`);

  return Number(match[1]) * unitSeconds[match[2]];
};

const panelText = async (panel: Locator) => {
  await panel.scrollIntoViewIfNeeded();

  return (await panel.innerText()).trim();
};

// A stat panel lists each series as its name on one line and its value on the next.
const statText = (dashboard: Dashboards, panelName: string, index = 0) =>
  panelText(dashboard.builders.panelContentByExactName(panelName).nth(index));
const activeInstance = async (prometheusApi: PrometheusApi) =>
  (await prometheusApi.instantQuery(haActive(1)))[0].metric.service_name;

const verifyClusterHealth = async (dashboard: Dashboards) => {
  for (const panelName of dashboard.mongo.clusterSyncDetails.clusterStats) {
    await expect(dashboard.builders.panelContentByExactName(panelName)).toHaveCount(2);

    for (const index of [0, 1]) {
      expect(await statText(dashboard, panelName, index), `${panelName} must show a value`).toMatch(
        /^[\d.]+\s*\S*$/,
      );
    }
  }

  expect(await statText(dashboard, 'Members Down', 0)).toBe('0');
  expect(await statText(dashboard, 'Members Down', 1)).toBe('0');
  expect(toSeconds(await statText(dashboard, 'Oplog Window'))).toBeGreaterThan(0);
  expect(await statText(dashboard, 'Disk Space Used')).toMatch(/^[\d.]+%$/);
};

pmmTest.describe('MongoDB ClusterSync Details dashboard', () => {
  // The failover test runs last: it leaves an ACTIVE instance that never ran the initial clone.
  pmmTest.describe.configure({ mode: 'serial', retries: 0 });

  pmmTest.beforeEach(async ({ api, grafanaHelper }) => {
    await grafanaHelper.authorize();
    await expect
      .poll(async () => (await api.prometheusApi.instantQuery(haActive(1))).length, {
        message: 'Exactly one PCSM instance must hold the HA lease',
        timeout: Timeouts.TWO_MINUTES,
      })
      .toBe(1);
  });

  pmmTest(
    'Verify the MongoDB ClusterSync Details dashboard opens from the MongoDB menu and is listed in the MongoDB folder @pmm-pcsm-psmdb-integration',
    async ({ dashboard, leftNavigation, page, searchDashboardsPage }) => {
      const clusterSync = dashboard.mongo.clusterSyncDetails;

      await page.goto('pmm-ui/help');

      await pmmTest.step('Open MongoDB → ClusterSync', async () => {
        await leftNavigation.selectMenuItem('mongodb.clusterSync');
        await expect(page).toHaveURL(new RegExp(clusterSync.url));
        await expect(dashboard.builders.dashboardTitle(clusterSync.title).first()).toBeVisible({
          timeout: Timeouts.THIRTY_SECONDS,
        });
      });

      await pmmTest.step('Verify the existing MongoDB menu items are still listed', async () => {
        const mongoMenu = leftNavigation.buttons.mongodb as NestedLocators;

        for (const item of ['overview', 'summary', 'oplog', 'collections', 'backupStatus', 'clusterSync']) {
          await expect((mongoMenu[item] as { locator: Locator }).locator).toBeVisible();
        }
      });

      await pmmTest.step('Open the dashboard from the MongoDB folder', async () => {
        await page.goto(searchDashboardsPage.url);
        await searchDashboardsPage.builders.expandFolderButton('MongoDB').click();
        await searchDashboardsPage.builders.dashboardRow(clusterSync.title).getByRole('link').click();
        await expect(page).toHaveURL(new RegExp(clusterSync.url));
        await dashboard.loadAllPanels();

        for (const row of Object.values(clusterSync.rows)) {
          await expect(dashboard.builders.rowTitle(row)).toBeAttached();
        }
      });
    },
  );

  pmmTest(
    'Verify the ClusterSync dashboard filters list the source, target and PCSM instances only @pmm-pcsm-psmdb-integration',
    async ({ dashboard, page, urlHelper }) => {
      const clusterSync = dashboard.mongo.clusterSyncDetails;

      await page.goto(clusterSync.url);
      await dashboard.waitForDashboardToLoad();

      await pmmTest.step('Verify the default source and target clusters', async () => {
        await expect(dashboard.builders.selectedVariableValues('Source Cluster')).toHaveText(sourceCluster);
        await expect(dashboard.builders.selectedVariableValues('Target Cluster')).toHaveText(targetCluster);
      });

      await pmmTest.step('Verify the PCSM filters list only the PCSM group', async () => {
        expect(await dashboard.getVariableValues('Environment')).toEqual(['All', 'pcsm-dev']);
        expect(await dashboard.getVariableValues('ClusterSync Cluster')).toEqual(['All', 'pcsm-sync-1']);
        expect(await dashboard.getVariableValues('ClusterSync Instance')).toEqual(['All', ...instances]);
      });

      await pmmTest.step('Verify the target list leaves out the selected source', async () => {
        expect(await dashboard.getVariableValues('Target Cluster')).toEqual([targetCluster]);
        await dashboard.selectVariableValue('Source Cluster', targetCluster);
        expect(await dashboard.getVariableValues('Target Cluster')).toEqual([sourceCluster]);
      });

      await pmmTest.step('Verify one selected instance limits the instance row to it', async () => {
        // At the default 12 hours the Auto interval steps past a setup only minutes old,
        // and right after setup the rate panels wait for their first samples.
        await expect(async () => {
          await page.goto(
            urlHelper.buildUrlWithParameters(clusterSync.url, { from: 'now-1h', serviceName: 'pcsm-1' }),
          );
          await dashboard.loadAllPanels();

          expect(await statText(dashboard, 'Instances Up')).toMatch(/^pcsm-1\s+UP$/);
          expect(await statText(dashboard, 'Role Transitions')).toMatch(/^pcsm-1\s+\d+$/);

          for (const panelName of ['CPU Usage', 'Resident Memory']) {
            await dashboard.builders.panelByExactName(panelName).scrollIntoViewIfNeeded();
            await expect(dashboard.builders.panelLegendSeries(panelName)).toHaveText(['pcsm-1']);
          }
        }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.TWO_MINUTES });
      });
    },
  );

  pmmTest(
    'Verify a running PCSM migration shows data in the health and progress rows, and the pipeline and instance rows show only PCSM data labelled by service name @pmm-pcsm-psmdb-integration',
    async ({ api, dashboard, page, urlHelper }) => {
      const clusterSync = dashboard.mongo.clusterSyncDetails;
      const active = await activeInstance(api.prometheusApi);

      await page.goto(urlHelper.buildUrlWithParameters(clusterSync.url, { from: 'now-1h' }));
      await dashboard.loadAllPanels();

      await pmmTest.step('Verify the source and target health', async () => {
        await verifyClusterHealth(dashboard);
      });

      await pmmTest.step('Verify the ClusterSync column', async () => {
        const instancesUp = await statText(dashboard, 'Instances Up');

        for (const instance of instances) expect(instancesUp).toMatch(new RegExp(`${instance}\\s+UP`));

        expect(await statText(dashboard, 'Active Instance')).toMatch(new RegExp(`^${active}\\s+ACTIVE$`));
        expect(toSeconds(await statText(dashboard, 'Replication Lag'))).toBeLessThan(10);

        // The setup's HANDOVER made every instance ACTIVE once inside the time range.
        for (const series of instances.flatMap((instance) => [
          `Read - ${instance}`,
          `Applied - ${instance}`,
        ])) {
          await expect(
            dashboard.builders.panelLegendSeries('Change Events Rate').getByText(series, { exact: true }),
          ).toHaveCount(1);
        }

        await dashboard.verifyPanelValuesInView(clusterSync.metrics);
      });

      await pmmTest.step('Verify the clone progress', async () => {
        expect(await statText(dashboard, 'Copy Progress')).toMatch(new RegExp(`^${active}\\s+100(\\.0)?%$`));
        await dashboard.verifyPanelValuesInView(clusterSync.progressMetrics);
      });

      await pmmTest.step('Verify the replication pipeline row', async () => {
        await dashboard.verifyPanelValuesInView(clusterSync.pipelineMetrics);

        for (const panelName of instances.flatMap(clusterSync.perWorkerPanels)) {
          await dashboard.builders.panelByExactName(panelName).scrollIntoViewIfNeeded();
          expect(await dashboard.builders.panelLegendSeries(panelName).count()).toBeGreaterThan(0);
          expect(await dashboard.builders.panelLegendSeries(panelName).count()).toBeLessThanOrEqual(10);
        }

        await expect(dashboard.builders.textInDashboard('Waiting for first flush')).toHaveCount(0);
      });

      await pmmTest.step('Verify the instance row', async () => {
        expect(await statText(dashboard, 'Lease Term')).toMatch(/^pcsm-sync-1\s+\d+$/);
        // Instance Roles is a state timeline drawn on a canvas, so the roles are read from its metric.
        expect(await api.prometheusApi.instantQuery(haActive(1))).toHaveLength(1);
        expect(await api.prometheusApi.instantQuery(haActive(0))).toHaveLength(1);

        for (const panelName of clusterSync.processPanels) {
          await dashboard.builders.panelByExactName(panelName).scrollIntoViewIfNeeded();

          const series = await dashboard.builders.panelLegendSeries(panelName).allTextContents();

          expect(series.length, `${panelName} must chart the PCSM instances`).toBeGreaterThan(0);

          for (const name of series) {
            expect(name.trim(), `${panelName} must chart only PCSM instances`).toMatch(/pcsm-[12]$/);
          }
        }
      });

      await pmmTest.step('Open the source ReplSet Summary from the column header', async () => {
        const link = dashboard.builders.panelByExactName('Source Cluster').getByRole('link', {
          name: 'ReplSet Summary',
        });

        await link.scrollIntoViewIfNeeded();
        await link.click();
        await expect(dashboard.builders.dashboardTitle('MongoDB ReplSet Summary').first()).toBeVisible({
          timeout: Timeouts.THIRTY_SECONDS,
        });
        await expect(page).toHaveURL(new RegExp(`var-cluster=${sourceCluster}`));
      });
    },
  );

  pmmTest(
    'Verify the ClusterSync dashboard reports the PCSM group down when every instance stops @pmm-pcsm-psmdb-integration',
    async ({ cliHelper, dashboard, page, urlHelper }) => {
      const url = urlHelper.buildUrlWithParameters(dashboard.mongo.clusterSyncDetails.url, {
        from: 'now-15m',
      });

      const reload = async () => {
        await page.goto(url);
        await dashboard.loadAllPanels();
      };

      try {
        await pmmTest.step('Stop PCSM on every instance', async () => {
          for (const instance of instances) {
            cliHelper.execSilent(`docker exec ${instance} pkill -x pcsm`).assertSuccess();
          }
        });

        await pmmTest.step('Verify every instance is DOWN and none is ACTIVE', async () => {
          await expect(async () => {
            await reload();

            const instancesUp = await statText(dashboard, 'Instances Up');

            for (const instance of instances) expect(instancesUp).toMatch(new RegExp(`${instance}\\s+DOWN`));

            expect(await statText(dashboard, 'Active Instance')).toBe('none');
            expect(await statText(dashboard, 'Replication Lag')).toBe('No PCSM data');
          }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.TWO_MINUTES });
        });
      } finally {
        await pmmTest.step('Start PCSM on every instance again', async () => {
          for (const instance of instances) startPcsm(cliHelper, instance);
        });
      }

      await pmmTest.step('Verify the group recovers with one ACTIVE instance', async () => {
        await expect(async () => {
          await reload();

          const instancesUp = await statText(dashboard, 'Instances Up');

          for (const instance of instances) expect(instancesUp).toMatch(new RegExp(`${instance}\\s+UP`));

          expect(await statText(dashboard, 'Active Instance')).toMatch(/^pcsm-[12]\s+ACTIVE$/);
          expect(toSeconds(await statText(dashboard, 'Replication Lag'))).toBeLessThan(10);
        }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.FIVE_MINUTES });
      });
    },
  );

  pmmTest(
    'Verify the ClusterSync dashboard follows the new active instance after a PCSM failover @pmm-pcsm-psmdb-integration',
    async ({ api, cliHelper, dashboard, page, urlHelper }) => {
      const clusterSync = dashboard.mongo.clusterSyncDetails;
      const url = urlHelper.buildUrlWithParameters(clusterSync.url, { from: 'now-15m' });
      const stopped = await activeInstance(api.prometheusApi);
      const takeover = instances.find((instance) => instance !== stopped) as string;
      const leaseTerm = async () => Number((await statText(dashboard, 'Lease Term')).split(/\s+/).pop());
      const roleTransitions = async (instance: string) =>
        Number(new RegExp(`${instance}\\s+(\\d+)`).exec(await statText(dashboard, 'Role Transitions'))?.[1]);

      const reload = async () => {
        await page.goto(url);
        await dashboard.loadAllPanels();
      };

      await reload();

      const termBefore = await leaseTerm();
      const transitionsBefore = await roleTransitions(takeover);
      let ordersBefore = 0;

      try {
        await pmmTest.step(`Stop PCSM on the ACTIVE instance ${stopped}`, async () => {
          cliHelper.execSilent(`docker exec ${stopped} pkill -x pcsm`).assertSuccess();
          ordersBefore = targetOrders(cliHelper);
        });

        await pmmTest.step(`Verify ${stopped} is DOWN and ${takeover} took over`, async () => {
          await expect(async () => {
            await reload();
            expect(await statText(dashboard, 'Instances Up')).toMatch(new RegExp(`${stopped}\\s+DOWN`));
            expect(await statText(dashboard, 'Active Instance')).toMatch(
              new RegExp(`^${takeover}\\s+ACTIVE$`),
            );
          }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.TWO_MINUTES });
        });

        await pmmTest.step('Verify the lease term and role transitions moved on', async () => {
          await expect(async () => {
            expect(await leaseTerm()).toBe(termBefore + 1);
            expect(await roleTransitions(takeover)).toBeGreaterThan(transitionsBefore);
          }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.ONE_MINUTE });
        });

        await pmmTest.step('Verify the sync panels follow the new ACTIVE instance', async () => {
          await expect(async () => {
            await reload();
            expect(toSeconds(await statText(dashboard, 'Replication Lag'))).toBeLessThan(10);
            await expect(dashboard.builders.panelLegendSeries('Change Events Rate')).toContainText([
              `Read - ${takeover}`,
              `Applied - ${takeover}`,
            ]);
          }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.TWO_MINUTES });
          expect(await statText(dashboard, 'Copy Progress')).toBe('No clone data');
        });

        await pmmTest.step(`Verify ${takeover} keeps writing the source workload to the target`, async () => {
          await expect
            .poll(() => targetOrders(cliHelper), { timeout: Timeouts.ONE_MINUTE })
            .toBeGreaterThan(ordersBefore);
        });
      } finally {
        await pmmTest.step(`Start PCSM on ${stopped} again`, async () => startPcsm(cliHelper, stopped));
      }

      await pmmTest.step(`Verify ${stopped} is UP again as STANDBY`, async () => {
        await expect(async () => {
          await reload();
          expect(await statText(dashboard, 'Instances Up')).toMatch(new RegExp(`${stopped}\\s+UP`));
        }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.TWO_MINUTES });
        expect(
          await api.prometheusApi.instantQueryValue(
            `percona_clustersync_mongodb_ha_active{service_name="${stopped}"}`,
          ),
        ).toBe(0);
      });
    },
  );
});
