import BasePage from '@pages/base.page';

export default class DumpPage extends BasePage {
  url = '/pmm-ui/pmm-dump';
  newUrl = '/pmm-ui/pmm-dump/new';
  builders = {
    menuItem: (name: string) => this.page.getByRole('menuitem', { name }),
    row: (dumpId: string) => this.page.getByTestId(`dump-row-${dumpId}`),
    rowDetails: (dumpId: string) => this.builders.row(dumpId).getByRole('button', { name: 'Expand' }),
    rowMenu: (dumpId: string) => this.builders.row(dumpId).getByRole('button', { name: 'Row Actions' }),
    serviceName: (name: string) => this.page.getByText(name, { exact: true }),
  };
  buttons = {
    createDataset: this.page.getByTestId('create-dataset'),
    send: this.page
      .getByTestId('dump-send-to-support-dialog')
      .getByRole('button', { exact: true, name: 'Send' }),
    submitDataset: this.page.getByTestId('create-dataset-submit-button'),
  };
  elements = {
    logsDialog: this.page.getByTestId('dump-logs-modal'),
    sendToSupportHeading: this.page.getByRole('heading', { name: 'Send to Support' }),
  };
  inputs = {
    address: this.page.getByTestId('dump-support-address'),
    directory: this.page.getByTestId('dump-support-directory'),
    name: this.page.getByTestId('dump-support-user'),
    password: this.page.getByTestId('dump-support-password'),
  };
  messages = {
    sentToSupport: this.page.getByText('Datasets were sent to Support.'),
  };
}
