import pmmTest from '@fixtures/pmmTest';
import BasePage from '@pages/base.page';
import { expect, type Request } from '@playwright/test';
import apiEndpoints from '@helpers/apiEndpoints';
import { Timeouts } from '@helpers/timeouts';

const realTimeTableTestId = 'realtime-overview-table';
const sessionsTableTestId = 'rta-sessions';

export default class RealTimeAnalyticsPage extends BasePage {
  readonly url = 'pmm-ui/rta/overview';
  readonly durationFilterParameter = 'overview.f.queryExecutionDurationMs';
  readonly expectedTexts = {
    agentTooOld: (serviceName: string, serviceId: string, agentVersion: string) =>
      `Service ${serviceName} (id ${serviceId}) has pmm-agent with version ${agentVersion} not supporting Real-Time Analytics; pmm-agent 3.12.0 or later is required.`,
    consumerRemedy: (consumer: string) =>
      `UPDATE performance_schema.setup_consumers SET ENABLED='YES' WHERE NAME='${consumer}'`,
    instrumentRemedy: (instrument: string) =>
      `UPDATE performance_schema.setup_instruments SET ENABLED='YES', TIMED='YES' WHERE NAME='${instrument}'`,
    performanceSchemaDisabled:
      'Real-Time Analytics is not supported for this instance: performance_schema is disabled; it is required for Real-Time Analytics',
    sessionError: (serviceName: string, reason: string) =>
      `Real-Time Analytics could not start for ${serviceName}: ${reason}`,
    sessionWarningsIntro: 'The session is running, but some details cannot be collected from this instance:',
    statementsConsumerDisabled:
      'The events_statements_current consumer is disabled, so statement latency, lock time, row counts, temporary table counts and full-scan detection are not collected.',
    truncatedTooltip:
      'MySQL keeps only the first 1024 bytes of a statement by default, so this text is incomplete. To see up to 64 KiB, raise performance_schema_max_sql_text_length, restart MySQL, and turn on the events_statements_current consumer.',
    unavailable: 'Unavailable',
  };
  readonly refreshIntervals = ['1s', '2s', '3s', '4s', '5s'] as const;
  readonly sessionsUrl = 'pmm-ui/rta/sessions';
  apiEndpoint = apiEndpoints.realtimeanalytics.queriesSearch;
  toggles = {
    blockedOnly: this.page.getByTestId('overview-table-blocked-only-toggle'),
    blockedOnlySwitch: this.page.getByTestId('overview-table-blocked-only-toggle').getByRole('switch'),
    hideBeginCommit: this.page.getByTestId('overview-table-hide-commit-toggle'),
  };
  builders = {
    blockedChipForQuery: (queryText: string) =>
      this.builders.rowByQueryText(queryText).getByTestId('blocked-chip'),
    blockedUnknownChipForQuery: (queryText: string) =>
      this.builders.rowByQueryText(queryText).getByTestId('blocked-unknown-chip'),
    columnFilter: (columnHeader: 'Database' | 'User') => this.page.getByTitle(`Filter by ${columnHeader}`),
    columnToggle: (columnHeader: string) =>
      this.page.getByRole('switch', { exact: true, name: `Toggle visibility ${columnHeader}` }),
    databaseForRow: (rowIndex: string) => this.builders.rowByIndex(rowIndex).getByTestId(/-database-cell$/),
    detailsPaneCodeByText: (queryText: string) =>
      this.elements.detailsPane.locator('[data-testid="query-text"], code.language-mongodb', {
        hasText: queryText,
      }),
    elapsedTimeForQueryByText: (queryText: string) =>
      this.builders.rowByQueryText(queryText).getByTestId(/-elapsed-time-cell$/),
    elapsedTimeForRow: (rowIndex: string) =>
      this.builders.rowByIndex(rowIndex).getByTestId(/-elapsed-time-cell$/),
    hostForLastRow: () =>
      this.page
        .getByTestId(realTimeTableTestId)
        .locator('tbody tr')
        .last()
        .getByTestId(/-host-cell$/),
    hostForQueryByText: (queryText: string) =>
      this.builders.rowByQueryText(queryText).getByTestId(/-host-cell$/),
    hostForRow: (rowIndex: string) => this.builders.rowByIndex(rowIndex).getByTestId(/-host-cell$/),
    operationIdForRow: (rowIndex: string) =>
      this.builders.rowByIndex(rowIndex).getByTestId(/-operation-id-cell$/),
    queryByRowIndex: (rowIndex: string) =>
      this.builders.rowByIndex(rowIndex).getByTestId(/-query-text-cell$/),
    rowByIndex: (rowIndex: string) =>
      this.page.getByTestId(realTimeTableTestId).locator(`//tbody//tr[position()=${rowIndex}]`),
    rowByQueryText: (queryText: string) =>
      this.page.getByTestId(realTimeTableTestId).locator(`tr`, { hasText: queryText }),
    rowByQueryTextAndHost: (queryText: string, host: string) =>
      this.builders.rowByQueryText(queryText).filter({
        has: this.page.getByTestId(/-host-cell$/).getByText(host, { exact: true }),
      }),
    rowsPerPageOption: (pageSize: string) => this.page.getByRole('option', { exact: true, name: pageSize }),
    serviceOption: (serviceId: string) => this.page.getByTestId(`service-option-${serviceId}`),
    serviceOptionInGroup: (technology: 'MongoDB' | 'MySQL', serviceId: string) =>
      this.page
        .getByRole('listbox')
        .locator(':scope > li', { has: this.page.getByText(technology, { exact: true }) })
        .getByTestId(`service-option-${serviceId}`),
    // Material React Table names the button "Expand" whether the row is expanded or not.
    sessionExpandButton: (sessionName: string) =>
      this.builders.sessionRow(sessionName).getByRole('button', { exact: true, name: 'Expand' }),
    sessionLink: (sessionName: string) =>
      this.page.getByTestId(sessionsTableTestId).getByRole('link', { exact: true, name: sessionName }),
    sessionRow: (sessionName: string) =>
      this.page
        .getByTestId(sessionsTableTestId)
        .locator('tbody tr')
        .filter({ has: this.page.getByRole('link', { exact: true, name: sessionName }) }),
    sessionStatus: (sessionName: string) => this.builders.sessionRow(sessionName).getByRole('cell').nth(4),
    sessionStatusIcon: (sessionName: string) =>
      this.builders.sessionStatusMessage(sessionName).locator('svg'),
    sessionStatusMessage: (sessionName: string) =>
      this.builders.sessionRow(sessionName).getByTestId('session-status-message'),
    sessionStopButton: (sessionName: string) =>
      this.builders.sessionRow(sessionName).getByTestId('open-stop-modal'),
    technologyForSession: (sessionName: string) =>
      this.page
        .getByTestId(sessionsTableTestId)
        .locator('tr', { hasText: sessionName })
        .getByTestId('technology'),
    technologyGroupHeader: (technology: string) =>
      this.page.getByRole('listbox').locator('.MuiAutocomplete-groupLabel', { hasText: technology }),
    truncatedChipForQuery: (queryText: string) =>
      this.builders.rowByQueryText(queryText).getByTestId(/^query-.+-truncated-chip$/),
    userForRow: (rowIndex: string) => this.builders.rowByIndex(rowIndex).getByTestId(/-user-cell$/),
  };
  buttons = {
    allSessions: this.page.getByTestId('overview-table-all-sessions-button'),
    closeDetailsPane: this.page.getByTestId('details-pane-close-button'),
    confirmStopSession: this.page.getByTestId('stop-session-modal-stop'),
    detailsNextQuery: this.page.getByTestId('details-pane-next-button'),
    detailsPreviousQuery: this.page.getByTestId('details-pane-prev-button'),
    detailsRawDataTab: this.page.getByTestId('details-pane-raw-data-tab'),
    export: this.page.getByTestId('overview-table-export-button'),
    filters: this.page.getByRole('button', { name: 'Show/Hide filters' }),
    nextPage: this.page.getByRole('button', { name: 'Go to next page' }),
    openNewSessionModal: this.page.getByTestId('open-new-modal'),
    openServices: this.page.getByTitle('Open'),
    pauseRealTimeAnalytics: this.page.getByTestId('overview-table-pause-button'),
    refresh: this.page.getByTestId('overview-table-refresh-button'),
    refreshIntervalDropdown: this.page.getByTestId('auto-refresh-button'),
    resumeRealTimeAnalytics: this.page.getByTestId('overview-table-resume-button'),
    showHideColumns: this.page.getByRole('button', { name: 'Show/Hide columns' }),
    stopAgentsButton: this.page.getByTestId('stop-multiple-sessions-modal-stop'),
    stopAllSessions: this.page.getByTestId('open-stop-all-modal'),
  };
  elements = {
    blockedByHeading: this.page.getByTestId('blocked-by-heading'),
    blockedByPanel: this.page.getByTestId('blocked-by-panel'),
    blockedWaitDuration: this.page.getByTestId('blocked-wait-duration'),
    blockerQuery: this.page.getByTestId('blocker-query'),
    columnPinButtons: this.page.getByRole('button', { name: /^(Pin to (left|right)|Unpin)$/ }),
    columnsMenu: this.page.getByRole('menu'),
    databaseColumnHeader: this.page.getByTestId(realTimeTableTestId).getByText('Database', { exact: true }),
    detailsCommand: this.page.getByTestId('command-value'),
    detailsFullScan: this.page.getByTestId('full-scan-value'),
    detailsLockTime: this.page.getByTestId('lock-time-value'),
    detailsOperationId: this.page.getByTestId('operation-id-value'),
    detailsPane: this.page.getByTestId('query-details-pane'),
    detailsProgramName: this.page.getByTestId('program-name-value'),
    detailsQueryText: this.page.getByTestId('query-details-pane').getByTestId('query-text'),
    detailsRawData: this.page.getByTestId('query-raw-data'),
    detailsRowsExamined: this.page.getByTestId('rows-examined-value'),
    detailsRowsSent: this.page.getByTestId('rows-sent-value'),
    detailsState: this.page.getByTestId('state-value'),
    detailsTruncatedChip: this.page.getByTestId('query-text-truncated'),
    detailsUsername: this.page.getByTestId('username-value'),
    durationCells: this.page.getByTestId(realTimeTableTestId).getByTestId(/-elapsed-time-cell$/),
    elapsedTimeColumnHeader: this.page
      .getByTestId(realTimeTableTestId)
      .getByRole('columnheader', { name: /Elapsed time/ }),
    elapsedTimeColumnHeaderLabel: this.page
      .getByTestId(realTimeTableTestId)
      .getByRole('columnheader', { name: /Elapsed time/ })
      .getByText('Elapsed time', { exact: true }),
    hostColumnHeader: this.page.getByTestId(realTimeTableTestId).getByText('Host', { exact: true }),
    // peak-ui <1.0.30 wraps the empty row in an info alert, >=1.0.30 in an EmptyState (PMM-15002).
    noQueriesAvailable: this.builders.rowByIndex('1').getByText(/^(No queries available|No data found)$/),
    queryTextColumnHeader: this.page
      .getByTestId(realTimeTableTestId)
      .getByText('Query text', { exact: true }),
    realTimeTable: this.page.getByTestId(realTimeTableTestId),
    realTimeTableRow: this.page.getByTestId(realTimeTableTestId).locator('tbody tr'),
    selectedSessionRows: this.page.locator('tbody input[aria-label="Toggle select row"]:checked'),
    servicesListbox: this.page.getByRole('listbox'),
    sessionRows: this.page.locator('tbody > tr'),
    sessionRowSelectionCheckboxes: this.page.locator('tbody input[aria-label="Toggle select row"]'),
    sessionsTable: this.page.getByTestId(sessionsTableTestId),
    sessionStatusMessage: this.page.getByTestId('session-status-message'),
    sessionStatusMessageTooltip: this.page.getByTestId('session-status-message-tooltip'),
    technologyColumnHeader: this.page
      .getByTestId(sessionsTableTestId)
      .getByText('Technology', { exact: true }),
    tooltip: this.page.getByRole('tooltip'),
    userColumnHeader: this.page.getByTestId(realTimeTableTestId).getByText('User', { exact: true }),
  };
  inputs = {
    clusterService: this.page.locator('input[name = "service"]'),
    filterByHost: this.page.getByTitle('Filter by Host'),
    filterByQueryText: this.page.getByTitle('Filter by Query text'),
    maximumDuration: this.page.getByRole('textbox', { name: 'Max' }),
    minimumDuration: this.page.getByRole('textbox', { name: 'Min' }),
    realTimeServiceInput: this.page.getByTestId('realtime-service-input'),
    rowsLimit: this.page.getByRole('combobox', { name: 'Rows per page' }),
  };
  messages = {};

