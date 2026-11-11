import BasePage from '@pages/base.page';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

export default class BackupInventoryPage extends BasePage {
  url = 'graph/backup/inventory';
  urls = {
    restoreHistory: 'graph/backup/restore',
  };
  builders = {
    artifactRow: (name: string) => this.grafanaIframe().getByRole('row').filter({ hasText: name }),
  };
  buttons = {};
  elements = {
    loadedTable: this.grafanaIframe()
      .getByTestId('table-tbody')
      .or(this.grafanaIframe().getByTestId('table-no-data').getByRole('heading')),
  };
  inputs = {};
  messages = {};

  open = async (url = this.url) => {
    await this.page.goto(url);
    await expect(this.elements.loadedTable).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
  };
}
