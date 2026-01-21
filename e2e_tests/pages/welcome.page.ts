import { Page } from "@playwright/test";
import { IPageObject } from "@interfaces/pageObject";
import pmmTest from "@fixtures/pmmTest";

export default class WelcomePage implements IPageObject {
  public readonly buttons;
  public readonly elements;

  public readonly cases = [
    { updateAvailable: true },
    { updateAvailable: false },
  ];

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

  // mock api for update available
  public async mockUpdateAvailable(updateAvailable: boolean): Promise<void> {
    await pmmTest.step('Mock update available API', async () => {
      await this.page.route('**/v1/server/updates?force=true', async (route) => {
        const installedTimestamp = '2025-12-18T00:00:00Z';
        const now = new Date();
        const millisecond = now.getMilliseconds().toString().padStart(3, '0');
        const nanosecondTimestamp = now.toISOString().split('.')[0] + '.' + millisecond + '000000Z';

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            installed: {
              version: '',
              full_version: '',
              timestamp: installedTimestamp,
            },
            latest: {
              version: '',
              tag: '',
              timestamp: null,
              release_notes_url: 'https://example.com',
              release_notes_text: 'New features'
            },
            update_available: updateAvailable,
            latest_news_url: "https://example.com",
            last_check: nanosecondTimestamp,
          })
        });
      });
    });
  }
}
