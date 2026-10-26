import pmmTest from '@fixtures/pmmTest';
import { expect, Locator } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';
import { NestedLocators } from '@pages/base.page';

const instances = ['pcsm-1', 'pcsm-2'];
const activeQuery = 'percona_clustersync_mongodb_ha_active == 1';
const unitSeconds: Record<string, number> = { min: 60, ms: 0.001, ns: 1e-9, s: 1, µs: 1e-6 };

// Stat panels render a duration as "350 ms" or "1.20 s".
const toSeconds = (text: string) => {
  const match = /(-?[\d.]+)\s*(min|ms|µs|ns|s)\b/.exec(text);

  if (!match) throw new Error(`No duration in "${text}"`);

  return Number(match[1]) * unitSeconds[match[2]];
};

const panelText = async (panel: Locator) => {
  await panel.scrollIntoViewIfNeeded();

  return (await panel.innerText()).trim();
};

pmmTest.describe('MongoDB ClusterSync Details dashboard', () => {
  pmmTest.beforeEach(async ({ api, grafanaHelper }) => {
    await grafanaHelper.authorize();
    await expect
      .poll(async () => (await api.prometheusApi.instantQuery(activeQuery)).length, {
        message: 'Exactly one PCSM instance must hold the HA lease',
        timeout: Timeouts.TWO_MINUTES,
      })
      .toBe(1);
  });

  pmmTest(
    'Verify the MongoDB ClusterSync Details dashboard opens from the MongoDB menu and is listed in the MongoDB folder @pmm-pcsm-integration',
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
        await dashboard.waitForDashboardToLoad();

        for (const row of Object.values(clusterSync.rows)) {
          await expect(dashboard.builders.rowTitle(row)).toBeVisible();
        }
      });
    },
  );

  pmmTest(
    'Verify the ClusterSync dashboard filters list the source, target and PCSM instances only @pmm-pcsm-integration',
    async ({ dashboard, page, urlHelper }) => {
      const clusterSync = dashboard.mongo.clusterSyncDetails;

      await page.goto(clusterSync.url);
      await dashboard.waitForDashboardToLoad();

      await pmmTest.step('Verify the default source and target clusters', async () => {
        await expect(dashboard.builders.selectedVariableValues('Source Cluster')).toHaveText('rs-src');
        await expect(dashboard.builders.selectedVariableValues('Target Cluster')).toHaveText('rs-tgt');
      });

      await pmmTest.step('Verify the PCSM filters list only the PCSM group', async () => {
        expect(await dashboard.getVariableValues('Environment')).toEqual(['All', 'pcsm-dev']);
        expect(await dashboard.getVariableValues('ClusterSync Cluster')).toEqual(['All', 'pcsm-sync-1']);
        expect(await dashboard.getVariableValues('ClusterSync Instance')).toEqual(['All', ...instances]);
      });

      await pmmTest.step('Verify the target list leaves out the selected source', async () => {
        expect(await dashboard.getVariableValues('Target Cluster')).toEqual(['rs-tgt']);
        await dashboard.selectVariableValue('Source Cluster', 'rs-tgt');
        expect(await dashboard.getVariableValues('Target Cluster')).toEqual(['rs-src']);
      });

      await pmmTest.step('Verify one selected instance limits the instance row to it', async () => {
        await page.goto(urlHelper.buildUrlWithParameters(clusterSync.url, { serviceName: 'pcsm-1' }));
        await dashboard.waitForDashboardToLoad();
        await dashboard.expandRow(clusterSync.rows.instances);

        for (const panelName of ['Instance Availability', 'Instance Roles', 'CPU Usage', 'Resident Memory']) {
          await dashboard.builders.panelByExactName(panelName).scrollIntoViewIfNeeded();
          await expect(dashboard.builders.panelLegendSeries(panelName)).toHaveText(['pcsm-1'], {
            timeout: Timeouts.THIRTY_SECONDS,
          });
        }
      });
    },
  );

  pmmTest(
    'Verify a running PCSM migration shows data in the health and progress rows, and the pipeline and instance rows show only PCSM data labelled by service name @pmm-pcsm-integration',
    async ({ api, dashboard, page, urlHelper }) => {
      const clusterSync = dashboard.mongo.clusterSyncDetails;
      const [active] = await api.prometheusApi.instantQuery(activeQuery);
      const activeInstance = active.metric.service_name;

      await page.goto(urlHelper.buildUrlWithParameters(clusterSync.url, { from: 'now-1h' }));
      await dashboard.waitForDashboardToLoad();

      await pmmTest.step('Verify the source and target health', async () => {
        for (const panelName of clusterSync.clusterStats) {
          const panels = dashboard.builders.panelContentByExactName(panelName);

          await expect(panels).toHaveCount(2);

          for (const panel of await panels.all()) {
            expect(await panelText(panel), `${panelName} must show a value`).toMatch(/^[\d.]+\s*\S*$/);
          }
        }

        await expect(dashboard.builders.panelContentByExactName('Members Down').first()).toHaveText('0');
        await expect(dashboard.builders.panelContentByExactName('Members Down').last()).toHaveText('0');
        await expect(dashboard.builders.panelContentByExactName('Oplog Window')).toHaveText(/\d/);
        await expect(dashboard.builders.panelContentByExactName('Disk Space Used')).toHaveText(
          /\d+(\.\d+)?%/,
        );
      });

      await pmmTest.step('Verify the ClusterSync column', async () => {
        const instancesUp = await panelText(dashboard.builders.panelContentByExactName('Instances Up'));

        for (const instance of instances) expect(instancesUp).toMatch(new RegExp(`${instance}\\s+UP`));

        await expect(dashboard.builders.panelContentByExactName('Active Instance')).toHaveText(
          new RegExp(`^${activeInstance}\\s+ACTIVE$`),
        );
        expect(
          toSeconds(await panelText(dashboard.builders.panelContentByExactName('Replication Lag'))),
        ).toBeLessThan(10);
        await expect(dashboard.builders.panelLegendSeries('Change Events Rate')).toHaveText([
          `Read - ${activeInstance}`,
          `Applied - ${activeInstance}`,
        ]);
        await dashboard.verifyPanelValuesInView(clusterSync.metrics);
      });

      await pmmTest.step('Verify the clone progress', async () => {
        await expect(dashboard.builders.panelContentByExactName('Copy Progress')).toHaveText('100%');
        await dashboard.verifyPanelValuesInView(clusterSync.progressMetrics);
      });

      await pmmTest.step('Verify the replication pipeline row', async () => {
        await dashboard.expandRow(clusterSync.rows.pipeline);
        await dashboard.verifyPanelValuesInView(clusterSync.pipelineMetrics);

        for (const panelName of clusterSync.perWorkerPanels(activeInstance)) {
          await dashboard.builders.panelByExactName(panelName).scrollIntoViewIfNeeded();
          expect(await dashboard.builders.panelLegendSeries(panelName).count()).toBeGreaterThan(0);
          expect(await dashboard.builders.panelLegendSeries(panelName).count()).toBeLessThanOrEqual(10);
        }

        await expect(dashboard.builders.textInDashboard('Waiting for first flush')).toHaveCount(0);
        await dashboard.collapseRow(clusterSync.rows.pipeline);
      });

      await pmmTest.step('Verify the instance row', async () => {
        await dashboard.expandRow(clusterSync.rows.instances);
        await expect(dashboard.builders.panelContentByExactName('Lease Term')).toHaveText(/^\d+$/);

        const roles = await panelText(dashboard.builders.panelByExactName('Instance Roles'));

        expect(roles).toContain('ACTIVE');
        expect(roles).toContain('STANDBY');

        for (const panelName of clusterSync.processPanels) {
          await dashboard.builders.panelByExactName(panelName).scrollIntoViewIfNeeded();

          const series = await dashboard.builders.panelLegendSeries(panelName).allTextContents();

          expect(series.length, `${panelName} must chart the PCSM instances`).toBeGreaterThan(0);

          for (const name of series) {
            expect(name, `${panelName} must chart only PCSM instances`).toMatch(/pcsm-[12]$/);
          }
        }
      });
    },
  );

  pmmTest(
    'Verify the ClusterSync dashboard follows the new active instance after a PCSM failover @pmm-pcsm-integration',
    async ({ api, cliHelper, dashboard, page, urlHelper }) => {
      const clusterSync = dashboard.mongo.clusterSyncDetails;
      const url = urlHelper.buildUrlWithParameters(clusterSync.url, { from: 'now-15m' });
      const [active] = await api.prometheusApi.instantQuery(activeQuery);
      const stopped = active.metric.service_name;
      const takeover = instances.find((instance) => instance !== stopped) as string;
      const leaseTerm = async () =>
        Number(await panelText(dashboard.builders.panelContentByExactName('Lease Term')));

      await page.goto(url);
      await dashboard.waitForDashboardToLoad();
      await dashboard.expandRow(clusterSync.rows.instances);

      const termBefore = await leaseTerm();
      const transitionsBefore = (await api.prometheusApi.instantQueryValue(
        `percona_clustersync_mongodb_ha_role_transitions_total{service_name="${takeover}"}`,
      )) as number;

      try {
        await pmmTest.step(`Stop PCSM on the ACTIVE instance ${stopped}`, async () => {
          cliHelper.execSilent(`docker exec ${stopped} pkill -x pcsm`).assertSuccess();
        });

        await pmmTest.step(`Verify ${stopped} is DOWN and ${takeover} took over`, async () => {
          await expect(async () => {
            await page.goto(url);
            await dashboard.waitForDashboardToLoad();
            expect(await panelText(dashboard.builders.panelContentByExactName('Instances Up'))).toMatch(
              new RegExp(`${stopped}\\s+DOWN`),
            );
            await expect(dashboard.builders.panelContentByExactName('Active Instance')).toHaveText(
              new RegExp(`^${takeover}\\s+ACTIVE$`),
            );
          }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.TWO_MINUTES });
        });

        await pmmTest.step('Verify the lease term and role transitions moved on', async () => {
          await dashboard.expandRow(clusterSync.rows.instances);
          expect(await leaseTerm()).toBe(termBefore + 1);
          await expect
            .poll(() =>
              api.prometheusApi.instantQueryValue(
                `percona_clustersync_mongodb_ha_role_transitions_total{service_name="${takeover}"}`,
              ),
            )
            .toBeGreaterThan(transitionsBefore);
          await dashboard.builders.panelByExactName('Role Transitions').scrollIntoViewIfNeeded();
          await expect(dashboard.builders.panelContentByExactName('Role Transitions')).toContainText(
            takeover,
          );
        });

        await pmmTest.step('Verify the sync panels follow the new ACTIVE instance', async () => {
          await expect(async () => {
            expect(
              toSeconds(await panelText(dashboard.builders.panelContentByExactName('Replication Lag'))),
            ).toBeLessThan(10);
          }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.ONE_MINUTE });
          await expect(dashboard.builders.panelLegendSeries('Change Events Rate')).toHaveText([
            `Read - ${takeover}`,
            `Applied - ${takeover}`,
          ]);
          await expect(dashboard.builders.panelContentByExactName('Copy Progress')).toHaveText(
            'No clone data',
          );
        });
      } finally {
        await pmmTest.step(`Start PCSM on ${stopped} again`, async () => {
          if (cliHelper.execSilent(`docker exec ${stopped} pgrep -x pcsm`).code !== 0) {
            cliHelper
              .execSilent(`docker exec --detach ${stopped} sh -c 'exec pcsm >>/var/log/pcsm.log 2>&1'`)
              .assertSuccess();
          }
        });
      }

      await pmmTest.step(`Verify ${stopped} is UP again as STANDBY`, async () => {
        await expect(async () => {
          await page.goto(url);
          await dashboard.waitForDashboardToLoad();
          expect(await panelText(dashboard.builders.panelContentByExactName('Instances Up'))).toMatch(
            new RegExp(`${stopped}\\s+UP`),
          );
        }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.TWO_MINUTES });
        // The state timeline shows roles over time, so the current role is read from its metric.
        expect(
          await api.prometheusApi.instantQueryValue(
            `percona_clustersync_mongodb_ha_active{service_name="${stopped}"}`,
          ),
        ).toBe(0);
      });
    },
  );

  pmmTest(
    'Verify the ClusterSync dashboard follows a migration out of a three-member PSMDB replica set @pmm-pcsm-psmdb-integration',
    async ({ dashboard, page, urlHelper }) => {
      const clusterSync = dashboard.mongo.clusterSyncDetails;

      await page.goto(
        urlHelper.buildUrlWithParameters(clusterSync.url, {
          from: 'now-1h',
          sourceCluster: 'replicaset',
          targetCluster: 'rs-tgt',
        }),
      );
      await dashboard.waitForDashboardToLoad();

      await pmmTest.step('Verify the source and target health', async () => {
        for (const panelName of clusterSync.clusterStats) {
          for (const panel of await dashboard.builders.panelContentByExactName(panelName).all()) {
            expect(await panelText(panel), `${panelName} must show a value`).toMatch(/^[\d.]+\s*\S*$/);
          }
        }

        await expect(dashboard.builders.panelContentByExactName('Members Down').first()).toHaveText('0');
        await expect(dashboard.builders.panelContentByExactName('Members Down').last()).toHaveText('0');
        await expect(dashboard.builders.panelContentByExactName('Oplog Window')).toHaveText(/\d/);
        await expect(dashboard.builders.panelContentByExactName('Disk Space Used')).toHaveText(
          /\d+(\.\d+)?%/,
        );
        await dashboard.verifyPanelValuesInView(clusterSync.metrics);
      });

      await pmmTest.step('Verify the sync progress', async () => {
        await expect(dashboard.builders.panelContentByExactName('Copy Progress')).toHaveText('100%');
        expect(
          toSeconds(await panelText(dashboard.builders.panelContentByExactName('Replication Lag'))),
        ).toBeLessThan(10);
      });

      await pmmTest.step('Open the source ReplSet Summary from the column header', async () => {
        await dashboard.builders
          .panelByName('Source Cluster')
          .getByRole('link', { name: 'ReplSet Summary' })
          .click();
        await expect(dashboard.builders.dashboardTitle('MongoDB ReplSet Summary').first()).toBeVisible({
          timeout: Timeouts.THIRTY_SECONDS,
        });
        await expect(dashboard.builders.selectedVariableValues('Cluster')).toHaveText('replicaset');
      });
    },
  );
});
