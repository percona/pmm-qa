const { searchDashboardsModal } = inject();

const folders = new DataTable(['folderObject']);

Object.values(searchDashboardsModal.folders).forEach((folder) => {
  // Temp skip until finiding a way to see all dashboards using UI
  if (folder.name === searchDashboardsModal.folders.mySql.name) return;

  folders.add([folder]);
});

Feature('Test Dashboards collection inside the Folders').retry(1);

Before(async ({ I, searchDashboardsModal }) => {
  await I.Authorize();
  I.amOnPage(searchDashboardsModal.url);
});

Scenario(
  'PMM-T1091 - Verify PMM Dashboards folders are correct @nightly @dashboards',
  async ({ I, searchDashboardsModal }) => {
    searchDashboardsModal.waitForOpened();
    const foldersNames = Object.values(searchDashboardsModal.folders).map((folder) => folder.name);
    const actualFolders = (await searchDashboardsModal.getFoldersList());

    I.assertDeepMembers(actualFolders, foldersNames);
  },
);

Data(folders).Scenario(
  'PMM-T1086 - Verify PMM Dashboards collections are present in correct folders @nightly @dashboards @post-upgrade',
  async ({
    current, searchDashboardsModal,
  }) => {
    searchDashboardsModal.waitForOpened();
    searchDashboardsModal.expandFolder(current.folderObject.name);
    await searchDashboardsModal.verifyDashboardsInFolderCollection(current.folderObject);
  },
).retry(1);
