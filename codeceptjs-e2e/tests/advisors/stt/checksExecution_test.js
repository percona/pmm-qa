const assert = require('assert');

const {
  settingsAPI, psMySql, advisorsAPI, databaseChecksPage,
} = inject();
const connection = psMySql.defaultConnection;
const emptyPasswordSummary = 'User(s) has/have no password defined';
const mysqlVersionSummary = 'Newer version of Percona Server for MySQL is available';
const intervals = settingsAPI.defaultCheckIntervals;
const psServiceName = 'stt-mysql-5.7.30';
const failedCheckRowLocator = databaseChecksPage.elements
  .failedCheckRowByServiceName(psServiceName);
let nodeId;
let serviceId;

const intervalsTests = new DataTable(['interval', 'intervalValue']);

// TODO: unskip after https://jira.percona.com/browse/PMM-8051
// intervalsTests.add(['frequent_interval', 'ADVISOR_CHECK_INTERVAL_FREQUENT']);
intervalsTests.add(['standard_interval', 'ADVISOR_CHECK_INTERVAL_STANDARD']);
// intervalsTests.add(['rare_interval', 'ADVISOR_CHECK_INTERVAL_RARE']);

const cleanup = async () => {
  await settingsAPI.apiEnableSTT();
  await settingsAPI.setCheckIntervals();
  await advisorsAPI.restoreDefaultIntervals();
  await psMySql.dropUser();
  await advisorsAPI.enableCheck(advisorsAPI.checkNames.mysqlVersion);
  await advisorsAPI.enableCheck(advisorsAPI.checkNames.mysqlEmptyPassword);
};

const prepareFailedCheck = async () => {
  await advisorsAPI.startSecurityChecks();

  // Check that there is MySQL version failed check
  await advisorsAPI.waitForFailedCheckExistance(mysqlVersionSummary, psServiceName);
};

Feature('Security Checks: Checks Execution');

BeforeSuite(async ({ psMySql, addInstanceAPI }) => {
  const mysqlComposeConnection = {
    host: '127.0.0.1',
    port: '3309',
    username: connection.username,
    password: connection.password,
  };

  [nodeId, serviceId] = await addInstanceAPI.addInstanceForSTT(connection, psServiceName);

  psMySql.connectToPS(mysqlComposeConnection);
});

AfterSuite(async ({ psMySql, inventoryAPI }) => {
  await psMySql.disconnectFromPS();
  if (nodeId) await inventoryAPI.deleteNode(nodeId, true);
});

Before(async ({
  I, psMySql,
}) => {
  await I.Authorize();
  await cleanup();
  await psMySql.createUser();
});

After(async () => {
  await cleanup();
});

Scenario.skip(
  'PMM-T384 Verify that the user does not see an alert again if it has been fixed [critical] @stt @not-ovf',
  async ({
    I, advisorsAPI, databaseChecksPage, psMySql, advisorsPage,
  }) => {
    await prepareFailedCheck();
    await psMySql.setUserPassword();
    // Run DB Checks from UI
    I.amOnPage(advisorsPage.url);
    await advisorsPage.runDBChecks();

    I.amOnPage(databaseChecksPage.url);
    await advisorsAPI.waitForFailedCheckNonExistance(emptyPasswordSummary, psServiceName);
    // Verify there is no MySQL user empty password failed check
    databaseChecksPage.verifyFailedCheckNotExists(emptyPasswordSummary, serviceId);
  },
);

Scenario.skip(
  'PMM-T594 Verify failed checks appear after STT is enabled in Settings @stt @not-ovf',
  async ({
    I, databaseChecksPage, homePage, settingsAPI,
  }) => {
    await settingsAPI.changeSettings({ stt: false });
    await settingsAPI.changeSettings({ stt: true });

    // Wait for MySQL user empty password failed check
    await advisorsAPI.waitForFailedCheckExistance(mysqlVersionSummary, psServiceName);
    I.amOnPage(homePage.url);
    I.waitForVisible(homePage.fields.checksPanelSelector, 30);
    I.dontSeeElement(homePage.fields.noFailedChecksInPanel);
    I.seeElement(homePage.fields.sttFailedChecksPanelSelector);

    I.amOnPage(databaseChecksPage.url);
    I.waitForVisible(failedCheckRowLocator, 30);
  },
);

Scenario.skip(
  'PMM-T617 Verify user is able to silence failed check @stt @not-ovf @advisors-fb',
  async ({
    I, databaseChecksPage,
  }) => {
    const failedCheckRowLocator = databaseChecksPage.elements
      .failedCheckRowBySummary(mysqlVersionSummary);

    await prepareFailedCheck();
    databaseChecksPage.openFailedChecksListForService(serviceId);

    // Silence mysql Empty Password failed check and verify it's not displayed
    I.waitForVisible(failedCheckRowLocator, 30);

    const oldColor = await I.grabCssPropertyFrom(locate(databaseChecksPage.elements.failedCheckRowBySummary(mysqlVersionSummary))
      .find('td'), 'background-color');

    I.click(failedCheckRowLocator.find('$silence-button'));
    const newColor = await I.grabCssPropertyFrom(locate(databaseChecksPage.elements.failedCheckRowBySummary(mysqlVersionSummary))
      .find('td'), 'background-color');

    assert.ok(oldColor !== newColor);
  },
);

// Data(intervalsTests).Scenario(
// eslint-disable-next-line max-len
//   'PMM-T706 PMM-709 PMM-T711 Verify checks are executed based on interval value, change interval, fix problem [critical] @stt @not-ovf',
//   async ({
//     advisorsAPI, settingsAPI, perconaServerDB, databaseChecksPage, current,
//   }) => {
//     await prepareFailedCheck();
//     await perconaServerDB.setUserPassword();
//
//     // TODO: uncomment after https://jira.percona.com/browse/PMM-8051
//     // await advisorsAPI.changeCheckInterval(
//     //   advisorsAPI.checkNames.mysqlEmptyPassword,
//     //   current.intervalValue,
//     // );
//
//     await settingsAPI.setCheckIntervals({ ...intervals, [current.interval]: '3s' });
//
//     await advisorsAPI.waitForFailedCheckNonExistance(emptyPasswordSummary, psServiceName);
//
//     // Verify there is no MySQL user empty password failed check
//     databaseChecksPage.verifyFailedCheckNotExists(emptyPasswordSummary, serviceId);
//   },
// );

Scenario.skip(
  'PMM-T757 Verify disabled checks do not execute based on interval value [critical] @stt @not-ovf',
  async ({
    advisorsAPI, settingsAPI,
  }) => {
    await prepareFailedCheck();
    await advisorsAPI.disableCheck(advisorsAPI.checkNames.mysqlVersion);
    await settingsAPI.setCheckIntervals({ ...intervals, standard_interval: '3s' });

    await advisorsAPI.waitForFailedCheckNonExistance(mysqlVersionSummary, psServiceName);

    // Verify there is no MySQL user empty password failed check
    // databaseChecksPage.verifyFailedCheckNotExists(mysqlVersionSummary, serviceId);
  },
);
