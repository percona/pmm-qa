const {
  I, pmmInventoryPage, settingsAPI,
} = inject();
const assert = require('assert');
// xpath used here because locate('th').withText('') method does not work correctly
const locateChecksHeader = (header) => `//th[text()='${header}']`;
const failedCheckRow = (checkSummary) => `//tr[td[contains(., "${checkSummary}")]]`;

module.exports = {
  // insert your locators and methods here
  // setting locators
  url: 'graph/pmm-database-checks',
  allChecks: 'graph/pmm-database-checks/all-checks',
  // Database Checks page URL before 2.13 version
  oldUrl: 'graph/d/pmm-checks/pmm-database-checks',
  elements: {
    failedCheckRowByServiceName: (name) => locate('tr').withChild(locate('td').withText(name)),
    failedCheckRowBySummary: (summary) => locate('tr').withChild(locate('td').withText(summary)),
    allChecksTable: locate('div').find('$db-check-tab-content'),
    allChecksTableRows: locate('$table-tbody').find('tr'),
  },
  messages: {
    homePagePanelMessage: 'Advisor Checks feature is disabled.\nCheck PMM Settings.',
    disabledSTTMessage: 'Advisor Checks feature is disabled. You can enable it in',
  },
  buttons: {
    toggleSilenced: locate('$db-checks-failed-checks-toggle-silenced').find('label'),
    toggleFailedCheckBySummary: (checkSummary) => locate(failedCheckRow(checkSummary)).find('$silence-button'),
  },
  fields: {
    dbCheckPanelSelector: '$db-check-tab-content',
    dbCheckPanelEmptySelector: '$db-check-panel-table-empty',
    sttEnabledDBCheckPanelSelector: '$db-check-panel-home',
    disabledSTTMessageSelector: '$db-check-panel-settings-link',
    serviceNameSelector: 'tr > td[rowspan]:first-child',
    totalFailedChecksTooltipSelector: '.popper > div > div > div:first-of-type',
    failedChecksTooltipSelector: '.popper > div > div > div',
    serviceNameHeaderSelector: locateChecksHeader('Service Name'),
    detailsHeaderSelector: locateChecksHeader('Details'),
    noOfFailedChecksHeaderSelector: locateChecksHeader('Failed Checks'),
    disabledSTTMessageLinkSelector: locate('$db-check-panel-settings-link'),
    failedChecksRowSelector: 'tbody > tr',
    tooltipSelector: locate('.ant-tooltip-inner > div > div').first(),
    noAccessRightsSelector: '$unauthorized',
  },
  checks: {
    anonymous: [
      'MongoDB CVE Version',
      'MongoDB Version',
      'MySQL Version',
      'PostgreSQL Version',
    ],
    registered: [
      'Check if binaries are 32 bits',
      'Check log verbosity and binary log expiration',
      'Checks based on values of MySQL configuration variables',
      'Configuration change requires restart/reload.',
      'InnoDB password lifetime',
      'MongoDB Active vs Available Connections',
      'MongoDB Authentication',
      'MongoDB Configuration Write ticket Check',
      'MongoDB CPU cores',
      'MongoDB Journal',
      'MongoDB maxSessions',
      'MongoDB Non-Default Log Level',
      'MongoDB Read Tickets',
      'MongoDB Security AuthMech Check',
      'MongoDB TaskExecutorPoolSize High',
      'MongoDB write Tickets',
      'MySQL Binary Logs checks, Local infile and local infile.',
      'MySQL configuration check',
      'MySQL configuration local load data in file',
      'MySQL security check for password',
      'MySQL test Database',
      'MySQL User check',
      'PostgreSQL Archiver is failing',
      'PostgreSQL cache hit ratio',
      'PostgreSQL Checkpoints Logging is Disabled.',
      'PostgreSQL fsync is set to off',
      'PostgreSQL Table Bloat in percentage of the table size',
      'PostgreSQL Table Bloat size in bytes',
      'PostgreSQL Transaction ID Wraparound approaching'],
    registeredOnly: ['MySQL User check'],
    paid: [
      'MonogDB IP bindings',
      'MongoDB localhost authentication bypass enabled',
      'MongoDB Replica Set Topology',
      'Replication privileges',
      'MySQL Automatic User Expired Password',
      'Checks based on values of MySQL configuration variables (replication)',
      'Checks if a replica is safely logging replicated transactions.',
      // Not deployed yet
      // 'Are there tables with index sizes larger than data?',
      'MySQL security check for replication',
      'MySQL check for table without Primary Key',
      'InnoDB flush method and File Format check.',
      'InnoDB Strict Mode',
      'MySQL Users With Granted Public Networks Access',
      'MySQL User check (advanced)',
      'Check whether there is any table level autovacuum settings',
      'PostgreSQL max_connections is too high.',
      'PostgreSQL Autovacuum Logging Is Disabled',
      'PostgreSQL Stale Replication Slot',
      'PostgreSQL Super Role',
    ],
  },
  // introducing methods

  // Info icon locator in Failed Checks column for showing tooltip with additional information
  failedChecksInfoLocator(rowNumber = 1) {
    return `//tbody/tr[${rowNumber}]/td[1]/following-sibling::td/div/span[2]`;
  },
  // Locator for checks results in Failed Checks column
  numberOfFailedChecksLocator(rowNumber = 1) {
    return `//tbody/tr[${rowNumber}]/td[1]/following-sibling::td/div/span[1]`;
  },

  openDBChecksPage() {
    I.amOnPage(this.url);
  },

  openFailedChecksListForService(serviceId) {
    I.amOnPage(`${this.url}/failed-checks/${serviceId.split('/')[2]}`);
    I.waitForVisible('td', 30);
  },

  verifyFailedCheckNotExists(checkSummary, serviceId) {
    this.openFailedChecksListForService(serviceId);
    I.dontSee(checkSummary);
  },

  verifyFailedCheckExists(checkSummary, serviceId) {
    this.openFailedChecksListForService(serviceId);
    I.see(checkSummary);
  },
  /*
   Method for verifying elements on a page when STT is enabled and disabled
   default state is enabled
   */
  verifyDatabaseChecksPageElements(stt = 'enabled') {
    switch (stt) {
      case 'enabled':
        I.seeElement(this.fields.dbCheckPanelSelector);
        I.dontSeeElement(this.fields.disabledSTTMessageSelector);
        I.dontSeeElement(this.fields.disabledSTTMessageLinkSelector);
        I.seeElement(this.fields.serviceNameHeaderSelector);
        I.seeElement(this.fields.noOfFailedChecksHeaderSelector);
        I.seeElement(this.fields.detailsHeaderSelector);
        break;
      case 'disabled':
        I.waitForVisible(this.fields.disabledSTTMessageSelector, 30);
        I.seeElement(this.fields.dbCheckPanelSelector);
        I.see(this.messages.disabledSTTMessage, this.fields.disabledSTTMessageSelector);
        I.seeElement(this.fields.disabledSTTMessageLinkSelector);
        I.dontSeeElement(this.fields.serviceNameHeaderSelector);
        I.dontSeeElement(this.fields.noOfFailedChecksHeaderSelector);
        I.dontSeeElement(this.fields.detailsHeaderSelector);
        break;
      default:
    }
  },

  // Method used to verify elements on a page depending on STT state
  // Contains if statements to avoid situations when another test disables STT
  // while we expect it to be enabled and vice versa
  async verifyDatabaseChecksPageOpened(stt = 'enabled') {
    I.waitForVisible(this.fields.dbCheckPanelSelector, 30);
    const disabledSTT = await I.grabNumberOfVisibleElements(this.fields.disabledSTTMessageSelector);

    switch (stt) {
      case 'enabled':
        if (disabledSTT) {
          await settingsAPI.apiEnableSTT();
          I.refreshPage();
        }

        I.waitForVisible(this.fields.serviceNameHeaderSelector, 30);
        this.verifyDatabaseChecksPageElements(stt);
        break;
      case 'disabled':
        if (!disabledSTT) {
          await settingsAPI.apiDisableSTT();
          I.refreshPage();
        }

        this.verifyDatabaseChecksPageElements(stt);
        break;
      default:
    }
  },

  // Compares values in tooltip with values in table
  async compareTooltipValues(rowNumber = 1) {
    let tableNumbers = await I.grabTextFrom(this.numberOfFailedChecksLocator(rowNumber));
    const tooltipTotalNumber = await I.grabTextFrom(this.fields.totalFailedChecksTooltipSelector);
    const tooltipNumbers = await I.grabTextFromAll(this.fields.failedChecksTooltipSelector);

    tableNumbers = tableNumbers.split(/[^0-9]+/g);
    tableNumbers.pop();
    tooltipNumbers.shift();
    const detailsFromTable = `Critical – ${tableNumbers[1]}\nMajor – ${tableNumbers[2]}\nTrivial – ${tableNumbers[3]}`;

    assert.equal(`Failed checks: ${tableNumbers[0]}`, tooltipTotalNumber);
    assert.equal(detailsFromTable, tooltipNumbers);
  },

  mouseOverInfoIcon(row) {
    I.moveCursorTo(this.failedChecksInfoLocator(row));
    I.waitForVisible(this.fields.totalFailedChecksTooltipSelector, 30);
    I.seeElement(this.fields.totalFailedChecksTooltipSelector);
  },

  async verifyServiceNamesExistence(serviceName) {
    I.see(serviceName);

    I.amOnPage(pmmInventoryPage.url);
    I.waitForVisible(pmmInventoryPage.fields.inventoryTableColumn, 30);
    I.scrollPageToBottom();

    I.seeElement(locate('$table-row').find('td').withText(serviceName));
  },
  async verifyAdvisorCheckExistence(advisorName) {
    I.waitForVisible(this.elements.allChecksTableRows, 30);
    I.seeElement(this.elements.allChecksTableRows.withText(advisorName));
  },

  async verifyAdvisorCheckIsNotPresent(advisorName) {
    I.waitForVisible(this.elements.allChecksTableRows, 30);
    I.dontSeeElement(this.elements.allChecksTableRows.withText(advisorName));
  },
};
