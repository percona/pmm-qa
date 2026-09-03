import { APIRequestContext, expect } from '@playwright/test';
import GrafanaHelper from '@helpers/grafana.helper';
import { Timeouts } from '@helpers/timeouts';
import apiEndpoints from '@helpers/apiEndpoints';

// Only the methods PMM ships. The API can also emit OVF, AZURE and DO
// (managed/utils/distribution/distribution_util.go), but no such build exists to test.
export type DistributionMethod =
  'DISTRIBUTION_METHOD_AMI' | 'DISTRIBUTION_METHOD_DOCKER' | 'DISTRIBUTION_METHOD_UNSPECIFIED';

export interface PmmVersion {
  major: number;
  minor: number;
  patch: number;
  version: string;
}

interface VersionResponse {
  distribution_method?: DistributionMethod;
  version: string;
}

export default class ServerApi {
  constructor(private request: APIRequestContext) {}

  getDistributionMethod = async (): Promise<DistributionMethod | undefined> => {
    const response = await this.request.get(apiEndpoints.server.version, {
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status()).toEqual(200);

    return ((await response.json()) as VersionResponse).distribution_method;
  };

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
