import BasePage from '@pages/base.page';
import { expect } from '@playwright/test';

export default class RunIdFilterComponent extends BasePage {
  builders = {};
  buttons = {};
  elements = {};
  inputs = {
    runId: this.page.getByTestId('run-id-filter').getByRole('textbox'),
  };
  messages = {};

  apply = async (runId: string) => {
    await this.inputs.runId.fill(runId);
    await this.inputs.runId.press('Enter');
    await expect(this.page).toHaveURL(new RegExp(`runId=${runId}`));
  };
}
