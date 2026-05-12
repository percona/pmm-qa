import { GrafanaPanel } from '@interfaces/grafanaPanel';
import DashboardInterface from '@interfaces/dashboard';
import { Locator, Page } from '@playwright/test';
import BasePage from '@pages/base.page';

export default class HomeDashboard extends BasePage implements DashboardInterface {
  url = 'graph/d/pmm-home/home-dashboard';
  noDataMetrics: string[] = [];
  builders = {};
  buttons = {};
  elements: Record<string, Locator>;
  inputs = {};
  messages = {};

  constructor(protected page: Page) {
    super(page);
    this.elements = {
      headerLocator: this.grafanaIframe().locator('//header//span[contains(text(),"Home")]'),
    };
  }

  metrics = (): GrafanaPanel[] => [{ name: `Failed advisors`, type: 'text' }];

  metricsWithData = () => this.metrics().filter((metric) => !this.noDataMetrics.includes(metric.name));
}
