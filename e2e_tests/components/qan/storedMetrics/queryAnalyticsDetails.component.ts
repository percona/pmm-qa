import BasePage from '../../../pages/base.page';

export default class QueryAnalyticsDetails extends BasePage {
  builders = {};
  buttons = {
    explainTab: this.grafanaIframe().getByTestId('data-testid Tab Explain'),
  };
  elements = {
    explainNoData: this.grafanaIframe().getByTestId('classic-explain-no-data'),
  };
  inputs = {};
  messages = {
    explainNoData: 'No classic explain found',
  };
}
