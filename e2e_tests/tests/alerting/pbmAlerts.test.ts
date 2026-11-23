import pmmTest from '@fixtures/pmmTest';
import type Api from '@api/api';
import GrafanaHelper from '@helpers/grafana.helper';
import { Timeouts } from '@helpers/timeouts';
import { AlertSeverity } from '@interfaces/alerting';
import { expect } from '@playwright/test';

pmmTest.describe.configure({ mode: 'serial' });

const members = ['rs101', 'rs102', 'rs103'];
const rootUri = 'mongodb://root:root@localhost:27017/?authSource=admin&directConnection=true';
const ruleGroup = 'pbm-alerts';
let folderUid = '';

const createRuleFromTemplate = async (api: Api, templateName: string, name: string) => {
  const response = await api.alertingApi.createRule(GrafanaHelper.getAuthHeader(), {
    folder_uid: folderUid,
    for: '10s',
    group: ruleGroup,
    interval: '10s',
    name,
    severity: AlertSeverity.Warning,
    template_name: templateName,
  });

  expect(response.status(), await response.text()).toEqual(200);
};

pmmTest.beforeEach(async ({ api }) => {
  await api.alertingApi.removeAllAlertRules();
  folderUid = await api.grafanaApi.createFolder(`PMM-15232 PBM alerts ${Date.now()}`);
});

pmmTest.afterEach(async ({ api, cliHelper }) => {
  cliHelper.execute('docker start minio');

  for (const member of members) {
    cliHelper.execute(`docker exec ${member} systemctl start pbm-agent`);
  }

  // A resync drops the record of the backup that failed.
  cliHelper.execute('docker exec rs101 pbm config --force-resync');
  await api.alertingApi.removeAllAlertRules();

  if (folderUid) await api.grafanaApi.deleteFolder(folderUid);
});

pmmTest(
  'PMM-T2855 - Verify the PBM agent down alert fires when a pbm-agent is stopped and clears when it is started @pbm-alerting',
  async ({ api, cliHelper }) => {
    pmmTest.setTimeout(Timeouts.TEN_MINUTES);

    const ruleName = 'pbm-agent-down';
    const service = await api.inventoryApi.getServiceDetailsByRegexAndParameters('rs103', {
      cluster: 'replicaset',
    });
    const activeAlerts = async () =>
      api.alertingApi.getRuleAlerts(ruleName, 'service_name', service.service_name, { activeOnly: true });

    await pmmTest.step('Create a rule from the PBM agent down template', async () => {
      await createRuleFromTemplate(api, 'pmm_mongodb_pbm_agent_down', ruleName);
    });

    await pmmTest.step('Stop the pbm-agent of rs103 and wait for the alert', async () => {
      cliHelper.execute('docker exec rs103 systemctl stop pbm-agent').assertSuccess();
      await expect(async () => {
        expect((await activeAlerts()).map(({ state }) => state)).toContain('Alerting');
      }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.FIVE_MINUTES });
    });

    await pmmTest.step('Start the pbm-agent again and wait for the alert to clear', async () => {
      cliHelper.execute('docker exec rs103 systemctl start pbm-agent').assertSuccess();
      await expect(async () => {
        expect(await activeAlerts()).toHaveLength(0);
      }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.FIVE_MINUTES });
    });
  },
);

pmmTest(
  'PMM-T2856 - Verify the PBM backup failed alert fires for a backup that fails once it is running @pbm-alerting',
  async ({ api, cliHelper }) => {
    pmmTest.setTimeout(Timeouts.TEN_MINUTES);

    const ruleName = 'pbm-backup-failed';
    const latestBackup = (field: string) =>
      cliHelper
        .execute(
          `docker exec rs101 mongo "${rootUri}" --quiet --eval 'const backup = db.getSiblingDB("admin").pbmBackups.find().sort({ start_ts: -1 }).limit(1).toArray()[0]; backup ? backup.${field} : "none"'`,
        )
        .assertSuccess()
        .stdout.trim();

    await pmmTest.step('Create a rule from the PBM backup failed template', async () => {
      await createRuleFromTemplate(api, 'pmm_mongodb_pbm_backup_failed', ruleName);
    });

    await pmmTest.step('Start a backup and stop the storage while it runs', async () => {
      // The resync of the previous test can still hold PBM's lock, which makes the backup command fail.
      await expect(async () => {
        cliHelper.execute('docker exec -d rs101 pbm backup').assertSuccess();
        await expect(async () => {
          expect(latestBackup('status')).toEqual('running');
        }).toPass({ intervals: [Timeouts.TWO_SECONDS], timeout: Timeouts.THIRTY_SECONDS });
      }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.TWO_MINUTES });
      cliHelper.execute('docker stop minio').assertSuccess();
      await expect(async () => {
        expect(latestBackup('status')).toEqual('error');
      }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.FIVE_MINUTES });
    });

    await pmmTest.step('The alert fires for the failed backup', async () => {
      const backup = latestBackup('name');

      cliHelper.execute('docker start minio').assertSuccess();
      await expect(async () => {
        expect(
          (await api.alertingApi.getRuleAlerts(ruleName, 'name', backup, { activeOnly: true })).map(
            ({ state }) => state,
          ),
        ).toContain('Alerting');
      }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.FIVE_MINUTES });
    });
  },
);
