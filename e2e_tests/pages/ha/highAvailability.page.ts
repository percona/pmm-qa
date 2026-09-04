import BasePage from '@pages/base.page';
import { Timeouts } from '@helpers/timeouts';

/** The "PMM HA" entry of the left navigation, rendered from `/v1/ha/nodes`. */
export default class HighAvailabilityPage extends BasePage {
  url = 'pmm-ui/help';
  builders = {};
  buttons = {
    haNavItem: this.page.getByTestId('navitem-high-availability'),
    // Expands without navigating; the item itself links to a child with no url.
    haNavItemToggle: this.page.getByTestId('navitem-high-availability-toggle'),
    identifyNodes: this.page.getByTestId('navitem-high-availability-nodes'),
  };
  elements = {
    badge: this.page.getByTestId('ha-badge'),
    leaderNavItem: this.page.getByTestId('navitem-high-availability-leader-text-item'),
    leaderNodeName: this.page
      .getByTestId('navitem-high-availability-leader-text-item')
      .locator('[class*="MuiListItemText-secondary"]'),
  };
  inputs = {};
  messages = {};

  expandHaNavItem = async (): Promise<void> => {
    if (await this.elements.leaderNavItem.isVisible()) return;

    // The HA entry renders late while /v1/ha/nodes is failing over.
    await this.buttons.haNavItemToggle.waitFor({ state: 'visible', timeout: Timeouts.TWO_MINUTES });
    await this.buttons.haNavItemToggle.click({ timeout: Timeouts.TEN_SECONDS });
    await this.elements.leaderNavItem.waitFor({ state: 'visible', timeout: Timeouts.TEN_SECONDS });
  };

  getLeaderName = async (): Promise<string> => {
    await this.expandHaNavItem();

    return (await this.elements.leaderNodeName.innerText()).trim();
  };

  /**
   * Needed after a failover: the page was talking to the pod that was killed, so
   * its sidebar can be left holding a failed query instead of retrying.
   */
  reloadAndExpandHaNavItem = async (): Promise<void> => {
    await this.page.reload();
    await this.expandHaNavItem();
  };
}
