import { test as base, expect } from '@playwright/test';
import { getPmmAdminVersion } from '@helpers/pmm-admin';
import { minPmmClientVersion, versionBelow } from '@helpers/versionGates';

const clientVersions = new Map<string, Promise<string>>();

// One lookup per container per worker. A failed lookup is not cached, otherwise one transient
// error would fail every gated test in the worker.
const getClientVersion = (container: string): Promise<string> => {
  let version = clientVersions.get(container);
  if (!version) {
    version = getPmmAdminVersion(container).catch((error: unknown) => {
      clientVersions.delete(container);

      throw error;
    });
    clientVersions.set(container, version);
  }

  return version;
};

export const test = base.extend<{ pmmClientContainer: string; versionGate: void }>({
  // Container whose pmm-admin the spec drives; empty means the host's pmm-admin.
  pmmClientContainer: ['', { option: true }],
  // An auto fixture rather than a beforeEach, so every spec importing this test is gated.
  versionGate: [
    async ({ pmmClientContainer }, use, testInfo) => {
      const testId = testInfo.title.match(/PMM-T\d+/)?.[0];
      const minVersion = testId ? minPmmClientVersion[testId] : undefined;

      if (minVersion) {
        const version = await getClientVersion(pmmClientContainer);

        testInfo.skip(versionBelow(version, minVersion), `Requires pmm-client ${minVersion}+`);
      }

      await use(undefined);
    },
    { auto: true },
  ],
});

export { expect };
