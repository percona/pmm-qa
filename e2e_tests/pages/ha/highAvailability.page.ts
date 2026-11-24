import BasePage from '@pages/base.page';
import { Timeouts } from '@helpers/timeouts';

/** The "PMM HA" entry of the left navigation, rendered from `/v1/ha/nodes`. */
export default class HighAvailabilityPage extends BasePage {
  url = 'pmm-ui/help';
  builders = {};
  buttons = {
    // Expands without navigating; the item itself links to a child with no url.
    haNavItemToggle: this.page.getByTestId('navitem-high-availability-toggle'),
    overviewNavItem: this.page.getByTestId('navitem-high-availability-overview'),
  };
  elements = {
    badge: this.page.getByTestId('ha-badge'),
  };
  inputs = {};
  messages = {};

  /** Opens "PMM HA" -> "Overview", the only navigation route to the HA health dashboard. */
  openOverviewDashboard = async (): Promise<void> => {
    await this.buttons.haNavItemToggle.waitFor({ state: 'visible', timeout: Timeouts.TWO_MINUTES });

    if (!(await this.buttons.overviewNavItem.isVisible())) {
      await this.buttons.haNavItemToggle.click({ timeout: Timeouts.TEN_SECONDS });
    }

    await this.buttons.overviewNavItem.click({ timeout: Timeouts.TEN_SECONDS });
  };
}
