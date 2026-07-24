const assert = require('assert');

const { psMySql } = inject();

const connection = psMySql.defaultConnection;
const psServiceName = 'allChecks-ps-5.7.30';
let nodeId;
let serviceId;

Feature('Security Checks: All Checks');

/*
 BeforeSuite(async ({ addInstanceAPI }) => {
  [nodeId, serviceId] = await addInstanceAPI.addInstanceForSTT(connection, psServiceName);
});
AfterSuite(async ({ inventoryAPI }) => {
  if (nodeId) await inventoryAPI.deleteNode(nodeId, true);
});

Before(async ({ I, settingsAPI, advisorsAPI }) => {
  await I.Authorize();
  await settingsAPI.apiEnableSTT();
  await advisorsAPI.enableCheck(advisorsAPI.checkNames.mysqlVersion);
});

After(async ({ settingsAPI, advisorsAPI }) => {
  await settingsAPI.apiEnableSTT();
  await advisorsAPI.enableCheck(advisorsAPI.checkNames.mysqlVersion);
});
*/

Scenario.skip(
  'PMM-T469 PMM-T472 PMM-T654 Verify list of all checks [critical] @stt',
  async ({
    I, advisorsPage,
  }) => {
    const checkNameCell = locate('td').at(1);

    I.amOnPage(advisorsPage.url);

    I.waitForVisible(advisorsPage.elements.tableBody, 30);

    const checkNames = await I.grabTextFromAll(checkNameCell);

    assert.ok(!checkNames.find((el) => el === ''), 'Expected to not have empty check names.');
    const checkDescriptions = await I.grabTextFromAll(locate('td').at(2));

    assert.ok(!checkDescriptions.find((el) => el === ''), 'Expected to not have empty check descriptions.');

    assert.ok(checkNames.length === [...new Set(checkNames)].length, 'Expected to not have duplicate checks in All Checks list.');
  },
);

Scenario.skip(
  'PMM-T471 Verify reloading page on All Checks tab [minor] @stt',
  async ({
    I, advisorsPage,
  }) => {
    I.amOnPage(advisorsPage.url);

    I.waitForVisible(advisorsPage.elements.tableBody, 30);
    I.seeInCurrentUrl(advisorsPage.url);

    I.refreshPage();

    I.waitForVisible(advisorsPage.elements.tableBody, 30);
    I.seeInCurrentUrl(advisorsPage.url);
    I.seeElement(advisorsPage.elements.checkNameCell(advisorsPage.checks[0].name));
  },
);

Scenario.skip(
  'PMM-T585 Verify user is able enable/disable checks [critical] @stt @advisors-fb',
  async ({
    I, advisorsPage, advisorsAPI, databaseChecksPage,
  }) => {
    const detailsText = process.env.OVF_TEST === 'yes'
      ? 'Newer version of MySQL is available'
      : 'Newer version of Percona Server for MySQL is available';
    const checkName = 'MySQL Version';

    I.amOnPage(advisorsPage.url);
    // Run DB Checks from UI
    await advisorsPage.runDBChecks();

    // Wait for MySQL version failed check
    await advisorsAPI.waitForFailedCheckExistance(detailsText, psServiceName);

    // Verify failed check on UI
    databaseChecksPage.verifyFailedCheckExists(detailsText, serviceId);

    // Disable MySQL Version check
    I.amOnPage(advisorsPage.url);
    I.waitForVisible(advisorsPage.buttons.disableEnableCheck(checkName));
    I.seeTextEquals('Disable', advisorsPage.buttons.disableEnableCheck(checkName));
    I.seeTextEquals('Enabled', advisorsPage.elements.statusCellByName(checkName));

    I.click(advisorsPage.buttons.disableEnableCheck(checkName));

    I.seeTextEquals('Enable', advisorsPage.buttons.disableEnableCheck(checkName));
    I.seeTextEquals('Disabled', advisorsPage.elements.statusCellByName(checkName));

    // Run DB Checks from UI
    await advisorsPage.runDBChecks();
    await advisorsAPI.waitForFailedCheckNonExistance(detailsText, psServiceName);

    // Verify there is no MySQL Version failed check
    // databaseChecksPage.verifyFailedCheckNotExists(detailsText, serviceId);
  },
);

