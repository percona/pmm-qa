import BasePage from '@pages/base.page';

// The modal is rendered by the PMM shell, outside the Grafana iframe that opens it.
export default class AlertThresholdsPage extends BasePage {
  builders = {
    overrideInput: (ruleTitle: string) => this.builders.row(ruleTitle).getByRole('spinbutton'),
    resetToDefault: (ruleTitle: string) =>
      this.builders.row(ruleTitle).getByRole('button', { name: 'Reset to default' }),
    row: (ruleTitle: string) =>
      this.elements.modal.getByRole('row').filter({ has: this.page.getByRole('cell', { name: ruleTitle }) }),
    snackbar: (text: string | RegExp) => this.page.locator('#notistack-snackbar').filter({ hasText: text }),
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

  setOverride = async (ruleTitle: string, value: string): Promise<void> => {
    await this.builders.overrideInput(ruleTitle).fill(value);
  };
}
