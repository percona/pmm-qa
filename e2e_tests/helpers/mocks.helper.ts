import { Page } from '@playwright/test';

export default class mocksHelper {
  constructor(public page: Page) { }

  // mock no services
  mockNoServices = async (): Promise<void> => {
    await this.page.route('**/v1/inventory/services', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          "mysql": [],
          "mongodb": [],
          "postgresql": [],
          "proxysql": [],
          "haproxy": [],
          "external": [],
          "valkey": []
        })
      })
    })
  }

  // mock api for fresh install
  mockFreshInstall = async (): Promise<void> => {
    let productTourCompleted = false;

    await this.page.route('**/v1/users/me', route => {
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
  };
};
