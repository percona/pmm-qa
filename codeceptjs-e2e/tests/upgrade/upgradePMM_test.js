const assert = require('assert');

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
  'PMM-T3 - Verify user is able to Upgrade PMM version [blocker] @pmm-upgrade',
  async ({ I, homePage }) => {
    await I.stopMockingUpgrade();
    I.amOnPage(homePage.url);

    await homePage.updatesModal.closeModal();
    await homePage.verifyPreUpdateWidgetIsPresent(versionMinor);
    await homePage.upgradePMM(versionMinor);
  },
).retry(0);

Scenario(
  'Verify pmm server is upgraded to correct version @pmm-upgrade',
  async ({ I, homePage }) => {
    await I.stopMockingUpgrade();
    I.amOnPage(homePage.url);

    await homePage.verifyPMMServerVersion(process.env.PMM_SERVER_LATEST);
  },
);
