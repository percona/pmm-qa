import { Page } from '@playwright/test';
import { IPageObject } from '@interfaces/pageObject';

export default class WelcomePage implements IPageObject {
  public readonly buttons;
  public readonly elements;

  public readonly cases = [{ updateAvailable: true }, { updateAvailable: false }];

  constructor(public readonly page: Page) {
    this.buttons = {
      addServiceButton: this.page.getByTestId('welcome-card-add-service'),
      dismissButton: this.page.getByTestId('welcome-card-dismiss'),
      startTourButton: this.page.getByTestId('welcome-card-start-tour'),
      updates: this.page.getByTestId('update-modal-go-to-updates-button'),
      tourCloseButton: this.page.getByTestId('tour-close-button'),
    };

    this.elements = {
      welcomeCard: this.page.getByTestId('welcome-card'),
      tourPopover: this.page.locator('.reactour__popover'),
    };
  }
}
