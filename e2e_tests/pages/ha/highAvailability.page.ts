import BasePage from '@pages/base.page';
import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { Locator } from '@playwright/test';

/**
 * The "PMM HA" entry of the left navigation: the health badge and the "Leader:"
 * row underneath it, both rendered from `/v1/ha/nodes`.
 */
export default class HighAvailabilityPage extends BasePage {
  url = 'pmm-ui/help';
  builders = {};
  buttons = {
    haNavItem: this.page.getByTestId('navitem-high-availability'),
    // Expands without navigating: the item itself links to its first child, the
    // "Leader:" row, which has no url.
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

  /**
   * Name of the node the badge currently reports as the Raft leader. Matches
   * the `node_id` label of `pmm_ha_leader_status`.
   */
  getLeaderName = async (): Promise<string> =>
    await pmmTest.step('Read the current leader from the HA badge', async () => {
      await this.expandHaNavItem();

      return (await this.elements.leaderNodeName.innerText()).trim();
    });

  /** Leader name as a locator, for assertions that have to wait out a failover. */
  leaderNameLocator = (): Locator => this.elements.leaderNodeName;

  /**
   * Needed after a failover: the page was talking to the pod that was killed, so
   * its sidebar can be left holding a failed query instead of retrying.
   */
  reloadAndExpandHaNavItem = async (): Promise<void> => {
    await this.page.reload();
    await this.expandHaNavItem();
  };
}
