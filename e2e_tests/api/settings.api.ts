import { APIRequestContext, expect } from '@playwright/test';
import GrafanaHelper from '@helpers/grafana.helper';
import apiEndpoints from '@helpers/apiEndpoints';

interface SettingsResponse {
  settings: {
    backup_management_enabled: boolean;
    data_retention: string;
    default_role_id?: number | string;
    enable_access_control: boolean;
    pmm_public_address: string;
  };
}

export default class SettingsApi {
  constructor(private request: APIRequestContext) {}

  enableAccessControl = async () => {
    const settings = await this.getSettings();

    if (settings.settings.enable_access_control === true) return;

    await this.updateSettings({ enable_access_control: true });
  };

  enableBackupManagement = async () => {
    const settings = await this.getSettings();

    if (settings.settings.backup_management_enabled === true) return;

    await this.updateSettings({ enable_backup_management: true });
  };

  getSettings = async () => {
    const response = await this.request.get(apiEndpoints.server.settings, {
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status()).toEqual(200);

    return (await response.json()) as SettingsResponse;
  };

  /** Only the keys passed are changed; used to put a shared cluster back as it was found. */
  updateSettings = async (data: Record<string, unknown>) => {
    const response = await this.request.put(apiEndpoints.server.settings, {
      data,
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(
      response.status(),
      `Update settings API call returned status code: ${response.status()} (${response.statusText()})`,
    ).toEqual(200);
  };
}
