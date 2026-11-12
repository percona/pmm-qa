import BasePage from '@pages/base.page';
import pmmTest from '@fixtures/pmmTest';

export default class AmazonRdsPage extends BasePage {
  url = '/pmm-ui/amazon-rds';
  auroraDetailsUrl = '/pmm-ui/graph/d/mysql-amazonaurora/mysql-amazon-aurora-details';
  texts = {
    auroraCluster: 'Aurora cluster',
    auroraMysql: 'Aurora MySQL',
    oneGroupShown: /^1 of \d+ groups$/,
    oneInstanceConnected: '1 / 1',
    oneWriter: '1 writer',
    up: 'Up',
    writer: 'writer',
  };
  builders = {
    expandGroupButton: (identifier: string) =>
      this.page.getByRole('button', { exact: true, name: `Expand ${identifier}` }),
    // An expanded group's detail row is named after the group too, through its nested table.
    // A group cell can hold two values (Type over Engine), so a value is matched by its own text.
    groupValue: (identifier: string, text: string) =>
      this.page
        .getByRole('row')
        .filter({ has: this.page.getByRole('cell', { exact: true, name: identifier }) })
        .filter({ hasNot: this.page.getByRole('table') })
        .getByText(text, { exact: true }),
    instanceCell: (identifier: string, serviceName: string, text: string) =>
      this.builders
        .instancesTable(identifier)
        .getByRole('row')
        .filter({ has: this.page.getByRole('link', { exact: true, name: serviceName }) })
        .getByRole('cell', { exact: true, name: text }),
    instancesTable: (identifier: string) => this.page.getByRole('table', { exact: true, name: identifier }),
    serviceLink: (identifier: string, serviceName: string) =>
      this.builders.instancesTable(identifier).getByRole('link', { exact: true, name: serviceName }),
  };
  buttons = {};
  elements = {
    groupCount: this.page.getByText(/^\d+ of \d+ groups$/),
  };
  inputs = {};
  messages = {};

  openGroup = async (identifier: string) =>
    await pmmTest.step(`Open the ${identifier} group`, async () => {
      await this.page.goto(`${this.url}?${new URLSearchParams({ 'rds-id': identifier })}`);
      await this.builders.expandGroupButton(identifier).click();
    });
}
