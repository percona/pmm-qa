export interface SettingsResponse {
  settings: {
    advisor_enabled: boolean;
    azurediscover_enabled: boolean;
    backup_management_enabled: boolean;
    data_retention: string;
    default_role_id?: number | string;
    enable_access_control: boolean;
    pmm_public_address: string;
    // Omitted from the JSON when false.
    telemetry_enabled?: boolean;
    telemetry_summaries: string[];
    updates_enabled: boolean;
  };
}
