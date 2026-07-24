const assert = require('assert');
const { isOvFAmiJenkinsJob, SERVICE_TYPE } = require('../helper/constants');

const { psMySql, dashboardPage, databaseChecksPage } = inject();

const clientDbServices = new DataTable(['serviceType', 'name', 'metric', 'annotationName', 'dashboard', 'upgrade_service']);

clientDbServices.add([SERVICE_TYPE.MYSQL, 'ps_', 'mysql_global_status_max_used_connections', 'annotation-for-mysql', dashboardPage.mysqlInstanceSummaryDashboard.url, 'mysql_upgrade']);
clientDbServices.add([SERVICE_TYPE.POSTGRESQL, 'PGSQL_', 'pg_stat_database_xact_rollback', 'annotation-for-postgres', dashboardPage.postgresqlInstanceSummaryDashboard.url, 'pgsql_upgrade']);
clientDbServices.add([SERVICE_TYPE.MONGODB, 'mongodb_', 'mongodb_connections', 'annotation-for-mongo', dashboardPage.mongoDbInstanceSummaryDashboard.url, 'mongo_upgrade']);

// For running on local env set PMM_SERVER_LATEST and DOCKER_VERSION variables
function getVersions() {
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
}

const { versionMinor, patchVersionDiff, majorVersionDiff } = getVersions();

Feature('PMM server Upgrade Tests and Executing test cases related to Upgrade Testing Cycle').retry(1);

Before(async ({ I }) => {
  await I.Authorize();
});

Scenario(
  'PMM-T289 - Verify Whats New link is presented on Update Widget @pmm-upgrade',
  async ({ I, homePage }) => {
    const locators = homePage.getLocators(versionMinor);

    I.amOnPage(homePage.url);
    // Whats New Link is added for the latest version hours before the release,
    // hence we need to skip checking on that, rest it should be available and checked.
    if (majorVersionDiff >= 1 && patchVersionDiff >= 1) {
      I.waitForElement(locators.whatsNewLink, 30);
      I.seeElement(locators.whatsNewLink);
      const link = await I.grabAttributeFrom(locators.whatsNewLink, 'href');

      assert.equal(link.indexOf('https://per.co.na/pmm/') > -1, true, 'Whats New Link has an unexpected URL');
    }
  },
);

Scenario(
  'PMM-T288 - Verify user can see Update widget before upgrade [critical] @pmm-upgrade',
  async ({ I, homePage }) => {
    await I.stopMockingUpgrade();
    I.amOnPage(homePage.url);
    await homePage.verifyPreUpdateWidgetIsPresent(versionMinor);
  },
);

Scenario(
  'PMM-T3 - Verify user is able to Upgrade PMM version [blocker] @pmm-upgrade',
  async ({ I, homePage }) => {
    await I.stopMockingUpgrade();
    I.amOnPage(homePage.url);

    await homePage.updatesModal.closeModal();
    await homePage.upgradePMM(versionMinor);
  },
).retry(0);

Scenario('PMM-T1647 - Verify pmm-server package doesn\'t exist @pmm-upgrade', async ({ I }) => {
  if (!isOvFAmiJenkinsJob) {
    const packages = await I.verifyCommand('docker exec pmm-server rpm -qa');

    I.assertTrue(!packages.includes('pmm-server'), 'pmm-server package present in package list.');
  }
});

Scenario.skip(
  'Verify user can see Update widget [critical] @pmm-upgrade',
  async ({ I, homePage }) => {
    I.amOnPage(homePage.url);
    await homePage.verifyPostUpdateWidgetIsPresent();
  },
);

Scenario(
  'Verify pmm server is upgraded to correct version @pmm-upgrade',
  async ({ I, homePage }) => {
    await I.stopMockingUpgrade();
    I.amOnPage(homePage.url);

    await homePage.verifyPMMServerVersion(process.env.PMM_SERVER_LATEST);
  },
);
