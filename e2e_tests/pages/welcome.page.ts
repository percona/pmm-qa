import BasePage from '@pages/base.page';

export default class WelcomePage extends BasePage {
  readonly cases = [{ updateAvailable: true }, { updateAvailable: false }];
  builders = {};
  buttons = {
    addServiceButton: this.page.getByTestId('welcome-card-add-service'),
    dismissButton: this.page.getByTestId('welcome-card-dismiss'),
    startTourButton: this.page.getByTestId('welcome-card-start-tour'),
    tourCloseButton: this.page.getByTestId('tour-close-button'),
    updates: this.page.getByTestId('update-modal-go-to-updates-button'),
  };
  elements = {
    tourPopover: this.page.locator('.reactour__popover'),
    welcomeCard: this.page.getByTestId('welcome-card'),
  };
  inputs = {};
  messages = {};
}
