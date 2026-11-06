import BasePage from '@pages/base.page';

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

export default class EmailInsightsDialogComponent extends BasePage {
  builders = {
    error: (text: string) => this.elements.dialog.locator('.Mui-error', { hasText: text }),
  };
  buttons = {
    cancel: this.page.getByTestId('email-insights-dialog').getByRole('button', { name: 'Cancel' }),
    send: this.page.getByTestId('email-insights-send'),
  };
  elements = {
    dialog: this.page.getByTestId('email-insights-dialog'),
    tooMany: this.page.getByTestId('email-insights-too-many'),
  };
  inputs = {
    addresses: this.page.getByTestId('email-insights-addresses'),
  };
  messages = {
    addressInvalid: (addresses: string) => this.builders.error(`Not a valid address: ${addresses}`),
    addressRequired: this.builders.error('Enter at least one address.'),
    filtered: (count: number) =>
      this.elements.dialog.getByText(`Email ${plural(count, 'insight')} matching the current filters.`),
    tooMany: (count: number) =>
      this.elements.tooMany.filter({
        hasText: `${count} insights match, more than the 200 one email can carry. Narrow the filters to 200 insights or fewer.`,
      }),
    tooManyAddresses: (count: number) => this.builders.error(`Up to 20 addresses; there are ${count}.`),
    unfiltered: this.elements.dialog.getByText(/^No filters are set, so this emails all \d+ insights?\.$/),
  };
}
