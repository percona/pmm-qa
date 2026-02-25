import BasePage from '@pages/base.page';
import { type Request } from '@playwright/test';

export default class RtaOverview extends BasePage {
  url = 'pmm-ui/rta/overview';
  readonly refreshIntervals = ['1s', '2s', '3s', '4s', '5s'] as const;
  apiEndpoint = '/v1/realtimeanalytics/queries:search';
  builders = {};
  buttons = {
    autoRefreshDropdown: this.page.getByTestId('auto-refresh-button'),
    pause: this.page.getByRole('button', { name: 'Pause' }),
    refresh: this.page.getByTestId('overview-table-refresh-button'),
    resume: this.page.getByRole('button', { name: 'Resume' }),
  };
  elements = {
    overviewTableBody: this.page.locator('tbody.MuiTableBody-root').first(),
  };
  inputs = {
    clusterService: this.page.locator('input[name = "service"]'),
  };
  messages = {};

  getApiRequestCount = async (durationMs: number): Promise<number> => {
    let count = 0;

    const onRequest = (request: Request) => {
      if (this.apiRequest(request)) {
        count += 1;
      }
    };

    this.page.on('request', onRequest);
    // eslint-disable-next-line playwright/no-wait-for-timeout -- needed to check API requests
    await this.page.waitForTimeout(durationMs);
    this.page.off('request', onRequest);

    return count;
  };

  startMonitoringClusterService = async (): Promise<void> => {
    await this.page.goto(this.url);
    await this.inputs.clusterService.click();
    await this.page.getByRole('option').first().click();

    await this.page.keyboard.press('Escape');
  };

  verifyRequestInterval = async (
    intervalMs: number,
    toleranceMs: number,
    timeoutMs: number,
    intervalsToCheck: number,
  ): Promise<boolean> => {
    const timestamps: number[] = [];
    const startedAt = Date.now();

    try {
      await this.page.waitForRequest(this.apiRequest, { timeout: timeoutMs });

      timestamps.push(Date.now());

      for (let index = 0; index < intervalsToCheck; index++) {
        const elapsed = Date.now() - startedAt;
        const remainingTimeout = timeoutMs - elapsed;

        if (remainingTimeout <= 0) {
          return false;
        }

        await this.page.waitForRequest(this.apiRequest, { timeout: remainingTimeout });
        timestamps.push(Date.now());
      }
    } catch {
      return false;
    }

    for (let index = 1; index < timestamps.length; index++) {
      const delta = timestamps[index] - timestamps[index - 1];

      if (Math.abs(delta - intervalMs) > toleranceMs) {
        return false;
      }
    }

    return true;
  };

  private apiRequest = (request: Request) => request.url().includes(this.apiEndpoint);
}
