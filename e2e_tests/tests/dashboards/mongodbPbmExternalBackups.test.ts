import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

// Runs on the host of `pmm-framework --database psmdb,EXTERNAL_PBM=true`: PBM runs in the pbm-external container,
// which no PMM backup feature drives, and the replica set rs101-rs103 is monitored by PMM.
const environment = 'psmdb-dev';
const cluster = 'replicaset';
const pbmUri = 'mongodb://pbm:pbmpass@rs101:27017,rs102:27017,rs103:27017/?replicaSet=rs';

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest(
  'PMM-T2857 - Verify MongoDB Backup Details shows backups taken by an external PBM that PMM did not start',
  async ({ api, cliHelper, dashboard, page, urlHelper }) => {
    pmmTest.setTimeout(Timeouts.TEN_MINUTES);

    const backupDetails = dashboard.mongo.backupDetails;
    const { emptyText, panelName } = backupDetails.failingAgents;
    const backups: string[] = [];

    await pmmTest.step('Take two logical backups with the external PBM', async () => {
      for (let i = 0; i < 2; i++) {
        const output = cliHelper
          .execute(
            `docker exec -e PBM_MONGODB_URI='${pbmUri}' pbm-external pbm backup --type=logical --wait`,
            Timeouts.FIVE_MINUTES,
          )
          .assertSuccess();
        const name = /Starting backup '([^']+)'/.exec(output.stdout)?.[1];

        expect(name, `backup name in "${output.stdout}"`).toBeTruthy();
        backups.push(name as string);
      }
    });

    await pmmTest.step('PMM has no artifact for them', async () => {
      const artifacts = (await api.backupsApi.getArtifacts()).map(({ name }) => name);

      for (const backup of backups) expect(artifacts).not.toContain(backup);
    });

    await pmmTest.step('Open MongoDB Backup Details', async () => {
      await page.goto(
        urlHelper.buildUrlWithParameters(backupDetails.url, {
          cluster,
          environment,
          from: 'now-30m',
          to: 'now',
        }),
      );
      await dashboard.loadAllPanels();
    });

    await pmmTest.step(
      'The overview shows PBM configured, PITR on, all agents and the latest backup',
      async () => {
        await dashboard.verifyPanelTextAfterRefresh('Backup Configured', 'YES', Timeouts.TWO_MINUTES);
        await dashboard.verifyPanelTextAfterRefresh('PITR Status', 'ON', Timeouts.TWO_MINUTES);
        await dashboard.verifyPanelTextAfterRefresh('Backup Agents', '3', Timeouts.TWO_MINUTES);
        await dashboard.verifyPanelTextAfterRefresh(
          'Last Successful Backup',
          backups[1],
          Timeouts.TWO_MINUTES,
        );
        await dashboard.verifyPanelTextAfterRefresh(panelName, emptyText, Timeouts.TWO_MINUTES);
      },
    );

    await pmmTest.step('Backup history lists both backups with a size and a duration', async () => {
      await expect
        .poll(
          async () => {
            // Grafana renders a table's rows only once its panel is in view.
            await dashboard.builders.panelByExactName('Backup history').scrollIntoViewIfNeeded();

            const rows = await dashboard.getTableRowsAfterRefresh('Backup history');

            return rows.filter((row) => backups.includes(row['Backup Name']));
          },
          {
            intervals: [Timeouts.TEN_SECONDS],
            message: 'Backup history should list both backups',
            timeout: Timeouts.TWO_MINUTES,
          },
        )
        .toEqual(
          expect.arrayContaining(
            backups.map((name) =>
              expect.objectContaining({
                'Backup Name': name,
                'Cluster/Replica Set': cluster,
                Duration: expect.stringMatching(/\d+ (second|minute)/),
                Environment: environment,
                Size: expect.stringMatching(/^[\d.]+ [kMG]?B$/),
              }),
            ),
          ),
        );
    });

    await pmmTest.step('Backup Sizes and Backup Duration show the backups', async () => {
      await dashboard.verifyPanelHasDataAfterRefresh('Backup Sizes', Timeouts.TWO_MINUTES);
      await dashboard.verifyPanelHasDataAfterRefresh('Backup Duration', Timeouts.TWO_MINUTES);
    });
  },
);
