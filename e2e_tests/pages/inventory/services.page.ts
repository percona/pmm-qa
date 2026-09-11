import BasePage from '../base.page';

export default class ServicesPage extends BasePage {
  readonly url = 'graph/inventory/services';
  builders = {
    monitoringStatusByServiceName: (serviceName: string) =>
      this.grafanaIframe().locator(`//td[@title="${serviceName}"]//parent::tr//td[position()="5"]//a`),
    rowsPerPageOption: (rowsPerPage: string) =>
      this.grafanaIframe().getByRole('option', { exact: true, name: rowsPerPage }),
    statusByServiceName: (serviceName: string) =>
      this.grafanaIframe()
        .getByRole('row', { name: serviceName })
        .getByTitle(/^STATUS_/),
  };
  buttons = {
    addService: this.grafanaIframe().getByRole('button', { name: 'Add Service' }),
  };
  elements = {
    rowsPerPageDropdown: this.grafanaIframe().getByTestId('pagination').locator('div[class*="-singleValue"]'),
  };
  inputs = {};
  messages = {};
}
