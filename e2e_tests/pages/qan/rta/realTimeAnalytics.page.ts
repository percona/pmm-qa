import BasePage from '@pages/base.page';

export default class RealTimeAnalyticsPage extends BasePage {
  readonly url = 'pmm-ui/rta/overview';
  builders = {
    operationIdForRow: (rowIndex: string) =>
      this.page.locator(`//tbody//tr[position()=${rowIndex}]//td[position()=3]`),
  };
  buttons = {
    pauseRealTimeAnalytics: this.page.getByTestId('overview-table-pause-button'),
    resumeRealTimeAnalytics: this.page.getByTestId('overview-table-resume-button'),
  };
  elements = {
    mongoDbQuery: this.page.locator('//*[@class="language-mongodb"]'),
  };
  inputs = {};
  messages = {};

  getUrlWithServices = (services: string[]) => {
    let parsedUrl = this.url;

    for (let i = 0; i < services.length; i++) {
      if (i === 0) {
        parsedUrl += `?serviceIds=${services[i]}`;
      } else {
        parsedUrl += `&serviceIds=${services[i]}`;
      }
    }

    return parsedUrl;
  };
}
