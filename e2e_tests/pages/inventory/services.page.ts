import BasePage from '../base.page';

export default class ServicesPage extends BasePage {
  readonly url = 'graph/inventory/services';
  builders = {
    monitoringStatusByServiceName: (serviceName: string) =>
      this.grafanaIframe().locator(`//td[@title="${serviceName}"]//parent::tr//td[position()="5"]//a`),
    rowsPerPageOption: (rowsPerPage: string) =>
      this.grafanaIframe().getByRole('option', { exact: true, name: rowsPerPage }),
  };
  buttons = {
    addService: this.grafanaIframe().getByRole('button', { name: 'Add Service' }),
  };
  elements = {
    // react-select exposes role=combobox on a hidden dummy input with no text; the emotion
    // -singleValue div is the only node carrying the selected page size.
    rowsPerPageDropdown: this.grafanaIframe().getByTestId('pagination').locator('div[class*="-singleValue"]'),
  };
  inputs = {};
  messages = {};
}
