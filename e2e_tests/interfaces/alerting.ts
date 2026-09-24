export type AlertSeverity =
  | 'SEVERITY_ALERT'
  | 'SEVERITY_CRITICAL'
  | 'SEVERITY_DEBUG'
  | 'SEVERITY_EMERGENCY'
  | 'SEVERITY_ERROR'
  | 'SEVERITY_INFO'
  | 'SEVERITY_NOTICE'
  | 'SEVERITY_WARNING';

export interface AlertInstance {
  labels: Record<string, string>;
  state: string;
}

export interface AlertRule {
  alerts?: AlertInstance[];
  name: string;
  state: string;
}

export interface AlertRulesResponse {
  data: {
    groups: { folderUid: string; name: string; rules: AlertRule[] }[];
  };
}

export interface TemplatedAlertRule {
  folderUid: string;
  group: string;
  interval?: string;
  name: string;
  pendingPeriod: string;
  serviceName?: string;
  severity?: AlertSeverity;
  templateName: string;
  threshold: number;
}
