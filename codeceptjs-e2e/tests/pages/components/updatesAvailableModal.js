const { I } = inject();

class UpdatesAvailableModalComponent {
  constructor() {
    this.root = locate('[role="dialog"]');
    this.closeIcon = this.root.find('[aria-label="Close"]');
    this.dismissButton = this.root.find('button').withText('Dismiss');
    this.goToUpdatesPage = this.root.find('button').withText('Go to updates page');
  }
}

module.exports = new UpdatesAvailableModalComponent();
module.exports.UpdatesAvailableDialog = UpdatesAvailableModalComponent;
