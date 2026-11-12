import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import GrafanaHelper from '@helpers/grafana.helper';
import { Timeouts } from '@helpers/timeouts';

// Runs on the host of `pmm-framework --database psmdb,SETUP_TYPE=psa`: the tests stop pbm-agent
// and MinIO in its containers. rs101 is the primary, rs102 a secondary and rs103 the arbiter.
const environment = 'psmdb-dev';
const cluster = 'replicaset';

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  pmmTest.setTimeout(Timeouts.THIRTY_MINUTES);
  await grafanaHelper.authorize();
});

pmmTest.afterEach(async ({ cliHelper }) => {
  cliHelper.execute('docker start minio').assertSuccess();

  for (const node of ['rs101', 'rs102']) {
    cliHelper.execute(`docker exec ${node} systemctl start pbm-agent`).assertSuccess();
  }
});

pmmTest(
  'PMM-T2404 - Verify a stopped backup agent is listed as DOWN with its details and links, then leaves the table once it starts again @pmm-psmdb-integration',
  async ({ api, cliHelper, dashboard, mongoDbHelper, page, urlHelper }) => {
    const backupDetails = dashboard.mongo.backupDetails;
    const { columns, emptyText, filterableColumns, panelName, tooltipTerms } = backupDetails.failingAgents;
    const service = await api.inventoryApi.getServiceDetailsByRegexAndParameters('^rs102_', {
      cluster,
      environment,
    });
    const dashboardUrl = urlHelper.buildUrlWithParameters(backupDetails.url, {
      cluster,
      environment,
      from: 'now-30m',
      to: 'now',
    });
    const downRow = expect.objectContaining({
      Cluster: cluster,
      Environment: environment,
      Host: 'rs102:27017',
      'PMM node': service.node_name,
      'PMM service': service.service_name,
      'Replica set': 'rs',
      Status: 'DOWN',
    });

    await pmmTest.step('Open MongoDB Backup Details and see no failing agent', async () => {
      await page.goto(dashboardUrl);
      await dashboard.loadAllPanels();
      await dashboard.verifyPanelTextAfterRefresh(panelName, emptyText, Timeouts.FIVE_MINUTES);
    });

    await expect(dashboard.builders.panelContentByExactName('Backup Agent Status')).toContainText(
      'rs103:27017',
    );

    await pmmTest.step('Hover the info icon and read the tooltip', async () => {
      await dashboard.builders.panelInfoIconByName(panelName).hover();

      for (const term of tooltipTerms) await expect(dashboard.elements.tooltip).toContainText(term);
    });

    const stoppedAt = Date.now();

    await pmmTest.step('Stop pbm-agent on rs102 and see one DOWN row', async () => {
      cliHelper.execute('docker exec rs102 systemctl stop pbm-agent').assertSuccess();
      await expect
        .poll(async () => dashboard.getTableRowsAfterRefresh(panelName), {
          intervals: [Timeouts.TEN_SECONDS],
          message: `${panelName} should list only rs102 as DOWN`,
          timeout: Timeouts.FIVE_MINUTES,
        })
        .toEqual([downRow]);
      await expect
        .poll(() => mongoDbHelper.getPbmAgentErrors('rs101'), { timeout: Timeouts.ONE_MINUTE })
        .toEqual({ 'rs102:27017': [expect.stringContaining('lost agent')] });
    });

    await pmmTest.step('Failing for counts from the stop', async () => {
      let failingFor = NaN;

      await expect
        .poll(
          async () => {
            const [row] = await dashboard.getTableRowsAfterRefresh(panelName);

            failingFor = GrafanaHelper.getDurationSeconds(row['Failing for']);

            return failingFor;
          },
          { message: 'Failing for should show a duration', timeout: Timeouts.ONE_MINUTE },
        )
        .not.toBeNaN();
      expect(Math.abs(failingFor - (Date.now() - stoppedAt) / 1_000)).toBeLessThanOrEqual(120);
    });

    await pmmTest.step('PMM service opens MongoDB Instance Summary of rs102', async () => {
      await dashboard.builders.tableCellLink(panelName, 0, columns.indexOf('PMM service')).click();
      await expect(page).toHaveURL(
        new RegExp(`mongodb-instance-summary\\?var-service_name=${service.service_name}&from=now-30m&to=now`),
      );
      await expect(dashboard.builders.selectedVariableValues('Service Name')).toHaveText(
        service.service_name,
      );
    });

    await pmmTest.step('Filter for the Cluster value keeps the row', async () => {
      await page.goto(dashboardUrl);
      await dashboard.loadAllPanels();
      await dashboard.builders.tableCell(panelName, 0, columns.indexOf('Cluster')).hover();
      await dashboard.builders.tableCellFilterForValue(panelName, 0, columns.indexOf('Cluster')).click();
      await expect(page).toHaveURL(new RegExp(`var-Filters=cluster%7C%3D%7C${cluster}`));
      await expect
        .poll(async () => dashboard.getTableRowsAfterRefresh(panelName), { timeout: Timeouts.ONE_MINUTE })
        .toEqual([downRow]);
    });

    await pmmTest.step('Hover each cell: only Cluster and Environment offer Filter for value', async () => {
      for (const [index, column] of columns.entries()) {
        // Grafana renders a cell's filter buttons only while it is hovered.
        await dashboard.builders.tableCell(panelName, 0, index).hover();
        await expect(
          dashboard.builders.tableCellFilterForValue(panelName, 0, index),
          `${column} should ${filterableColumns.includes(column) ? '' : 'not '}offer Filter for value`,
        ).toHaveCount(filterableColumns.includes(column) ? 1 : 0);
      }
    });

    await pmmTest.step('Remove the Cluster filter', async () => {
      await dashboard.builders.removeAdHocFilter('cluster').click();
      await expect(page).not.toHaveURL(/var-Filters=cluster/);
      await expect(dashboard.builders.selectedVariableValues('Environment')).toHaveText(environment);
      await expect(dashboard.builders.selectedVariableValues('Cluster')).toHaveText(cluster);
    });

    await pmmTest.step('Start pbm-agent on rs102 and see the table empty again', async () => {
      cliHelper.execute('docker exec rs102 systemctl start pbm-agent').assertSuccess();
      await dashboard.verifyPanelTextAfterRefresh(panelName, emptyText, Timeouts.FIVE_MINUTES);
    });
  },
);

