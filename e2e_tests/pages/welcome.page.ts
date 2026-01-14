import { Page, Locator, expect } from "@playwright/test";

export default class WelcomePage {

  public readonly cases = [
    { updateAvailable: true },
    { updateAvailable: false },
  ];

  constructor(public page: Page) { }

  public elements = {
    welcomeCard: () => this.page.getByTestId('welcome-card'),
    addServiceButton: () => this.page.getByTestId('welcome-card-add-service'),
    dismissButton: () => this.page.getByTestId('welcome-card-dismiss'),
    startTourButton: () => this.page.getByTestId('welcome-card-start-tour'),
    tourPopover: () => this.page.locator('.reactour__popover'),
    updates: () => this.page.getByTestId('update-modal-go-to-updates-button'),
    tourCloseButton: () => this.page.getByTestId('tour-close-button'),
  }

  // mock api for update available
  public mockUpdateAvailable = async (updateAvailable: boolean): Promise<void> => {
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
  };
}
