import { Page } from '@playwright/test';

export async function authorize(
  page: Page,
  username = 'admin',
  password = process.env.ADMIN_PASSWORD || 'admin',
  baseUrl = '',
) {
  const authToken = getToken(username, password);
  await page.setExtraHTTPHeaders({ Authorization: `Basic ${authToken}` });
  await page.request.post(`${baseUrl}graph/login`, {
    data: { user: username, password },
  });
  await page.reload();
  return page;
}

export async function unAuthorize(page: Page) {
  await page.setExtraHTTPHeaders({});
  await page.reload();
}

export function getToken(username = 'admin', password = process.env.ADMIN_PASSWORD || 'admin') {
  return Buffer.from(`${username}:${password}`).toString('base64');
}

export async function suppressTour(page: Page): Promise<void> {
  await page.route('**/v1/users/me**', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        user_id: 1,
        product_tour_completed: true,
        alerting_tour_completed: true,
        snoozed_pmm_version: '',
      }),
    });
  });
}

export async function suppressUpgradeNotification(page: Page): Promise<void> {
  await page.route('**/v1/server/updates?force=**', (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        installed: {},
        last_check: new Date().toISOString(),
        latest: {},
        update_available: false,
      }),
    }),
  );
}
