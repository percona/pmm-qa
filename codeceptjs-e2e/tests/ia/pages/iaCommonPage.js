const assert = require('assert');
const { locateOption } = require('../../helper/locatorHelper');

const {
  I, alertRulesPage, ruleTemplatesPage, rulesAPI, templatesAPI, alertsPage, alertsAPI,
} = inject();

module.exports = {
  tabNames: {
    firedAlerts: 'Fired alerts',
    ruleTemplates: 'Alert templates',
    alertRules: 'Alert rules',
    contactPoints: 'Contact points',
    notificationPolicies: 'Notification policies',
    silences: 'Silences',
    alertGroups: 'Alert groups',
    admin: 'Alert settings',
  },
  elements: {
    noData: locate('$table-no-data').find('h1'),
    pagination: '$pagination',
    itemsShown: '$pagination-items-inverval',
    rowInTable: locate('$table-tbody').find('tr'),
    // tab: (tabName) => locate('[role="tablist"] a').withAttr({ 'aria-label': `Tab ${tabName}` }),
    tab: (tabName) => locate(`//span[text()="${tabName}"]`),
    table: '$table-tbody',
    disabledIa: '$empty-block',
    settingsLink: '$settings-link',
    selectDropdownOption: (option) => locateOption(option),
    inputField: (id) => `input[id='${id}']`,
    modalDialog: 'div[role=\'dialog\']',
  },
  buttons: {
    firstPageButton: '$first-page-button',
    prevPageButton: '$previous-page-button',
    pageButton: '$page-button',
    pageButtonActive: '$page-button-active',
    nextPageButton: '$next-page-button',
    lastPageButton: '$last-page-button',
    rowsPerPage: locate('$pagination').find('div[class*="-singleValue"]'),
    rowsPerPageOption: (count) => locateOption(count.toString()),
  },
  messages: {
    itemsShown: (leftNumber, rightNumber, totalItems) => `Showing ${leftNumber}-${rightNumber} of ${totalItems} items`,
    disabledIa: 'Percona Alerting is disabled. You can enable it in  PMM Settings.',
  },

  /**
   * @param  {} tabName
   * @param  {} tabElement  - element (locator) that exist in tab
   * @param  {} tabUrl - expected url in tab
   */
  async openAndVerifyTab(tabName, tabElement, tabUrl) {
    I.switchTo();
    I.waitForVisible(this.elements.tab(tabName), 30);
    I.click(this.elements.tab(tabName));
    I.switchTo('#grafana-iframe');
    I.waitForVisible(tabElement, 10);
    I.seeInCurrentUrl(tabUrl);
    //
    // const className = await I.grabAttributeFrom(this.elements.tab(tabName), 'class');
    //
    // assert.ok(className.endsWith('activeTabStyle'), `Tab ${tabName} should be active`);
  },

  getCreateEntitiesAndPageUrl(page) {
    if (page === 'rules') {
      return {
        createEntities: rulesAPI.createAlertRules,
        url: alertRulesPage.url,
        getListOfItems: rulesAPI.getAlertRules,
      };
    }

    if (page === 'templates') {
      return {
        createEntities: templatesAPI.createRuleTemplates,
        url: ruleTemplatesPage.url,
        getListOfItems: templatesAPI.getTemplatesList,
      };
    }

    if (page === 'alerts') {
      return {
        createEntities: rulesAPI.createAlertRules,
        url: alertsPage.url,
        getListOfItems: alertsAPI.getAlertsList,
      };
    }

    return new Error('Did not met expected page. Expected: "channels", "rules" or "templates" ');
  },

  selectRowsPerPage(count) {
    I.click(this.buttons.rowsPerPage);
    I.waitForElement(this.buttons.rowsPerPageOption(count), 30);
    I.click(this.buttons.rowsPerPageOption(count));
  },

  async verifyButtonState(button, disabled) {
    const isDisabled = await I.grabAttributeFrom(button, 'disabled');

    if (disabled.disabled) {
      I.assertEqual(isDisabled, '', `Button ${button} should be disabled.`);
    } else {
      I.assertEqual(isDisabled, null, `Button ${button} should be enabled.`);
    }
  },

  async verifyPaginationButtonsState(state) {
    for (const [key, value] of Object.entries(state)) {
      if (this.buttons[key]) {
        I.waitForVisible(this.buttons[key], 10);
        await this.verifyButtonState(this.buttons[key], this.shouldBeDisabled(value));
      } else {
        throw new Error(`Didn't find ${key} key in ${this.buttons} object`);
      }
    }
  },

  shouldBeDisabled(value) {
    return value === 'disabled' ? { disabled: true } : { disabled: null };
  },
};
