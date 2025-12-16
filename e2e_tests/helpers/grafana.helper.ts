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
