import BasePage from '@pages/base.page';

export default class WelcomePage extends BasePage {
  elements = {
    welcomeCard: this.page.getByTestId('welcome-card'),
    tourPopover: this.page.locator('.reactour__popover'),
  };
  buttons = {
    addServiceButton: this.page.getByTestId('welcome-card-add-service'),
    dismissButton: this.page.getByTestId('welcome-card-dismiss'),
    startTourButton: this.page.getByTestId('welcome-card-start-tour'),
    updates: this.page.getByTestId('update-modal-go-to-updates-button'),
    tourCloseButton: this.page.getByTestId('tour-close-button'),
  };
  inputs = {};
  messages = {};
  builders = {};
  readonly cases = [{ updateAvailable: true }, { updateAvailable: false }];
}
