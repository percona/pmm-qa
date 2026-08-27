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
    groups: { rules: AlertRule[] }[];
  };
}

export interface TemplatedAlertRule {
  folderUid: string;
  group: string;
  name: string;
  pendingPeriod: string;
  templateName: string;
  threshold: number;
}
