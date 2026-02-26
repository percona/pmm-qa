import pmmTest from '@fixtures/pmmTest';
import BasePage from '@pages/base.page';
import { expect } from '@playwright/test';

const realTimeTableTestId = 'realtime-overview-table';

export default class RealTimeAnalyticsPage extends BasePage {
  readonly url = 'pmm-ui/rta/overview';
  builders = {
    elapsedTimeForQueryByText: (queryText: string) =>
      this.builders.rowByQueryText(queryText).locator('//td[position()=4]'),
    elapsedTimeForRow: (rowIndex: string) => this.builders.rowByIndex(rowIndex).locator('//td[position()=4]'),
    operationIdForRow: (rowIndex: string) => this.builders.rowByIndex(rowIndex).locator('//td[position()=3]'),
    queryByRowIndex: (rowIndex: string) => this.builders.rowByIndex(rowIndex).locator('//td[position()=1]'),
    rowByIndex: (rowIndex: string) =>
      this.page.getByTestId(realTimeTableTestId).locator(`//tbody//tr[position()=${rowIndex}]`),
    rowByQueryText: (queryText: string) =>
      this.page.getByTestId(realTimeTableTestId).locator(`tr`, { hasText: queryText }),
  };
  buttons = {
    allSessions: this.page.getByTestId('overview-table-all-sessions-button'),
    filters: this.page.getByTestId('FilterListIcon'),
    openNewSessionModal: this.page.getByTestId('open-new-modal'),
    openStopAllModal: this.page.getByTestId('open-stop-all-modal'),
    pauseRealTimeAnalytics: this.page.getByTestId('overview-table-pause-button'),
    resumeRealTimeAnalytics: this.page.getByTestId('overview-table-resume-button'),
  };
  elements = {
    elapsedTimeColumnHeader: this.page.getByTestId(realTimeTableTestId).getByTitle('Elapsed time'),
    mongoDbQuery: this.page.locator('.language-mongodb'),
    realTimeTable: this.page.getByTestId(realTimeTableTestId),
    realTimeTableRow: this.page.getByTestId(realTimeTableTestId).locator('tr'),
  };
  inputs = {
    filterByQueryText: this.page.getByTitle('Filter by Query text'),
    realTimeServiceInput: this.page.getByTestId('realtime-service-input'),
  };
  messages = {};

  clickElapsedTimeHeader = async () => {
    await this.elements.elapsedTimeColumnHeader.click();
  };

  filterQueriesByText = async (queryText: string) => {
    await pmmTest.step(`Filter queries by text: ${queryText}`, async () => {
      await this.builders.rowByIndex('1').waitFor({ state: 'visible' });
      await this.openFilters();
      await this.inputs.filterByQueryText.fill(queryText);

      await expect(this.builders.queryByRowIndex('1')).toContainText(queryText);
    });
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

  openFilters = async () => {
    await this.buttons.filters.click();
  };
}
