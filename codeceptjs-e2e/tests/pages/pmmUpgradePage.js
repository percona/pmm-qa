class PmmUpgradePage {
  constructor() {
    this.url = 'pmm-ui/updates';
    this.elements = {
      updateNowButton: locate('button').withText('Update now'),
      checkUpdatesNow: locate('button').withText('Check Updates Now'),
      updateSuccess: locate('p').withText('PMM Server installation complete!'),
    };
  }
}

module.exports = new PmmUpgradePage();
module.exports.PmmUpgradePage = PmmUpgradePage;
