import pmmTest from '@fixtures/pmmTest';
import BasePage from '@pages/base.page';
import { expect, type Request } from '@playwright/test';
import apiEndpoints from '@helpers/apiEndpoints';
import { Timeouts } from '@helpers/timeouts';

const realTimeTableTestId = 'realtime-overview-table';

export default class RealTimeAnalyticsPage extends BasePage {
  readonly url = 'pmm-ui/rta/overview';
  readonly refreshIntervals = ['1s', '2s', '3s', '4s', '5s'] as const;
  apiEndpoint = apiEndpoints.realtimeanalytics.queriesSearch;
  builders = {
    detailsPaneCodeByText: (queryText: string) =>
      this.elements.detailsPane.locator('[data-testid="query-text"], code.language-mongodb', {
        hasText: queryText,
      }),
    elapsedTimeForQueryByText: (queryText: string) =>
      this.builders.rowByQueryText(queryText).locator('//td[position()=4]'),
    elapsedTimeForRow: (rowIndex: string) => this.builders.rowByIndex(rowIndex).locator('//td[position()=4]'),
    hostForLastRow: () =>
      this.page.getByTestId(realTimeTableTestId).locator('tbody tr').last().locator('td').nth(1),
    hostForRow: (rowIndex: string) => this.builders.rowByIndex(rowIndex).locator('//td[position()=2]'),
    operationIdForRow: (rowIndex: string) => this.builders.rowByIndex(rowIndex).locator('//td[position()=3]'),
    queryByRowIndex: (rowIndex: string) => this.builders.rowByIndex(rowIndex).locator('//td[position()=1]'),
    rowByIndex: (rowIndex: string) =>
      this.page.getByTestId(realTimeTableTestId).locator(`//tbody//tr[position()=${rowIndex}]`),
    rowByQueryText: (queryText: string) =>
      this.page.getByTestId(realTimeTableTestId).locator(`tr`, { hasText: queryText }),
  };
  buttons = {
    allSessions: this.page.getByTestId('overview-table-all-sessions-button'),
    closeDetailsPane: this.page.getByTestId('details-pane-close-button'),
    detailsNextQuery: this.page.getByTestId('details-pane-next-button'),
    detailsPreviousQuery: this.page.getByTestId('details-pane-prev-button'),
    export: this.page.getByTestId('overview-table-export-button'),
    filters: this.page.getByRole('button', { name: 'Show/Hide filters' }),
    nextPage: this.page.getByRole('button', { name: 'Go to next page' }),
    openNewSessionModal: this.page.getByTestId('open-new-modal'),
    pauseRealTimeAnalytics: this.page.getByTestId('overview-table-pause-button'),
    refresh: this.page.getByTestId('overview-table-refresh-button'),
    refreshIntervalDropdown: this.page.getByTestId('auto-refresh-button'),
    resumeRealTimeAnalytics: this.page.getByTestId('overview-table-resume-button'),
    stopAgentsButton: this.page.getByTestId('stop-multiple-sessions-modal-stop'),
    stopAllSessions: this.page.getByTestId('open-stop-all-modal'),
  };
  elements = {
    detailsOperationId: this.page.getByTestId('operation-id-value'),
    detailsPane: this.page.getByTestId('query-details-pane'),
    elapsedTimeColumnHeader: this.page
      .getByTestId(realTimeTableTestId)
      .getByText('Elapsed time', { exact: true }),
    hostColumnHeader: this.page.getByTestId(realTimeTableTestId).getByText('Host', { exact: true }),
    noQueriesAvailable: this.builders.rowByIndex('1').getByRole('alert', { name: 'No queries available' }),
    queryTextColumnHeader: this.page
      .getByTestId(realTimeTableTestId)
      .getByText('Query text', { exact: true }),
    realTimeTable: this.page.getByTestId(realTimeTableTestId),
    realTimeTableRow: this.page.getByTestId(realTimeTableTestId).locator('tbody tr'),
  };
  inputs = {
    clusterService: this.page.locator('input[name = "service"]'),
    filterByQueryText: this.page.getByTitle('Filter by Query text'),
    realTimeServiceInput: this.page.getByTestId('realtime-service-input'),
  };
  messages = {};

  clickElapsedTimeHeader = async () => {
    await this.elements.elapsedTimeColumnHeader.click();
  };

  clickHostHeader = async () => {
    await this.elements.hostColumnHeader.click();
  };

  clickQueryTextHeader = async () => {
    await this.elements.queryTextColumnHeader.click();
  };

  filterQueriesByText = async (queryText: string) => {
    await pmmTest.step(`Filter queries by text: ${queryText}`, async () => {
      await this.builders.rowByIndex('1').waitFor({ state: 'visible' });
      await this.elements.noQueriesAvailable.waitFor({ state: 'hidden' });
      await this.openFilters();
      await this.inputs.filterByQueryText.fill(queryText);

      await expect(this.builders.queryByRowIndex('1')).toContainText(queryText);
    });
  };

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

  getElapsedTimeForQueryByRow = async (rowIndex: string) => {
    await this.builders.elapsedTimeForRow(rowIndex).waitFor({ state: 'visible' });

    const elapsedTime = await this.builders.elapsedTimeForRow(rowIndex).textContent();
    const seconds = elapsedTime?.split(' ')[0];

    return Number(seconds);
  };

  getElapsedTimeForQueryByText = async (queryText: string) => {
    await this.builders.elapsedTimeForQueryByText(queryText).waitFor({ state: 'visible' });

    const elapsedTime = await this.builders.elapsedTimeForQueryByText(queryText).textContent();
    const seconds = elapsedTime?.split(' ')[0];

    return Number(seconds);
  };

  getOperationIdByRow = async (rowIndex: string) => {
    await this.builders.operationIdForRow(rowIndex).waitFor({ state: 'visible' });

    return (await this.builders.operationIdForRow(rowIndex).textContent()) || '';
  };

  getUrlWithServices = (services: string[]) => {
    let parsedUrl = this.url;

    for (let i = 0; i < services.length; i++) {
      if (i === 0) {
        parsedUrl += `?serviceIds=${services[i]}`;
      } else {
        parsedUrl += `&serviceIds=${services[i]}`;
      }
    }

    return parsedUrl;
  };

  openDetailsForRow = async (rowIndex: string) => {
    await this.builders.rowByIndex(rowIndex).click();
    await expect(this.elements.detailsPane).toBeVisible();
  };

  openFilters = async () => {
    await this.buttons.filters.click();
  };

  selectClusterService = async () => {
    await this.inputs.clusterService.click();
    await this.page.getByRole('option').first().click();
    await this.page.keyboard.press('Escape');
  };

  stopAllSessions = async () => {
    await this.buttons.stopAllSessions.waitFor({ state: 'visible', timeout: Timeouts.THREE_SECONDS });
    await this.buttons.stopAllSessions.click();
    await this.buttons.stopAgentsButton.click();
    await this.buttons.stopAgentsButton.waitFor({ state: 'hidden', timeout: Timeouts.THREE_SECONDS });
  };

  verifyRequestInterval = async (
    intervalMs: number,
    timeoutMs: number,
    toleranceMs = 200,
    intervalsToCheck = 2,
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