pmmTest(
  'PMM-T2405 - Verify agents that cannot reach backup storage are listed as FAIL after DOWN agents and sorted by host @pmm-psmdb-integration',
  async ({ api, cliHelper, dashboard, mongoDbHelper, page, urlHelper }) => {
    const backupDetails = dashboard.mongo.backupDetails;
    const { emptyText, panelName } = backupDetails.failingAgents;
    const [primary, secondary] = await Promise.all(
      ['^rs101_', '^rs102_'].map(async (regex) =>
        api.inventoryApi.getServiceDetailsByRegexAndParameters(regex, { cluster, environment }),
      ),
    );
    const row = (status: string, host: string, service: typeof primary) =>
      expect.objectContaining({
        Cluster: cluster,
        Environment: environment,
        Host: host,
        'PMM node': service.node_name,
        'PMM service': service.service_name,
        'Replica set': 'rs',
        Status: status,
      });

    await pmmTest.step('Open MongoDB Backup Details and see no failing agent', async () => {
      await page.goto(
        urlHelper.buildUrlWithParameters(backupDetails.url, {
          cluster,
          environment,
          from: 'now-30m',
          to: 'now',
        }),
      );
      await dashboard.loadAllPanels();
      await dashboard.verifyPanelTextAfterRefresh(panelName, emptyText, Timeouts.FIVE_MINUTES);
    });

    const stoppedAt = Date.now();

    await pmmTest.step('Stop pbm-agent on rs102 and MinIO and see DOWN above FAIL', async () => {
      cliHelper.execute('docker exec rs102 systemctl stop pbm-agent').assertSuccess();
      cliHelper.execute('docker stop minio').assertSuccess();
      await expect
        .poll(async () => dashboard.getTableRowsAfterRefresh(panelName), {
          intervals: [Timeouts.TEN_SECONDS],
          message: `${panelName} should list rs102 DOWN, then rs101 FAIL`,
          timeout: Timeouts.FIVE_MINUTES,
        })
        .toEqual([row('DOWN', 'rs102:27017', secondary), row('FAIL', 'rs101:27017', primary)]);
    });

    // Let the DOWN row age before the restart, so a Failing for reset by the restart is told apart from the stop.
    const downFailingFor = await pmmTest.step('Let the rs102 DOWN row age a minute', async () => {
      const readFailingFor = async () =>
        GrafanaHelper.getDurationSeconds(
          (await dashboard.getTableRowsAfterRefresh(panelName))[0]['Failing for'],
        );

      await expect
        .poll(readFailingFor, {
          intervals: [Timeouts.TEN_SECONDS],
          message: 'rs102 should be DOWN for a minute',
          timeout: Timeouts.FIVE_MINUTES,
        })
        .toBeGreaterThanOrEqual(60);

      return readFailingFor();
    });

    expect(mongoDbHelper.getPbmAgentErrors('rs101')).toEqual({
      'rs101:27017': expect.arrayContaining([expect.stringContaining('storage')]),
      'rs102:27017': [expect.stringContaining('lost agent')],
    });

    const restartedAt = Date.now();

    await pmmTest.step('Start pbm-agent on rs102 and see both FAIL, sorted by host', async () => {
      cliHelper.execute('docker exec rs102 systemctl start pbm-agent').assertSuccess();
      await expect
        .poll(async () => dashboard.getTableRowsAfterRefresh(panelName), {
          intervals: [Timeouts.TEN_SECONDS],
          message: `${panelName} should list rs101 and rs102 as FAIL`,
          timeout: Timeouts.FIVE_MINUTES,
        })
        .toEqual([row('FAIL', 'rs101:27017', primary), row('FAIL', 'rs102:27017', secondary)]);
    });

    await pmmTest.step('rs102 Failing for still counts from the agent stop', async () => {
      const failingFor = GrafanaHelper.getDurationSeconds(
        (await dashboard.getTableRowsAfterRefresh(panelName))[1]['Failing for'],
      );

      expect(failingFor).toBeGreaterThanOrEqual((Date.now() - stoppedAt) / 1_000 - 120);
      expect(failingFor).toBeGreaterThanOrEqual(downFailingFor + (Date.now() - restartedAt) / 1_000 - 30);
    });

    await pmmTest.step('Start MinIO and see the table empty again', async () => {
      cliHelper.execute('docker start minio').assertSuccess();
      await dashboard.verifyPanelTextAfterRefresh(panelName, emptyText, Timeouts.FIVE_MINUTES);
    });
  },
);
