import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

pmmTest.beforeEach(async ({ grafanaHelper, page, updatesPage }) => {
  await grafanaHelper.authorize();
  await page.addLocatorHandler(updatesPage.buttons.remindMeLater, async () => {
    await updatesPage.buttons.remindMeLater.click();
  });
});

pmmTest(
  'PMM-T2900 - Verify Grafana in PMM Server does not report usage, check for plugin updates or use Gravatar avatars by default, and still lists plugins and their version history @settings',
  async ({ cliHelper, page, pluginsPage, serverAdminSettingsPage, usersPage }) => {
    await pmmTest.step(
      'Verify usage reporting, update checks, news, reports and Gravatar are off',
      async () => {
        await page.goto(serverAdminSettingsPage.url);
        await expect(serverAdminSettingsPage.elements.settingsTitle).toBeVisible({
          timeout: Timeouts.ONE_MINUTE,
        });

        for (const { key, section, value } of serverAdminSettingsPage.grafanaCallsHomeSettings) {
          await expect(
            serverAdminSettingsPage.builders.settingValue(section, key),
            `${section}.${key}`,
          ).toHaveText(value);
        }
      },
    );

    await pmmTest.step('Verify the admin user shows the default avatar', async () => {
      await page.goto(usersPage.url);
      await expect(usersPage.builders.avatar('admin')).toHaveAttribute('src', usersPage.defaultAvatarSrc, {
        timeout: Timeouts.ONE_MINUTE,
      });
    });

    await pmmTest.step(
      'Verify the plugin update checker and Angular pattern download never start',
      async () => {
        const startedModules = cliHelper.execute(
          `docker exec pmm-server grep -cE 'msg=starting module=\\*' /srv/logs/grafana.log`,
        );

        startedModules.assertSuccess();
        expect(Number(startedModules.stdout.trim())).toBeGreaterThan(0);
        cliHelper
          .execute(
            `docker exec pmm-server grep -E 'module=\\*(updatemanager\\.PluginsService|angulardetectorsprovider\\.Dynamic)' /srv/logs/grafana.log`,
          )
          .exitCodeEquals(1);
      },
    );

    await pmmTest.step('Verify ClickHouse is listed among installed plugins', async () => {
      await page.goto(pluginsPage.url);
      await expect(pluginsPage.elements.installedFilter).toBeChecked({ timeout: Timeouts.ONE_MINUTE });
      await expect(pluginsPage.builders.pluginCard(pluginsPage.clickHouse)).toBeVisible();
    });

    await pmmTest.step('Verify ClickHouse version history marks the installed version', async () => {
      await pluginsPage.builders.pluginCard(pluginsPage.clickHouse).click();
      await pluginsPage.buttons.versionHistoryTab.click();
      await expect(pluginsPage.elements.installedVersion).toHaveCount(1, {
        timeout: Timeouts.THIRTY_SECONDS,
      });
      await expect.poll(async () => await pluginsPage.elements.versions.count()).toBeGreaterThan(1);
    });
  },
);
