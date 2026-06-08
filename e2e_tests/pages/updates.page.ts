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
    updateNow: this.page.getByRole('button', { name: 'Update now' }),
  };
  elements = {
    availableSection: this.page.getByRole('heading', { name: /New update available/i }),
    newVersionLine: this.page.locator('p').filter({ hasText: 'New version:' }),
    pageTitle: this.page.getByRole('heading', { exact: true, name: 'Updates' }),
    releaseHighlights: this.page.getByRole('heading', { name: 'Release highlights' }),
    releaseSummary: this.page.getByRole('heading', { name: 'Release summary' }),
  };
  inputs = {};
  messages = {};

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
}
