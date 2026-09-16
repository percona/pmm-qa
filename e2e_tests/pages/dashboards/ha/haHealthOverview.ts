import BasePage from '@pages/base.page';
import DashboardInterface from '@interfaces/dashboard';
import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { GrafanaPanel } from '@interfaces/grafanaPanel';
import { Timeouts } from '@helpers/timeouts';

const leaderRole = /\bLeader\b/;
const followerRole = /\bFollower\b/;
const percentage = /(\d+(?:\.\d+)?)\s*%/;

export const haHealthOverviewPanels = {
  leaderPmmInstance: 'Leader PMM Instance',
  overallSystemHealth: 'Overall System Health',
  pmmPods: 'PMM Pods',
  podsWithRestarts: 'Pods with Restarts',
  postgresqlPrimary: 'PostgreSQL Primary',
};

/**
 * "PMM HA Health Overview" (uid `pmm-ha-health-overview`), the GA dashboard of
 * PMM-13860.
 */
export default class HaHealthOverviewDashboard extends BasePage implements DashboardInterface {
  url = 'graph/d/pmm-ha-health-overview/pmm-ha-health-overview';
  metrics: GrafanaPanel[] = [
    { name: 'PMM', type: 'stat' },
    { name: 'PostgreSQL', type: 'stat' },
    { name: 'ClickHouse', type: 'stat' },
    { name: 'VictoriaMetrics', type: 'stat' },
    { name: 'HAProxy', type: 'stat' },
    { name: haHealthOverviewPanels.overallSystemHealth, type: 'gauge' },
    { name: 'Pod Count', type: 'stat' },
    { name: 'Pod Restarts', type: 'stat' },
    { name: haHealthOverviewPanels.podsWithRestarts, type: 'table' },
    { name: haHealthOverviewPanels.leaderPmmInstance, type: 'stat' },
    { name: haHealthOverviewPanels.postgresqlPrimary, type: 'stat' },
    { name: 'VictoriaMetrics Components', type: 'stat' },
    { name: 'CPU Usage', type: 'timeSeries' },
    { name: 'Memory Usage', type: 'timeSeries' },
    { name: 'PostgreSQL Storage', type: 'gauge' },
    { name: 'ClickHouse Storage', type: 'gauge' },
    { name: 'VictoriaMetrics Storage', type: 'gauge' },
    { name: 'Service Availability by Component', type: 'timeSeries' },
    { name: haHealthOverviewPanels.pmmPods, type: 'table' },
    { name: 'PostgreSQL Pods', type: 'table' },
    { name: 'ClickHouse Pods', type: 'table' },
    { name: 'VictoriaMetrics Pods', type: 'table' },
    { name: 'HAProxy Instances', type: 'table' },
    { name: 'HAProxy Backend Servers', type: 'table' },
  ];
  // Empty on a cluster nothing has restarted in the dashboard's time range.
  noDataMetrics: string[] = [haHealthOverviewPanels.podsWithRestarts];
  builders = {};
  buttons = {};
  elements = {};
  inputs = {};
  messages = {};

  /** The percentage the gauge renders, so the assertion is on the panel and not on its PromQL. */
  overallSystemHealth = async (): Promise<number> => {
    const text = await this.panelText(haHealthOverviewPanels.overallSystemHealth);
    const value = percentage.exec(text)?.[1];

    if (value === undefined) {
      throw new Error(
        `"${haHealthOverviewPanels.overallSystemHealth}" rendered no percentage, got: ${text.replace(/\n/g, ' | ')}`,
      );
    }

    return Number(value);
  };

  panelText = async (panelName: string): Promise<string> => {
    const panel = this.grafanaIframe().getByTestId(`data-testid Panel header ${panelName}`);

    await panel.scrollIntoViewIfNeeded();

    return await panel.innerText();
  };

  /**
   * One string per rendered row, e.g. `pmm-ha-0 UP Leader`. Read row-wise rather
   * than cell-wise so a row keeps pod, status and role together.
   */
  tableRows = async (panelName: string): Promise<string[]> => {
    const table = this.grafanaIframe().getByTestId(`data-testid Panel header ${panelName}`).getByRole('grid');

    await table.waitFor({ state: 'visible', timeout: Timeouts.ONE_MINUTE });

    const rows = (await table.getByRole('row').allInnerTexts())
      .map((row) => row.replace(/\s+/g, ' ').trim())
      .filter((row) => row.length > 0);

    if (rows.length === 0) throw new Error(`Table panel "${panelName}" rendered no rows`);

    return rows;
  };

  verifyLeaderPmmInstance = async (leader: string): Promise<void> =>
    await pmmTest.step(`Verify "${haHealthOverviewPanels.leaderPmmInstance}" names "${leader}"`, async () => {
      // Polled: the dashboard reads pmm_ha_leader_status, so it trails the pods
      // by a scrape interval after an election.
      await expect(async () => {
        await this.page.reload();
        expect(await this.panelText(haHealthOverviewPanels.leaderPmmInstance)).toContain(leader);
      }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.FIVE_MINUTES });
    });

  /** Every pod present, `leader` the only Leader, every other pod a Follower. */
  verifyPodRoles = async (leader: string, podNames: string[]): Promise<void> =>
    await pmmTest.step(
      `Verify "${haHealthOverviewPanels.pmmPods}" shows "${leader}" leading and the rest following`,
      async () => {
        await expect(async () => {
          await this.page.reload();

          const rows = await this.tableRows(haHealthOverviewPanels.pmmPods);

          const rowFor = (podName: string): string => {
            const row = rows.find((candidate) => candidate.startsWith(podName));

            if (row === undefined) {
              throw new Error(`"${podName}" has no row in the table, rows are: ${rows.join(' / ')}`);
            }

            return row;
          };

          expect(rowFor(leader), `"${leader}" must be the Leader`).toMatch(leaderRole);

          for (const podName of podNames.filter((podName) => podName !== leader)) {
            expect(rowFor(podName), `"${podName}" must be a Follower`).toMatch(followerRole);
          }

          expect(
            rows.filter((row) => leaderRole.test(row)),
            'Exactly one pod may be shown as Leader',
          ).toHaveLength(1);
        }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.FIVE_MINUTES });
      },
    );
}
