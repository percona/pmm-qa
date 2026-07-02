class PmmUpgradePage {
  constructor() {
    this.url = 'pmm-ui/updates';
    this.elements = {
      checkUpdatesNow: locate('button').withText(/Check updates now/i),
      howToUpdateDocsLink: locate('a').withText('How to update docs'),
      updateNowButton: locate('button').withText(/Update now/i),
      updateSuccess: locate('p').withText('PMM Server installation complete!'),
    };
  }
}

module.exports = new PmmUpgradePage();
module.exports.PmmUpgradePage = PmmUpgradePage;
