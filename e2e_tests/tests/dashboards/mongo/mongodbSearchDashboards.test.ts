import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';
import { ServiceType } from '@interfaces/inventory';

const mongotServices = '^mongot\\d_';
const timeRange = { from: 'now-15m', refresh: '5s' };

pmmTest.describe('MongoDB Search dashboards with mongot', () => {
  pmmTest.describe.configure({ mode: 'default' });

  pmmTest.beforeEach(async ({ grafanaHelper, mongotHelper }) => {
    mongotHelper.startSearchLoad();
    await expect
      .poll(() => mongotHelper.searchLoadSeconds(), {
        intervals: [Timeouts.TEN_SECONDS],
        message: 'The search query load on rs101 must run for 5 minutes',
        timeout: Timeouts.TEN_MINUTES,
      })
      .toBeGreaterThanOrEqual(Timeouts.FIVE_MINUTES / Timeouts.ONE_SECOND);
    await grafanaHelper.authorize();
  });

  pmmTest(
    'PMM-T2479 - Verify Search health and Search details open from the MongoDB menu and show every mongot service healthy @pmm-mongot-integration',
    async ({ api, dashboard, leftNavigation, page, urlHelper }) => {
      const searchHealth = dashboard.mongo.searchHealth;
      const services = await api.inventoryApi.getServiceNamesByRegex(mongotServices);

      expect(services).toHaveLength(3);
      await page.goto(urlHelper.buildUrlWithParameters(dashboard.home.url, { from: 'now-15m' }));
      // A menu click before the home dashboard settles is undone when its iframe syncs the URL back.
      await dashboard.waitForDashboardToLoad();

      await pmmTest.step('Open the MongoDB menu and verify its items', async () => {
        await leftNavigation.elements.mongoToggle.click();
        await expect(leftNavigation.elements.mongoItems).toHaveText(leftNavigation.mongoMenu);
        await leftNavigation.elements.mongoHaToggle.click();
        await expect(leftNavigation.elements.mongoHaItems).toHaveText(leftNavigation.mongoHaMenu);
      });

      await leftNavigation.selectMenuItem('mongodb.searchHealth');
      await expect(page).toHaveURL(new RegExp(searchHealth.url));
      await expect(leftNavigation.elements.timePickerOpenButton).toContainText('Last 15 minutes');
      await dashboard.loadAllPanels();

      await pmmTest.step('Verify the tiles', async () => {
        await expect(dashboard.builders.panelContentByExactName('Overall')).toHaveText(
          searchHealth.texts.allHealthy,
        );
        await expect.poll(() => dashboard.getStatColor('Overall')).toBe('green');

        for (const tile of searchHealth.tiles) {
          await expect(dashboard.builders.panelContentByExactName(tile)).toHaveText(/\S/);
          await expect(dashboard.builders.panelContentByExactName(tile)).not.toContainText(
            searchHealth.texts.noData,
          );
        }

        await expect(dashboard.builders.panelContentByExactName('Availability')).toHaveText(
          searchHealth.texts.allUp,
        );
        await expect(dashboard.builders.panelContentByExactName('Index Health')).toHaveText(
          searchHealth.texts.allSteady,
        );
      });

      await pmmTest.step('Verify the Health by Service table', async () => {
        await expect(dashboard.builders.tableRows(searchHealth.healthTable)).toHaveCount(services.length);

        for (const service of services) {
          const { health, replicaSet, up } = searchHealth.healthColumns;

          await expect(dashboard.builders.tableRowCell(searchHealth.healthTable, service, health)).toHaveText(
            searchHealth.texts.ok,
          );
          await expect(dashboard.builders.tableRowCell(searchHealth.healthTable, service, up)).toHaveText(
            searchHealth.texts.up,
          );
          await expect(
            dashboard.builders.tableRowCell(searchHealth.healthTable, service, replicaSet),
          ).toHaveText('rs');
        }
      });

      for (const trend of searchHealth.trends) {
        await expect
          .poll(
            async () =>
              (await dashboard.builders.legendSeries(trend).allTextContents()).map((s) => s.trim()).sort(),
            {
              message: `${trend} must have one line per mongot service`,
            },
          )
          .toEqual(services);
      }

      await leftNavigation.selectMenuItem('mongodb.searchDetails');
      await expect(page).toHaveURL(new RegExp(dashboard.mongo.searchDetails.url));
      await expect(dashboard.builders.panelByExactName('mongot Services Down')).toBeVisible();
      expect(
        (await dashboard.getVariableValues('Search Service')).filter((value) => value !== 'All'),
      ).toEqual(services);
    },
  );

  pmmTest(
    "PMM-T2480 - Verify Search details opened from a Search health row shows that mongot's indexes, queries, replication and mongod-side data @pmm-mongot-integration",
    async ({ api, dashboard, leftNavigation, mongotHelper, page, urlHelper }) => {
      const { searchDetails, searchHealth } = dashboard.mongo;
      const services = await api.inventoryApi.getServiceNamesByRegex(mongotServices);
      const mongot2 = services[1];
      const rs101 = (await api.inventoryApi.getServiceDetailsByPartialName('rs101')).service_name;

      await page.goto(urlHelper.buildUrlWithParameters(searchHealth.url, { from: 'now-15m' }));

      await pmmTest.step('Open Search details from the mongot2 row', async () => {
        await dashboard.builders.tableLink(searchHealth.healthTable, mongot2).click();
        await expect(dashboard.builders.panelByExactName('mongot Services Down')).toBeVisible();
        await expect(dashboard.builders.selectedVariableValues('Search Service')).toHaveText(mongot2);
        await expect(leftNavigation.elements.timePickerOpenButton).toContainText('Last 15 minutes');
      });

      await dashboard.loadAllPanels();

      await pmmTest.step('Verify the Overview tiles', async () => {
        for (const tile of searchDetails.overviewTiles) {
          await expect(dashboard.builders.panelContentByExactName(tile)).toHaveText(/\S/);
          await expect(dashboard.builders.panelContentByExactName(tile)).not.toContainText(
            searchHealth.texts.noData,
          );
        }

        await expect(dashboard.builders.panelContentByExactName('mongot Services Down')).toHaveText('0');
        await expect(dashboard.builders.panelContentByExactName('Indexes Not STEADY')).toHaveText('0');
      });

      const indexes = mongotHelper.getSearchIndexes();

      expect(indexes.map((index) => index.name).sort()).toEqual(['default', 'vector_index']);

      for (const { id } of indexes) {
        await expect(
          dashboard.builders.tableRowCell(
            searchDetails.indexesTable,
            id,
            searchDetails.indexesColumns.status,
          ),
        ).toHaveText(searchDetails.steady);
      }

      await dashboard.verifyAllPanelsHaveData(searchDetails.noDataMetrics);
      await expect
        .poll(
          async () => dashboard.builders.legendSeries(searchDetails.searchStagesGraph).allTextContents(),
          {
            message: `${searchDetails.searchStagesGraph} must have a line for ${rs101}`,
          },
        )
        .toContainEqual(expect.stringContaining(rs101));

      await dashboard.selectVariableValue('Search Service', 'All');
      await dashboard.loadAllPanels();

      for (const graph of searchDetails.perServiceGraphs) {
        await expect
          .poll(
            async () =>
              (await dashboard.builders.legendSeries(graph).allTextContents()).map((s) => s.trim()).sort(),
            {
              message: `${graph} must have one line per mongot service`,
              timeout: Timeouts.THIRTY_SECONDS,
            },
          )
          .toEqual(services);
      }
    },
  );

  pmmTest(
    'PMM-T2481 - Verify a frozen mongot is shown as down within a minute and as healthy again after it resumes @pmm-mongot-integration',
    async ({ api, cliHelper, dashboard, page, urlHelper }) => {
      const searchHealth = dashboard.mongo.searchHealth;
      const { health, up } = searchHealth.healthColumns;
      const services = await api.inventoryApi.getServiceNamesByRegex(mongotServices);
      const mongot2 = services[1];

      await page.goto(urlHelper.buildUrlWithParameters(searchHealth.url, timeRange));
      await dashboard.loadAllPanels();
      await expect(dashboard.builders.panelContentByExactName('Availability')).toHaveText(
        searchHealth.texts.allUp,
      );

      try {
        cliHelper.execute('docker pause mongot2').assertSuccess();

        await pmmTest.step('Verify mongot2 is shown as down', async () => {
          await expect(dashboard.builders.panelContentByExactName('Availability')).toHaveText(
            searchHealth.texts.oneDown,
            { timeout: Timeouts.ONE_MINUTE },
          );
          await expect.poll(() => dashboard.getStatColor('Availability')).toBe('red');
          await expect(dashboard.builders.panelContentByExactName('Overall')).toHaveText(
            searchHealth.texts.oneNeedsAttention,
          );
          await expect(dashboard.builders.tableRows(searchHealth.healthTable).first()).toContainText(mongot2);
          await expect(dashboard.builders.tableRowCell(searchHealth.healthTable, mongot2, health)).toHaveText(
            searchHealth.texts.attention,
          );
          await expect(dashboard.builders.tableRowCell(searchHealth.healthTable, mongot2, up)).toHaveText(
            searchHealth.texts.down,
          );

          for (const service of [services[0], services[2]]) {
            await expect(
              dashboard.builders.tableRowCell(searchHealth.healthTable, service, health),
            ).toHaveText(searchHealth.texts.ok);
          }
        });

        cliHelper.execute('docker unpause mongot2').assertSuccess();

        await pmmTest.step('Verify mongot2 is shown as healthy again', async () => {
          await expect(dashboard.builders.panelContentByExactName('Availability')).toHaveText(
            searchHealth.texts.allUp,
            { timeout: Timeouts.TWO_MINUTES },
          );
          await page.reload();
          await expect(dashboard.builders.panelContentByExactName('Availability')).toHaveText(
            searchHealth.texts.allUp,
          );
          await expect(dashboard.builders.panelContentByExactName('Overall')).toHaveText(
            searchHealth.texts.allHealthy,
          );
          await expect(dashboard.builders.tableRowCell(searchHealth.healthTable, mongot2, health)).toHaveText(
            searchHealth.texts.ok,
          );
        });
      } finally {
        cliHelper
          .execute(`[ "$(docker inspect -f '{{.State.Paused}}' mongot2)" = false ] || docker unpause mongot2`)
          .assertSuccess();
      }
    },
  );

  pmmTest(
    'PMM-T2486 - Verify the Environment, Cluster and Replication Set filters limit the Search dashboards to the chosen mongot services @pmm-mongot-integration',
    async ({ api, cliHelper, dashboard, page, urlHelper }) => {
      const { searchDetails, searchHealth } = dashboard.mongo;
      const services = await api.inventoryApi.getServiceNamesByRegex(mongotServices);
      const otherService = 'mongot1-other';
      let otherServiceAdded = false;

      try {
        await pmmTest.step('Add mongot1 a second time with other labels', async () => {
          cliHelper
            .execute(
              `docker exec rs101 pmm-admin add external --listen-port=9946 --service-name=${otherService} --environment=psmdb-other --cluster=other-cluster --replication-set=rs-other`,
            )
            .assertSuccess();
          otherServiceAdded = true;
          await expect
            .poll(() => api.prometheusApi.instantQueryValue(`up{service_name="${otherService}"}`), {
              intervals: [Timeouts.TEN_SECONDS],
              timeout: Timeouts.TWO_MINUTES,
            })
            .toBe(1);
        });

        await pmmTest.step('Verify Environment psmdb-dev shows only the replica set mongots', async () => {
          await page.goto(
            urlHelper.buildUrlWithParameters(searchHealth.url, { ...timeRange, environment: 'psmdb-dev' }),
          );
          await dashboard.loadAllPanels();
          expect(
            (await dashboard.getVariableValues('Search Service')).filter((value) => value !== 'All'),
          ).toEqual(services);
          await expect(dashboard.builders.tableRows(searchHealth.healthTable)).toHaveCount(services.length);

          for (const service of services) {
            await expect(dashboard.builders.tableRow(searchHealth.healthTable, service)).toHaveCount(1);
          }
        });

        await pmmTest.step('Verify Environment psmdb-other shows only the other mongot', async () => {
          await page.goto(
            urlHelper.buildUrlWithParameters(searchHealth.url, { ...timeRange, environment: 'psmdb-other' }),
          );
          await dashboard.loadAllPanels();
          expect((await dashboard.getVariableValues('Cluster')).filter((value) => value !== 'All')).toEqual([
            'other-cluster',
          ]);
          expect(
            (await dashboard.getVariableValues('Replication Set')).filter((value) => value !== 'All'),
          ).toEqual(['rs-other']);
          await expect(dashboard.builders.tableRows(searchHealth.healthTable)).toHaveCount(1);
          await expect(
            dashboard.builders.tableRowCell(
              searchHealth.healthTable,
              otherService,
              searchHealth.healthColumns.health,
            ),
          ).toHaveText(searchHealth.texts.ok);
        });

        await pmmTest.step('Verify all filters at All show every mongot', async () => {
          await page.goto(
            urlHelper.buildUrlWithParameters(searchHealth.url, {
              ...timeRange,
              cluster: '$__all',
              environment: '$__all',
              replicationSet: '$__all',
            }),
          );
          await dashboard.loadAllPanels();
          await expect(dashboard.builders.tableRows(searchHealth.healthTable)).toHaveCount(
            services.length + 1,
          );

          for (const service of [...services, otherService]) {
            await expect(dashboard.builders.tableRow(searchHealth.healthTable, service)).toHaveCount(1);
          }
        });

        await pmmTest.step('Verify Search details with Environment psmdb-other', async () => {
          await page.goto(
            urlHelper.buildUrlWithParameters(searchDetails.url, { ...timeRange, environment: 'psmdb-other' }),
          );
          await dashboard.loadAllPanels();
          expect(
            (await dashboard.getVariableValues('Search Service')).filter((value) => value !== 'All'),
          ).toEqual([otherService]);

          for (const tile of searchDetails.overviewTiles) {
            await expect(dashboard.builders.panelContentByExactName(tile)).toHaveText(/\S/);
            await expect(dashboard.builders.panelContentByExactName(tile)).not.toContainText(
              searchHealth.texts.noData,
            );
          }
        });
      } finally {
        if (otherServiceAdded) cliHelper.removeService('rs101', ServiceType.external, otherService);
      }
    },
  );

  pmmTest(
    'PMM-T2482 - Verify a mongot that stops together with its pmm-agent is shown as down after about five minutes @pmm-mongot-integration',
    async ({ api, cliHelper, dashboard, page, urlHelper }) => {
      pmmTest.setTimeout(Timeouts.FIFTEEN_MINUTES);

      const searchHealth = dashboard.mongo.searchHealth;
      const { health, up } = searchHealth.healthColumns;
      const mongot2 = (await api.inventoryApi.getServiceNamesByRegex(mongotServices))[1];

      try {
        cliHelper.execute('docker stop mongot2').assertSuccess();
        cliHelper.execute('docker exec rs102 systemctl stop pmm-agent').assertSuccess();
        await page.goto(urlHelper.buildUrlWithParameters(searchHealth.url, timeRange));

        await pmmTest.step('Verify mongot2 is shown as down', async () => {
          await expect(dashboard.builders.panelContentByExactName('Availability')).toHaveText(
            searchHealth.texts.oneDown,
            { timeout: Timeouts.FIVE_MINUTES + Timeouts.ONE_MINUTE },
          );
          await expect.poll(() => dashboard.getStatColor('Availability')).toBe('red');
          await expect(dashboard.builders.panelContentByExactName('Overall')).toHaveText(
            searchHealth.texts.oneNeedsAttention,
          );
          await expect(dashboard.builders.tableRowCell(searchHealth.healthTable, mongot2, health)).toHaveText(
            searchHealth.texts.attention,
          );
          await expect(dashboard.builders.tableRowCell(searchHealth.healthTable, mongot2, up)).toHaveText(
            searchHealth.texts.down,
          );
        });

        cliHelper.execute('docker exec rs102 systemctl start pmm-agent').assertSuccess();
        cliHelper.execute('docker start mongot2').assertSuccess();

        await pmmTest.step('Verify mongot2 is shown as up again', async () => {
          await expect(dashboard.builders.panelContentByExactName('Availability')).toHaveText(
            searchHealth.texts.allUp,
            { timeout: Timeouts.TWO_MINUTES },
          );
          await page.reload();
          await expect(dashboard.builders.panelContentByExactName('Availability')).toHaveText(
            searchHealth.texts.allUp,
          );
          await expect(dashboard.builders.tableRowCell(searchHealth.healthTable, mongot2, health)).toHaveText(
            searchHealth.texts.ok,
          );
        });
      } finally {
        const agentStart = cliHelper.execute('docker exec rs102 systemctl start pmm-agent');
        const mongotStart = cliHelper.execute('docker start mongot2');

        agentStart.assertSuccess();
        mongotStart.assertSuccess();
      }
    },
  );
});

