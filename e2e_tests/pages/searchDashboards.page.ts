import BasePage from '@pages/base.page';

export default class SearchDashboardsPage extends BasePage {
  url = 'graph/dashboards';
  builders = {
    collapseFolderButton: (folderName: string) =>
      this.grafanaIframe().getByRole('button', { name: `Collapse folder ${folderName}` }),
    // Grafana gives a folder row and a dashboard row the same test id; only a dashboard row carries icon-apps.
    dashboardRow: (dashboardName: string) =>
      this.grafanaIframe()
        .getByTestId(`data-testid browse dashboards row ${dashboardName}`)
        .filter({ has: this.page.getByTestId('icon-apps') }),
    expandFolderButton: (folderName: string) =>
      this.grafanaIframe().getByRole('button', { name: `Expand folder ${folderName}` }),
  };
  buttons = {};
  elements = {
    rows: this.grafanaIframe().getByTestId(/^data-testid browse dashboards row /),
  };
  inputs = {
    search: this.grafanaIframe().getByRole('textbox', { name: 'Search for dashboards and folders' }),
  };
  messages = {};
}
