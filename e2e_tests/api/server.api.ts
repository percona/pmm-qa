import AdmZip from 'adm-zip';
import { APIRequestContext, expect } from '@playwright/test';
import GrafanaHelper from '@helpers/grafana.helper';
import { Timeouts } from '@helpers/timeouts';
import apiEndpoints from '@helpers/apiEndpoints';

export interface PmmVersion {
  major: number;
  minor: number;
  patch: number;
  version: string;
}

interface VersionResponse {
  version: string;
}

interface ServerVersionResponse {
  distribution_method: string;
}

export default class ServerApi {
  constructor(private request: APIRequestContext) {}

  getDistributionMethod = async (): Promise<string> => {
    const response = await this.request.get(apiEndpoints.server.serverVersion, {
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status()).toEqual(200);

    return ((await response.json()) as ServerVersionResponse).distribution_method;
  };

  /** One log file from the PMM Server logs archive, the same one the Help menu downloads. */
  getLog = async (fileName: string): Promise<string> => {
    const response = await this.request.get(apiEndpoints.server.logs, {
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status(), `Download of ${apiEndpoints.server.logs}`).toEqual(200);

    const entry = new AdmZip(await response.body()).getEntry(fileName);

    if (!entry) throw new Error(`${fileName} is not in ${apiEndpoints.server.logs}`);

    return entry.getData().toString('utf8');
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

  getWithoutRedirect = async (path: string, secFetchDest?: 'document' | 'iframe') =>
    this.request.get(path, {
      headers: secFetchDest ? { 'Sec-Fetch-Dest': secFetchDest } : {},
      maxRedirects: 0,
    });

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
