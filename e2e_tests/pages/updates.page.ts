import { expect, Locator, Page } from '@playwright/test';
import BasePage from '@pages/base.page';
import pmmTest from '@fixtures/pmmTest';
import GrafanaHelper from '@helpers/grafana.helper';
import { Timeouts } from '@helpers/timeouts';

export interface UpdateInfo {
  installed?: { full_version?: string; version?: string };
  latest?: { release_notes_text?: string; release_notes_url?: string; tag?: string; version?: string };
  latest_news_url?: string;
  update_available: boolean;
}

export default class UpdatesPage extends BasePage {
  advancedSettingsUrl = '/pmm-ui/settings/advanced-settings';
  clientsUrl = '/pmm-ui/updates/clients';
  url = '/pmm-ui/updates';
  homeUrl = '/pmm-ui/graph/';
  builders = {};
  buttons = {
    howToUpdateDocs: this.page.getByRole('link', { name: 'How to update docs' }),
    whatsNew: this.grafanaIframe().getByRole('link', { name: "What's new" }),
  };
  elements = {
    availableSection: this.page.getByRole('heading', { name: /New update available/i }),
    checkForUpdates: this.page.getByText('Check for updates'),
    newVersionLine: this.page.locator('p').filter({ hasText: 'New version:' }),
    pageTitle: this.page.getByRole('heading', { exact: true, name: 'Updates' }),
    runningVersion: this.page.getByText('Running version:'),
    updateNow: this.page.getByRole('button', { name: /update now/i }),
  };
  inputs = {};
  messages = {};

  clickReleaseNotes = async (link: Locator): Promise<{ href: string | null; newTab: Page }> =>
    await pmmTest.step('Click Release Notes link in update modal', async () => {
      const href = await link.getAttribute('href');
      const [newTab] = await Promise.all([this.page.waitForEvent('popup'), link.click()]);

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
      await this.elements.pageTitle.waitFor({ state: 'visible' });
    });

  openHomeForWhatsNew = async (): Promise<void> =>
    await pmmTest.step('Open home page', async () => {
      await this.page.goto(this.homeUrl);
      await expect(this.buttons.whatsNew).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
    });
}
