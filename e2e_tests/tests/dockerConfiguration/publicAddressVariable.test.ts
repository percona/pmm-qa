import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

const containerName = 'pmm-server-public-address';
const baseUrl = 'https://127.0.0.1:455/';
const runArgs = (publicAddress: string) =>
  `--restart always -e PMM_ENABLE_TELEMETRY=0 -e PMM_ENABLE_INTERNAL_PG_QAN=1 -e PMM_PUBLIC_ADDRESS=${publicAddress} --publish 455:8443 ${process.env.DOCKER_VERSION || 'perconalab/pmm-server:3-dev-latest'}`;

pmmTest.describe('Tests for PMM_PUBLIC_ADDRESS environment variable', () => {
  pmmTest.describe.configure({ mode: 'default' });
  pmmTest.use({ baseURL: baseUrl });

  pmmTest.afterEach(async ({ cliHelper }) => {
    cliHelper.removeContainer(containerName);
  });

  for (const publicAddress of [
    '127.0.0.1',
    '127.0.0.1:8443',
    'ec2-18-188-74-98.us-east-2.compute.amazonaws.com',
    'ec2-18-188-74-98.us-east-2.compute.amazonaws.com:8443',
  ]) {
    pmmTest(
      `PMM-T1173 + PMM-T1174 - Verify PMM_PUBLIC_ADDRESS env variable with IP @docker-configuration | ${publicAddress}`,
      async ({ api, dockerHelper, grafanaHelper, page, settingsPage }) => {
        await pmmTest.step('Start PMM Server with the public address variable', async () => {
          dockerHelper.startContainer(containerName, runArgs(publicAddress));
          await api.serverApi.waitForReady(Timeouts.TWO_MINUTES);
          await grafanaHelper.authorize('admin', 'admin', baseUrl);
        });

        await page.goto(settingsPage.urls.advanced);
        await expect(settingsPage.inputs.publicAddress).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
        await expect(settingsPage.inputs.publicAddress).toHaveValue(publicAddress);
      },
    );
  }

  pmmTest(
    'PMM-T1177 - Verify PMM_PUBLIC_ADDRESS env variable can be updated @docker-configuration',
    async ({ api, dockerHelper, grafanaHelper, page, settingsPage }) => {
      await pmmTest.step('Start PMM Server with the public address variable', async () => {
        dockerHelper.startContainer(containerName, runArgs('127.0.0.5'));
        await api.serverApi.waitForReady(Timeouts.TWO_MINUTES);
        await grafanaHelper.authorize('admin', 'admin', baseUrl);
      });

      await page.goto(settingsPage.urls.advanced);
      await expect(settingsPage.inputs.publicAddress).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });

      await pmmTest.step('Clear the public address', async () => {
        await settingsPage.inputs.publicAddress.clear();
        await settingsPage.applyAdvancedChanges();
        await expect(settingsPage.messages.settingsUpdated).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
        await expect(settingsPage.messages.settingsUpdated).toBeHidden({ timeout: Timeouts.TEN_SECONDS });
      });

      await pmmTest.step('Set a new public address', async () => {
        await settingsPage.inputs.publicAddress.fill('127.0.0.1');
        await settingsPage.applyAdvancedChanges();
        await expect(settingsPage.messages.settingsUpdated).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
      });

      await pmmTest.step('Verify the saved public address after a reload', async () => {
        await expect(async () => {
          await page.reload();
          await expect(settingsPage.inputs.publicAddress).toHaveValue('127.0.0.1', {
            timeout: Timeouts.TEN_SECONDS,
          });
        }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.TWO_MINUTES });
      });
    },
  );
});
