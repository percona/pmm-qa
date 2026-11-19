import { test as base, expect } from '@playwright/test';
import { getPmmAdminVersion } from '@helpers/pmm-admin';
import { minPmmClientVersion, versionBelow } from '@helpers/versionGates';

export const test = base.extend<{ pmmClientContainer: string; versionGate: void }>({
  // Container whose pmm-admin the spec drives; empty means the host's pmm-admin.
  pmmClientContainer: ['', { option: true }],
  versionGate: [
    async ({ pmmClientContainer }, use, testInfo) => {
      const testId = testInfo.title.match(/PMM-T\d+/)?.[0];
      const minVersion = testId ? minPmmClientVersion[testId] : undefined;

      if (minVersion) {
        const version = await getPmmAdminVersion(pmmClientContainer);

        testInfo.skip(versionBelow(version, minVersion), `Requires pmm-client ${minVersion}+`);
      }

      await use(undefined);
    },
    { auto: true },
  ],
});

/**
 * Skip the tests of the enclosing describe on a pmm-client that has no "pmm-admin update"; call it from the describe's beforeAll
 *
 * @param   containerName   docker container running pmm-agent; empty for the host's pmm-admin
 */
export async function skipWithoutUpdateCommand(containerName: string) {
  test.skip(versionBelow(await getPmmAdminVersion(containerName), '3.11.0'), 'Requires pmm-client 3.11.0+');
}

export { expect };
