import BasePage from '@pages/base.page';
import { expect } from '@playwright/test';

// The modal is rendered by the PMM shell, outside the Grafana iframe that opens it.
export default class AlertThresholdsPage extends BasePage {
  builders = {
    overrideInput: (ruleTitle: string) => this.builders.row(ruleTitle).getByRole('spinbutton'),
    resetToDefault: (ruleTitle: string) =>
      this.builders.row(ruleTitle).getByRole('button', { name: 'Reset to default' }),
    row: (ruleTitle: string) =>
      this.elements.modal.getByRole('row').filter({ has: this.page.getByRole('cell', { name: ruleTitle }) }),
    // An open MUI modal marks the snackbar's container aria-hidden, which getByRole skips.
    snackbar: (text: string | RegExp) => this.page.locator('[role="alert"]').filter({ hasText: text }),
  };
  buttons = {
    cancel: this.page.locator('.MuiModal-root').getByRole('button', { name: 'Cancel' }),
    submit: this.page.locator('.MuiModal-root').getByRole('button', { name: 'Submit changes' }),
  };
  elements = {
    modal: this.page.locator('.MuiModal-root').filter({ has: this.page.getByTestId('modal-title') }),
    ruleRows: this.page.locator('.MuiModal-root').locator('tbody').getByRole('row'),
    title: this.page.getByTestId('modal-title'),
  };
  inputs = {};
  messages = {
    empty: this.elements.modal.getByText('No alert rules support threshold overrides for this node.'),
    updated: this.builders.snackbar('Alert thresholds updated'),
  };

  resetOverride = async (ruleTitle: string): Promise<void> => {
    await this.builders.resetToDefault(ruleTitle).click();
    await this.buttons.submit.click();
    await expect(this.messages.updated).toBeVisible();
  };

  saveOverride = async (ruleTitle: string, value: string): Promise<void> => {
    await this.submitOverride(ruleTitle, value);
    await expect(this.messages.updated).toBeVisible();
  };

  submitOverride = async (ruleTitle: string, value: string): Promise<void> => {
    await this.builders.overrideInput(ruleTitle).fill(value);
    await this.buttons.submit.click();
  };

  verifyDefault = async (ruleTitle: string, threshold: number): Promise<void> => {
    await expect(this.builders.row(ruleTitle)).toContainText('threshold');
    await expect(this.builders.row(ruleTitle)).toContainText('%');
    await this.verifyOverride(ruleTitle, String(threshold));
  };

  verifyOverride = async (ruleTitle: string, value: string): Promise<void> => {
    await expect(this.builders.overrideInput(ruleTitle)).toHaveValue(value);
  };
}