pmmTest.describe('MongoDB Search dashboards without mongot', () => {
  pmmTest.beforeEach(async ({ grafanaHelper }) => {
    await grafanaHelper.authorize();
  });

  pmmTest(
    'PMM-T2483 - Verify the Search dashboards show No data when MongoDB is monitored but no mongot is registered @pmm-psmdb-sharding-integration',
    async ({ api, dashboard, page, urlHelper }) => {
      const { searchDetails, searchHealth } = dashboard.mongo;

      await expect
        .poll(
          () =>
            api.prometheusApi.instantQueryValue(
              'time() - min(min_over_time(timestamp(mongodb_up{service_name=~"rs101_.*"})[15m:15s]))',
            ),
          {
            intervals: [Timeouts.THIRTY_SECONDS],
            message: 'rs101 must report metrics for 5 minutes',
            timeout: Timeouts.TEN_MINUTES,
          },
        )
        .toBeGreaterThanOrEqual(Timeouts.FIVE_MINUTES / Timeouts.ONE_SECOND);
      await page.goto(urlHelper.buildUrlWithParameters(searchHealth.url, { from: 'now-15m' }));
      await dashboard.loadAllPanels();

      for (const tile of searchHealth.tiles) {
        await expect(dashboard.builders.panelContentByExactName(tile)).toHaveText(searchHealth.texts.noData);
      }

      await expect(dashboard.builders.tableRows(searchHealth.healthTable)).toHaveCount(0);
      expect(
        (await dashboard.getVariableValues('Search Service')).filter((value) => value !== 'All'),
      ).toEqual([]);

      await page.goto(urlHelper.buildUrlWithParameters(searchDetails.url, { from: 'now-15m' }));
      await dashboard.loadAllPanels();

      for (const tile of searchDetails.overviewTiles) {
        await expect(dashboard.builders.panelContentByExactName(tile)).toHaveText(searchHealth.texts.noData);
      }
    },
  );
});
