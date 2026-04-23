// xpath used here because locate('td').withText('') method does not work correctly
const checkRow = (checkName) => locate('$table-tbody-tr').withDescendant(`//td[text()="${checkName}"]`);
const actionButton = (checkName) => locate(checkRow(checkName)).find('td').last().find('button');

const {
  I,
} = inject();

module.exports = {
  url: 'graph/advisors/insights',
  urlConfiguration: 'graph/advisors/configuration',
  urlQuery: 'graph/advisors/query',
  urlSecurity: 'graph/advisors/security',
  elements: {
    tableRow: (index) => locate(`(//tr[@data-testid="table-tbody-tr"])[${index + 1}]`),
    failedAdvisorsServices: locate('//tbody//tr/td[position()=1]'),
    failedAdvisorsNames: locate('//tbody//tr/td[position()=1]'),
    failedAdvisorName: (index) => locate(`(//tr[@data-testid="table-tbody-tr"])[${index + 1}]//td[position()=1]`),
    disableAdvisor: (advisor) => locate(`//*[text()="${advisor}"]//ancestor::tr//span[text()="Disable"]`),
    enableAdvisor: (advisor) => locate(`//*[text()="${advisor}"]//ancestor::tr//span[text()="Enable"]`),
    advisorsGroups: locate('//*[@data-testid="collapse-clickable"]'),
    expandableSectionByName: (name) => locate('div[class$="collapse__header-label"] span').withText(name),
    checkNameCell: (checkName) => locate(checkRow(checkName)).find('td').at(1),
    descriptionCellByName: (checkName) => locate(checkRow(checkName)).find('td').at(2),
    statusCellByName: (checkName) => locate(checkRow(checkName)).find('td').at(3),
    technologyCellByName: (checkName) => locate(checkRow(checkName)).find('td').at(4),
    intervalCellByName: (checkName) => locate(checkRow(checkName)).find('td').at(5),
    advisorsGroupHeader: (name) => locate('span').withText(name),
    tableBody: '$table-tbody',
    noChecksFound: '$table-no-data',
    modalContent: '$modal-content',
  },
  buttons: {
    disableEnableCheck: (checkName) => locate(checkRow(checkName)).find('$check-table-loader-button'),
    openChangeInterval: (checkName) => locate(checkRow(checkName)).find('[title="Change check interval"]'),
    intervalValue: (intervalName) => locate('label').withText(intervalName),
    startDBChecks: locate('$db-check-panel-actions').find('button'),
    applyIntervalChange: '$change-check-interval-modal-save',
  },
  filter: {
    searchButton: locate('$open-search-fields'),
    searchFieldDropdown: locate('div').after('$open-search-fields')
      .find('//div[contains(@class, "grafana-select-value")]'),
    searchFieldALL: locate('[aria-label="Select options menu"]').find('div')
      .withChild('span').withText('All'),
    searchFieldName: locate('[aria-label="Select options menu"]').find('div')
      .withChild('span').withText('Name'),
    searchFieldDescription: locate('[aria-label="Select options menu"]')
      .find('div').withChild('span').withText('Description'),
    searchInput: locate('$search-text-input'),
    filterButton: '$advance-filter-button',
    statusAllRadio: locate('label[for^="radio-btn"]').at(1),
    statusEnabledRadio: locate('label[for^="radio-btn"]').at(2),
    statusDisabledRadio: locate('label[for^="radio-btn"]').at(3),
    intervalDropdown: locate('div')
      .after(locate('div').withChild('//label[@data-testid="interval-field-label"]'))
      .find('//div[contains(@class, "grafana-select-value")]'),
    intervalAll: locate('[aria-label="Select options menu"]')
      .find('div').withChild('span').withText('All'),
    intervalStandard: locate('[aria-label="Select options menu"]')
      .find('div').withChild('span').withText('Standard'),
    intervalRare: locate('[aria-label="Select options menu"]')
      .find('div').withChild('span').withText('Rare'),
    intervalFrequent: locate('[aria-label="Select options menu"]')
      .find('div').withChild('span').withText('Frequent'),
    clearAllButton: locate('$clear-all-button'),
  },
  messages: {
    successIntervalChange: (checkName) => `Interval changed for ${checkName}`,
    changeIntervalText: (checkName) => `Set interval for ${checkName}`,
    securityChecksDone: 'All checks started running in the background',
  },
  checks: [
    {
      name: 'MySQL Version',
      description: 'This check returns warnings if MySQL, Percona Server for MySQL, or MariaDB version is not the latest one.',
      status: 'Enabled',
      interval: 'Standard',
    },
    {
      name: 'MySQL User check',
      description: 'This check returns an error if there are users not properly set.',
      status: 'Enabled',
      interval: 'Standard',
    },
  ],

  async open() {
    I.amOnPage(this.url);
    I.waitForVisible(this.elements.tableBody, 30);
  },

  async runDBChecks() {
    I.amOnPage(this.url);
    I.waitForVisible(this.buttons.startDBChecks, 30);
    I.click(this.buttons.startDBChecks);
    I.verifyPopUpMessage(this.messages.securityChecksDone, 60);
  },

  runAdvisors() {
    I.waitForVisible(this.buttons.startDBChecks, 30);
    I.click(this.buttons.startDBChecks);
    I.verifyPopUpMessage(this.messages.securityChecksDone, 60);
  },

  getUrlByCategory(categoryName) {
    switch (categoryName) {
      case 'configuration':
        return this.urlConfiguration;
      case 'query':
        return this.urlQuery;
      case 'security':
        return this.urlSecurity;
      default:
        throw new Error(`${categoryName} is not a valid category`);
    }
  },

  async openAllCategories() {
    I.waitForVisible(this.elements.advisorsGroups);
    const numberOfCategories = await I.grabNumberOfVisibleElements(this.elements.advisorsGroups);

    for (let i = 0; i < numberOfCategories; i++) {
      I.click(this.elements.advisorsGroups.at(i + 1));
    }
  },

  async verifyAdvisorIsNotFailed(advisorName) {
    I.waitForVisible(this.elements.failedAdvisorsServices);
    const numberOfServices = await I.grabNumberOfVisibleElements(this.elements.failedAdvisorsServices);

    for (let i = 0; i < numberOfServices; i++) {
      I.waitForVisible(this.elements.failedAdvisorsServices.at(i + 1), 5);
      I.click(this.elements.failedAdvisorsServices.at(i + 1));
      I.waitForVisible(this.elements.failedAdvisorsNames);
      const failedAdvisors = await I.grabTextFromAll(this.elements.failedAdvisorsNames);

      I.assertFalse(failedAdvisors.includes(advisorName), `Disabled failed advisor: ${advisorName} should not be present in the list of failed advisors: ${failedAdvisors}`);
      await I.goBack();
    }
  },

  async verifyAdvisorIsFailed(advisorName) {
    I.waitForVisible(this.elements.failedAdvisorsServices);
    const numberOfServices = await I.grabNumberOfVisibleElements(this.elements.failedAdvisorsServices);

    for (let i = 0; i < numberOfServices; i++) {
      I.waitForVisible(this.elements.failedAdvisorsServices.at(i + 1), 5);
      I.click(this.elements.failedAdvisorsServices.at(i + 1));
      I.waitForVisible(this.elements.failedAdvisorsNames);
      const failedAdvisors = await I.grabTextFromAll(this.elements.failedAdvisorsNames);

      I.assertTrue(failedAdvisors.includes(advisorName), `Disabled failed advisor: ${advisorName} should not be present in the list of failed advisors: ${failedAdvisors}`);
      await I.goBack();
    }
  },

  runAllAdvisors() {
    const urls = [this.urlConfiguration, this.urlQuery, this.urlSecurity];

    for (const url of urls) {
      I.amOnPage(url);
      this.runAdvisors();
    }
  },
};
