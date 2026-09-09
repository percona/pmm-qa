import BasePage from '@pages/base.page';
import { Timeouts } from '@helpers/timeouts';

export default class StatsAndLicensePage extends BasePage {
  url = 'graph/admin/upgrading';
  enterpriseAdvertising = [
    'Enterprise license',
    'Grafana Enterprise',
    'Get your free trial',
    'Data source permissions',
    'Reporting',
    'SAML authentication',
    'Team Sync',
    'White labeling',
    'Auditing',
    'Grafana usage insights',
    'Sort dashboards by popularity in search',
    'Find unused dashboards',
    'Dashboard usage stats drawer',
    'Enterprise plugins',
    'Oracle',
    'Splunk',
    'Service Now',
    'Dynatrace',
    'New Relic',
    'DataDog',
    'AppDynamics',
    'SAP HANA®',
    'Honeycomb',
    'Jira',
    'Salesforce',
    'Snowflake',
    'Wavefront',
    'At your service',
    'Unlimited Expert Support',
    'Email',
    'Private Slack channel',
    'Phone',
    'Hand-in-hand support',
    'in the upgrade process',
    'Also included:',
    'Indemnification, working with Grafana Labs on future prioritization, and training from the core Grafana team.',
    'You can use the trial version for free for 30 days. We will remind you about it five days before the trial period ends.',
    'Contact us and get a free trial',
  ];
  builders = {
    advertisement: (text: string) => this.grafanaIframe().getByText(text),
  };
  buttons = {
    manageAlerts: this.grafanaIframe().getByRole('link', { name: 'Manage alerts' }),
    manageDashboards: this.grafanaIframe().getByRole('link', { name: 'Manage dashboards' }),
    manageDataSources: this.grafanaIframe().getByRole('link', { name: 'Manage data sources' }),
    manageUsers: this.grafanaIframe().getByRole('link', { name: 'Manage users' }),
  };
  elements = {
    manageDashboardsLabel: this.grafanaIframe().getByText('Manage dashboards'),
  };
  inputs = {};
  messages = {};

  waitForPageLoaded = async (): Promise<void> => {
    for (const button of Object.values(this.buttons)) {
      await button.waitFor({ state: 'visible', timeout: Timeouts.THIRTY_SECONDS });
    }
  };
}
