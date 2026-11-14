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
  annotations?: Record<string, string>;
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

export interface AlertTemplate {
  condition?: string;
  expressions?: { expression: string; reducer?: string; ref_id: string; type: string }[];
  name: string;
  params?: {
    float?: { default: number; max: number; min: number };
    name: string;
    overridable?: boolean;
    type: string;
    unit: string;
  }[];
  queries?: { datasource: string; expr: string; ref_id: string }[];
  source: string;
  summary: string;
}

export interface ProvisionedAlertRule {
  data: {
    datasourceUid: string;
    model: {
      editorType?: string;
      expression?: string;
      intervalMs?: number;
      queryType?: string;
      rawSql?: string;
      reducer?: string;
      settings?: { mode?: string };
    };
    refId: string;
    relativeTimeRange?: { from: number; to: number };
  }[];
  folderUID: string;
  for: string;
  labels?: Record<string, string>;
  provenance?: string;
  ruleGroup: string;
  title: string;
}

export type RulerRulesResponse = Record<
  string,
  {
    name: string;
    rules: { grafana_alert: { namespace_uid: string; provenance?: string; title: string; uid: string } }[];
  }[]
>;

export interface AlertRuleFilter {
  label: string;
  regexp: string;
  type: 'FILTER_TYPE_MATCH' | 'FILTER_TYPE_MISMATCH';
}

export interface TemplatedAlertRule {
  filters?: AlertRuleFilter[];
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
