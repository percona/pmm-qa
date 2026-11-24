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

export { expect };

/**
 * Skips the calling describe group before its setup runs when the pmm-client of containerName is older than minVersion.
 * Call it from the group's beforeAll: unlike a skip from versionGate, no beforeEach or afterEach hook then runs.
 *
 * @param   containerName   docker container running pmm-agent; empty for the pmm-admin of the host
 * @param   minVersion      first pmm-client version the group can run against
 */
export const requirePmmClient = async (containerName: string, minVersion: string) => {
  const version = await getPmmAdminVersion(containerName);

  test.skip(versionBelow(version, minVersion), `Requires pmm-client ${minVersion}+`);
};
