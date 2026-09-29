export enum AlertSeverity {
  Critical = 'SEVERITY_CRITICAL',
  Error = 'SEVERITY_ERROR',
  Notice = 'SEVERITY_NOTICE',
  Warning = 'SEVERITY_WARNING',
  Alert = 'SEVERITY_ALERT',
  Info = 'SEVERITY_INFO',
  Debug = 'SEVERITY_DEBUG',
  Emergency = 'SEVERITY_EMERGENCY',
}

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
