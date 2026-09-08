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

  restoreSettingsDefaults = async (): Promise<void> => {
    const body: Record<string, unknown> = {
      data_retention: '2592000s',
      enable_advisor: true,
      enable_alerting: true,
      enable_telemetry: true,
      metrics_resolutions: { hr: '5s', lr: '60s', mr: '10s' },
      remove_alert_manager_rules: true,
      remove_alert_manager_url: true,
      remove_email_alerting_settings: true,
      remove_slack_alerting_settings: true,
    };
    const response = await this.request.put(apiEndpoints.server.settings, {
      data: body,
      headers: GrafanaHelper.getAuthHeader(),
    });

    if (response.status() !== 400) {
      expect(response.status()).toEqual(200);

      return;
    }

    const { message } = (await response.json()) as { message?: string };

    expect(message, 'Unexpected 400 from the settings restore').toContain(
      'Telemetry is configured via PMM_ENABLE_TELEMETRY',
    );

    delete body.enable_advisor;
    delete body.enable_telemetry;

    const retry = await this.request.put(apiEndpoints.server.settings, {
      data: body,
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(retry.status()).toEqual(200);
  };

  setPublicAddress = async (address: string): Promise<void> =>
    await this.updateSettings({ pmm_public_address: address });

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
