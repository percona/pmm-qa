import BasePage from '@pages/base.page';

export default class AddInstancePage extends BasePage {
  url = 'graph/add-instance?orgId=1';
  builders = {};
  buttons = {
    azure: this.grafanaIframe().getByTestId('azure-instance'),
    mysql: this.grafanaIframe().getByTestId('mysql-instance'),
  };
  elements = {};
  inputs = {};
  messages = {};
}
