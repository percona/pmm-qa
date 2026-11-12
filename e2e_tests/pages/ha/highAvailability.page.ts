import BasePage from '@pages/base.page';

/** The "PMM HA" entry of the left navigation, rendered from `/v1/ha/nodes`. */
export default class HighAvailabilityPage extends BasePage {
  url = 'pmm-ui/help';
  builders = {};
  buttons = {};
  elements = {
    badge: this.page.getByTestId('ha-badge'),
  };
  inputs = {};
  messages = {};
}
