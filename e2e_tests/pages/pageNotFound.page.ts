import BasePage from '@pages/base.page';

export default class PageNotFoundPage extends BasePage {
  url = '/pmm-ui/does-not-exist';
  documentTitle = 'Page not found - Percona Monitoring and Management';
  homeUrl = /\/pmm-ui\/graph\/d\/pmm-home/;
  unknownUrls = [
    '/pmm-ui/does-not-exist',
    '/pmm-ui/feed?tab=1',
    '/pmm-ui/inventory/does-not-exist',
    '/pmm-ui/rta/does-not-exist',
    '/pmm-ui/next/does-not-exist',
  ];
  builders = {};
  buttons = {
    goBack: this.page.getByTestId('not-found-back-button'),
    goHome: this.page.getByTestId('not-found-home-button'),
  };
  elements = {
    footer: this.page.getByTestId('pmm-footer'),
    heading: this.page.getByRole('heading', { level: 1, name: 'Page not found' }),
  };
  inputs = {};
  messages = {
    description: this.page.getByText(
      'The link or bookmark you used may be out of date. Use the sidebar to find what you need.',
    ),
  };

  // page.goto() starts React Router's history at index 0, which hides "Go back";
  // pushing the entry from inside the app is what a client-side navigation does.
  navigateInApp = async (path: string) => {
    await this.page.evaluate((target) => {
      window.history.pushState(
        { idx: (window.history.state?.idx ?? 0) + 1, key: 'pmm-qa', usr: null },
        '',
        target,
      );
      window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
    }, path);
  };
}
