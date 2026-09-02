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

interface SettingsBody {
  data_retention?: string;
  pmm_public_address?: string;
  enable_telemetry?: boolean;
  enable_updates?: boolean;
  enable_alerting?: boolean;
  enable_backup_management?: boolean;
  enable_internal_pg_qan?: boolean;
  enable_advisor?: boolean;
  advisor_run_intervals?: {
    rare_interval: string;
    standard_interval: string;
    frequent_interval: string;
  };
  enable_azurediscover?: boolean;
  enable_access_control?: boolean;
}

export default class SettingsApi {
  constructor(private request: APIRequestContext) {}

  changeSettings = async (body: SettingsBody) => {
    const response = await this.request.put(apiEndpoints.server.settings, {
      data: body,
      headers: GrafanaHelper.getAuthHeader(),
    });

    expect(response.status()).toEqual(200);

    return (await response.json()) as SettingsResponse;
  };

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
}
