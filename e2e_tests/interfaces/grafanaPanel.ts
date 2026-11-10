export type GrafanaPanelType =
  | 'timeSeries'
  | 'table'
  | 'text'
  | 'stat'
  | 'gauge'
  | 'polyStat'
  | 'barGauge'
  | 'pie'
  | 'custom'
  | 'barTime'
  | 'stateTime'
  | 'singleStateTime'
  | 'summary'
  | 'unknown'
  | 'empty';

export interface GrafanaFieldConfig {
  defaults: { unit?: string };
  overrides: {
    matcher: { id: string; options: string };
    properties: { id: string; value: unknown }[];
  }[];
}

export interface GrafanaPanel {
  name: string;
  type: GrafanaPanelType;
}
