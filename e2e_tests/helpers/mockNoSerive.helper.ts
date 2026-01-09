import { Page } from '@playwright/test';

export default class MockNoServiceHelper {
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
}
