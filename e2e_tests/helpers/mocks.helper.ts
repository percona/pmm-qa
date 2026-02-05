import { Page } from '@playwright/test';

export default class mocksHelper {
  constructor(public page: Page) {}

  // mock no services
  async mockNoServices(): Promise<void> {
    await this.page.route('**/v1/inventory/services', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          mysql: [],
          mongodb: [],
          postgresql: [],
          proxysql: [],
          haproxy: [],
          external: [],
          valkey: [],
        }),
      });
    });
  }

  // mock api for fresh install
  async mockFreshInstall(): Promise<void> {
    let productTourCompleted = false;

    await this.page.route('**/v1/users/me', (route) => {
      const method = route.request().method();

      if (method === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user_id: 1,
            product_tour_completed: productTourCompleted,
            alerting_tour_completed: false,
          }),
        });
      }
      if (method === 'PATCH' || method === 'PUT') {
        productTourCompleted = true;

        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            product_tour_completed: true,
          }),
        });
      }

      return route.continue();
    });
  }

  async mockUpdateAvailable(updateAvailable: boolean): Promise<void> {
    await this.page.route('**/v1/server/updates?force=true', async (route) => {
      const installedTimestamp = new Date();
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
            release_notes_text: 'New features',
          },
          update_available: updateAvailable,
          latest_news_url: 'https://example.com',
          last_check: nanosecondTimestamp,
        }),
      });
    });
  }
}
