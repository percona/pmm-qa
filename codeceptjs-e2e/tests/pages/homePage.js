const { I, dashboardPage, pmmUpgradePage } = inject();
const assert = require('assert');
const moment = require('moment');
const productTourModal = require('./components/productTourComponent');
const updatesAvailableDialog = require('./components/updatesAvailableModal');

module.exports = {
  updatesModal: updatesAvailableDialog,
  // insert your locators and methods here
  // setting locators
  url: 'graph/d/pmm-home/home-dashboard?orgId=1&refresh=1m&from=now-5m&to=now',
  cleanUrl: 'graph/d/pmm-home/home-dashboard',
  landingUrl: 'help',
  genericOauthUrl: 'graph/login/generic_oauth',
  requestEnd: '/v1/Updates/Check',
  elements: {
    pageContent: locate('//main[@id="pageContent"]'),
  },
  fields: {
    systemsUnderMonitoringCount:
      locate('.panel-content span').inside('[aria-label="Monitored Nodes panel"]'),
    dbUnderMonitoringCount:
      locate('.panel-content span').inside('[aria-label="Monitored DB Services panel"]'),
    dashboardHeaderText: 'Percona Monitoring and Management',
    dashboardHeaderLocator: '//header//span[contains(text(),"Home")]',
    oldLastCheckSelector: '#pmm-update-widget > .last-check-wrapper p',
    sttDisabledFailedChecksPanelSelector: '$db-check-panel-settings-link',
    failedSecurityChecksPmmSettingsLink: locate('$db-check-panel-settings-link').find('a'),
    sttFailedChecksPanelSelector: '$db-check-panel-has-checks',
    failedChecksPanelContent: '$db-check-panel-home',
    leftMenuToggle: locate(I.useDataQA('data-testid Toggle menu')).find('[aria-label="Open menu"]'),
    checksPanelSelector: '$db-check-panel-home',
    noFailedChecksInPanel: '$db-check-panel-zero-checks',
    failedChecksPanelInfo: '[aria-label="Advisors check panel"] i',
    newsPanelTitleSelector: dashboardPage.graphsLocator('Percona News'),
    pmmCustomMenu: locate('[data-toggle="dropdown"]').withText('PMM'),
    metricTitle: '$header-container',
    inventoryButton: '$navitem-inventory',
    mysqlButton: '$navitem-mysql',
    servicesButton: locate('span').withText('Services'),
    newsPanelContentSelector:
      locate('.panel-content').inside('[aria-label="Percona News panel"]'),
    popUp: '.panel-info-content',
    noAccessRightsSelector: '$unauthorized',
    updateWidget: {
      base: {
        checkUpdateButton: '#refresh',
        updateProgressModal: '.modal-content',
        successUpgradeMsgSelector: '.modal-content',
        lastCheckSelector: '.last-check-wrapper > p',
        triggerUpdate: 'button[ng-click="update()"]',
        reloadButtonAfterUpgrade: 'button[ng-click="reloadAfterUpdate()"]',
        upToDateLocator: '//div[@class="panel-content"]//section/p[text()="You are up to date"]',
        availableVersion: '#available_version > div > p',
        currentVersion: '#current_version > span',
        inProgressMessage: 'Update in progress',
        successUpgradeMessage: 'Successfully updated',
        whatsNewLink: 'a.text-primary.pmm-link',
      },
      oldDataAttr: {
        checkUpdateButton: '[data-qa="update-last-check-button"]',
        currentVersion: '[data-qa="update-installed-version"]',
        lastCheckSelector: '[data-qa="update-last-check"]',
        triggerUpdate: '//button//span[contains(text(), "Upgrade to")]',
        updateProgressModal: '//div/h4[text()="Upgrade in progress"]',
        successUpgradeMsgSelector: '[data-qa="modal-update-success-text"]',
        reloadButtonAfterUpgrade: '[data-qa="modal-close"]',
        availableVersion: '[data-qa="update-latest-version"]',
        inProgressMessage: 'Upgrade in progress',
        successUpgradeMessage: 'PMM has been successfully upgraded to version',
        whatsNewLink: locate('//a[@rel="noreferrer"]').withText('What\'s new'),
      },
      latest: {
        checkUpdateButton: '$update-last-check-button',
        currentVersion: '$update-installed-version',
        lastCheckSelector: '$update-last-check',
        triggerUpdate: '//button//span[contains(text(), "Upgrade to")]',
        updateProgressModal: '//div/h4[text()="Upgrade in progress"]',
        successUpgradeMsgSelector: '$modal-update-success-text',
        reloadButtonAfterUpgrade: '$modal-close',
        availableVersion: '$update-latest-version',
        inProgressMessage: 'Upgrade in progress',
        successUpgradeMessage: 'PMM has been successfully upgraded to version',
        whatsNewLink: '//a[@rel="noreferrer"]//span[contains(text(), "What")]/parent::a',
      },
    },
  },
  buttons: {
    pmmHelp: '$navitem-help-list-item',
    pmmLogs: locate('//a[@href="/logs.zip"]'),
  },
  upgradeMilestones: [
    'TASK [Gathering Facts]',
    'TASK [initialization : Copy file with image version]',
    'TASK [Cleanup yum cache]',
    'failed=0',
  ],
  failedChecksSinglestatsInfoMessage: 'Display the number of Advisors checks identified as failed during its most recent run.',

  serviceDashboardLocator: (serviceName) => locate('a').withText(serviceName),
  isAmiUpgrade: process.env.AMI_UPGRADE_TESTING_INSTANCE === 'true' || process.env.OVF_UPGRADE_TESTING_INSTANCE === 'true',
  pmmServerName: process.env.VM_NAME ? process.env.VM_NAME : 'pmm-server',

  productTour: productTourModal,

  async open() {
    I.amOnPage(this.url);
    I.waitForElement(this.fields.metricTitle, 60);
  },

  async openLeftMenu() {
    I.waitForElement(this.fields.leftMenuToggle, 60);
    I.click(this.fields.leftMenuToggle);
    I.waitForVisible(I.useDataQA('data-testid Nav menu item'), 20);
  },

  async upgradePMM(version, containerName, skipUpgradeLogs = false) {
    const locators = this.getLocators(version);

    I.waitForElement(locators.triggerUpdate, 180);
    I.seeElement(locators.triggerUpdate);

    I.click(locators.triggerUpdate);
    I.switchTo();
    I.waitForElement(pmmUpgradePage.elements.updateNowButton);

    I.wait(5);
    const numberOfElements = await I.grabNumberOfVisibleElements(pmmUpgradePage.elements.checkUpdatesNow);

    if (numberOfElements >= 1) {
      I.click(pmmUpgradePage.elements.checkUpdatesNow);
    }

    I.waitForElement(pmmUpgradePage.elements.updateNowButton);
    I.click(pmmUpgradePage.elements.updateNowButton);
    I.waitForElement(pmmUpgradePage.elements.updateSuccess, 240);

    // eslint-disable-next-line no-console
    console.log(`Upgraded to pmm server tag: ${await I.verifyCommand('docker ps -a | grep pmm-server | awk -F "pmm-server:" \'{print $2}\' | awk -F "  " \'{print $1}\'')}`);
  },

  async verifyPreUpdateWidgetIsPresent(version) {
    const locators = this.getLocators(version);

    I.waitForVisible(locators.triggerUpdate, 180);
    I.waitForVisible(locators.currentVersion, 180);
    I.seeElement(locators.availableVersion);
    I.seeElement(locators.currentVersion);
    I.seeElement(locators.triggerUpdate);
    I.dontSeeElement(locators.upToDateLocator);
    I.seeElement(locators.currentVersion);
    I.seeElement(locators.checkUpdateButton);
    I.see('Last check:');
    assert.notEqual(
      await I.grabTextFrom(locators.availableVersion),
      await I.grabTextFrom(locators.currentVersion),
      'Available and Current versions match',
    );
  },

  async verifyPostUpdateWidgetIsPresent() {
    const locators = this.getLocators('latest');

    I.waitForVisible(locators.upToDateLocator, 60);
    I.waitForVisible(locators.lastCheckSelector, 30);
    I.dontSeeElement(locators.availableVersion);
    I.dontSeeElement(locators.triggerUpdate);
    I.seeElement(locators.upToDateLocator);
    I.seeElement(locators.currentVersion);
    I.seeElement(locators.checkUpdateButton);
    const lastCheckText = await I.grabTextFrom(locators.lastCheckSelector);
    // moment(lastCheckText, ["MM-DD-YYYY", "YYYY-MM-DD"]); alternative solution without Date class
    const date = moment(new Date(lastCheckText));

    I.assertTrue(date.isValid(), `"Last Check Date" is not a valid date string: ${lastCheckText}`);
  },

  verifyVisibleService(serviceName) {
    const serviceExists = locate('.react-grid-item').find(locate('p').withText(serviceName));

    I.waitForElement(serviceExists, 30);
    I.seeElement(serviceExists);
  },

  // Method used to get selectors for different PMM versions, only to change locators after 2.9 version update
  getLocators(version) {
    let locators;

    // data-testid introduction since 2.23
    if (version >= 9 && version <= 22) {
      // eslint-disable-next-line no-param-reassign
      version = 'oldDataAttr';
    } else {
      // eslint-disable-next-line no-param-reassign
      version = 'latest';
    }

    version in this.fields.updateWidget
      ? (locators = {
        ...this.fields.updateWidget.base,
        ...this.fields.updateWidget[version],
      })
      : (locators = this.fields.updateWidget.base);

    return locators;
  },

  // For running on local env set PMM_SERVER_LATEST and DOCKER_VERSION variables
  getVersions() {
    const [, pmmMinor, pmmPatch] = (process.env.PMM_SERVER_LATEST || '').split('.');
    const [, versionMinor, versionPatch] = process.env.DOCKER_VERSION
      ? (process.env.DOCKER_VERSION || '').split('.')
      : (process.env.SERVER_VERSION || '').split('.');

    const majorVersionDiff = pmmMinor - versionMinor;
    const patchVersionDiff = pmmPatch - versionPatch;
    const current = `2.${versionMinor}`;

    return {
      majorVersionDiff,
      patchVersionDiff,
      current,
      versionMinor,
    };
  },
};
