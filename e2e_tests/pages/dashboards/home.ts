import { GrafanaPanel } from '@interfaces/grafanaPanel';
import DashboardInterface from '@interfaces/dashboard';
import { Locator, Page } from '@playwright/test';

export default class HomeDashboard implements DashboardInterface {
  url = 'graph/d/pmm-home/home-dashboard';
  noDataMetrics: string[] = [];
  elements: Record<string, Locator>;

  constructor(protected page: Page) {
    this.elements = {
      headerLocator: this.page.locator('//header//span[contains(text(),"Home")]'),
    };
  }

  metrics = (): GrafanaPanel[] => [{ name: `Failed advisors`, type: 'text' }];

  metricsWithData = () => this.metrics().filter((metric) => !this.noDataMetrics.includes(metric.name));
}