Scenario.skip(
  'PMM-T723 Verify user can change check interval @stt @advisors-fb',
  async ({
    I, advisorsPage, advisorsAPI,
  }) => {
    const checkName = 'MySQL Version';
    const interval = 'Rare';

    await advisorsAPI.restoreDefaultIntervals();
    I.amOnPage(advisorsPage.url);

    I.waitForVisible(advisorsPage.elements.tableBody, 30);
    I.seeInCurrentUrl(advisorsPage.url);

    I.click(advisorsPage.buttons.openChangeInterval(checkName));
    I.waitForVisible(advisorsPage.elements.modalContent, 10);
    I.seeTextEquals(
      advisorsPage.messages.changeIntervalText(checkName),
      locate(advisorsPage.elements.modalContent).find('h4'),
    );
    I.click(advisorsPage.buttons.intervalValue(interval));

    I.click(advisorsPage.buttons.applyIntervalChange);

    I.verifyPopUpMessage(advisorsPage.messages.successIntervalChange(checkName));
    I.seeTextEquals(interval, advisorsPage.elements.intervalCellByName(checkName));

    await advisorsAPI.restoreDefaultIntervals();
  },
);

Scenario.skip(
  '@PMM-T1269 Verify ability to filter Advisor checks list @stt',
  async ({
    I, advisorsPage, advisorsAPI,
  }) => {
    const searchKey = 'CVE fixes';
    const ruleName = 'MongoDB CVE Version';
    const interval = 'Rare';
    const tableRowLocator = '//tr[td]';

    await advisorsPage.open();

    await I.say('Click on magnifying glass icon then select search by Description field', 'pink');
    I.click(advisorsPage.filter.searchButton);
    I.waitForVisible(advisorsPage.filter.searchFieldDropdown, 5);
    I.click(advisorsPage.filter.searchFieldDropdown);
    I.waitForVisible(advisorsPage.filter.searchFieldDescription);
    I.click(advisorsPage.filter.searchFieldDescription);

    await I.say(`Search for ${searchKey} and assert single check found`, 'pink');
    I.fillField(advisorsPage.filter.searchInput, searchKey);
    I.waitForVisible(advisorsPage.elements.tableBody, 5);
    I.seeNumberOfElements(tableRowLocator, 1);

    await I.say(`Edit result: set "${interval}" and filter "Standard" then assert no checks found`, 'pink');
    I.click(advisorsPage.buttons.openChangeInterval(ruleName));
    I.waitForVisible(advisorsPage.elements.modalContent, 5);
    I.click(advisorsPage.buttons.intervalValue(interval));
    I.click(advisorsPage.buttons.applyIntervalChange);
    I.click(advisorsPage.filter.filterButton);
    I.waitForVisible(advisorsPage.filter.intervalDropdown, 5);
    I.click(advisorsPage.filter.intervalDropdown);
    I.waitForVisible(advisorsPage.filter.intervalStandard);
    I.click(advisorsPage.filter.intervalStandard);
    I.waitForVisible(advisorsPage.elements.noChecksFound, 5);

    await I.say(`Filter "${interval}" checks and assert single check found`, 'pink');
    I.click(advisorsPage.filter.intervalDropdown);
    I.waitForVisible(advisorsPage.filter.intervalRare);
    I.click(advisorsPage.filter.intervalRare);
    I.waitForVisible(advisorsPage.elements.tableBody, 5);
    I.seeNumberOfElements(tableRowLocator, 1);

    await I.say('Edit result: disable then assert no checks found', 'pink');
    I.click(advisorsPage.buttons.disableEnableCheck(ruleName));
    I.click(advisorsPage.filter.statusEnabledRadio);
    I.waitForVisible(advisorsPage.elements.noChecksFound, 5);

    await I.say('Filter "Disabled" checks and assert single check found', 'pink');
    I.click(advisorsPage.filter.statusDisabledRadio);
    I.waitForVisible(advisorsPage.elements.tableBody, 5);
    I.seeNumberOfElements(tableRowLocator, 1);

    await I.say('Click "clear all" button then search and filter elements are not displayed', 'pink');
    I.click(advisorsPage.filter.clearAllButton);
    I.waitForInvisible(advisorsPage.filter.searchFieldDropdown, 5);
    I.waitForInvisible(advisorsPage.filter.searchInput);
    I.waitForInvisible(advisorsPage.filter.statusAllRadio);
    I.waitForInvisible(advisorsPage.filter.intervalDropdown);

    await advisorsAPI.restoreDefaultIntervals();
    await advisorsAPI.enableCheck(ruleName);
  },
);
