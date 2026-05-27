import { expect, Locator } from '@playwright/test';
import CliHelper from '@helpers/cli.helper';
import { Timeouts } from '@helpers/timeouts';
import pmmTest from '@fixtures/pmmTest';
import DashboardInterface from '@interfaces/dashboard';
import BasePage from '@pages/base.page';

export default class VacuumDashboard extends BasePage implements DashboardInterface {
  readonly url = 'graph/d/postgres_vacuum_monitoring/postgresql-vacuum-monitoring';
  metrics = [];
  noDataMetrics = [];
  builders = {};
  buttons = {};
  elements = {
    lastAnalyzeValue: this.grafanaIframe().locator(
      '//div[contains(@class, "react-grid-item")][6]//div[contains(text(), "dvdrental")]//following-sibling::*',
    ),
    lastVacuumValue: this.grafanaIframe().locator(
      '//div[contains(@class, "react-grid-item")][5]//div[contains(text(), "dvdrental")]//following-sibling::*',
    ),
  };
  inputs = {};
  messages = {};

  vacuumAnalyzeTables = async (tables: string[], containerName: string) => {
    const allowedPrefixes = [
      'film',
      'actor',
      'store',
      'address',
      'category',
      'city',
      'country',
      'customer',
      'inventory',
      'language',
      'rental',
      'staff',
      'payment',
    ];
    const cliHelper = new CliHelper();

    for (const rawTable of tables) {
      const table = rawTable.trim();

      if (!table) continue;
      if (!allowedPrefixes.some((prefix) => table.includes(prefix))) continue;

      await pmmTest.step(`Run VACUUM (ANALYZE) on ${table}`, async () => {
        cliHelper
          .execSilent(
            `docker exec ${containerName} psql -U postgres -d dvdrental -c 'VACUUM (ANALYZE) ${table}'`,
          )
          .assertSuccess();
      });
    }
  };

  waitForLastAnalyzeValues = async (timeout: Timeouts = Timeouts.TEN_MINUTES) => {
    await this.waitForValidDate(this.elements.lastAnalyzeValue, 'Last Analyze', timeout);
  };

  waitForLastVacuumValues = async (timeout: Timeouts = Timeouts.TEN_MINUTES) => {
    await this.waitForValidDate(this.elements.lastVacuumValue, 'Last Vacuum', timeout);
  };

  private waitForValidDate = async (locator: Locator, label: string, timeout: number) => {
    const pollInterval = Timeouts.FIVE_SECONDS;
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      const values = await locator.allTextContents();
      const hasValidDate = values.some((value) => !Number.isNaN(new Date(value).valueOf()));

      if (hasValidDate) return;

      // eslint-disable-next-line playwright/no-wait-for-timeout -- polling the dashboard for async metric updates
      await this.page.waitForTimeout(pollInterval);
    }

    expect(false, `No valid ${label} date was rendered within ${timeout / Timeouts.ONE_SECOND}s`).toBe(true);
  };
}
