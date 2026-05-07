const { alertsAPI } = inject();
const page = 'templates';

Feature('Alerting: Templates Pagination');

Before(async ({ I, templatesAPI }) => {
  await I.Authorize();
  await templatesAPI.clearAllTemplates();
});

After(async ({ templatesAPI }) => {
  await templatesAPI.clearAllTemplates();
});

// Scenario(
//   'PMM-T632 PMM-T697 PMM-T701 PMM-T1251 Verify Pagination navigation @fb-alerting @grafana-pr',
//   async ({
//     I, iaCommon,
//   }) => {
//     const initialButtonsState = {
//       firstPageButton: 'disabled',
//       prevPageButton: 'disabled',
//       pageButtonActive: 'enabled',
//       nextPageButton: 'disabled',
//       lastPageButton: 'disabled',
//     };
//     const { createEntities, url, getListOfItems } = iaCommon.getCreateEntitiesAndPageUrl(page);
//
//     I.amOnPage(url);
//     await iaCommon.verifyPaginationButtonsState(initialButtonsState);
//
//     const templatesTotal = await I.grabNumberOfVisibleElements(iaCommon.elements.rowInTable);
//
//     I.assertAbove(templatesTotal, 10, 'There\'s more then 10 templates by default');
//     I.seeNumberOfElements(iaCommon.buttons.pageButtonActive, 1);
//
//     // Create more templates to have 2 pages (26 in sum)
//     await createEntities(26 - templatesTotal);
//     I.say(`1st checkpoint, URL = ${url}, Count of elements = ${(await getListOfItems()).length}`);
//     I.refreshPage();
//
//     await iaCommon.verifyPaginationButtonsState({
//       ...initialButtonsState,
//       nextPageButton: 'enabled',
//       lastPageButton: 'enabled',
//     });
//
//     // Verify number of rows and number of page buttons on page 1
//     I.seeNumberOfElements(iaCommon.elements.rowInTable, 25);
//     I.seeNumberOfElements(iaCommon.buttons.pageButton, 1);
//     I.seeNumberOfElements(iaCommon.buttons.pageButtonActive, 1);
//
//     // Go to page 2
//     I.scrollTo(iaCommon.elements.pagination);
//     I.click(locate(iaCommon.buttons.pageButton).at(1));
//     I.waitForVisible(iaCommon.elements.pagination, 30);
//
//     await iaCommon.verifyPaginationButtonsState({
//       ...initialButtonsState,
//       firstPageButton: 'enabled',
//       prevPageButton: 'enabled',
//     });
//
//     // Verify only 1 row on page 2
//     I.seeNumberOfElements(iaCommon.elements.rowInTable, 1);
//     I.seeNumberOfElements(iaCommon.buttons.pageButton, 1);
//     I.seeNumberOfElements(iaCommon.buttons.pageButtonActive, 1);
//
//     // Create 25 more templates to have 3 pages (51 in sum)
//     await createEntities(25);
//     I.say(`2nd checkpoint, URL = ${url}, Count of elements = ${(await getListOfItems()).length}`);
//     I.refreshPage();
//     I.waitForVisible(iaCommon.elements.pagination, 30);
//
//     // Go to page 2
//     I.scrollTo(iaCommon.elements.pagination);
//     I.click(locate(iaCommon.buttons.pageButton).at(1));
//
//     await iaCommon.verifyPaginationButtonsState({
//       ...initialButtonsState,
//       firstPageButton: 'enabled',
//       prevPageButton: 'enabled',
//       nextPageButton: 'enabled',
//       lastPageButton: 'enabled',
//     });
//
//     // Verify number of rows and number of page buttons on page 1
//     I.seeNumberOfElements(iaCommon.elements.rowInTable, 25);
//     I.seeNumberOfElements(iaCommon.buttons.pageButton, 2);
//     I.seeNumberOfElements(iaCommon.buttons.pageButtonActive, 1);
//
//     // Go to page 3
//     I.scrollTo(iaCommon.elements.pagination);
//     I.click(iaCommon.buttons.nextPageButton);
//     I.waitForVisible(iaCommon.elements.pagination, 30);
//
//     await iaCommon.verifyPaginationButtonsState({
//       ...initialButtonsState,
//       firstPageButton: 'enabled',
//       prevPageButton: 'enabled',
//     });
//
//     // Verify page 3 has 1 row
//     I.seeNumberOfElements(iaCommon.elements.rowInTable, 1);
//
//     // Go back to page 1
//     I.scrollTo(iaCommon.elements.pagination);
//     I.click(iaCommon.buttons.firstPageButton);
//     I.waitForVisible(iaCommon.elements.pagination, 30);
//     I.seeNumberOfElements(iaCommon.elements.rowInTable, 25);
//
//     await iaCommon.verifyPaginationButtonsState({
//       ...initialButtonsState,
//       nextPageButton: 'enabled',
//       lastPageButton: 'enabled',
//     });
//
//     // Go to the last page
//     I.scrollTo(iaCommon.elements.pagination);
//     I.click(iaCommon.buttons.lastPageButton);
//     I.waitForVisible(iaCommon.elements.pagination, 30);
//     I.seeNumberOfElements(iaCommon.elements.rowInTable, 1);
//
//     await iaCommon.verifyPaginationButtonsState({
//       ...initialButtonsState,
//       firstPageButton: 'enabled',
//       prevPageButton: 'enabled',
//     });
//
//     // Go to page 2
//     I.scrollTo(iaCommon.elements.pagination);
//     I.click(iaCommon.buttons.prevPageButton);
//     I.waitForVisible(iaCommon.elements.pagination, 30);
//     I.seeNumberOfElements(iaCommon.elements.rowInTable, 25);
//
//     await iaCommon.verifyPaginationButtonsState({
//       ...initialButtonsState,
//       firstPageButton: 'enabled',
//       prevPageButton: 'enabled',
//       nextPageButton: 'enabled',
//       lastPageButton: 'enabled',
//     });
//   },
// );
//
// Scenario(
//   'PMM-T662 PMM-T698 PMM-T702 PMM-T631 PMM-T1251 Pagination rows per page persistence @fb-alerting',
//   async ({
//     I, iaCommon,
//   }) => {
//     const { createEntities, url, getListOfItems } = iaCommon.getCreateEntitiesAndPageUrl(page);
//
//     I.amOnPage(url);
//
//     // Verify '25' rows per page is selected by default
//     I.waitForVisible(iaCommon.elements.pagination, 30);
//     I.seeTextEquals('25', iaCommon.buttons.rowsPerPage);
//
//     // Change rows per page to '50'
//     iaCommon.selectRowsPerPage(50);
//     I.seeTextEquals('50', iaCommon.buttons.rowsPerPage);
//
//     // Create more templates to have 2 pages (26 in sum)
//     const templatesTotal = await I.grabNumberOfVisibleElements(iaCommon.elements.rowInTable);
//
//     await createEntities(26 - templatesTotal);
//
//     // Rows per page is '50' after refreshing a page
//     I.say(`1st checkpoint, URL = ${url}, Count of elements = ${(await getListOfItems()).length}`);
//     I.refreshPage();
//     I.waitForVisible(iaCommon.elements.pagination, 30);
//     I.scrollTo(iaCommon.elements.pagination);
//     I.seeTextEquals('50', iaCommon.buttons.rowsPerPage);
//
//     // Verify that we have 25 rows and only one page
//     I.seeNumberOfElements(iaCommon.elements.rowInTable, 26);
//     I.seeNumberOfElements(iaCommon.buttons.pageButtonActive, 1);
//
//     // Change rows per page to '25'
//     I.waitForVisible(iaCommon.elements.pagination, 30);
//     iaCommon.selectRowsPerPage(25);
//
//     // Verify that we have 25 rows and 2 pages
//     I.seeNumberOfElements(iaCommon.elements.rowInTable, 25);
//     I.seeNumberOfElements(iaCommon.buttons.pageButton, 1);
//     I.seeNumberOfElements(iaCommon.buttons.pageButtonActive, 1);
//
//     // Change rows to 100
//     iaCommon.selectRowsPerPage(100);
//     I.waitForVisible(iaCommon.elements.pagination, 30);
//     I.seeNumberOfElements(iaCommon.elements.rowInTable, 26);
//     I.seeNumberOfElements(iaCommon.buttons.pageButtonActive, 1);
//
//     // Create 75 more templates (101 in sum)
//     await createEntities(75);
//     I.say(`2nd checkpoint, URL = ${url}, Count of elements = ${(await getListOfItems()).length}`);
//     I.refreshPage();
//
//     // Verify 100 rows per page persists after refreshing a page
//     I.waitForVisible(iaCommon.elements.pagination, 30);
//     I.scrollTo(iaCommon.elements.pagination);
//     I.seeTextEquals('100', iaCommon.buttons.rowsPerPage);
//     I.seeNumberOfElements(iaCommon.elements.rowInTable, 100);
//     I.seeNumberOfElements(iaCommon.buttons.pageButton, 1);
//     I.seeNumberOfElements(iaCommon.buttons.pageButtonActive, 1);
//
//     // Go to page 2
//     I.scrollTo(iaCommon.elements.pagination);
//     I.click(locate(iaCommon.buttons.pageButton).at(1));
//
//     // Verify only 1 row on page 2
//     I.waitForVisible(iaCommon.elements.pagination, 30);
//     I.waitForVisible(iaCommon.elements.rowInTable, 30);
//     I.seeTextEquals('100', iaCommon.buttons.rowsPerPage);
//     I.seeNumberOfElements(iaCommon.elements.rowInTable, 1);
//     I.seeNumberOfElements(iaCommon.buttons.pageButton, 1);
//     I.seeNumberOfElements(iaCommon.buttons.pageButtonActive, 1);
//   },
// );
//
// Scenario(
//   'PMM-T631 PMM-T633 PMM-T1251 Changing rows per page resets view to 1 page @fb-alerting',
//   async ({
//     I, iaCommon, templatesAPI,
//   }) => {
//     const { createEntities, url, getListOfItems } = iaCommon.getCreateEntitiesAndPageUrl(page);
//
//     // Create more templates to have 2 pages (101 in sum)
//     const templatesTotal = (await templatesAPI.getTemplatesList()).length;
//
//     await createEntities(101 - templatesTotal);
//
//     I.say(`Checkpoint, URL = ${url}, Count of elements = ${(await getListOfItems()).length}`);
//     I.amOnPage(url);
//
//     // Verify '25' rows per page is selected by default
//     I.waitForVisible(iaCommon.elements.pagination, 30);
//     I.seeTextEquals('25', iaCommon.buttons.rowsPerPage);
//     I.seeTextEquals(iaCommon.messages.itemsShown(1, 25, 101), iaCommon.elements.itemsShown);
//
//     // Go to page 2
//     I.scrollTo(iaCommon.elements.pagination);
//     I.click(locate(iaCommon.buttons.pageButton).at(1));
//     I.waitForVisible(iaCommon.elements.pagination, 30);
//     I.seeTextEquals(iaCommon.messages.itemsShown(26, 50, 101), iaCommon.elements.itemsShown);
//
//     // Change rows per page to '50'
//     iaCommon.selectRowsPerPage(50);
//     I.waitForVisible(iaCommon.elements.pagination, 30);
//     I.scrollTo(iaCommon.elements.pagination);
//     I.seeTextEquals('50', iaCommon.buttons.rowsPerPage);
//     I.seeTextEquals(iaCommon.messages.itemsShown(1, 50, 101), iaCommon.elements.itemsShown);
//     I.click(locate(iaCommon.buttons.pageButton).at(1));
//     I.waitForVisible(iaCommon.elements.pagination, 30);
//     I.seeTextEquals(iaCommon.messages.itemsShown(51, 100, 101), iaCommon.elements.itemsShown);
//
//     // Change rows per page to '100'
//     iaCommon.selectRowsPerPage(100);
//     I.waitForVisible(iaCommon.elements.pagination, 30);
//     I.scrollTo(iaCommon.elements.pagination);
//     I.seeTextEquals('100', iaCommon.buttons.rowsPerPage);
//     I.seeTextEquals(iaCommon.messages.itemsShown(1, 100, 101), iaCommon.elements.itemsShown);
//     I.click(locate(iaCommon.buttons.pageButton).at(1));
//     I.waitForVisible(iaCommon.elements.pagination, 30);
//     I.seeNumberOfElements(iaCommon.elements.rowInTable, 1);
//     I.seeNumberOfElements(iaCommon.buttons.pageButton, 1);
//     I.seeNumberOfElements(iaCommon.buttons.pageButtonActive, 1);
//     I.seeTextEquals(iaCommon.messages.itemsShown(101, 101, 101), iaCommon.elements.itemsShown);
//   },
// );
