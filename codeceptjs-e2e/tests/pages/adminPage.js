const { I } = inject();
const assert = require('assert');

const pathToPmmQaRepo = process.env.PATH_TO_PMM_QA || '/srv/qa-integration';

module.exports = {
  url: 'graph/d/pmm-home/home-dashboard?orgId=1',
  pathToFramework: `${pathToPmmQaRepo}/pmm_qa/pmm-framework.py`,
  pathToPMMTests: `${pathToPmmQaRepo}/pmm_qa/`,
  sideMenu: {
    integratedAlerting: 'li > a[href="/graph/integrated-alerting"]',
    alertingBellIcon: locate('$navbar-section').at(2).find('li a[aria-label="Alerting"]'),
    integratedAlertingManuItem: locate('ul[aria-label="Alerting"]').find('[data-key=integrated-alerting]'),
  },
  fields: {
    navigation: '//i[contains(@class, "navbar-page-btn__search")]',
    timePickerMenu: I.useDataQA('data-testid TimePicker Open Button'),
    applyCustomTimer: I.useDataQA('data-testid TimePicker submit button'),
    backToDashboard: '//button[@ng-click=\'ctrl.close()\']',
    discardChanges: '//button[@ng-click="ctrl.discard()"]',
    metricTitle: '(//div[@class="panel-title"])[2]',
    changeTimeZoneButton: locate('button').withText('Change time settings').inside('#TimePickerContent'),
    timeZoneSelector: '#TimePickerContent [aria-label="Time zone picker"]',
    reportTitleWithNA:
      '//span[contains(text(), "N/A")]//ancestor::div[contains(@class,"panel-container")]//span[contains(@class,"panel-title-text")]',
    pmmDropdownMenuSelector: locate('a[data-toggle="dropdown"] > span').withText('PMM'),
    timeRangeFrom: locate('input').withAttr({ 'data-testid': 'data-testid Time Range from field' }),
    timeRangeTo: locate('input').withAttr({ 'data-testid': 'data-testid Time Range to field' }),
    tooltipText: locate('$info-tooltip').find('span'),
    tooltipReadMoreLink: locate('$info-tooltip').find('a'),
  },

  getTimeZoneOptionSelector: (timeZone) => locate('//*[contains(@data-testid, "Select option")]').find('span').withText(timeZone),
  getTimeZoneSelector: (timeZone) => locate('[aria-label="Time zone selection"]').find('span').withText(timeZone),

  async selectItemFromPMMDropdown(title) {
    const titleLocator = `//li/a[text()='${title}']`;

    I.click(this.fields.pmmDropdownMenuSelector);
    I.waitForVisible(titleLocator, 30);
    I.click(titleLocator);
  },

  async navigateToDashboard(folderName, dashboardName) {
    I.waitForElement(this.fields.navigation, 30);
    I.click(this.fields.navigation);
    I.waitForElement(this.prepareFolderLocator(folderName), 30);
    I.click(this.prepareFolderLocator(folderName));
    I.waitForElement(this.prepareDashboardLocator(dashboardName), 30);
    I.waitForVisible(this.prepareDashboardLocator(dashboardName), 30);
    I.wait(5);
    I.click(this.prepareDashboardLocator(dashboardName));
    const numOfElements = await I.grabNumberOfVisibleElements(this.fields.discardChanges);

    if (numOfElements > 0) {
      I.click('Discard');
    }

    I.wait(10);
    I.see(dashboardName);
  },

  prepareFolderLocator(folderName) {
    return `//span[contains(text(),'${folderName}') and @class='search-section__header__text']`;
  },

  prepareDashboardLocator(dashboardName) {
    return `(//div[contains(text(), '${dashboardName}')])[1]`;
  },

  async applyTimeRange(timeRange = 'Last 5 minutes') {
    const timeRangeSelector = locate('li > label').withText(timeRange);
    const closePopUpLocator = I.getClosePopUpButtonLocator();

    // Close randomly appeared pop up message
    if (await I.grabNumberOfVisibleElements(closePopUpLocator)) {
      I.click(closePopUpLocator);
    }

    I.waitForElement(this.fields.timePickerMenu, 30);
    I.forceClick(this.fields.timePickerMenu);
    I.waitForVisible(timeRangeSelector, 30);
    I.click(timeRangeSelector);
  },

  async verifyTimeRange(timeRange) {
    const selectedTimeRange = locate(I.useDataQA('data-testid TimePicker Open Button')).find('span').withText(timeRange);

    I.seeElement(selectedTimeRange);
  },

  setAbsoluteTimeRange(from = '2022-01-10 09:09:59', to = '2022-01-10 10:00:59') {
    I.waitForElement(this.fields.timePickerMenu, 30);
    I.click(this.fields.timePickerMenu);
    I.waitForVisible(this.fields.timeRangeFrom, 30);
    I.clearField(this.fields.timeRangeFrom);
    I.fillField(this.fields.timeRangeFrom, from);
    I.clearField(this.fields.timeRangeTo);
    I.fillField(this.fields.timeRangeTo, to);
    I.click(this.fields.applyCustomTimer);
    I.waitForInvisible(this.fields.applyCustomTimer, 30);
  },

  verifySelectedTimeRange(from, to) {
    I.waitForElement(this.fields.timePickerMenu, 30);
    I.click(this.fields.timePickerMenu);
    I.waitForVisible(this.fields.timeRangeFrom, 30);
    I.waitForValue(this.fields.timeRangeFrom, from);
    I.waitForValue(this.fields.timeRangeTo, to);
    I.click(this.fields.applyCustomTimer);
    I.waitForInvisible(this.fields.applyCustomTimer, 30);
  },

  applyTimeZone(timeZone = 'Europe/London') {
    const timeZoneSelector = this.getTimeZoneOptionSelector(timeZone);

    I.waitForElement(this.fields.timePickerMenu, 30);
    I.forceClick(this.fields.timePickerMenu);
    I.waitForVisible(this.fields.changeTimeZoneButton, 30);
    I.click(this.fields.changeTimeZoneButton);
    I.waitForElement(this.fields.timeZoneSelector, 30);
    I.fillField(this.fields.timeZoneSelector, timeZone);
    I.waitForElement(timeZoneSelector, 30);
    I.click(timeZoneSelector);
    I.forceClick(this.fields.timePickerMenu);
  },

  viewMetric(metricName) {
    I.click(`//span[contains(text(), '${metricName}')]`);
    I.waitForElement(`//span[contains(text(), '${metricName}')]/../span/ul/li[1]`, 30);
    I.click(`//span[contains(text(), '${metricName}')]/../span/ul/li[1]`);
    I.wait(10);
  },

  openPanel(panelName) {
    I.click(`//div[contains(@class,'dashboard-row')]//a[contains(text(), '${panelName}')]`);
    I.wait(2);
  },

  async handleLazyLoading(timesPageDown) {
    I.click(this.fields.metricTitle);
    I.wait(10);
    I.click(this.fields.metricTitle);
    for (let i = 0; i < timesPageDown; i++) {
      I.pressKey('PageDown');
      I.wait(2);
    }
  },

  performPageDown(timesPagesDown) {
    for (let i = 0; i < timesPagesDown; i++) {
      I.pressKey('PageDown');
      I.wait(1);
    }
  },

  performPageUp(timesPagesUp) {
    for (let i = 0; i < timesPagesUp; i++) {
      I.pressKey('PageUp');
      I.wait(1);
    }
  },
  async grabReportNameWithNA(number) {
    const numOfElements = await I.grabNumberOfVisibleElements(this.fields.reportTitleWithNA);

    if (numOfElements > number) {
      const reportTitle = await I.grabTextFrom(this.fields.reportTitleWithNA);

      assert.equal(
        numOfElements > number,
        false,
        `${numOfElements} Reports with N/A found on dashboard ${reportTitle}`,
      );
    }
  },

  async verifyBackgroundColor(element, expectedColor) {
    const backgroundColor = await I.grabCssPropertyFrom(element, 'background-color');

    assert.strictEqual(
      backgroundColor,
      expectedColor,
      `The Background color of the ${element} is not matching, the actual value is ${backgroundColor}`,
    );
  },

  customClearField(field) {
    I.appendField(field, '');
    I.pressKey(['Control', 'a']);
    I.pressKey('Backspace');
  },

  /**
   * Encapsulates Tooltip data verification.
   * There could be only one tooltip popup on a page.
   *
   * @param   tooltipObj        one of {@link pmmSettingsPage.tooltips} or an object with similar structure
   * tooltipObj have to have field tooltipText containing selector for tooltip text and field tooltipReadMoreLink
   * containing selector for tooltip doc link
   * @returns {Promise<void>}   requires await in test body.
   */
  async verifyTooltip(tooltipObj) {
    const tooltipIcon = tooltipObj.iconLocator;
    const tooltipText = tooltipObj.tooltipText.as('Tooltip text');

    I.waitForVisible(tooltipIcon, 5);
    I.wait(1);
    I.moveCursorTo(tooltipIcon);
    I.waitForVisible(tooltipText, 5);
    I.seeTextEquals(tooltipObj.text, tooltipText);
    /* there are tooltip without "Read more" link */
    if (tooltipObj.link) {
      const tooltipReadMoreLink = tooltipObj.tooltipReadMoreLink.as(`Tooltip "Read more" link for ${tooltipObj.iconLocator}`);

      I.waitForVisible(tooltipReadMoreLink, 5);
      I.scrollTo(tooltipReadMoreLink);
      I.seeAttributesOnElements(tooltipReadMoreLink, { href: tooltipObj.link });
      const readMoreLink = (await I.grabAttributeFrom(tooltipReadMoreLink, 'href'));
      const response = await I.sendGetRequest(readMoreLink);

      assert.equal(response.status, 200, 'Read more link should lead to working documentation page. But the GET request response status is not 200');
    }
  },
};
