import { APIRequestContext, expect } from '@playwright/test';
import GrafanaHelper from '@helpers/grafana.helper';
import apiEndpoints from '@helpers/apiEndpoints';

interface SettingsResponse {
  settings: {
    backup_management_enabled: boolean;
    default_role_id?: number | string;
    enable_access_control: boolean;
  };
}

export default class SettingsApi {
  constructor(private request: APIRequestContext) {}

  enableAccessControl = async () => {
    const settings = await this.getSettings();

    if (settings.settings.enable_access_control === true) return;

    const response = await this.request.put(apiEndpoints.server.settings, {
      data: { enable_access_control: true },
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status()).toEqual(200);
  };

  enableBackupManagement = async () => {
    const settings = await this.getSettings();

    if (settings.settings.backup_management_enabled === true) return;

    const response = await this.request.put(apiEndpoints.server.settings, {
      data: { enable_backup_management: true },
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status()).toEqual(200);
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

    if (response.status() !== 400) return;

    const { message } = (await response.json()) as { message?: string };

    if (!message?.includes('Telemetry is configured via PMM_ENABLE_TELEMETRY')) return;

    delete body.enable_advisor;
    delete body.enable_telemetry;
    await this.request.put(apiEndpoints.server.settings, {
      data: body,
      headers: GrafanaHelper.getAuthHeader(),
    });
  };

  setPublicAddress = async (address: string): Promise<void> => {
    await this.request.put(apiEndpoints.server.settings, {
      data: { pmm_public_address: address },
      headers: GrafanaHelper.getAuthHeader(),
    });
  };
}
