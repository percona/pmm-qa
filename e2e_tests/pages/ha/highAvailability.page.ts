import BasePage from '@pages/base.page';
import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { Locator } from '@playwright/test';

/**
 * The "PMM HA" entry of the left navigation: the health badge and the
 * "Leader:" row underneath it. Both are rendered from `/v1/ha/nodes`, which the
 * sidebar refetches every 15 seconds, so a failover shows up here without a
 * page reload.
 */
export default class HighAvailabilityPage extends BasePage {
  url = 'pmm-ui/help';
  builders = {};
  buttons = {
    haNavItem: this.page.getByTestId('navitem-high-availability'),
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

    await this.buttons.haNavItem.click({ timeout: Timeouts.TEN_SECONDS });
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

  /**
   * Locator resolving to the leader name, for polling assertions that have to
   * wait out a failover.
   */
  leaderNameLocator = (): Locator => this.elements.leaderNodeName;
}
