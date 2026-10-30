import BasePage from '@pages/base.page';

export default class DumpPage extends BasePage {
  url = 'graph/pmm-dump';
  builders = {
    menuItem: (name: string) => this.grafanaIframe().getByTestId('dropdown-button').filter({ hasText: name }),
    row: (dumpId: string) =>
      this.grafanaIframe()
        .getByTestId('table-tbody-tr')
        .filter({ has: this.page.getByTestId(`table-select-${dumpId}-field-container`) }),
    rowDetails: (dumpId: string) => this.builders.row(dumpId).getByTestId('show-row-details'),
    rowMenu: (dumpId: string) => this.builders.row(dumpId).getByTestId('dropdown-menu-toggle'),
    serviceName: (name: string) => this.grafanaIframe().getByText(name, { exact: true }),
  };
  buttons = {
    send: this.grafanaIframe().getByRole('button', { exact: true, name: 'Send' }),
  };
  elements = {
    modalHeader: this.grafanaIframe().getByTestId('modal-header'),
    sendToSupportHeading: this.grafanaIframe().getByRole('heading', { name: 'Send to Support' }),
  };
  inputs = {
    address: this.grafanaIframe().getByLabel('Address *'),
    directory: this.grafanaIframe().getByLabel('Directory'),
    name: this.grafanaIframe().getByLabel('Name *'),
    password: this.grafanaIframe().getByTestId('data-testid Password input field'),
  };
  messages = {
    sentToSupport: this.grafanaIframe().getByText('The message was send successfully!'),
  };
}
