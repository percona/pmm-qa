import { Page, Route } from '@playwright/test';
import apiEndpoints from '@helpers/apiEndpoints';

export default class mocksHelper {
  constructor(public page: Page) {}

  // mock api for fresh install
  mockFreshInstall = async (): Promise<void> => {
    let productTourCompleted = false;

    await this.page.route(apiEndpoints.users.me, (route: Route) => {
      const method = route.request().method();

      if (method === 'GET') {
        return route.fulfill({
          body: JSON.stringify({
            alerting_tour_completed: false,
            product_tour_completed: productTourCompleted,
            user_id: 1,
          }),
          contentType: 'application/json',
          status: 200,
        });
      }
      if (method === 'PATCH' || method === 'PUT') {
        productTourCompleted = true;

        return route.fulfill({
          body: JSON.stringify({
            product_tour_completed: true,
          }),
          contentType: 'application/json',
          status: 200,
        });
      }

      return route.continue();
    });
  };

  // mock no services
  mockNoServices = async (): Promise<void> => {
    const fulfillNoServices = async (route: Route) =>
      route.fulfill({
        body: JSON.stringify({
          external: [],
          haproxy: [],
          mongodb: [],
          mysql: [],
          postgresql: [],
          proxysql: [],
          valkey: [],
        }),
        contentType: 'application/json',
        status: 200,
      });

    await this.page.route(apiEndpoints.inventory.services, fulfillNoServices);
    await this.page.route(apiEndpoints.management.services, fulfillNoServices);
  };

  mockUpdateAvailable = async (updateAvailable: boolean): Promise<void> => {
    await this.page.route(apiEndpoints.server.updates, async (route: Route) => {
      const installedTimestamp = new Date();
      const now = new Date();
      const millisecond = now.getMilliseconds().toString().padStart(3, '0');
      const nanosecondTimestamp = now.toISOString().split('.')[0] + '.' + millisecond + '000000Z';

      await route.fulfill({
        body: JSON.stringify({
          installed: {
            full_version: '',
            timestamp: installedTimestamp,
            version: '',
          },
          last_check: nanosecondTimestamp,
          latest: {
            release_notes_text: 'New features',
            release_notes_url: 'https://example.com',
            tag: '',
            timestamp: null,
            version: '',
          },
          latest_news_url: 'https://example.com',
          update_available: updateAvailable,
        }),
        contentType: 'application/json',
        status: 200,
      });
    });
  };
}
