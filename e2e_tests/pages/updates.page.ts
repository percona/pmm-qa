import { Page, Locator } from '@playwright/test';
import BasePage from '@pages/base.page';
import pmmTest from '@fixtures/pmmTest';
import GrafanaHelper from '@helpers/grafana.helper';

export interface UpdateInfo {
  installed?: { full_version?: string; version?: string };
  latest?: { release_notes_text?: string; release_notes_url?: string; tag?: string; version?: string };
  latest_news_url?: string;
  update_available: boolean;
}

export default class UpdatesPage extends BasePage {
  url = '/pmm-ui/updates';
  builders = {};
  buttons = {
    whatsNew: this.grafanaIframe().getByTestId('update-news-link'),
  };
  elements = {
    availableSection: this.grafanaIframe().getByTestId('update-latest-section'),
    availableVersion: this.grafanaIframe().getByTestId('update-latest-version'),
  };
  inputs = {};
  messages = {};

  clickWhatsNew = async (button: Locator): Promise<{ href: string | null; newTab: Page }> =>
    await pmmTest.step("Click What's new link", async () => {
      const href = await button.getAttribute('href');
      const [newTab] = await Promise.all([this.page.waitForEvent('popup'), button.click()]);

      return { href, newTab };
    });

  getUpdateInfo = async (): Promise<UpdateInfo> =>
    await pmmTest.step('Fetch update info from version service', async () => {
      const response = await this.page.request.get('v1/server/updates?force=true', {
        headers: GrafanaHelper.getAuthHeader(),
      });

      return (await response.json()) as UpdateInfo;
    });

  open = async (): Promise<void> =>
    await pmmTest.step('Open Updates page', async () => {
      await this.page.goto(this.url);
      await this.page.locator('#grafana-iframe').waitFor({ state: 'visible' });
    });
}
