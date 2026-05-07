const assert = require('assert');
const { SERVICE_TYPE } = require('../../helper/constants');

const {
  advisorsPage, databaseChecksPage, codeceptjsConfig, psMySql,
} = inject();
const config = codeceptjsConfig.config.helpers.Playwright;
const connection = psMySql.defaultConnection;
let nodeId;
let serviceId;

const urls = new DataTable(['url']);

urls.add([databaseChecksPage.url]);
urls.add([advisorsPage.url]);

const psServiceName = 'databaseChecks-ps-5.7.30';
const detailsText = process.env.OVF_TEST === 'yes'
  ? 'Newer version of MySQL is available'
  : 'Newer version of Percona Server for MySQL is available';

Feature('Database Failed Checks');

BeforeSuite(async ({ addInstanceAPI }) => {
  [nodeId, serviceId] = await addInstanceAPI.addInstanceForSTT(connection, psServiceName);
});

AfterSuite(async ({ inventoryAPI }) => {
  if (nodeId) await inventoryAPI.deleteNode(nodeId, true);
});

Before(async ({ I }) => {
  await I.Authorize();
});

Scenario.skip(
  'PMM-T294 Verify user is able to see message about Disabled STT in Checks panel at Home Page [critical] @stt',
  async ({
    I, homePage, databaseChecksPage, settingsAPI,
  }) => {
    await settingsAPI.apiDisableSTT();
    I.amOnPage(homePage.url);
    I.waitForVisible(homePage.fields.sttDisabledFailedChecksPanelSelector, 30);
    I.see(
      databaseChecksPage.messages.homePagePanelMessage,
      homePage.fields.sttDisabledFailedChecksPanelSelector,
    );
  },
);

Scenario.skip(
  'PMM-T295 PMM-T276 PMM-T470 Verify user is able to see message about Disabled STT at Database Checks page [critical] @stt',
  async ({
    I, databaseChecksPage, pmmSettingsPage, settingsAPI, current,
  }) => {
    await settingsAPI.apiDisableSTT();
    I.amOnPage(current.url);
    I.waitForVisible(databaseChecksPage.fields.dbCheckPanelSelector, 30);
    I.waitForVisible(databaseChecksPage.fields.disabledSTTMessageSelector, 30);
    I.see(
      databaseChecksPage.messages.disabledSTTMessage,
      locate('div').withChild(databaseChecksPage.fields.disabledSTTMessageSelector),
    );
    I.seeElement(databaseChecksPage.fields.disabledSTTMessageLinkSelector);
    I.seeAttributesOnElements(databaseChecksPage.fields.disabledSTTMessageLinkSelector, {
      href: `${config.url}${pmmSettingsPage.url}/advanced-settings`,
    });
  },
);

// TODO: need to add functions to access pages via left side menu
xScenario(
  'PMM-T233 PMM-T234 Verify user is able to access PMM Database Checks through UI and with URL [critical] @stt',
  async ({
    I, adminPage, databaseChecksPage, pmmSettingsPage, settingsAPI, advisorsAPI,
  }) => {
    await settingsAPI.apiEnableSTT();
    await advisorsAPI.waitForFailedCheckExistance(detailsText, psServiceName);
    I.amOnPage(pmmSettingsPage.url);
    await pmmSettingsPage.waitForPmmSettingsPageLoaded();
    await adminPage.selectItemFromPMMDropdown('PMM Database Checks');
    I.waitForVisible(databaseChecksPage.fields.dbCheckPanelSelector, 30);
    I.amOnPage(databaseChecksPage.url);
    I.waitForVisible(databaseChecksPage.fields.dbCheckPanelSelector, 30);
  },
);

Scenario.skip(
  'PMM-T233 PMM-T354 PMM-T368 open PMM Database Checks page from home dashboard [critical] @stt',
  async ({
    I, homePage, databaseChecksPage, settingsAPI, advisorsAPI,
  }) => {
    const failedChecksDetails = locate('$checks-tooltip-body').find('div');

    await settingsAPI.apiEnableSTT();
    await advisorsAPI.startSecurityChecks(['mysql_version']);
    await advisorsAPI.waitForFailedCheckExistance(detailsText, psServiceName);
    I.wait(30);
    I.amOnPage(homePage.url);
    I.waitForVisible(homePage.fields.checksPanelSelector, 30);
    I.waitForVisible(homePage.fields.sttFailedChecksPanelSelector, 30);

    // Verify failed checks pop up
    I.moveCursorTo(homePage.fields.sttFailedChecksPanelSelector);
    I.waitForVisible(failedChecksDetails, 5);
    const [expectedCritical, expectedError, expectedWarning, expectedTrivial] = (await I.grabTextFrom(homePage.fields.sttFailedChecksPanelSelector)).split(' / ').map(Number);

    const levels = await I.grabTextFromAll(failedChecksDetails);

    let critical = 0;
    let error = 0;
    let warning = 0;
    let trivial = 0;

    // Calculate severity numbers taken from details popUp
    levels.forEach((level) => {
      const [l, num] = level.split(' – ');
      const sum = parseInt(num, 10);

      switch (l.trim()) {
        case 'Emergency':
        case 'Alert':
        case 'Critical':
          critical += sum;
          break;
        case 'Error':
          error += sum;
          break;
        case 'Warning':
          warning += sum;
          break;
        case 'Notice':
        case 'Info':
        case 'Debug':
          trivial += sum;
          break;
        default:
          assert.fail(`Got unexpected severity level ${l}`);
      }
    });

    const errMsg = (severity, actualNum, expectedNum) => `Number of "${severity}" severities "${expectedNum}" does no match calculated number ${actualNum}. \n ${levels}`;

    // Compare calculated numbers with number shown in the panel
    assert.strictEqual(critical, expectedCritical, errMsg('Critical', critical, expectedCritical));
    assert.strictEqual(error, expectedError, errMsg('Error', error, expectedError));
    assert.strictEqual(warning, expectedWarning, errMsg('Warning', warning, expectedWarning));
    assert.strictEqual(trivial, expectedTrivial, errMsg('Trivial', trivial, expectedTrivial));

    // Verify info icon message for Failed check panel
    I.moveCursorTo(homePage.fields.failedChecksPanelInfo);
    I.waitForVisible(homePage.fields.popUp, 5);
    I.seeTextEquals(homePage.failedChecksSinglestatsInfoMessage, homePage.fields.popUp);

    I.doubleClick(homePage.fields.sttFailedChecksPanelSelector);
    // await databaseChecksPage.verifyDatabaseChecksPageOpened();
    I.waitForVisible(databaseChecksPage.elements.failedCheckRowByServiceName(psServiceName), 10);
  },
);

Scenario.skip(
  'PMM-T241 Verify user can see correct service name for failed checks [critical] @stt @advisors-fb',
  async ({
    I, databaseChecksPage, settingsAPI, advisorsAPI, inventoryAPI, advisorsPage,
  }) => {
    await settingsAPI.apiEnableSTT();
    I.amOnPage(advisorsPage.url);
    await advisorsPage.runDBChecks();
    await advisorsAPI.waitForFailedCheckExistance(detailsText, psServiceName);

    I.amOnPage(databaseChecksPage.url);
    // Verify failed check on UI
    databaseChecksPage.verifyFailedCheckExists(detailsText, serviceId);
    I.see(psServiceName);
    await inventoryAPI.verifyServiceExistsAndHasRunningStatus(
      {
        serviceType: SERVICE_TYPE.MYSQL,
        service: 'mysql',
      },
      psServiceName,
    );
  },
);
