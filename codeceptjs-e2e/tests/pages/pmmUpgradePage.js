class PmmUpgradePage {
  constructor() {
    this.url = 'pmm-ui/updates';
    this.elements = {
      checkUpdatesNow: locate('button').withText('Check updates now'),
      howToUpdateDocsLink: locate('a').withText('How to update docs'),
      newUpdateAvailable: locate('h4').withText('New update available'),
      newVersion: locate('strong').withText('New version:'),
      runningVersion: locate('p').withText('Running version:'),
      updateNowButton: locate('button').withText('Update now'),
      updateSuccess: locate('p').withText('PMM Server installation complete!'),
    };
  }
}

module.exports = new PmmUpgradePage();
module.exports.PmmUpgradePage = PmmUpgradePage;
