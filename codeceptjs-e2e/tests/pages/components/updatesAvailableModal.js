const { I } = inject();

class UpdatesAvailableModalComponent {
  constructor() {
    this.root = locate('//*[contains(@class, "MuiStack-root")]');
    this.closeIcon = this.root.find('//*[@data-testid="CloseIcon"]');
    this.dismissButton = this.root.find('button').withText('Dismiss');
    this.goToUpdatesPage = this.root.find('button').withText('Go to updates page');
  }

  async closeModal() {
    I.switchTo();
    await I.clickIfVisible(this.closeIcon);
    I.switchTo('#grafana-iframe');
  }
}

module.exports = new UpdatesAvailableModalComponent();
module.exports.UpdatesAvailableDialog = UpdatesAvailableModalComponent;
