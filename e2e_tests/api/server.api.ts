import { APIRequestContext, expect } from '@playwright/test';
import GrafanaHelper from '@helpers/grafana.helper';
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
      major: Number.parseInt(versionMajor, 10),
      minor: Number.parseInt(versionMinor, 10),
      patch: Number.parseInt(versionPatch, 10),
      version: data.version,
    };
  };
}