  clickElapsedTimeHeader = async () => {
    await this.elements.elapsedTimeColumnHeaderLabel.click();
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
      await this.openFiltersIfHidden();
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

  getDurationFilter = () => new URL(this.page.url()).searchParams.get(this.durationFilterParameter);

  getDurations = async () => (await this.elements.durationCells.allTextContents()).map(Number.parseFloat);

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

  openFiltersIfHidden = async () => {
    await expect(async () => {
      if (!(await this.inputs.filterByQueryText.isVisible())) {
        await this.openFilters();
      }

      await expect(this.inputs.filterByQueryText).toBeVisible({ timeout: Timeouts.TWO_SECONDS });
    }).toPass({ timeout: Timeouts.TEN_SECONDS });
  };

  selectClusterService = async () => {
    await this.inputs.clusterService.click();
    await this.page.getByRole('option').first().click();
    await this.page.keyboard.press('Escape');
  };

  selectServiceOptions = async (serviceIds: string[]) => {
    for (const serviceId of serviceIds) {
      await this.builders.serviceOption(serviceId).click();
    }

    await this.page.keyboard.press('Escape');
    await this.elements.servicesListbox.waitFor({ state: 'hidden' });
  };

  setQueryTextFilter = async (queryText: string) => {
    await this.openFiltersIfHidden();
    await this.inputs.filterByQueryText.fill(queryText);
  };

  showColumns = async (...columns: ('Database' | 'User')[]) => {
    await pmmTest.step(`Show columns: ${columns.join(', ')}`, async () => {
      await this.buttons.showHideColumns.click();

      for (const column of columns) {
        await this.builders.columnToggle(column).check();
      }

      await this.page.keyboard.press('Escape');
      await this.elements.columnsMenu.waitFor({ state: 'hidden' });
    });
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
