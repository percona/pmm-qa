import { APIRequestContext, expect } from '@playwright/test';
import GrafanaHelper from '@helpers/grafana.helper';
import { Timeouts } from '@helpers/timeouts';
import apiEndpoints from '@helpers/apiEndpoints';

interface PmmVersion {
  major: number;
  minor: number;
  patch: number;
  version: string;
}

interface VersionResponse {
  version: string;
}

export default class ServerApi {
  constructor(private request: APIRequestContext) {}

  getPmmVersion = async (): Promise<PmmVersion> => {
    const response = await this.request.get(apiEndpoints.server.version, {
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status()).toEqual(200);

    const data = (await response.json()) as VersionResponse;
    const [versionMajor, versionMinor, versionPatch] = data.version.split('.');

    return {
      major: parseInt(versionMajor),
      minor: parseInt(versionMinor),
      patch: parseInt(versionPatch),
      version: data.version,
    };
  };

  waitForReady = async (overallTimeoutMs: Timeouts = Timeouts.ONE_MINUTE): Promise<void> => {
    const pollIntervalMs = Timeouts.FIVE_SECONDS;
    const deadline = Date.now() + overallTimeoutMs;
    let lastError: unknown;

    while (Date.now() < deadline) {
      try {
        const res = await this.request.get(apiEndpoints.server.readyz, { ignoreHTTPSErrors: true });

        if (res.status() === 200) {
          return;
        }
      } catch (err) {
        lastError = err;
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(
      `PMM Server was not ready in expected timeout: ${overallTimeoutMs}ms (last error: ${lastError})`,
    );
  };
}
